#!/usr/bin/env python3
"""
Developer Profile Analyzer — QA Benchmark Suite
================================================
Tests 4 Next.js implementations against a shared contract.

Usage:
    python run_benchmark.py

Output:
    whatwedo/benchmark/results.json
    whatwedo/benchmark/REPORT.md

Rules:
    - NEVER writes inside abacusai/, antigravity/, claude/, codex/
    - All output goes to benchmark/ only
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

# ─── Dependency bootstrap ─────────────────────────────────────────────────────

def ensure_deps() -> None:
    """Install httpx and rich if missing (silent)."""
    for pkg in ("httpx", "rich"):
        try:
            __import__(pkg)
        except ImportError:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", pkg, "--break-system-packages", "-q"],
                check=True,
                capture_output=True,
            )

ensure_deps()

import httpx  # noqa: E402
from rich import box  # noqa: E402
from rich.console import Console  # noqa: E402
from rich.panel import Panel  # noqa: E402
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn  # noqa: E402
from rich.table import Table  # noqa: E402

# ─── Constants ────────────────────────────────────────────────────────────────

IS_WINDOWS = platform.system() == "Windows"
NPM        = "npm.cmd" if IS_WINDOWS else "npm"
NODE       = "node.exe" if IS_WINDOWS else "node"

SCRIPT_DIR = Path(__file__).resolve().parent   # whatwedo/
BENCH_DIR  = SCRIPT_DIR / "benchmark"

MODELS: list[dict[str, Any]] = [
    {
        "name":    "abacusai",
        "dir":     SCRIPT_DIR / "abacusai",
        "port":    3001,
        # Response layout hints for this implementation
        "layout": {
            "profile_key":   None,          # profile data split across user + normalized
            "user_key":      "user",        # raw GitHub user object
            "normalized_key":"normalized",  # normalized profile object
            "scores_key":    "scores",
            "insights_key":  "insights",
            "languages_path":["normalized", "topLanguages"],
            "engineering_path": ["normalized"],
        },
    },
    {
        "name":    "antigravity",
        "dir":     SCRIPT_DIR / "antigravity",
        "port":    3002,
        "layout": {
            "profile_key":   "profile",     # NormalizedProfile
            "user_key":      "user",         # GitHubUser (name, avatar_url, etc.)
            "normalized_key": "profile",
            "scores_key":    "scores",
            "insights_key":  "insights",
            "languages_path":["profile", "topLanguages"],
            "engineering_path": ["profile"],
        },
    },
    {
        "name":    "claude",
        "dir":     SCRIPT_DIR / "claude" / "dev-profile-analyzer",
        "port":    3003,
        "layout": {
            "profile_key":   "profile",     # Rich NormalizedProfile (has all fields)
            "user_key":      "profile",
            "normalized_key":"profile",
            "scores_key":    "scores",
            "insights_key":  "insights",
            "languages_path":["profile", "topLanguages"],
            "engineering_path": ["profile"],
        },
    },
    {
        "name":    "codex",
        "dir":     SCRIPT_DIR / "codex",
        "port":    3004,
        "layout": {
            "profile_key":   "profile",     # GitHubProfileSummary
            "user_key":      "profile",
            "normalized_key":"normalized",  # NormalizedProfile
            "scores_key":    "scores",
            "insights_key":  "insights",
            "languages_path":["normalized", "topLanguages"],
            "engineering_path": ["normalized"],
        },
    },
]

REAL_USERNAME = "torvalds"
FAKE_USERNAME = "this_user_does_not_exist_xyz_99999"
SERVER_STARTUP_TIMEOUT = 60   # seconds
REQUEST_TIMEOUT        = 90   # seconds (GitHub API can be slow)

MOCK_STRINGS = [
    "john doe", "johndoe", "https://github.com/github.png",
    "jane doe", "janedoe", "mock_user", "testuser",
]

SCORE_KEYS = ["backend", "frontend", "devops", "testing", "consistency", "projectDepth", "overallScore"]

console = Console()

# ─── Helpers ─────────────────────────────────────────────────────────────────

def deep_get(obj: Any, *keys: str) -> Any:
    """Safe nested dict access: deep_get(d, 'a', 'b') → d['a']['b']."""
    for k in keys:
        if not isinstance(obj, dict):
            return None
        obj = obj.get(k)
    return obj


def find_in_response(data: dict, *candidate_paths: list[str]) -> Any:
    """Try multiple key paths and return the first non-None result."""
    for path in candidate_paths:
        v = deep_get(data, *path)
        if v is not None:
            return v
    return None


def json_contains_mock(obj: Any) -> tuple[bool, str]:
    """Recursively search JSON for hardcoded mock strings."""
    text = json.dumps(obj).lower()
    for mock in MOCK_STRINGS:
        if mock.lower() in text:
            return True, mock
    return False, ""


def resolve_field(data: dict, *paths: list[str]) -> Any:
    """Return first non-None value from multiple candidate key-paths."""
    for path in paths:
        v = data
        for k in path:
            if not isinstance(v, dict):
                v = None
                break
            v = v.get(k)
        if v is not None:
            return v
    return None

# ─── Build Integrity ──────────────────────────────────────────────────────────

def run_build(model: dict) -> dict:
    """Run npm install + npm run build in the project directory."""
    result: dict[str, Any] = {
        "install": {"status": "skip", "error": None},
        "build":   {"status": "skip", "error": None},
        "passed":  False,
    }

    cwd = str(model["dir"])

    # npm install
    try:
        proc = subprocess.run(
            [NPM, "install", "--prefer-offline"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=180,
        )
        if proc.returncode == 0:
            result["install"]["status"] = "pass"
        else:
            result["install"]["status"] = "fail"
            result["install"]["error"] = (proc.stderr or proc.stdout)[-800:]
            return result
    except subprocess.TimeoutExpired:
        result["install"]["status"] = "fail"
        result["install"]["error"] = "npm install timed out after 180 s"
        return result
    except Exception as exc:
        result["install"]["status"] = "fail"
        result["install"]["error"] = str(exc)
        return result

    # npm run build
    try:
        proc = subprocess.run(
            [NPM, "run", "build"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=300,
            env={**os.environ, "NODE_ENV": "production"},
        )
        if proc.returncode == 0:
            result["build"]["status"] = "pass"
            result["passed"] = True
        else:
            result["build"]["status"] = "fail"
            result["build"]["error"] = (proc.stderr or proc.stdout)[-1200:]
    except subprocess.TimeoutExpired:
        result["build"]["status"] = "fail"
        result["build"]["error"] = "npm run build timed out after 300 s"
    except Exception as exc:
        result["build"]["status"] = "fail"
        result["build"]["error"] = str(exc)

    return result

# ─── Server lifecycle ─────────────────────────────────────────────────────────

def start_server(model: dict) -> subprocess.Popen | None:
    """
    Start `next dev` on the assigned port.
    Returns the Popen handle, or None if startup failed.
    """
    port = model["port"]
    cwd  = str(model["dir"])
    env  = {**os.environ, "PORT": str(port), "NODE_ENV": "development"}

    cmd = [NPM, "run", "dev", "--", "-p", str(port)]

    try:
        # On Windows we need CREATE_NEW_PROCESS_GROUP so we can kill the tree.
        kwargs: dict = dict(
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        if IS_WINDOWS:
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True

        proc = subprocess.Popen(cmd, **kwargs)
    except Exception as exc:
        console.print(f"  [red]✗ Failed to launch server: {exc}[/red]")
        return None

    # Wait for "Ready" signal in stdout
    deadline = time.time() + SERVER_STARTUP_TIMEOUT
    ready_markers = ("ready", "started server", "listening on", f":{port}")

    while time.time() < deadline:
        if proc.poll() is not None:
            console.print(f"  [red]✗ Server process exited early (code {proc.returncode})[/red]")
            return None
        try:
            line = proc.stdout.readline()
            if not line:
                time.sleep(0.1)
                continue
            line_l = line.lower().strip()
            if any(m in line_l for m in ready_markers):
                time.sleep(1.0)  # small grace period
                return proc
        except Exception:
            time.sleep(0.1)

    console.print(f"  [red]✗ Server did not become ready within {SERVER_STARTUP_TIMEOUT}s[/red]")
    stop_server(proc, model["port"])
    return None


def stop_server(proc: subprocess.Popen, port: int) -> None:
    """Terminate the server and release the port."""
    if proc is None:
        return
    try:
        if IS_WINDOWS:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                capture_output=True,
                timeout=10,
            )
        else:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except Exception:
        pass
    try:
        proc.wait(timeout=10)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass

    # Give the OS a moment to release the port
    time.sleep(1.5)

    # Force-kill anything still holding the port (best-effort)
    _force_free_port(port)


def _force_free_port(port: int) -> None:
    """Kill any process still listening on the given port (best-effort)."""
    try:
        if IS_WINDOWS:
            out = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True, text=True, timeout=5
            ).stdout
            for line in out.splitlines():
                if f":{port}" in line and "LISTENING" in line:
                    pid = line.strip().split()[-1]
                    subprocess.run(["taskkill", "/F", "/PID", pid],
                                   capture_output=True, timeout=5)
        else:
            subprocess.run(
                ["fuser", "-k", f"{port}/tcp"],
                capture_output=True, timeout=5
            )
    except Exception:
        pass

# ─── API helpers ──────────────────────────────────────────────────────────────

def post_analyze(port: int, username: str) -> tuple[dict | None, float, int | None, str | None]:
    """
    POST /api/analyze with the given username.

    Returns:
        (response_json_or_none, elapsed_ms, http_status, error_message)
    """
    url = f"http://localhost:{port}/api/analyze"
    t0 = time.perf_counter()
    try:
        resp = httpx.post(
            url,
            json={"username": username},
            timeout=REQUEST_TIMEOUT,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000
        try:
            data = resp.json()
        except Exception:
            data = {"_raw": resp.text[:500]}
        return data, elapsed_ms, resp.status_code, None
    except httpx.TimeoutException:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        return None, elapsed_ms, None, f"Request timed out after {REQUEST_TIMEOUT}s"
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        return None, elapsed_ms, None, str(exc)

# ─── Test: API Contract ───────────────────────────────────────────────────────

def check_contract(data: dict, layout: dict) -> dict:
    """
    Validate the response against the expected contract.

    Expected contract (spec):
        profile:     { username, name, bio, avatar, followers, following, publicRepos }
        scores:      { backend, frontend, devops, testing, consistency, projectDepth, overallScore }
        topLanguages: [{ name, percentage }]
        insights:    { summary, strengths[], weaknesses[], recommendations[], careerFit[] }
        engineering: { hasTests, hasDockerfile, hasCICD, hasReadme, hasDeployment }

    Each implementation uses slightly different key names / nesting —
    we accept any reasonable mapping and report deviations.
    """
    report: dict[str, Any] = {
        "passed": False,
        "sections": {},
        "missing_fields": [],
        "deviations": [],
    }

    eng_path   = layout.get("engineering_path", [])
    lang_path  = layout.get("languages_path", [])
    user_key   = layout.get("user_key")
    scores_key = layout.get("scores_key", "scores")
    ins_key    = layout.get("insights_key", "insights")

    # ── Profile fields ────────────────────────────────────────────────────────
    # username — try many possible locations
    username_val = resolve_field(data,
        ["profile", "username"], ["normalized", "username"],
        ["user", "login"], ["profile", "login"],
    )

    # name
    name_val = resolve_field(data,
        ["profile", "name"], ["profile", "displayName"],
        ["user", "name"], ["normalized", "displayName"],
    )

    # bio
    bio_val = resolve_field(data,
        ["profile", "bio"], ["user", "bio"],
        ["normalized", "bio"],
    )

    # avatar
    avatar_val = resolve_field(data,
        ["profile", "avatarUrl"], ["profile", "avatar_url"],
        ["user", "avatar_url"], ["normalized", "avatarUrl"],
    )

    # followers
    followers_val = resolve_field(data,
        ["profile", "followers"], ["user", "followers"],
        ["normalized", "followers"],
    )

    # following
    following_val = resolve_field(data,
        ["profile", "following"], ["user", "following"],
        ["normalized", "following"],
    )

    # publicRepos
    public_repos_val = resolve_field(data,
        ["profile", "publicRepos"], ["profile", "public_repos"],
        ["profile", "totalPublicRepos"], ["user", "public_repos"],
        ["normalized", "totalRepos"],
    )

    profile_fields = {
        "username":    username_val,
        "name":        name_val,
        "bio":         bio_val,
        "avatar":      avatar_val,
        "followers":   followers_val,
        "following":   following_val,
        "publicRepos": public_repos_val,
    }
    profile_missing = [k for k, v in profile_fields.items() if v is None]
    report["sections"]["profile"] = {
        "found":   {k: v for k, v in profile_fields.items() if v is not None},
        "missing": profile_missing,
        "passed":  len(profile_missing) == 0,
    }
    if profile_missing:
        report["missing_fields"].extend([f"profile.{f}" for f in profile_missing])

    # ── Scores ────────────────────────────────────────────────────────────────
    scores_obj = data.get(scores_key, {})
    scores_found = {}
    scores_missing = []
    for key in SCORE_KEYS:
        v = scores_obj.get(key)
        if v is not None:
            scores_found[key] = v
        else:
            scores_missing.append(key)
    report["sections"]["scores"] = {
        "found":   scores_found,
        "missing": scores_missing,
        "passed":  len(scores_missing) == 0,
    }
    if scores_missing:
        report["missing_fields"].extend([f"scores.{f}" for f in scores_missing])

    # ── Top languages ─────────────────────────────────────────────────────────
    langs = deep_get(data, *lang_path) if lang_path else None
    if langs is None:
        langs = resolve_field(data,
            ["topLanguages"], ["profile", "topLanguages"],
            ["normalized", "topLanguages"],
        )

    lang_valid = False
    lang_issue = None
    if not isinstance(langs, list) or len(langs) == 0:
        lang_issue = "topLanguages missing or empty"
    else:
        sample = langs[0]
        has_name = "name" in sample
        has_pct  = "percentage" in sample
        if has_name and has_pct:
            lang_valid = True
        else:
            missing_sub = []
            if not has_name: missing_sub.append("name")
            if not has_pct:  missing_sub.append("percentage")
            lang_issue = f"topLanguages[0] missing: {missing_sub}"

    report["sections"]["topLanguages"] = {
        "count":  len(langs) if isinstance(langs, list) else 0,
        "passed": lang_valid,
        "issue":  lang_issue,
    }
    if not lang_valid:
        report["missing_fields"].append(lang_issue or "topLanguages")

    # ── Insights ──────────────────────────────────────────────────────────────
    insights_obj = data.get(ins_key, {})
    insights_fields = {
        "summary":         insights_obj.get("summary"),
        "strengths":       insights_obj.get("strengths"),
        "weaknesses":      insights_obj.get("weaknesses"),
        "recommendations": insights_obj.get("recommendations"),
        "careerFit":       insights_obj.get("careerFit"),
    }
    insights_missing = [k for k, v in insights_fields.items() if v is None]
    insights_not_list = [
        k for k, v in insights_fields.items()
        if k != "summary" and v is not None and not isinstance(v, list)
    ]
    report["sections"]["insights"] = {
        "found":   {k: type(v).__name__ for k, v in insights_fields.items() if v is not None},
        "missing": insights_missing,
        "not_list": insights_not_list,
        "passed":  len(insights_missing) == 0 and len(insights_not_list) == 0,
    }
    if insights_missing:
        report["missing_fields"].extend([f"insights.{f}" for f in insights_missing])

    # ── Engineering signals ───────────────────────────────────────────────────
    eng_obj = deep_get(data, *eng_path) if eng_path else {}
    if not isinstance(eng_obj, dict):
        eng_obj = {}

    eng_fields_spec = ["hasTests", "hasDockerfile", "hasCICD", "hasReadme", "hasDeployment"]
    eng_found   = {k: eng_obj.get(k) for k in eng_fields_spec if eng_obj.get(k) is not None}
    eng_missing = [k for k in eng_fields_spec if k not in eng_found]

    # Also check in `quality` key (codex uses this)
    if eng_missing:
        quality_obj = data.get("quality", {}) or {}
        for k in list(eng_missing):
            v = quality_obj.get(k)
            if v is not None:
                eng_found[k] = v
                eng_missing.remove(k)

    report["sections"]["engineering"] = {
        "found":   eng_found,
        "missing": eng_missing,
        "passed":  len(eng_missing) == 0,
    }
    if eng_missing:
        report["missing_fields"].extend([f"engineering.{f}" for f in eng_missing])

    # ── Overall ───────────────────────────────────────────────────────────────
    all_sections_pass = all(
        s.get("passed", False)
        for s in report["sections"].values()
    )
    report["passed"] = all_sections_pass and len(report["missing_fields"]) == 0

    # Note contract deviations (non-exact field names that still contain data)
    if avatar_val is not None and "avatar_url" in str(data).lower() and "avatarUrl" not in str(data):
        report["deviations"].append("avatar key is 'avatar_url' not 'avatar'")
    if public_repos_val is not None and "public_repos" in str(data).lower():
        report["deviations"].append("publicRepos key is 'public_repos'/'totalPublicRepos'")
    if name_val is not None and "displayName" in str(data):
        report["deviations"].append("name key is 'displayName'")

    return report

# ─── Test: Mock Data Detection ────────────────────────────────────────────────

def check_mock_data(data: dict, username: str) -> dict:
    """
    Detect whether the response contains hardcoded/mock data.
    Also verifies the returned username matches the requested one.
    """
    is_mock, mock_string = json_contains_mock(data)

    # Check that the username in the response matches the requested one
    response_username = resolve_field(data,
        ["profile", "username"], ["normalized", "username"],
        ["user", "login"], ["profile", "login"],
    )
    username_match = (
        isinstance(response_username, str)
        and response_username.lower() == username.lower()
    )

    return {
        "is_mock":        is_mock,
        "mock_string":    mock_string if is_mock else None,
        "username_match": username_match,
        "returned_username": response_username,
        "passed":         not is_mock and username_match,
    }

# ─── Test: Error Handling ─────────────────────────────────────────────────────

def check_error_handling(data: dict | None, status: int | None, request_error: str | None) -> dict:
    """
    Verify the server handles a non-existent user gracefully.
    Passing criteria:
      - HTTP status in [400, 404, 422, 429] (explicit client error, not 5xx crash)
      - Response contains an 'error' field
      - No unhandled exception / 500 crash
    """
    if request_error:
        return {
            "passed":   False,
            "status":   None,
            "has_error_field": False,
            "issue":    f"Request failed: {request_error}",
        }

    graceful_statuses = {400, 404, 422, 429, 403}
    has_error_field = isinstance(data, dict) and ("error" in data or "message" in data)
    is_graceful     = status in graceful_statuses

    return {
        "passed":          is_graceful and has_error_field,
        "status":          status,
        "has_error_field": has_error_field,
        "issue": (
            None if (is_graceful and has_error_field)
            else f"Unexpected status {status}" + (" (no error field)" if not has_error_field else "")
        ),
    }

# ─── Test: Score Sanity ───────────────────────────────────────────────────────

def check_score_sanity(data: dict, layout: dict) -> dict:
    """
    Validate:
      1. All score values are numbers 0–100.
      2. overallScore is not identical to every other score (detects hardcoded values).
    """
    scores_obj = data.get(layout.get("scores_key", "scores"), {})
    if not isinstance(scores_obj, dict):
        return {"passed": False, "issue": "scores is not an object", "values": {}}

    out_of_range  = []
    non_numeric   = []
    found_scores  = {}

    for key in SCORE_KEYS:
        v = scores_obj.get(key)
        if v is None:
            continue
        if not isinstance(v, (int, float)):
            non_numeric.append(key)
        elif not (0 <= v <= 100):
            out_of_range.append(f"{key}={v}")
        else:
            found_scores[key] = v

    # Check for suspicious all-identical pattern
    distinct_vals = set(found_scores.values())
    all_identical = len(found_scores) > 2 and len(distinct_vals) == 1
    overall = found_scores.get("overallScore")
    overall_matches_all = (
        overall is not None
        and len(found_scores) > 2
        and all(v == overall for k, v in found_scores.items() if k != "overallScore")
    )

    issues = []
    if non_numeric:   issues.append(f"non-numeric scores: {non_numeric}")
    if out_of_range:  issues.append(f"out of 0–100 range: {out_of_range}")
    if all_identical: issues.append("all scores are identical (possible hardcoded value)")
    if overall_matches_all and not all_identical:
        issues.append("overallScore matches every other score (suspicious)")

    return {
        "passed":      len(issues) == 0,
        "values":      found_scores,
        "issues":      issues,
        "suspicious":  all_identical or overall_matches_all,
    }

# ─── Scoring ──────────────────────────────────────────────────────────────────

def compute_score(result: dict) -> tuple[int, dict]:
    """
    Convert test results into a 0–100 benchmark score.

    Weights:
        Build integrity   → 15 pts
        API contract      → 25 pts
        Real data         → 20 pts
        Error handling    → 15 pts
        Score sanity      → 15 pts
        Response time     → 10 pts  (< 5 s = 10, < 15 s = 7, < 30 s = 4, else 0)
    """
    pts: dict[str, int] = {}

    # Build
    if result.get("build", {}).get("passed"):
        pts["build"] = 15
    else:
        install_ok = result.get("build", {}).get("install", {}).get("status") == "pass"
        pts["build"] = 5 if install_ok else 0

    # API contract
    contract = result.get("contract", {})
    if contract.get("passed"):
        pts["contract"] = 25
    else:
        sections = contract.get("sections", {})
        ok = sum(1 for s in sections.values() if s.get("passed", False))
        total = len(sections) or 1
        pts["contract"] = round(25 * ok / total)

    # Real data
    mock = result.get("mock_data", {})
    if mock.get("passed"):
        pts["mock_data"] = 20
    elif not mock.get("is_mock") and not mock.get("username_match"):
        pts["mock_data"] = 10
    else:
        pts["mock_data"] = 0

    # Error handling
    pts["error_handling"] = 15 if result.get("error_handling", {}).get("passed") else 0

    # Score sanity
    sanity = result.get("score_sanity", {})
    if sanity.get("passed"):
        pts["score_sanity"] = 15
    elif not sanity.get("suspicious"):
        pts["score_sanity"] = 8
    else:
        pts["score_sanity"] = 0

    # Response time
    ms = result.get("response_time_ms")
    if ms is None:
        pts["response_time"] = 0
    elif ms < 5_000:
        pts["response_time"] = 10
    elif ms < 15_000:
        pts["response_time"] = 7
    elif ms < 30_000:
        pts["response_time"] = 4
    else:
        pts["response_time"] = 0

    total = sum(pts.values())
    return total, pts

# ─── Main benchmark loop ──────────────────────────────────────────────────────

def run_model_benchmark(model: dict, progress: Progress, task_id: Any) -> dict:
    """Run all tests for a single model. Returns the result dict."""
    name   = model["name"]
    port   = model["port"]
    layout = model["layout"]

    result: dict[str, Any] = {
        "model":           name,
        "port":            port,
        "build":           None,
        "contract":        None,
        "mock_data":       None,
        "error_handling":  None,
        "score_sanity":    None,
        "response_time_ms": None,
        "server_started":  False,
        "raw_response":    None,
    }

    # ── 1. Build integrity ────────────────────────────────────────────────────
    progress.update(task_id, description=f"[cyan]{name}[/cyan] › npm install + build")
    result["build"] = run_build(model)
    build_ok = result["build"]["passed"]
    build_icon = "✅" if build_ok else "❌"
    console.print(f"  {build_icon} build: {'pass' if build_ok else 'FAIL'}")

    # ── 2. Start dev server ───────────────────────────────────────────────────
    progress.update(task_id, description=f"[cyan]{name}[/cyan] › starting dev server on :{port}")
    console.print(f"  ⏳ starting dev server on port {port} …")
    proc = start_server(model)

    if proc is None:
        console.print(f"  [red]✗ server failed to start — skipping API tests[/red]")
        result["contract"]       = {"passed": False, "issue": "server did not start"}
        result["mock_data"]      = {"passed": False, "issue": "server did not start"}
        result["error_handling"] = {"passed": False, "issue": "server did not start"}
        result["score_sanity"]   = {"passed": False, "issue": "server did not start"}
        return result

    result["server_started"] = True
    console.print(f"  ✅ server ready on :{port}")

    try:
        # ── 3. Real username → API contract + mock + score sanity + resp time ─
        progress.update(task_id, description=f"[cyan]{name}[/cyan] › POST /api/analyze ({REAL_USERNAME})")
        console.print(f"  ⏳ POST /api/analyze username={REAL_USERNAME} …")

        data, elapsed_ms, status, req_err = post_analyze(port, REAL_USERNAME)
        result["response_time_ms"] = round(elapsed_ms)

        if req_err or data is None:
            console.print(f"  [red]✗ request failed: {req_err}[/red]")
            result["contract"]     = {"passed": False, "issue": req_err or "no response"}
            result["mock_data"]    = {"passed": False, "issue": req_err or "no response"}
            result["score_sanity"] = {"passed": False, "issue": req_err or "no response"}
        elif status not in (200, 201):
            console.print(f"  [yellow]⚠ HTTP {status} for real username[/yellow]")
            err_msg = f"HTTP {status}: {json.dumps(data)[:300]}"
            result["contract"]     = {"passed": False, "issue": err_msg}
            result["mock_data"]    = {"passed": False, "issue": err_msg}
            result["score_sanity"] = {"passed": False, "issue": err_msg}
        else:
            result["raw_response"] = data  # store for reference (truncated later)
            result["contract"]     = check_contract(data, layout)
            result["mock_data"]    = check_mock_data(data, REAL_USERNAME)
            result["score_sanity"] = check_score_sanity(data, layout)

            c_icon = "✅" if result["contract"]["passed"]   else "❌"
            m_icon = "✅" if result["mock_data"]["passed"]  else "⚠️ "
            s_icon = "✅" if result["score_sanity"]["passed"] else "❌"
            console.print(f"  {c_icon} contract  {m_icon} real-data  {s_icon} score-sanity  ⏱ {elapsed_ms:.0f}ms")

        # ── 4. Error handling — bad username ──────────────────────────────────
        progress.update(task_id, description=f"[cyan]{name}[/cyan] › error handling test")
        err_data, _, err_status, err_req_err = post_analyze(port, FAKE_USERNAME)
        result["error_handling"] = check_error_handling(err_data, err_status, err_req_err)
        e_icon = "✅" if result["error_handling"]["passed"] else "❌"
        console.print(f"  {e_icon} error handling (status {err_status})")

    finally:
        # ── 5. Shut down server ───────────────────────────────────────────────
        progress.update(task_id, description=f"[cyan]{name}[/cyan] › stopping server")
        stop_server(proc, port)
        console.print(f"  🛑 server stopped")

    return result

# ─── Report generation ────────────────────────────────────────────────────────

def icon(passed: Any) -> str:
    if passed is True:  return "✅"
    if passed is False: return "❌"
    return "⚠️"


def ms_label(ms: int | None) -> str:
    if ms is None: return "N/A"
    return f"{ms:,}ms"


def build_markdown_report(all_results: list[dict]) -> str:
    lines: list[str] = []

    lines.append("# Developer Profile Analyzer — Benchmark Report\n")
    lines.append(f"*Generated: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}*\n")
    lines.append(f"*Real username tested: `{REAL_USERNAME}` | Fake username: `{FAKE_USERNAME}`*\n")
    lines.append("---\n")

    # ── 1. Summary table ──────────────────────────────────────────────────────
    lines.append("## 1. Summary\n")
    header = (
        "| Model       | Build | API Contract | Real Data | Error Handling "
        "| Score Logic | Resp. Time | **Total** |"
    )
    sep = (
        "|-------------|:-----:|:------------:|:---------:|:--------------:"
        "|:-----------:|:----------:|:---------:|"
    )
    lines.append(header)
    lines.append(sep)

    ranked = sorted(all_results, key=lambda r: r.get("total_score", 0), reverse=True)

    for r in ranked:
        name  = r["model"]
        build = icon(r.get("build", {}).get("passed"))
        cont  = icon(r.get("contract", {}).get("passed"))
        mock  = icon(r.get("mock_data", {}).get("passed"))
        err   = icon(r.get("error_handling", {}).get("passed"))
        san   = icon(r.get("score_sanity", {}).get("passed"))
        ms    = ms_label(r.get("response_time_ms"))
        total = r.get("total_score", 0)
        lines.append(
            f"| {name:<11} | {build}  | {cont}           | {mock}       "
            f"| {err}             | {san}         | {ms:<10} | **{total}/100** |"
        )

    lines.append("")

    # ── 2. Per-model findings ─────────────────────────────────────────────────
    lines.append("## 2. Per-Model Findings\n")

    for r in all_results:
        name = r["model"]
        lines.append(f"### {name}\n")

        # Build
        build = r.get("build") or {}
        lines.append("**Build Integrity**")
        lines.append(f"- Install: `{build.get('install', {}).get('status', 'N/A')}`")
        lines.append(f"- Build: `{build.get('build', {}).get('status', 'N/A')}`")
        if build.get("build", {}).get("error"):
            err_snippet = (build["build"]["error"] or "")[:400].replace("\n", " ")
            lines.append(f"- Error snippet: `{err_snippet}`")
        lines.append("")

        # API Contract
        contract = r.get("contract") or {}
        lines.append("**API Contract**")
        sections = contract.get("sections", {})
        for sec_name, sec in sections.items():
            sec_icon = icon(sec.get("passed"))
            lines.append(f"- {sec_icon} `{sec_name}`")
            if sec.get("missing"):
                lines.append(f"  - Missing: {sec['missing']}")
            if sec.get("not_list"):
                lines.append(f"  - Should be list: {sec['not_list']}")
            if sec.get("issue"):
                lines.append(f"  - Issue: {sec['issue']}")
        if contract.get("deviations"):
            lines.append(f"- ⚠ Deviations from spec: {contract['deviations']}")
        missing = contract.get("missing_fields", [])
        if missing:
            lines.append(f"- Missing fields total: `{missing}`")
        lines.append("")

        # Mock data
        mock = r.get("mock_data") or {}
        lines.append("**Data Authenticity**")
        lines.append(f"- Mock data detected: `{mock.get('is_mock', 'N/A')}`")
        if mock.get("mock_string"):
            lines.append(f"  - Offending value: `{mock['mock_string']}`")
        lines.append(f"- Username match: `{mock.get('username_match', 'N/A')}`"
                     f"  (returned `{mock.get('returned_username', 'N/A')}`)")
        lines.append("")

        # Error handling
        err = r.get("error_handling") or {}
        lines.append("**Error Handling**")
        lines.append(f"- HTTP status for invalid user: `{err.get('status', 'N/A')}`")
        lines.append(f"- Has error field: `{err.get('has_error_field', 'N/A')}`")
        if err.get("issue"):
            lines.append(f"- Issue: {err['issue']}")
        lines.append("")

        # Score sanity
        san = r.get("score_sanity") or {}
        lines.append("**Score Sanity**")
        values = san.get("values", {})
        if values:
            row = " | ".join(f"`{k}={v}`" for k, v in values.items())
            lines.append(f"- Values: {row}")
        if san.get("issues"):
            for iss in san["issues"]:
                lines.append(f"- ⚠ {iss}")
        lines.append("")

        # Response time
        lines.append("**Response Time**")
        lines.append(f"- `{ms_label(r.get('response_time_ms'))}`")
        lines.append("")

        # Score breakdown
        pts = r.get("score_breakdown", {})
        total = r.get("total_score", 0)
        lines.append("**Score Breakdown**")
        lines.append(
            f"- Build: {pts.get('build', 0)}/15 | "
            f"Contract: {pts.get('contract', 0)}/25 | "
            f"Real Data: {pts.get('mock_data', 0)}/20 | "
            f"Error Handling: {pts.get('error_handling', 0)}/15 | "
            f"Score Sanity: {pts.get('score_sanity', 0)}/15 | "
            f"Resp. Time: {pts.get('response_time', 0)}/10"
        )
        lines.append(f"- **Total: {total}/100**")
        lines.append("\n---\n")

    # ── 3. Winner recommendation ──────────────────────────────────────────────
    lines.append("## 3. Winner & Recommendation\n")
    if ranked:
        winner = ranked[0]
        runner = ranked[1] if len(ranked) > 1 else None
        lines.append(f"### 🏆 Winner: `{winner['model']}` ({winner.get('total_score', 0)}/100)\n")

        # Auto-generate reasoning
        reasons = []
        if winner.get("build", {}).get("passed"):
            reasons.append("clean build")
        if winner.get("contract", {}).get("passed"):
            reasons.append("full API contract compliance")
        if winner.get("mock_data", {}).get("passed"):
            reasons.append("returns real GitHub data with correct username")
        if winner.get("error_handling", {}).get("passed"):
            reasons.append("graceful error handling for invalid usernames")
        if winner.get("score_sanity", {}).get("passed"):
            reasons.append("all score values within valid range without suspicious patterns")
        ms = winner.get("response_time_ms")
        if ms and ms < 10_000:
            reasons.append(f"fast response time ({ms_label(ms)})")

        if reasons:
            lines.append(f"**Why**: {winner['model']} excelled at: {', '.join(reasons)}.")
        else:
            lines.append(f"**Why**: `{winner['model']}` achieved the highest composite score.")

        if runner:
            gap = winner.get("total_score", 0) - runner.get("total_score", 0)
            lines.append(
                f"\n**Runner-up**: `{runner['model']}` ({runner.get('total_score', 0)}/100)"
                f" — {gap} point(s) behind."
            )
        lines.append("")

    # ── 4. Key takeaways ─────────────────────────────────────────────────────
    lines.append("## 4. Key Takeaways\n")
    for r in all_results:
        name = r["model"]
        strengths = []
        weaknesses = []

        if r.get("build", {}).get("passed"):
            strengths.append("builds cleanly")
        else:
            weaknesses.append("build failure")

        if r.get("contract", {}).get("passed"):
            strengths.append("full contract compliance")
        else:
            missing = r.get("contract", {}).get("missing_fields", [])
            if missing:
                weaknesses.append(f"missing contract fields: {missing[:3]}")

        if r.get("mock_data", {}).get("passed"):
            strengths.append("authentic data")
        elif r.get("mock_data", {}).get("is_mock"):
            weaknesses.append("returns mock/hardcoded data")

        if r.get("error_handling", {}).get("passed"):
            strengths.append("robust error handling")
        else:
            st = r.get("error_handling", {}).get("status")
            weaknesses.append(f"poor error handling (HTTP {st})")

        if r.get("score_sanity", {}).get("suspicious"):
            weaknesses.append("suspicious score values (possibly hardcoded)")
        elif r.get("score_sanity", {}).get("passed"):
            strengths.append("valid score distribution")

        ms = r.get("response_time_ms")
        if ms and ms < 5_000:
            strengths.append(f"fast ({ms_label(ms)})")
        elif ms and ms > 20_000:
            weaknesses.append(f"slow response ({ms_label(ms)})")

        lines.append(f"### `{name}`")
        if strengths:
            lines.append(f"- **Strengths**: {', '.join(strengths)}")
        if weaknesses:
            lines.append(f"- **Weaknesses**: {', '.join(weaknesses)}")
        if not strengths and not weaknesses:
            lines.append("- No conclusive data (server may not have started)")
        lines.append("")

    lines.append("---")
    lines.append("*Report generated by `run_benchmark.py` — QA Automation Suite*")

    return "\n".join(lines)

# ─── Entry point ─────────────────────────────────────────────────────────────

def main() -> None:
    BENCH_DIR.mkdir(parents=True, exist_ok=True)

    console.print(Panel(
        "[bold cyan]Developer Profile Analyzer — QA Benchmark[/bold cyan]\n"
        f"Testing {len(MODELS)} implementations  •  Output → [green]benchmark/[/green]",
        expand=False,
    ))
    console.print()

    all_results: list[dict] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        console=console,
        transient=False,
    ) as progress:
        for model in MODELS:
            task_id = progress.add_task(
                f"[cyan]{model['name']}[/cyan]", total=None
            )
            console.print(f"\n[bold yellow]── {model['name'].upper()} (port {model['port']}) ──[/bold yellow]")
            console.print(f"   dir: {model['dir']}")

            result = run_model_benchmark(model, progress, task_id)
            total_score, score_breakdown = compute_score(result)
            result["total_score"]      = total_score
            result["score_breakdown"]  = score_breakdown

            # Trim raw response to avoid huge JSON (keep first 2 KB)
            if result.get("raw_response"):
                raw_str = json.dumps(result["raw_response"])
                result["raw_response_preview"] = raw_str[:2048] + ("…" if len(raw_str) > 2048 else "")
                del result["raw_response"]

            all_results.append(result)
            progress.update(task_id, description=f"[green]{model['name']}[/green] — {total_score}/100")
            console.print(f"   [bold green]Score: {total_score}/100[/bold green]")

    # ── Write output files ────────────────────────────────────────────────────
    console.print()
    console.print("[bold]Writing output files …[/bold]")

    results_path = BENCH_DIR / "results.json"
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, default=str)
    console.print(f"  ✅ [green]{results_path}[/green]")

    report_md = build_markdown_report(all_results)
    report_path = BENCH_DIR / "REPORT.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_md)
    console.print(f"  ✅ [green]{report_path}[/green]")

    # ── Final summary table in terminal ──────────────────────────────────────
    console.print()
    table = Table(
        title="Benchmark Results",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold cyan",
    )
    table.add_column("Model",          style="bold")
    table.add_column("Build",          justify="center")
    table.add_column("Contract",       justify="center")
    table.add_column("Real Data",      justify="center")
    table.add_column("Error Handling", justify="center")
    table.add_column("Score Sanity",   justify="center")
    table.add_column("Resp. Time",     justify="right")
    table.add_column("Total",          justify="right", style="bold yellow")

    for r in sorted(all_results, key=lambda x: x.get("total_score", 0), reverse=True):
        table.add_row(
            r["model"],
            icon(r.get("build", {}).get("passed")),
            icon(r.get("contract", {}).get("passed")),
            icon(r.get("mock_data", {}).get("passed")),
            icon(r.get("error_handling", {}).get("passed")),
            icon(r.get("score_sanity", {}).get("passed")),
            ms_label(r.get("response_time_ms")),
            f"{r.get('total_score', 0)}/100",
        )

    console.print(table)

    # ── Winner announcement ───────────────────────────────────────────────────
    ranked = sorted(all_results, key=lambda x: x.get("total_score", 0), reverse=True)
    if ranked:
        winner = ranked[0]
        console.print(
            Panel(
                f"[bold green]🏆 Winner: {winner['model'].upper()}[/bold green]  "
                f"[yellow]{winner['total_score']}/100[/yellow]",
                expand=False,
            )
        )

    console.print(f"\n[dim]Full report → {report_path}[/dim]")
    console.print(f"[dim]Raw JSON   → {results_path}[/dim]\n")


if __name__ == "__main__":
    main()
