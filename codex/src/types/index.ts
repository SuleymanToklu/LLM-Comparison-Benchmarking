export type ExposureLevel = "none" | "low" | "medium" | "high";

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  fork: boolean;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  size: number;
  default_branch: string | null;
  pushed_at: string | null;
  updated_at: string;
  created_at: string;
  topics?: string[];
  homepage?: string | null;
}

export interface GitHubEvent {
  id: string;
  type: string;
  created_at: string;
  repo: {
    name: string;
  };
  payload?: {
    commits?: Array<{
      sha: string;
      message?: string;
    }>;
  };
}

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  resetAt: string | null;
}

export interface GitHubContentEntry {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string | null;
  git_url: string | null;
  download_url: string | null;
  type: "file" | "dir" | "symlink" | "submodule";
  content?: string;
  encoding?: string;
}

export interface RepoManifest {
  path: string;
  content: string;
}

export interface RepoFileSnapshot {
  repoFullName: string;
  defaultBranch: string | null;
  analyzed: boolean;
  truncated: boolean;
  paths: string[];
  manifests: RepoManifest[];
  error?: string;
}

export interface GitHubDataBundle {
  user: GitHubUser;
  repos: GitHubRepo[];
  ownedRepos: GitHubRepo[];
  events: GitHubEvent[];
  fileSnapshots: RepoFileSnapshot[];
  rateLimit?: GitHubRateLimit;
  warnings: string[];
}

export interface LanguageShare {
  name: string;
  percentage: number;
}

export interface ActivityAnalysis {
  avgCommitsPerWeek: number;
  activeReposLast90Days: number;
  consistencyScore: number;
  commitCountLast90Days: number;
  activeWeeksLast90Days: number;
  weeklyCommits: { week: string; commits: number }[];
}

export interface RepoSignal {
  repoName: string;
  repoFullName: string;
  hasTests: boolean;
  hasDockerfile: boolean;
  hasCICD: boolean;
  hasReadme: boolean;
  hasDeployment: boolean;
  frontendTechnologies: string[];
  backendTechnologies: string[];
  devopsTechnologies: string[];
  mlTechnologies: string[];
  error?: string;
}

export interface EngineeringSignals {
  hasTests: boolean;
  hasDockerfile: boolean;
  hasCICD: boolean;
  hasReadme: boolean;
  hasDeployment: boolean;
  reposWithTests: number;
  reposWithDockerfile: number;
  reposWithCICD: number;
  reposWithReadme: number;
  reposWithDeployment: number;
  frontendRepoCount: number;
  backendRepoCount: number;
  devopsRepoCount: number;
  mlRepoCount: number;
  frontendTechnologies: string[];
  backendTechnologies: string[];
  devopsTechnologies: string[];
  mlTechnologies: string[];
  repoQualityScore: number;
  repoSignals: RepoSignal[];
  warnings: string[];
}

export type RepositoryQualityAnalysis = EngineeringSignals;

export interface NormalizedProfile {
  username: string;
  totalRepos: number;
  ownedRepos: number;
  activeReposLast90Days: number;
  topLanguages: LanguageShare[];
  avgCommitsPerWeek: number;
  hasTests: boolean;
  hasDockerfile: boolean;
  hasCICD: boolean;
  hasReadme: boolean;
  hasDeployment: boolean;
  frontendExposure: ExposureLevel;
  backendExposure: ExposureLevel;
  devopsExposure: ExposureLevel;
  mlExposure: ExposureLevel;
  repoQualityScore: number;
  consistencyScore: number;
}

export interface ScoringContext {
  reposWithTests: number;
  avgRepoSizeKb: number;
  totalStars: number;
  frontendTechnologyCount: number;
  backendTechnologyCount: number;
  devopsTechnologyCount: number;
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

export interface GitHubProfileSummary {
  username: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
}

export interface AnalyzedRepository {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  size: number;
  pushedAt: string | null;
  updatedAt: string;
  topics: string[];
  signals: RepoSignal | null;
}

export interface AnalysisResponse {
  profile: GitHubProfileSummary;
  normalized: NormalizedProfile;
  scores: DeveloperScores;
  insights: AIInsights;
  aiStatus: {
    ok: boolean;
    error?: string;
  };
  activity: ActivityAnalysis;
  quality: RepositoryQualityAnalysis;
  repositories: AnalyzedRepository[];
  warnings: string[];
  rateLimit?: GitHubRateLimit;
  cached: boolean;
  generatedAt: string;
}

export interface ErrorResponse {
  error: string;
  detail?: string;
}

export interface LanguageAnalysis {
  topLanguages: LanguageShare[];
  languagePercentages: Record<string, number>;
}

export interface EngineeringAnalysis {
  normalized: NormalizedProfile;
  quality: RepositoryQualityAnalysis;
  activity: ActivityAnalysis;
  repositories: AnalyzedRepository[];
}
