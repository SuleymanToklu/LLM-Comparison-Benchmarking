# Developer Profile Analyzer — Benchmark Report

*Generated: 2026-05-23 17:03:27 UTC*

*Real username tested: `torvalds` | Fake username: `this_user_does_not_exist_xyz_99999`*

---

## 1. Summary

| Model       | Build | API Contract | Real Data | Error Handling | Score Logic | Resp. Time | **Total** |
|-------------|:-----:|:------------:|:---------:|:--------------:|:-----------:|:----------:|:---------:|
| antigravity | ✅  | ✅           | ✅       | ✅             | ✅         | 1,840ms    | **100/100** |
| claude      | ✅  | ❌           | ✅       | ✅             | ✅         | 1,823ms    | **95/100** |
| codex       | ✅  | ❌           | ✅       | ✅             | ✅         | 4,443ms    | **95/100** |
| abacusai    | ✅  | ❌           | ✅       | ✅             | ✅         | 2,202ms    | **90/100** |

## 2. Per-Model Findings

### abacusai

**Build Integrity**
- Install: `pass`
- Build: `pass`

**API Contract**
- ❌ `profile`
  - Missing: ['bio']
- ✅ `scores`
- ✅ `topLanguages`
- ✅ `insights`
- ❌ `engineering`
  - Missing: ['hasTests', 'hasDockerfile', 'hasCICD', 'hasReadme', 'hasDeployment']
- ⚠ Deviations from spec: ["name key is 'displayName'"]
- Missing fields total: `['profile.bio', 'engineering.hasTests', 'engineering.hasDockerfile', 'engineering.hasCICD', 'engineering.hasReadme', 'engineering.hasDeployment']`

**Data Authenticity**
- Mock data detected: `False`
- Username match: `True`  (returned `torvalds`)

**Error Handling**
- HTTP status for invalid user: `400`
- Has error field: `True`

**Score Sanity**
- Values: `backend=83` | `frontend=0` | `devops=3` | `testing=50` | `consistency=38` | `projectDepth=85` | `overallScore=44`

**Response Time**
- `2,202ms`

**Score Breakdown**
- Build: 15/15 | Contract: 15/25 | Real Data: 20/20 | Error Handling: 15/15 | Score Sanity: 15/15 | Resp. Time: 10/10
- **Total: 90/100**

---

### antigravity

**Build Integrity**
- Install: `pass`
- Build: `pass`

**API Contract**
- ✅ `profile`
- ✅ `scores`
- ✅ `topLanguages`
- ✅ `insights`
- ✅ `engineering`
- ⚠ Deviations from spec: ["avatar key is 'avatar_url' not 'avatar'", "publicRepos key is 'public_repos'/'totalPublicRepos'"]

**Data Authenticity**
- Mock data detected: `False`
- Username match: `True`  (returned `torvalds`)

**Error Handling**
- HTTP status for invalid user: `404`
- Has error field: `True`

**Score Sanity**
- Values: `backend=10` | `frontend=10` | `devops=0` | `testing=70` | `consistency=20` | `projectDepth=100` | `overallScore=35`

**Response Time**
- `1,840ms`

**Score Breakdown**
- Build: 15/15 | Contract: 25/25 | Real Data: 20/20 | Error Handling: 15/15 | Score Sanity: 15/15 | Resp. Time: 10/10
- **Total: 100/100**

---

### claude

**Build Integrity**
- Install: `pass`
- Build: `pass`

**API Contract**
- ❌ `profile`
  - Missing: ['bio']
- ✅ `scores`
- ✅ `topLanguages`
- ✅ `insights`
- ✅ `engineering`
- ⚠ Deviations from spec: ["name key is 'displayName'"]
- Missing fields total: `['profile.bio']`

**Data Authenticity**
- Mock data detected: `False`
- Username match: `True`  (returned `torvalds`)

**Error Handling**
- HTTP status for invalid user: `400`
- Has error field: `True`

**Score Sanity**
- Values: `backend=83` | `frontend=0` | `devops=3` | `testing=50` | `consistency=38` | `projectDepth=85` | `overallScore=44`

**Response Time**
- `1,823ms`

**Score Breakdown**
- Build: 15/15 | Contract: 20/25 | Real Data: 20/20 | Error Handling: 15/15 | Score Sanity: 15/15 | Resp. Time: 10/10
- **Total: 95/100**

---

### codex

**Build Integrity**
- Install: `pass`
- Build: `pass`

**API Contract**
- ❌ `profile`
  - Missing: ['bio']
- ✅ `scores`
- ✅ `topLanguages`
- ✅ `insights`
- ✅ `engineering`
- Missing fields total: `['profile.bio']`

**Data Authenticity**
- Mock data detected: `False`
- Username match: `True`  (returned `torvalds`)

**Error Handling**
- HTTP status for invalid user: `400`
- Has error field: `True`

**Score Sanity**
- Values: `backend=0` | `frontend=0` | `devops=0` | `testing=0` | `consistency=70` | `projectDepth=80` | `overallScore=24`

**Response Time**
- `4,443ms`

**Score Breakdown**
- Build: 15/15 | Contract: 20/25 | Real Data: 20/20 | Error Handling: 15/15 | Score Sanity: 15/15 | Resp. Time: 10/10
- **Total: 95/100**

---

## 3. Winner & Recommendation

### 🏆 Winner: `antigravity` (100/100)

**Why**: antigravity excelled at: clean build, full API contract compliance, returns real GitHub data with correct username, graceful error handling for invalid usernames, all score values within valid range without suspicious patterns, fast response time (1,840ms).

**Runner-up**: `claude` (95/100) — 5 point(s) behind.

## 4. Key Takeaways

### `abacusai`
- **Strengths**: builds cleanly, authentic data, robust error handling, valid score distribution, fast (2,202ms)
- **Weaknesses**: missing contract fields: ['profile.bio', 'engineering.hasTests', 'engineering.hasDockerfile']

### `antigravity`
- **Strengths**: builds cleanly, full contract compliance, authentic data, robust error handling, valid score distribution, fast (1,840ms)

### `claude`
- **Strengths**: builds cleanly, authentic data, robust error handling, valid score distribution, fast (1,823ms)
- **Weaknesses**: missing contract fields: ['profile.bio']

### `codex`
- **Strengths**: builds cleanly, authentic data, robust error handling, valid score distribution, fast (4,443ms)
- **Weaknesses**: missing contract fields: ['profile.bio']

---
*Report generated by `run_benchmark.py` — QA Automation Suite*