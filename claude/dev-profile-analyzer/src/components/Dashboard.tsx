'use client'

import { ArrowLeft, RefreshCw } from 'lucide-react'
import type { ProfileData } from '@/types/frontend'
import ProfileHeader     from '@/components/ProfileHeader'
import SkillRadar        from '@/components/SkillRadar'
import LanguageChart     from '@/components/LanguageChart'
import AIInsightsPanel   from '@/components/AIInsightsPanel'
import CareerFitPanel    from '@/components/CareerFitPanel'
import EngineeringMaturity from '@/components/EngineeringMaturity'

interface Props {
  data: ProfileData
  analyzedAt?: string
  cached?: boolean
  onReset: () => void
  onReanalyze: () => void
}

export default function Dashboard({ data, analyzedAt, cached, onReset, onReanalyze }: Props) {
  const { profile, scores, topLanguages, insights, engineering } = data

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Sticky top bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-gray-950/80 backdrop-blur-sm border-b border-gray-800/60 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Search
          </button>

          <span className="text-gray-700">·</span>
          <span className="text-sm font-semibold text-gray-300">@{profile.username}</span>

          <div className="ml-auto flex items-center gap-3">
            {analyzedAt && (
              <span className="hidden sm:block text-[10px] text-gray-600 tabular-nums">
                {cached ? '⚡ cached · ' : ''}
                {new Date(analyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={onReanalyze}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-300 transition-colors bg-gray-800/60 hover:bg-indigo-950/40 border border-gray-700 hover:border-indigo-800/50 px-2.5 py-1.5 rounded-lg"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* ── Dashboard grid ────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* A: Profile header — full width */}
        <ProfileHeader profile={profile} scores={scores} />

        {/* B + C: Radar & Language chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SkillRadar scores={scores} />
          {topLanguages.length > 0
            ? <LanguageChart languages={topLanguages} />
            : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center justify-center">
                <p className="text-sm text-gray-600">No language data available</p>
              </div>
            )
          }
        </div>

        {/* D: AI insights — full width, 3 inner columns */}
        <AIInsightsPanel insights={insights} />

        {/* E + F: Career fit & Engineering maturity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CareerFitPanel    careerFit={insights.careerFit} />
          <EngineeringMaturity engineering={engineering} />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-700 pb-6">
          Analysis based on public GitHub data · Scores computed deterministically
        </p>
      </main>
    </div>
  )
}
