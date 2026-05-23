export function analyzeActivity(events: any[], repos: any[]): { avgCommitsPerWeek: number; activeReposLast90Days: number; consistencyScore: number } {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const activeReposLast90Days = repos.filter(
    (r) => new Date(r.pushed_at) >= ninetyDaysAgo || new Date(r.updated_at) >= ninetyDaysAgo
  ).length;

  const pushEvents = events.filter(
    (e) => e.type === "PushEvent" && new Date(e.created_at) >= ninetyDaysAgo
  );

  let totalCommits = 0;
  for (const event of pushEvents) {
    totalCommits += event.payload?.commits?.length || 0;
  }

  const weeksIn90Days = 90 / 7;
  const avgCommitsPerWeek = parseFloat((totalCommits / weeksIn90Days).toFixed(2));

  let consistencyScore = Math.min(100, Math.round(avgCommitsPerWeek * 5));
  if (activeReposLast90Days > 5) {
    consistencyScore = Math.min(100, consistencyScore + 20);
  } else if (activeReposLast90Days > 2) {
    consistencyScore = Math.min(100, consistencyScore + 10);
  }

  return {
    avgCommitsPerWeek,
    activeReposLast90Days,
    consistencyScore,
  };
}
