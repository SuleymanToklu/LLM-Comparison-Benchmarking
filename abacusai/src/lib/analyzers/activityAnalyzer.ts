import type { ActivityMetrics, GitHubEvent } from "@/types"

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function analyzeActivity(events: GitHubEvent[]): ActivityMetrics {
  const now = Date.now()
  const since = now - NINETY_DAYS_MS
  const repoActivity = new Set<string>()
  let commitCount = 0

  for (const event of events) {
    const timestamp = new Date(event.created_at).getTime()
    if (Number.isNaN(timestamp) || timestamp < since) {
      continue
    }

    if (event.repo?.name) {
      repoActivity.add(event.repo.name.toLowerCase())
    }

    if (event.type === "PushEvent") {
      commitCount += event.payload?.commits?.length ?? 0
    }
  }

  const avgCommitsPerWeek = Number((commitCount / (90 / 7)).toFixed(2))
  const consistencyScore = clamp(Math.round((avgCommitsPerWeek / 8) * 100), 0, 100)

  return {
    avgCommitsPerWeek,
    activeReposLast90Days: repoActivity.size,
    consistencyScore
  }
}
