import type { DeveloperScores, NormalizedProfile } from "@/types"

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function exposureScore(exposure: NormalizedProfile["frontendExposure"]) {
  if (exposure === "none") return 0
  if (exposure === "low") return 35
  if (exposure === "medium") return 65
  return 90
}

export function computeScores(normalized: NormalizedProfile): DeveloperScores {
  const testing = clampScore(
    (normalized.hasTests ? 40 : 0) +
      (normalized.repoQualityScore >= 30 ? 30 : 0) +
      (normalized.hasCICD ? 30 : 0)
  )

  const devops = clampScore(
    (normalized.hasDockerfile ? 40 : 0) +
      (normalized.hasCICD ? 30 : 0) +
      (normalized.hasDeployment ? 30 : 0)
  )

  const frontend = clampScore(exposureScore(normalized.frontendExposure))
  const backend = clampScore(exposureScore(normalized.backendExposure))
  const consistency = clampScore(normalized.consistencyScore)

  const projectDepth = clampScore(
    normalized.repoQualityScore * 0.4 +
      Math.min(100, normalized.ownedRepos * 4) * 0.25 +
      Math.min(100, normalized.activeReposLast90Days * 10) * 0.35
  )

  const overallScore = clampScore(
    backend * 0.2 +
      frontend * 0.2 +
      devops * 0.15 +
      testing * 0.15 +
      consistency * 0.15 +
      projectDepth * 0.15
  )

  return {
    backend,
    frontend,
    devops,
    testing,
    consistency,
    projectDepth,
    overallScore
  }
}
