'use client'

import { useState } from 'react'
import type { AnalysisResult } from '@/types'
import type { ProfileData } from '@/types/frontend'
import LandingHero   from '@/components/LandingHero'
import LoadingState  from '@/components/LoadingState'
import Dashboard     from '@/components/Dashboard'

// ─── Transform API response → ProfileData ────────────────────────────────────

function fromApiResult(r: AnalysisResult): ProfileData {
  return {
    profile: {
      username:    r.profile.username,
      name:        r.profile.displayName,
      bio:         r.profile.bio,
      avatar:      r.profile.avatarUrl,
      location:    r.profile.location,
      profileUrl:  r.profile.profileUrl,
      followers:   r.profile.followers,
      following:   r.profile.following,
      publicRepos: r.profile.ownedRepos,
    },
    scores:       r.scores,
    topLanguages: r.profile.topLanguages.slice(0, 5).map(l => ({
      name:       l.name,
      percentage: l.percentage,
    })),
    insights: {
      summary:         r.insights.summary,
      strengths:       r.insights.strengths,
      weaknesses:      r.insights.weaknesses,
      recommendations: r.insights.recommendations,
      careerFit:       r.insights.careerFit,
    },
    engineering: {
      hasTests:      r.profile.hasTests,
      hasDockerfile: r.profile.hasDockerfile,
      hasCICD:       r.profile.hasCICD,
      hasReadme:     r.profile.hasReadme,
      hasDeployment: r.profile.hasDeployment,
    },
  }
}

// ─── Page state machine ───────────────────────────────────────────────────────

type View = 'landing' | 'loading' | 'dashboard'

export default function Page() {
  const [view,       setView]       = useState<View>('landing')
  const [username,   setUsername]   = useState('')
  const [data,       setData]       = useState<ProfileData | null>(null)
  const [analyzedAt, setAnalyzedAt] = useState<string | undefined>()
  const [cached,     setCached]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // ── Trigger analysis ────────────────────────────────────────────────────────
  async function analyze(rawUsername: string) {
    const name = rawUsername.trim()
    if (!name) return

    setUsername(name)
    setError(null)
    setView('loading')

    try {
      const res = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: name }),
      })

      const json = await res.json()

      if (!res.ok) {
        // API returned a structured error
        setError((json as { error?: string }).error ?? 'Analysis failed. Please try again.')
        setView('landing')
        return
      }

      const result = json as AnalysisResult & { cached?: boolean }
      setData(fromApiResult(result))
      setAnalyzedAt(result.analyzedAt)
      setCached(result.cached ?? false)
      setView('dashboard')
    } catch {
      setError('Network error. Check your connection and try again.')
      setView('landing')
    }
  }

  // ── Reset to landing ────────────────────────────────────────────────────────
  function reset() {
    setView('landing')
    setData(null)
    setError(null)
  }

  // ── Re-analyse same username ────────────────────────────────────────────────
  function reanalyze() {
    if (username) analyze(username)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return <LoadingState username={username} onCancel={reset} />
  }

  if (view === 'dashboard' && data) {
    return (
      <Dashboard
        data={data}
        analyzedAt={analyzedAt}
        cached={cached}
        onReset={reset}
        onReanalyze={reanalyze}
      />
    )
  }

  // Landing (default)
  return <LandingHero onAnalyze={analyze} error={error} />
}
