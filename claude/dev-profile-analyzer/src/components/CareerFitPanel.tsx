'use client'

import type { Insights } from '@/types/frontend'

interface Props {
  careerFit: Insights['careerFit']
}

type Tier = { label: string; trackBg: string; barBg: string; textColor: string; badgeBg: string }

function getTier(confidence: number): Tier {
  if (confidence >= 75)
    return {
      label:    'Strong fit',
      trackBg:  'bg-green-950/40',
      barBg:    'bg-gradient-to-r from-green-500 to-emerald-400',
      textColor:'text-green-400',
      badgeBg:  'bg-green-900/40 text-green-300',
    }
  if (confidence >= 50)
    return {
      label:    'Possible fit',
      trackBg:  'bg-amber-950/40',
      barBg:    'bg-gradient-to-r from-amber-500 to-yellow-400',
      textColor:'text-amber-400',
      badgeBg:  'bg-amber-900/30 text-amber-300',
    }
  return {
    label:    'Low fit',
    trackBg:  'bg-gray-800/60',
    barBg:    'bg-gradient-to-r from-gray-600 to-gray-500',
    textColor:'text-gray-500',
    badgeBg:  'bg-gray-800 text-gray-500',
  }
}

export default function CareerFitPanel({ careerFit }: Props) {
  const sorted = [...careerFit].sort((a, b) => b.confidence - a.confidence)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
        Career Fit
      </h2>

      <div className="space-y-4">
        {sorted.map((item, i) => {
          const tier = getTier(item.confidence)
          const isTop = i === 0

          return (
            <div key={item.role}>
              {/* Row header */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {isTop && (
                    <span className="text-xs bg-indigo-900/50 text-indigo-300 border border-indigo-800/50 px-1.5 py-0.5 rounded font-medium">
                      Best fit
                    </span>
                  )}
                  <span
                    className={`text-sm font-semibold ${isTop ? 'text-white' : 'text-gray-300'}`}
                  >
                    {item.role}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tier.badgeBg}`}>
                    {tier.label}
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${tier.textColor}`}>
                    {item.confidence}%
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className={`w-full h-2 rounded-full overflow-hidden ${tier.trackBg}`}>
                <div
                  className={`h-full rounded-full ${tier.barBg} transition-all duration-700`}
                  style={{ width: `${item.confidence}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
