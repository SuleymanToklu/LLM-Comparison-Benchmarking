'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { DomainScores } from '@/types/frontend'

interface Props {
  scores: DomainScores
}

const AXES = [
  { key: 'backend',      label: 'Backend'     },
  { key: 'frontend',     label: 'Frontend'    },
  { key: 'devops',       label: 'DevOps'      },
  { key: 'testing',      label: 'Testing'     },
  { key: 'consistency',  label: 'Consistency' },
  { key: 'projectDepth', label: 'Depth'       },
] as const

function scoreColor(v: number): string {
  if (v >= 70) return '#4ade80' // green-400
  if (v >= 45) return '#fbbf24' // amber-400
  return '#f87171'              // red-400
}

// Custom axis tick that colour-codes the label by its score.
// Recharts passes x/y as string|number at runtime; we normalise to number.
function ColoredTick(props: Record<string, unknown> & { scores: DomainScores }) {
  const x       = Number(props.x ?? 0)
  const y       = Number(props.y ?? 0)
  const payload = props.payload as { value: string } | undefined
  const anchor  = (props.textAnchor as string | undefined) ?? 'middle'
  const scores  = props.scores

  if (!payload) return null
  const axis = AXES.find(a => a.label === payload.value)
  const val  = axis ? scores[axis.key] : 0

  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor as 'start' | 'middle' | 'end'}
      dominantBaseline="central"
      fill={scoreColor(val)}
      fontSize={11}
      fontWeight={600}
    >
      {payload.value}
    </text>
  )
}

// Custom tooltip
function CustomTooltip({ active, payload }: { active?: boolean; payload?: {value: number, name: string}[] }) {
  if (!active || !payload?.length) return null
  const { value, name } = payload[0]
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <span className="text-gray-400">{name}: </span>
      <span className="font-bold" style={{ color: scoreColor(value) }}>{value}</span>
      <span className="text-gray-500">/100</span>
    </div>
  )
}

export default function SkillRadar({ scores }: Props) {
  const data = AXES.map(a => ({ subject: a.label, score: scores[a.key] }))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
        Skill Radar
      </h2>

      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
          <PolarGrid stroke="#1f2937" strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="subject"
            tick={(p: Record<string, unknown>) => (
              <ColoredTick {...p} scores={scores} />
            )}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#374151', fontSize: 9 }}
            tickCount={4}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.18}
            strokeWidth={2}
            dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Score grid below chart */}
      <div className="grid grid-cols-3 gap-2 mt-1">
        {AXES.map(a => {
          const val = scores[a.key]
          return (
            <div
              key={a.key}
              className="bg-gray-800/50 rounded-xl px-3 py-2 text-center"
            >
              <div
                className="text-lg font-bold leading-none"
                style={{ color: scoreColor(val) }}
              >
                {val}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">{a.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
