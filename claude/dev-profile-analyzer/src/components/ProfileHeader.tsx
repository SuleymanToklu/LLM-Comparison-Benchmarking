'use client'

import { MapPin, Building2, ExternalLink, Users, BookOpen, UserCheck } from 'lucide-react'
import type { ProfileStats, DomainScores } from '@/types/frontend'

interface Props {
  profile: ProfileStats
  scores: DomainScores
}

function scoreMeta(score: number): { color: string; bg: string; ring: string; label: string } {
  if (score >= 70) return { color: 'text-green-400',  bg: 'bg-green-950/50',  ring: 'ring-green-700/50',  label: 'Strong'   }
  if (score >= 45) return { color: 'text-amber-400',  bg: 'bg-amber-950/50',  ring: 'ring-amber-700/50',  label: 'Growing'  }
  return              { color: 'text-red-400',    bg: 'bg-red-950/50',    ring: 'ring-red-800/40',    label: 'Emerging' }
}

function StatPill({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-3.5 py-2.5">
      <span className="text-gray-500 shrink-0">{icon}</span>
      <div>
        <div className="text-base font-bold text-white leading-none">
          {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

export default function ProfileHeader({ profile, scores }: Props) {
  const { color, bg, ring, label } = scoreMeta(scores.overallScore)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        {/* Avatar */}
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profile.avatar}
            alt={profile.username}
            width={80}
            height={80}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-full ring-2 ring-indigo-500/30 object-cover"
          />
          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-gray-900" title="Profile active" />
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">
                {profile.name ?? profile.username}
              </h1>
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                @{profile.username}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
              {profile.bio && (
                <p className="text-sm text-gray-400 mt-1.5 max-w-lg leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* Location */}
              {profile.location && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
                  <MapPin className="w-3 h-3" />
                  {profile.location}
                </div>
              )}
            </div>

            {/* Score badge */}
            <div
              className={`shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-2xl ring-2 ${bg} ${ring}`}
            >
              <span className={`text-3xl font-black leading-none ${color}`}>
                {scores.overallScore}
              </span>
              <span className={`text-[10px] font-semibold mt-1 uppercase tracking-wider ${color} opacity-75`}>
                {label}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <StatPill
              icon={<BookOpen className="w-3.5 h-3.5" />}
              value={profile.publicRepos}
              label="Repos"
            />
            <StatPill
              icon={<Users className="w-3.5 h-3.5" />}
              value={profile.followers}
              label="Followers"
            />
            <StatPill
              icon={<UserCheck className="w-3.5 h-3.5" />}
              value={profile.following}
              label="Following"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
