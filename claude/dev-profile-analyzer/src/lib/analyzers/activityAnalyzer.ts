import { GitHubEvent, GitHubRepo, ActivityMetrics } from '@/types'

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
const WEEKS_IN_90_DAYS = NINETY_DAYS_MS / (7 * 24 * 60 * 60 * 1000) // ≈ 12.857

/**
 * Return the ISO 8601 week key for a Date, e.g. "2024-W03".
 *
 * ISO week starts on Monday; the week that contains the year's first Thursday
 * is week 1.  Using this (instead of `Math.floor(dayOfYear / 7)`) ensures
 * consistent bucketing at year boundaries.
 */
function isoWeekKey(date: Date): string {
  // Work on a copy; move to Thursday of the same ISO week
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  )
  return `${d.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

/**
 * Analyse a user's public event stream and repo list to derive activity metrics.
 *
 * @param events - Raw public events from GitHub (may be empty for private profiles)
 * @param repos  - Owned, non-forked repositories
 */
export function analyzeActivity(
  events: GitHubEvent[],
  repos: GitHubRepo[]
): ActivityMetrics {
  const cutoffMs = Date.now() - NINETY_DAYS_MS

  // ── Push-event analysis ───────────────────────────────────────────────────

  const recentPushes = events.filter(
    e => e.type === 'PushEvent' && new Date(e.created_at).getTime() > cutoffMs
  )

  // `distinct_size` is the authoritative commit count for a PushEvent.
  // Fall back to `commits.length`, then 1 if the payload is sparse.
  const totalCommits = recentPushes.reduce((acc, e) => {
    const count =
      e.payload.distinct_size ??
      e.payload.commits?.length ??
      1
    return acc + count
  }, 0)

  const avgCommitsPerWeek = Math.round(totalCommits / WEEKS_IN_90_DAYS)

  // ── Consistency score ─────────────────────────────────────────────────────

  // Count distinct ISO weeks that had at least one push
  const weekBuckets = new Set<string>()
  for (const event of recentPushes) {
    weekBuckets.add(isoWeekKey(new Date(event.created_at)))
  }

  const activeWeeksLast90Days = weekBuckets.size
  const maxPossibleWeeks = Math.ceil(WEEKS_IN_90_DAYS) // 13

  // Linear: 100 = pushed every single week; 0 = no pushes at all
  const consistencyScore = Math.min(
    100,
    Math.round((activeWeeksLast90Days / maxPossibleWeeks) * 100)
  )

  // ── Active repos ──────────────────────────────────────────────────────────

  // A repo is "active" if it received a push in the last 90 days.
  const activeReposLast90Days = repos.filter(r => {
    const ts = r.pushed_at ?? r.updated_at
    return ts && new Date(ts).getTime() > cutoffMs
  }).length

  return {
    avgCommitsPerWeek,
    activeReposLast90Days,
    consistencyScore,
    totalPushEventsLast90Days: recentPushes.length,
    activeWeeksLast90Days,
  }
}
