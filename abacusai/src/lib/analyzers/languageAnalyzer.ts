import type { GitHubRepo, LanguageShare } from "@/types"

export function analyzeLanguages(repos: GitHubRepo[]): LanguageShare[] {
  if (repos.length === 0) {
    return []
  }

  const languageCount = new Map<string, number>()

  for (const repo of repos) {
    if (!repo.language) {
      continue
    }

    const key = repo.language.trim()
    if (!key) {
      continue
    }

    languageCount.set(key, (languageCount.get(key) ?? 0) + 1)
  }

  const total = Array.from(languageCount.values()).reduce((acc, value) => acc + value, 0)
  if (total === 0) {
    return []
  }

  return Array.from(languageCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      percentage: Number(((count / total) * 100).toFixed(2))
    }))
}
