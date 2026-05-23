'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import type { EngineeringSignals } from '@/types/frontend'

interface Props {
  engineering: EngineeringSignals
}

const CHECKS: {
  key: keyof EngineeringSignals
  label: string
  description: string
  weight: number
}[] = [
  {
    key:         'hasReadme',
    label:       'Documentation',
    description: 'README files present in repos',
    weight:      20,
  },
  {
    key:         'hasTests',
    label:       'Automated Tests',
    description: 'Test directories or config files found',
    weight:      25,
  },
  {
    key:         'hasCICD',
    label:       'CI / CD Pipeline',
    description: 'GitHub Actions, Travis, CircleCI, etc.',
    weight:      25,
  },
  {
    key:         'hasDockerfile',
    label:       'Containerisation',
    description: 'Dockerfile or docker-compose present',
    weight:      20,
  },
  {
    key:         'hasDeployment',
    label:       'Deployment Config',
    description: 'Vercel, Fly.io, Render, Heroku, etc.',
    weight:      10,
  },
]

export default function EngineeringMaturity({ engineering }: Props) {
  // Weighted maturity score
  const score = CHECKS.reduce((acc, c) => acc + (engineering[c.key] ? c.weight : 0), 0)
  const passCount = CHECKS.filter(c => engineering[c.key]).length

  const maturityLabel =
    score >= 80 ? 'Excellent'
    : score >= 55 ? 'Good'
    : score >= 30 ? 'Developing'
    : 'Early'

  const barColor =
    score >= 80 ? 'from-green-500  to-emerald-400'
    : score >= 55 ? 'from-indigo-500 to-violet-400'
    : score >= 30 ? 'from-amber-500  to-yellow-400'
    : 'from-red-500    to-orange-400'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Engineering Maturity
        </h2>
        <div className="text-right">
          <div className="text-2xl font-black text-white leading-none">
            {passCount}
            <span className="text-base font-normal text-gray-600">/{CHECKS.length}</span>
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
            {maturityLabel}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-5">
        <div
          className={`h-1.5 rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Checks */}
      <ul className="space-y-3">
        {CHECKS.map(c => {
          const passed = engineering[c.key]
          return (
            <li key={c.key} className="flex items-start gap-3">
              {passed ? (
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-700 shrink-0 mt-0.5" />
              )}
              <div>
                <div
                  className={`text-sm font-medium leading-none ${passed ? 'text-gray-200' : 'text-gray-500'}`}
                >
                  {c.label}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">{c.description}</div>
              </div>
              {/* Weight pill */}
              <span
                className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${passed ? 'bg-green-900/30 text-green-500' : 'bg-gray-800 text-gray-600'}`}
              >
                +{c.weight}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
