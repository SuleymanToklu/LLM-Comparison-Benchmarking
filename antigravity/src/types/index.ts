export interface NormalizedProfile {
  username: string;
  totalRepos: number;
  ownedRepos: number;
  activeReposLast90Days: number;
  topLanguages: { name: string; percentage: number }[];
  avgCommitsPerWeek: number;
  hasTests: boolean;
  hasDockerfile: boolean;
  hasCICD: boolean;
  hasReadme: boolean;
  hasDeployment: boolean;
  frontendExposure: "none" | "low" | "medium" | "high";
  backendExposure: "none" | "low" | "medium" | "high";
  devopsExposure: "none" | "low" | "medium" | "high";
  mlExposure: "none" | "low" | "medium" | "high";
  repoQualityScore: number;
  consistencyScore: number;
}

export interface DeveloperScores {
  backend: number;
  frontend: number;
  devops: number;
  testing: number;
  consistency: number;
  projectDepth: number;
  overallScore: number;
}

export interface AIInsights {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  careerFit: { role: string; confidence: number }[];
}

export interface GitHubUser {
  name: string;
  avatar_url: string;
  bio: string;
  location: string;
  followers: number;
  following: number;
  public_repos: number;
}

export interface AnalysisResult {
  profile: NormalizedProfile;
  scores: DeveloperScores;
  insights: AIInsights;
  user: GitHubUser;
}
