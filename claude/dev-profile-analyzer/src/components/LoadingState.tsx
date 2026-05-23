'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'

interface Props {
  username: string
  onCancel: () => void
}

const STATUS_MESSAGES = [
  'Fetching repositories…',
  'Analyzing code patterns…',
  'Evaluating engineering practices…',
  'Computing skill scores…',
  'Generating AI insights…',
]

function Sk({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-800/80 ${className}`} />
}

export default function LoadingState({ username, onCancel }: Props) {
  const [msgIdx, setMsgIdx] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % STATUS_MESSAGES.length)
        setFade(true)
      }, 200)
    }, 1800)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="border-b border-gray-800/60 px-6 py-3.5 flex items-center gap-3">
        <div className="max-w-5xl mx-auto w-full flex items-center gap-3">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <span className="text-sm font-semibold text-gray-300 ml-auto">
            Analyzing @{username}
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Status card */}
        <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl px-5 py-3.5 flex items-center gap-3">
          {/* Spinner */}
          <span className="relative flex h-4 w-4 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-30 animate-ping" />
            <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </span>
          <span
            className="text-sm text-indigo-300 transition-opacity duration-200"
            style={{ opacity: fade ? 1 : 0 }}
          >
            {STATUS_MESSAGES[msgIdx]}
          </span>
          {/* Step counter */}
          <span className="ml-auto text-xs text-indigo-600 tabular-nums">
            {msgIdx + 1} / {STATUS_MESSAGES.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 w-full bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-[1800ms] ease-out"
            style={{ width: `${((msgIdx + 1) / STATUS_MESSAGES.length) * 100}%` }}
          />
        </div>

        {/* ── Skeleton: Profile header ───────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex gap-5">
            <Sk className="w-20 h-20 rounded-full shrink-0" />
            <div className="flex-1 space-y-2.5 pt-1">
              <Sk className="h-5 w-44" />
              <Sk className="h-3.5 w-28" />
              <Sk className="h-3.5 w-64" />
              <div className="flex gap-3 pt-1">
                <Sk className="h-3 w-16" />
                <Sk className="h-3 w-16" />
                <Sk className="h-3 w-16" />
              </div>
            </div>
            <Sk className="w-20 h-20 rounded-xl shrink-0 self-start hidden sm:block" />
          </div>
        </div>

        {/* ── Skeleton: Charts row ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Radar */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <Sk className="h-5 w-28 mb-5" />
            <Sk className="h-[280px] rounded-xl" />
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[...Array(6)].map((_, i) => <Sk key={i} className="h-8 rounded-lg" />)}
            </div>
          </div>
          {/* Bar chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <Sk className="h-5 w-40 mb-5" />
            <div className="space-y-4">
              {[88, 65, 50, 35, 20].map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Sk className="h-3 w-20 shrink-0" />
                  <div className="h-6 rounded animate-pulse bg-gray-800/80 flex-1" style={{ maxWidth: `${w}%` }} />
                  <Sk className="h-3 w-8 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Skeleton: AI insights (3 cols) ─────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <Sk className="h-5 w-24 mb-5" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, col) => (
              <div key={col} className="border border-gray-800 rounded-xl p-4 space-y-3">
                <Sk className="h-4 w-24" />
                {[...Array(3)].map((_, row) => (
                  <Sk key={row} className="h-3 w-full" />
                ))}
                <Sk className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>

        {/* ── Skeleton: Bottom row ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Career fit */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <Sk className="h-5 w-24 mb-5" />
            <div className="space-y-5">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1.5">
                    <Sk className="h-3.5 w-32" />
                    <Sk className="h-3.5 w-10" />
                  </div>
                  <Sk className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
          {/* Engineering maturity */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <Sk className="h-5 w-40 mb-5" />
            <Sk className="h-2 w-full rounded-full mb-4" />
            <div className="space-y-3.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Sk className="w-5 h-5 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Sk className="h-3.5 w-36" />
                    <Sk className="h-2.5 w-48" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
