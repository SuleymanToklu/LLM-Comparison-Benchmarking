import type { ActivityAnalysis, GitHubEvent } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYSIS_DAYS = 90;
const WEEK_COUNT = 13;

export function analyzeActivity(events: GitHubEvent[], now = new Date()): ActivityAnalysis {
  const cutoff = new Date(now.getTime() - ANALYSIS_DAYS * DAY_MS);
  const weeklyBuckets = buildWeekBuckets(now);
  const activeRepos = new Set<string>();
  let commitCountLast90Days = 0;

  for (const event of events) {
    if (event.type !== "PushEvent") {
      continue;
    }

    const eventDate = new Date(event.created_at);
    if (!Number.isFinite(eventDate.getTime()) || eventDate < cutoff || eventDate > now) {
      continue;
    }

    activeRepos.add(event.repo.name.toLowerCase());
    const commits = Math.max(event.payload?.commits?.length ?? 0, 1);
    commitCountLast90Days += commits;

    const bucket = weeklyBuckets.find((week) => eventDate >= week.start && eventDate <= week.end);
    if (bucket) {
      bucket.commits += commits;
    }
  }

  const activeWeeksLast90Days = weeklyBuckets.filter((week) => week.commits > 0).length;
  const avgCommitsPerWeek = roundToOne(commitCountLast90Days / WEEK_COUNT);

  return {
    avgCommitsPerWeek,
    activeReposLast90Days: activeRepos.size,
    consistencyScore: calculateConsistencyScore(avgCommitsPerWeek, activeWeeksLast90Days),
    commitCountLast90Days,
    activeWeeksLast90Days,
    weeklyCommits: weeklyBuckets.map((week) => ({
      week: week.label,
      commits: week.commits
    }))
  };
}

function buildWeekBuckets(now: Date): Array<{ label: string; start: Date; end: Date; commits: number }> {
  const currentWeekStart = startOfUtcWeek(now);

  return Array.from({ length: WEEK_COUNT }, (_, offset) => {
    const weeksAgo = WEEK_COUNT - 1 - offset;
    const start = new Date(currentWeekStart.getTime() - weeksAgo * 7 * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS - 1);

    return {
      label: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`,
      start,
      end,
      commits: 0
    };
  });
}

function startOfUtcWeek(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return start;
}

function calculateConsistencyScore(avgCommitsPerWeek: number, activeWeeksLast90Days: number): number {
  const frequencyScore = Math.min(avgCommitsPerWeek / 8, 1) * 65;
  const spreadScore = Math.min(activeWeeksLast90Days / WEEK_COUNT, 1) * 35;
  return clampScore(Math.round(frequencyScore + spreadScore));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}
