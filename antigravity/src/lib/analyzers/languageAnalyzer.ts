export function analyzeLanguages(repos: any[]): { name: string; percentage: number }[] {
  const langCounts: Record<string, number> = {};
  let totalWithLang = 0;

  for (const repo of repos) {
    if (repo.language) {
      langCounts[repo.language] = (langCounts[repo.language] || 0) + 1;
      totalWithLang++;
    }
  }

  const topLanguages = Object.entries(langCounts)
    .map(([name, count]) => ({
      name,
      percentage: totalWithLang > 0 ? Math.round((count / totalWithLang) * 100) : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  return topLanguages;
}

export function evaluateExposure(
  repos: any[],
  keywords: string[]
): "none" | "low" | "medium" | "high" {
  let matches = 0;
  for (const repo of repos) {
    const textToSearch = `${repo.name} ${repo.description || ""} ${repo.language || ""}`.toLowerCase();
    if (keywords.some((kw) => textToSearch.includes(kw.toLowerCase()))) {
      matches++;
    }
  }

  const ratio = repos.length > 0 ? matches / repos.length : 0;
  if (ratio === 0) return "none";
  if (ratio < 0.1) return "low";
  if (ratio < 0.3) return "medium";
  return "high";
}
