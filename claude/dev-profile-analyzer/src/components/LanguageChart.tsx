'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { LanguageEntry } from '@/types/frontend'

interface Props {
  languages: LanguageEntry[]
}

// Distinct palette — visible on dark backgrounds
const BAR_COLORS = ['#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6']

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <span className="text-gray-300 font-medium">{label}</span>
      <span className="text-gray-500">: </span>
      <span className="font-bold text-white">{payload[0].value}%</span>
    </div>
  )
}

// Custom bar label shown at the end of each bar
function BarLabel({ x, y, width, height, value }: {
  x?: number; y?: number; width?: number; height?: number; value?: number
}) {
  if (value === undefined || x === undefined || y === undefined || width === undefined || height === undefined) return null
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
      fill="#9ca3af"
    >
      {value}%
    </text>
  )
}

export default function LanguageChart({ languages }: Props) {
  const top5 = languages.slice(0, 5)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
        Language Distribution
      </h2>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={top5}
            layout="vertical"
            margin={{ top: 0, right: 52, bottom: 0, left: 0 }}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              hide
            />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fill: '#d1d5db', fontSize: 13, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar
              dataKey="percentage"
              radius={[0, 6, 6, 0]}
              label={<BarLabel />}
              maxBarSize={32}
            >
              {top5.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend dots */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
        {top5.map((l, i) => (
          <div key={l.name} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
            />
            {l.name}
          </div>
        ))}
      </div>
    </div>
  )
}
