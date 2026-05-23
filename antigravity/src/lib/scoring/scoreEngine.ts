import { DeveloperScores, NormalizedProfile } from "../../types";

export function calculateScores(profile: NormalizedProfile, repos: any[]): DeveloperScores {
  let testing = 0;
  if (profile.hasTests) testing += 40;
  const testRatio = profile.repoQualityScore / 100;
  if (testRatio > 0.3) testing += 30;
  if (profile.hasCICD) testing += 30;

  let devops = 0;
  if (profile.hasDockerfile) devops += 40;
  if (profile.hasCICD) devops += 30;
  if (profile.hasDeployment) devops += 30;

  let consistency = Math.min(100, Math.round(profile.avgCommitsPerWeek * 5));
  if (profile.activeReposLast90Days > 5) consistency = Math.min(100, consistency + 20);

  let totalStars = 0;
  let totalSize = 0;
  for (const r of repos) {
    totalStars += r.stargazers_count || 0;
    totalSize += r.size || 0;
  }
  const avgStars = repos.length > 0 ? totalStars / repos.length : 0;
  const avgSize = repos.length > 0 ? totalSize / repos.length : 0;
  
  let projectDepth = 30;
  if (avgStars > 1) projectDepth += 30;
  if (avgStars > 10) projectDepth += 20;
  if (avgSize > 5000) projectDepth += 20;
  projectDepth = Math.min(100, projectDepth);

  const exposureToScore = (exp: string) => {
    switch (exp) {
      case "high": return 100;
      case "medium": return 70;
      case "low": return 40;
      default: return 10;
    }
  };
  
  const frontend = exposureToScore(profile.frontendExposure);
  const backend = exposureToScore(profile.backendExposure);

  const overallScore = Math.round((testing + devops + consistency + projectDepth + frontend + backend) / 6);

  profile.repoQualityScore = Math.round((testing + devops) / 2);
  profile.consistencyScore = consistency;

  return {
    backend,
    frontend,
    devops,
    testing,
    consistency,
    projectDepth,
    overallScore,
  };
}
