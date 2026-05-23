import { GitHubRepo, RepoDetails } from '@/types'

export function analyzeRepoQuality(
  ownedRepos: GitHubRepo[],
  repoDetails: RepoDetails[]
): {
  repoQualityScore: number
  hasTests: boolean
  hasDockerfile: boolean
  hasCICD: boolean
  hasReadme: boolean
  hasDeployment: boolean
} {
  if (ownedRepos.length === 0) {
    return {
      repoQualityScore: 0,
      hasTests: false,
      hasDockerfile: false,
      hasCICD: false,
      hasReadme: false,
      hasDeployment: false,
    }
  }

  const hasTests = repoDetails.some((d) => d.hasTests)
  const hasDockerfile = repoDetails.some((d) => d.hasDockerfile)
  const hasCICD = repoDetails.some((d) => d.hasCICD)
  const hasReadme = repoDetails.some((d) => d.hasReadme)
  const hasDeployment = repoDetails.some((d) => d.hasDeployment)

  // Percentage of repos with tests
  const reposWithTests = repoDetails.filter((d) => d.hasTests).length
  const testCoverage = reposWithTests / ownedRepos.length

  // Average stars
  const avgStars =
    ownedRepos.reduce((acc, r) => acc + r.stargazers_count, 0) / ownedRepos.length

  // Repos with description
  const withDescription = ownedRepos.filter((r) => r.description && r.description.length > 5).length
  const descriptionRatio = withDescription / ownedRepos.length

  // Score components (out of 100)
  let score = 0
  score += hasReadme ? 20 : 0
  score += hasCICD ? 20 : 0
  score += hasDockerfile ? 15 : 0
  score += hasDeployment ? 10 : 0
  score += hasTests ? 15 : 0
  score += Math.min(10, Math.round(testCoverage * 10))
  score += Math.min(5, Math.round(descriptionRatio * 5))
  score += Math.min(5, Math.round(Math.log1p(avgStars) * 2))

  return {
    repoQualityScore: Math.min(100, score),
    hasTests,
    hasDockerfile,
    hasCICD,
    hasReadme,
    hasDeployment,
  }
}
