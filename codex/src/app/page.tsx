"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Github,
  Loader2,
  Search,
  XCircle
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { AnalysisResponse, ErrorResponse } from "@/types";

const loadingMessages = [
  "Fetching repositories...",
  "Analyzing patterns...",
  "Generating insights..."
];

export default function Home() {
  const [username, setUsername] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setMessageIndex(0);
      return;
    }

    const messageTimer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % loadingMessages.length);
    }, 1150);

    return () => window.clearInterval(messageTimer);
  }, [isLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setError("Enter a GitHub username.");
      return;
    }

    setError(null);
    setAnalysis(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username: trimmedUsername })
      });
      const payload = (await response.json().catch(() => null)) as AnalysisResponse | ErrorResponse | null;

      if (!response.ok) {
        const message =
          payload && "error" in payload
            ? `${payload.error}${payload.detail ? `: ${payload.detail}` : ""}`
            : "Analysis failed. Please try again.";
        throw new Error(message);
      }

      if (!payload || !("profile" in payload)) {
        throw new Error("Analysis returned an invalid response.");
      }

      setAnalysis(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Network error while analyzing the profile.");
    } finally {
      setIsLoading(false);
    }
  }

  function resetSearch() {
    setAnalysis(null);
    setError(null);
    setUsername("");
  }

  if (isLoading) {
    return <LoadingState message={loadingMessages[messageIndex]} />;
  }

  if (analysis) {
    return <Dashboard data={analysis} onReset={resetSearch} />;
  }

  return <LandingState username={username} error={error} onUsernameChange={setUsername} onSubmit={handleSubmit} />;
}

