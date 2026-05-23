'use client'

import { useState, type FormEvent } from 'react'
import { Search, GitBranch, ArrowRight, Zap } from 'lucide-react'

interface Props {
  onAnalyze: (username: string) => void
  error?: string | null
  isLoading?: boolean
}

const EXAMPLES = ['torvalds', 'gaearon', 'sindresorhus', 'yyx990803', 'antirez']

const FEATURES = [
  { icon: '⚡', label: 'Instant Analysis',   desc: '~10 second deep scan'     },
  { icon: '🤖', label: 'AI Insights',        desc: 'Powered by Gemini 2.0'    },
  { icon: '📊', label: 'Visual Reports',     desc: 'Charts & skill scorecards' },
]

export default function LandingHero({ onAnalyze, error, isLoading }: Props) {
  const [input, setInput] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (trimmed && !isLoading) onAnalyze(trimmed)
  }

  return (
    <div className="relative min-h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 70%)',
        }}
      />
      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 border-b border-gray-800/50 px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-gray-200 tracking-tight">
            DevProfile
          </span>
          <span className="ml-auto text-xs text-gray-600">
            Powered by Gemini 2.0 Flash
          </span>
        </div>
      </header>

      {/* Hero content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-16">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-indigo-950/70 border border-indigo-800/50 text-indigo-300 text-xs font-medium px-3 py-1.5 rounded-full mb-8 select-none">
          <GitBranch className="w-3 h-3" />
          GitHub Developer Intelligence
        </div>

        {/* Headline */}
        <h1 className="text-[2.75rem] sm:text-6xl md:text-7xl font-extrabold text-center tracking-tight leading-[1.05] mb-5">
          <span className="text-white">Analyze any </span>
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #c084fc 100%)',
            }}
          >
            developer
          </span>
          <br />
          <span className="text-white">profile in seconds</span>
        </h1>

        {/* Sub-headline */}
        <p className="text-gray-400 text-base sm:text-lg text-center max-w-lg leading-relaxed mb-10">
          Enter a GitHub username to get AI-powered insights on strengths,
          weaknesses, and career fit — backed by real repository data.
        </p>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="w-full max-w-md">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="GitHub username…"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full pl-10 pr-3.5 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-900 disabled:text-indigo-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              Analyze
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="mt-3 text-sm text-red-400 text-center animate-in fade-in">
              {error}
            </p>
          )}

          {/* Example accounts */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
            <span className="text-xs text-gray-600 mr-1">Try:</span>
            {EXAMPLES.map(u => (
              <button
                key={u}
                type="button"
                onClick={() => setInput(u)}
                className="text-xs text-gray-400 hover:text-indigo-300 bg-gray-900 hover:bg-indigo-950/40 border border-gray-800 hover:border-indigo-800/40 px-2.5 py-1 rounded-lg transition-colors"
              >
                {u}
              </button>
            ))}
          </div>
        </form>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-6 justify-center mt-16">
          {FEATURES.map(f => (
            <div key={f.label} className="flex items-center gap-2.5 text-gray-500">
              <span className="text-xl leading-none">{f.icon}</span>
              <div>
                <div className="text-xs font-medium text-gray-300">{f.label}</div>
                <div className="text-xs">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
