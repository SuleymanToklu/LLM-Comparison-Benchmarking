"use client"

import type { AnalysisResult } from "@/types"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"

type ViewState = "landing" | "loading" | "dashboard"

const statusMessages = [
  "Fetching repositories...",
  "Analyzing patterns...",
  "Generating insights..."
]

export default function HomePage() {
  const [username, setUsername] = useState("")
  const [viewState, setViewState] = useState<ViewState>("landing")
  const [statusIndex, setStatusIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)

  useEffect(() => {
    if (viewState !== "loading") {
      return
    }

    const statusTimer = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statusMessages.length)
    }, 900)

    return () => {
      clearInterval(statusTimer)
    }
  }, [viewState])

  const radarData = useMemo(() => {
    if (!result) {
      return []
    }

    return [
      { metric: "Backend", score: result.scores.backend },
      { metric: "Frontend", score: result.scores.frontend },
      { metric: "DevOps", score: result.scores.devops },
      { metric: "Testing", score: result.scores.testing },
      { metric: "Consistency", score: result.scores.consistency },
      { metric: "Project Depth", score: result.scores.projectDepth }
    ]
  }, [result])

  const topLanguages = useMemo(() => {
    return result?.normalized.topLanguages.slice(0, 5) ?? []
  }, [result])

  async function handleSubmit() {
    if (!username.trim()) {
      return
    }

    setError(null)
    setStatusIndex(0)
    setViewState("loading")

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username: username.trim() })
      })

      const payload = (await response.json()) as AnalysisResult | { error: string }

      if (!response.ok) {
        setResult(null)
        setError((payload as { error: string }).error || "Failed to analyze developer profile")
        setViewState("landing")
        return
      }

      setResult(payload as AnalysisResult)
      setViewState("dashboard")
    } catch {
      setResult(null)
      setError("Network error while analyzing profile")
      setViewState("landing")
    }
  }

  if (viewState === "landing") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-panel/90 p-8 shadow-2xl shadow-black/30 sm:p-12">
          <h1 className="text-center text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Developer Profile Analyzer
          </h1>
          <p className="mt-4 text-center text-slate-300">
            Analyze any GitHub profile and visualize engineering strengths with actionable insights.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <div className="relative w-full">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleSubmit()
                  }
                }}
                placeholder="Enter GitHub username"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-12 pr-4 text-slate-100 outline-none transition focus:border-accent"
              />
            </div>
            <button
              onClick={() => {
                void handleSubmit()
              }}
              className="rounded-xl bg-accent px-6 py-3 font-semibold text-white transition hover:brightness-110"
            >
              Analyze
            </button>
          </div>

          {error ? <p className="mt-4 rounded-lg bg-red-950/70 p-3 text-sm text-red-300">{error}</p> : null}
        </section>
      </main>
    )
  }

  if (viewState === "loading") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:py-10">
        <div className="mb-6 rounded-xl border border-slate-800 bg-panel p-4 text-sm text-slate-300">
          {statusMessages[statusIndex]}
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-44" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </main>
    )
  }

  if (!result) {
    return null
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:py-10">
      <section className="rounded-2xl border border-slate-800 bg-panel p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Image
              src={result.user.avatar_url}
              alt={result.user.login}
              width={84}
              height={84}
              className="h-20 w-20 rounded-full border border-slate-700 sm:h-24 sm:w-24"
            />
            <div>
              <h2 className="text-2xl font-bold text-white">{result.user.name ?? result.user.login}</h2>
              <p className="text-slate-400">@{result.user.login}</p>
              <p className="mt-1 text-slate-300">{result.user.bio ?? "No bio available"}</p>
              <p className="mt-1 text-sm text-slate-400">{result.user.location ?? "Location unavailable"}</p>
            </div>
          </div>
          <div className="rounded-xl border border-indigo-600/60 bg-indigo-950/50 px-5 py-3 text-center">
            <p className="text-xs uppercase tracking-wide text-indigo-300">Overall Score</p>
            <p className="text-3xl font-bold text-indigo-100">{result.scores.overallScore}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard label="Repos" value={result.user.public_repos} />
          <StatCard label="Followers" value={result.user.followers} />
          <StatCard label="Following" value={result.user.following} />
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-panel p-6">
          <h3 className="text-lg font-semibold text-white">Skill Radar</h3>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                <Radar dataKey="score" stroke="#6d8bff" fill="#6d8bff" fillOpacity={0.4} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-panel p-6">
          <h3 className="text-lg font-semibold text-white">Language Distribution</h3>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topLanguages} layout="vertical" margin={{ left: 20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#cbd5e1" }} unit="%" />
                <YAxis dataKey="name" type="category" tick={{ fill: "#cbd5e1" }} width={90} />
                <Tooltip formatter={(value) => [`${value}%`, "Usage"]} />
                <Bar dataKey="percentage" fill="#60a5fa" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <InsightsColumn
          title="Strengths"
          tone="green"
          icon={<CheckIcon />}
          items={result.insights?.strengths ?? []}
        />
        <InsightsColumn
          title="Weaknesses"
          tone="orange"
          icon={<WarningIcon />}
          items={result.insights?.weaknesses ?? []}
        />
        <InsightsColumn
          title="Recommendations"
          tone="blue"
          icon={<ArrowIcon />}
          items={result.insights?.recommendations ?? []}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-panel p-6">
          <h3 className="text-lg font-semibold text-white">Career Fit</h3>
          <ul className="mt-4 space-y-4">
            {(result.insights?.careerFit ?? []).map((item) => (
              <li key={item.role}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-200">{item.role}</span>
                  <span className="text-slate-400">{item.confidence}%</span>
                </div>
                <div className="h-2.5 rounded bg-slate-800">
                  <div className="h-full rounded bg-accent" style={{ width: `${item.confidence}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-panel p-6">
          <h3 className="text-lg font-semibold text-white">Engineering Maturity</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MaturityItem label="Tests" enabled={result.normalized.hasTests} />
            <MaturityItem label="Docker" enabled={result.normalized.hasDockerfile} />
            <MaturityItem label="CI/CD" enabled={result.normalized.hasCICD} />
            <MaturityItem label="README" enabled={result.normalized.hasReadme} />
            <MaturityItem label="Deployment" enabled={result.normalized.hasDeployment} />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-panel p-6">
        <h3 className="text-lg font-semibold text-white">Summary</h3>
        <p className="mt-3 text-slate-300">{result.insights?.summary ?? "AI insights unavailable."}</p>
        {result.warnings.map((warning) => (
          <p key={warning} className="mt-3 rounded bg-amber-950 p-2 text-amber-300">
            {warning}
          </p>
        ))}
      </section>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-center">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100">{value}</p>
    </div>
  )
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl border border-slate-800 bg-panel ${className}`} />
}

function MaturityItem({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
        enabled ? "border-emerald-700 bg-emerald-950/40" : "border-red-800 bg-red-950/30"
      }`}
    >
      <span className="text-slate-100">{label}</span>
      <span className={enabled ? "text-emerald-300" : "text-red-300"}>{enabled ? "✓" : "✕"}</span>
    </div>
  )
}

function InsightsColumn({
  title,
  icon,
  items,
  tone
}: {
  title: string
  icon: React.ReactNode
  items: string[]
  tone: "green" | "orange" | "blue"
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-700/60 bg-emerald-950/30"
      : tone === "orange"
        ? "border-orange-700/60 bg-orange-950/30"
        : "border-blue-700/60 bg-blue-950/30"

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
        {icon}
        {title}
      </h3>
      <ul className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <li key={item} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
              {item}
            </li>
          ))
        ) : (
          <li className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
            No insights available.
          </li>
        )}
      </ul>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-emerald-300">
      <path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-orange-300">
      <path d="M12 3 2.5 20h19L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 9v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-blue-300">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m13 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