function LandingState({
  username,
  error,
  onUsernameChange,
  onSubmit
}: {
  username: string;
  error: string | null;
  onUsernameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-lg bg-zinc-950 text-white shadow-soft">
          <Github className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="text-sm font-bold uppercase tracking-normal text-cyan-700">Developer Profile Analyzer</p>
        <h1 className="mt-3 text-4xl font-black tracking-normal text-zinc-950 sm:text-6xl">
          Understand a GitHub profile in seconds
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg">
          Enter a username to generate a real engineering profile from public GitHub data, deterministic scoring, and AI insights.
        </p>

        <form onSubmit={onSubmit} className="mx-auto mt-9 w-full max-w-xl">
          <label htmlFor="username" className="sr-only">
            GitHub username
          </label>
          <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-2 shadow-soft sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              <input
                id="username"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                placeholder="octocat"
                autoComplete="off"
                className="h-12 w-full rounded-lg border-0 bg-zinc-50 pl-11 pr-4 text-zinc-950 outline-none ring-1 ring-transparent transition placeholder:text-zinc-400 focus:bg-white focus:ring-cyan-500"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-6 text-sm font-black text-white transition hover:bg-zinc-800"
            >
              Analyze
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </form>

        {error ? (
          <div className="mx-auto mt-5 flex max-w-xl gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-left text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex min-h-16 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 text-blue-900 shadow-soft">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="text-sm font-black sm:text-base">{message}</span>
        </div>
        <div className="space-y-5">
          <SkeletonProfileHeader />
          <div className="grid gap-5 lg:grid-cols-2">
            <SkeletonPanel height="h-[360px]" rows={5} />
            <SkeletonPanel height="h-[360px]" rows={5} />
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <SkeletonPanel height="h-[230px]" rows={4} />
            <SkeletonPanel height="h-[230px]" rows={4} />
            <SkeletonPanel height="h-[230px]" rows={4} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <SkeletonPanel height="h-[260px]" rows={4} />
            <SkeletonPanel height="h-[260px]" rows={6} />
          </div>
        </div>
      </div>
    </main>
  );
}

function Dashboard({ data, onReset }: { data: AnalysisResponse; onReset: () => void }) {
  const radarData = useMemo(
    () => [
      { skill: "Backend", score: data.scores.backend },
      { skill: "Frontend", score: data.scores.frontend },
      { skill: "DevOps", score: data.scores.devops },
      { skill: "Testing", score: data.scores.testing },
      { skill: "Consistency", score: data.scores.consistency },
      { skill: "Project Depth", score: data.scores.projectDepth }
    ],
    [data.scores]
  );
  const topLanguages = data.normalized.topLanguages.slice(0, 5);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <ProfileHeader data={data} onReset={onReset} />

        {!data.aiStatus.ok ? (
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <div>
              <p className="font-black">Gemini insights are unavailable, so deterministic fallback insights are shown.</p>
              {data.aiStatus.error ? <p className="mt-1 text-amber-800">{data.aiStatus.error}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <ChartPanel title="Skill Radar" kicker={`${data.scores.overallScore}/100 overall`}>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#d4d4d8" />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Radar dataKey="score" stroke="#0f766e" fill="#0f766e" fillOpacity={0.28} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#d4d4d8" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>

          <ChartPanel title="Language Distribution" kicker="Top 5">
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topLanguages} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [`${value}%`, "Usage"]} contentStyle={{ borderRadius: 8, borderColor: "#d4d4d8" }} />
                  <Bar dataKey="percentage" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
        </div>

        <section className="grid gap-5 lg:grid-cols-3">
          <InsightColumn title="Strengths" tone="green" icon="check" items={data.insights.strengths} />
          <InsightColumn title="Weaknesses" tone="orange" icon="warning" items={data.insights.weaknesses} />
          <InsightColumn title="Recommendations" tone="blue" icon="arrow" items={data.insights.recommendations} />
        </section>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Career Fit" kicker="Role confidence">
            <div className="space-y-5">
              {data.insights.careerFit.map((fit) => (
                <div key={fit.role}>
                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                    <span className="font-black text-zinc-900">{fit.role}</span>
                    <span className="font-black text-zinc-600">{fit.confidence}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-lg bg-zinc-100">
                    <div className="h-full rounded-lg bg-cyan-700" style={{ width: `${fit.confidence}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Engineering Maturity" kicker={`${data.normalized.repoQualityScore}/100 quality`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <MaturityItem label="Tests" active={data.normalized.hasTests} detail={`${data.quality.reposWithTests}/${data.normalized.ownedRepos} repos`} />
              <MaturityItem label="Docker" active={data.normalized.hasDockerfile} detail={`${data.quality.reposWithDockerfile}/${data.normalized.ownedRepos} repos`} />
              <MaturityItem label="CI/CD" active={data.normalized.hasCICD} detail={`${data.quality.reposWithCICD}/${data.normalized.ownedRepos} repos`} />
              <MaturityItem label="README" active={data.normalized.hasReadme} detail={`${data.quality.reposWithReadme}/${data.normalized.ownedRepos} repos`} />
              <MaturityItem label="Deployment" active={data.normalized.hasDeployment} detail={`${data.quality.reposWithDeployment}/${data.normalized.ownedRepos} repos`} />
            </div>
          </Panel>
        </div>

        {data.warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-black">Data notes</p>
            <ul className="mt-2 space-y-1">
              {data.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ProfileHeader({ data, onReset }: { data: AnalysisResponse; onReset: () => void }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <Image
            src={data.profile.avatarUrl}
            alt={`${data.profile.username} avatar`}
            width={96}
            height={96}
            className="h-20 w-20 flex-none rounded-lg border border-zinc-200 object-cover sm:h-24 sm:w-24"
          />
          <div className="min-w-0">
            <p className="text-sm font-black text-cyan-700">@{data.profile.username}</p>
            <h2 className="mt-1 break-words text-3xl font-black text-zinc-950 sm:text-4xl">{data.profile.name ?? data.profile.username}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{data.profile.bio ?? "No GitHub bio available."}</p>
            <p className="mt-3 inline-flex rounded-lg bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-600">
              {data.profile.location ?? "Location unavailable"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-center">
            <p className="text-xs font-black uppercase tracking-normal text-cyan-800">Overall</p>
            <p className="text-3xl font-black text-cyan-950">{data.scores.overallScore}</p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="h-11 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-900 transition hover:border-zinc-500"
          >
            New search
          </button>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Repos" value={data.profile.publicRepos} />
        <Stat label="Followers" value={data.profile.followers} />
        <Stat label="Following" value={data.profile.following} />
      </div>
    </section>
  );
}

function InsightColumn({
  title,
  items,
  tone,
  icon
}: {
  title: string;
  items: string[];
  tone: "green" | "orange" | "blue";
  icon: "check" | "warning" | "arrow";
}) {
  const styles = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    orange: "border-orange-200 bg-orange-50 text-orange-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900"
  }[tone];

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
      <h3 className="text-lg font-black text-zinc-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className={`flex gap-3 rounded-lg border p-4 ${styles}`}>
            <IconForInsight icon={icon} />
            <p className="text-sm font-semibold leading-6">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function IconForInsight({ icon }: { icon: "check" | "warning" | "arrow" }) {
  if (icon === "check") {
    return <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />;
  }

  if (icon === "warning") {
    return <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />;
  }

  return <ArrowRight className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />;
}

function MaturityItem({ label, active, detail }: { label: string; active: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      {active ? (
        <CheckCircle2 className="h-6 w-6 flex-none text-emerald-700" aria-hidden="true" />
      ) : (
        <XCircle className="h-6 w-6 flex-none text-red-700" aria-hidden="true" />
      )}
      <div>
        <p className="font-black text-zinc-950">{label}</p>
        <p className="text-sm font-semibold text-zinc-500">{detail}</p>
      </div>
    </div>
  );
}

function ChartPanel({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-lg font-black text-zinc-950">{title}</h3>
        <span className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-600">{kicker}</span>
      </div>
      {children}
    </section>
  );
}

function Panel({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-lg font-black text-zinc-950">{title}</h3>
        <span className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-600">{kicker}</span>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-l-4 border-zinc-300 pl-3">
      <p className="text-xs font-black uppercase tracking-normal text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-zinc-950">{formatNumber(value)}</p>
    </div>
  );
}

function SkeletonProfileHeader() {
  return (
    <section className="animate-pulse rounded-lg border border-zinc-200 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex gap-4">
        <div className="h-20 w-20 rounded-lg bg-zinc-200 sm:h-24 sm:w-24" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 rounded-lg bg-zinc-200" />
          <div className="h-8 w-56 rounded-lg bg-zinc-200" />
          <div className="h-4 w-full max-w-xl rounded-lg bg-zinc-100" />
          <div className="h-4 w-48 rounded-lg bg-zinc-100" />
        </div>
        <div className="hidden h-20 w-28 rounded-lg bg-zinc-100 sm:block" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-16 rounded-lg bg-zinc-100" />
        ))}
      </div>
    </section>
  );
}

function SkeletonPanel({ height, rows }: { height: string; rows: number }) {
  return (
    <section className={`animate-pulse rounded-lg border border-zinc-200 bg-white p-5 shadow-soft ${height}`}>
      <div className="mb-7 flex items-center justify-between">
        <div className="h-5 w-36 rounded-lg bg-zinc-200" />
        <div className="h-6 w-20 rounded-lg bg-zinc-100" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="h-8 rounded-lg bg-zinc-100" />
        ))}
      </div>
    </section>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}
