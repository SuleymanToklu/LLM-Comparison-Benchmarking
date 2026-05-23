'use client'

import { CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react'
import type { Insights } from '@/types/frontend'

interface Props {
  insights: Insights
}

// ─── Column types ─────────────────────────────────────────────────────────────

type ColConfig = {
  key: 'strengths' | 'weaknesses' | 'recommendations'
  label: string
  Icon: React.ComponentType<{ className?: string }>
  // Tailwind colour families for: header text, header icon, card border, card bg, bullet
  header: string
  cardBorder: string
  cardBg: string
  bullet: string
  bulletText: string
}

const COLUMNS: ColConfig[] = [
  {
    key:        'strengths',
    label:      'Strengths',
    Icon:       CheckCircle2,
    header:     'text-green-400',
    cardBorder: 'border-green-900/50',
    cardBg:     'bg-green-950/20',
    bullet:     'text-green-500',
    bulletText: 'text-gray-300',
  },
  {
    key:        'weaknesses',
    label:      'Weaknesses',
    Icon:       AlertTriangle,
    header:     'text-red-400',
    cardBorder: 'border-red-900/50',
    cardBg:     'bg-red-950/20',
    bullet:     'text-red-500',
    bulletText: 'text-gray-300',
  },
  {
    key:        'recommendations',
    label:      'Recommendations',
    Icon:       Lightbulb,
    header:     'text-blue-400',
    cardBorder: 'border-blue-900/50',
    cardBg:     'bg-blue-950/20',
    bullet:     'text-blue-500',
    bulletText: 'text-gray-300',
  },
]

const BULLETS = {
  strengths:        '✓',
  weaknesses:       '✗',
  recommendations:  '→',
}

export default function AIInsightsPanel({ insights }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
        AI Insights
      </h2>

      {/* Summary */}
      <p className="text-sm text-gray-300 leading-relaxed mb-5 pb-5 border-b border-gray-800">
        {insights.summary}
      </p>

      {/* Three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const items = insights[col.key]
          const { Icon } = col
          return (
            <div
              key={col.key}
              className={`rounded-xl border p-4 ${col.cardBorder} ${col.cardBg}`}
            >
              {/* Column header */}
              <div className={`flex items-center gap-2 mb-3 ${col.header}`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="ml-auto text-xs opacity-50 font-normal">
                  {items.length}
                </span>
              </div>

              {/* Items */}
              <ul className="space-y-2.5">
                {items.map((item, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className={`shrink-0 text-xs font-bold mt-0.5 w-3 text-center ${col.bullet}`}>
                      {BULLETS[col.key]}
                    </span>
                    <span className={`text-xs leading-relaxed ${col.bulletText}`}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
