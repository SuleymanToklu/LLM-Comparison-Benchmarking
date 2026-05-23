import type { GitHubRepo, LanguageShare } from "@/types";

export function analyzeLanguages(repos: GitHubRepo[]): LanguageShare[] {
  const languageSizes = new Map<string, number>();

  for (const repo of repos) {
    const language = repo.language?.trim();
    if (!language) {
      continue;
    }

    languageSizes.set(language, (languageSizes.get(language) ?? 0) + Math.max(repo.size, 1));
  }

  const totalSize = Array.from(languageSizes.values()).reduce((sum, size) => sum + size, 0);
  if (totalSize <= 0) {
    return [];
  }

  return Array.from(languageSizes.entries())
    .map(([name, size]) => ({
      name,
      percentage: roundToOne((size / totalSize) * 100)
    }))
    .sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));
}

export function toLanguagePercentageMap(languages: LanguageShare[]): Record<string, number> {
  return Object.fromEntries(languages.map((language) => [language.name.toLowerCase(), language.percentage]));
}

export function sumLanguagePercentages(languagePercentages: Record<string, number>, names: string[]): number {
  return roundToOne(
    names.reduce((sum, name) => {
      return sum + (languagePercentages[name.toLowerCase()] ?? 0);
    }, 0)
  );
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}
