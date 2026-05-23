import type { DeveloperScores, ExposureLevel, NormalizedProfile, ScoringContext } from "@/types";

const EXPOSURE_BASE_SCORE: Record<ExposureLevel, number> = {
  none: 0,
  low: 35,
  medium: 68,
  high: 90
};

export function calculateDeveloperScores(profile: NormalizedProfile, context: ScoringContext): DeveloperScores {
  const backend = calculateDomainScore(profile.backendExposure, context.backendTechnologyCount);
  const frontend = calculateDomainScore(profile.frontendExposure, context.frontendTechnologyCount);
  const devops = calculateDevopsScore(profile);
  const testing = calculateTestingScore(profile, context);
  const consistency = clampScore(profile.consistencyScore);
  const projectDepth = calculateProjectDepthScore(profile, context);
  const overallScore = clampScore(
    Math.round(
      backend * 0.18 +
        frontend * 0.18 +
        devops * 0.16 +
        testing * 0.16 +
        consistency * 0.14 +
        projectDepth * 0.18
    )
  );

  return {
    backend,
    frontend,
    devops,
    testing,
    consistency,
    projectDepth,
    overallScore
  };
}

function calculateTestingScore(profile: NormalizedProfile, context: ScoringContext): number {
  let score = 0;
  const testedRepoRatio = profile.ownedRepos > 0 ? context.reposWithTests / profile.ownedRepos : 0;

  if (profile.hasTests) {
    score += 40;
  }
  if (testedRepoRatio > 0.3) {
    score += 30;
  }
  if (profile.hasCICD) {
    score += 30;
  }

  return clampScore(score);
}

function calculateDevopsScore(profile: NormalizedProfile): number {
  let score = 0;

  if (profile.hasDockerfile) {
    score += 40;
  }
  if (profile.hasCICD) {
    score += 30;
  }
  if (profile.hasDeployment) {
    score += 30;
  }

  return clampScore(score);
}

function calculateDomainScore(exposure: ExposureLevel, technologyCount: number): number {
  return clampScore(Math.round(EXPOSURE_BASE_SCORE[exposure] + Math.min(technologyCount * 4, 10)));
}

function calculateProjectDepthScore(profile: NormalizedProfile, context: ScoringContext): number {
  if (profile.ownedRepos === 0) {
    return 0;
  }

  const avgRepoSizeScore = Math.min(context.avgRepoSizeKb / 5_000, 1) * 34;
  const avgStars = context.totalStars / profile.ownedRepos;
  const starScore = Math.min(Math.log1p(avgStars) / Math.log1p(50), 1) * 24;
  const nonForkRatio = profile.totalRepos > 0 ? profile.ownedRepos / profile.totalRepos : 1;
  const nonForkScore = Math.min(nonForkRatio, 1) * 22;
  const activityScore = Math.min(profile.activeReposLast90Days / profile.ownedRepos, 1) * 12;
  const qualityScore = Math.min(profile.repoQualityScore / 100, 1) * 8;

  return clampScore(Math.round(avgRepoSizeScore + starScore + nonForkScore + activityScore + qualityScore));
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}
