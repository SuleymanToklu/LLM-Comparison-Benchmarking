export interface LanguageShare {
  name: string
  percentage: number
}

export type ExposureLevel = "none" | "low" | "medium" | "high"

export interface NormalizedProfile {
  username: string
  totalRepos: number
  ownedRepos: number
  activeReposLast90Days: number
  topLanguages: LanguageShare[]
  avgCommitsPerWeek: number
  hasTests: boolean
  hasDockerfile: boolean
  hasCICD: boolean
  hasReadme: boolean
  hasDeployment: boolean
  frontendExposure: ExposureLevel
  backendExposure: ExposureLevel
  devopsExposure: ExposureLevel
  mlExposure: ExposureLevel
  repoQualityScore: number
  consistencyScore: number
}

export interface DeveloperScores {
  backend: number
  frontend: number
  devops: number
  testing: number
  consistency: number
  projectDepth: number
  overallScore: number
}

export interface AIInsights {
  summary: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  careerFit: Array<{ role: string; confidence: number }>
}

export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
  bio: string | null
  location?: string | null
  followers: number
  following: number
  public_repos: number
  html_url: string
}

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  fork: boolean
  stargazers_count: number
  size: number
  language: string | null
  topics?: string[]
  description: string | null
  pushed_at: string
  updated_at: string
  created_at: string
  default_branch: string
}

export interface GitHubEvent {
  type: string
  created_at: string
  repo: { name: string }
  payload?: {
    commits?: Array<{ sha: string }>
  }
}

export interface GitHubContentFile {
  type: "file"
  name: string
  path: string
}

export interface GitHubContentDir {
  type: "dir"
  name: string
  path: string
}

export type GitHubContentItem = GitHubContentFile | GitHubContentDir

export interface EngineeringSignals {
  hasTests: boolean
  hasDockerfile: boolean
  hasCICD: boolean
  hasReadme: boolean
  hasDeployment: boolean
  testRepoRatio: number
  reposWithReadmeRatio: number
  reposWithCICDRatio: number
  reposWithDockerRatio: number
}

export interface ActivityMetrics {
  avgCommitsPerWeek: number
  activeReposLast90Days: number
  consistencyScore: number
}

export interface AnalysisResult {
  user: GitHubUser
  normalized: NormalizedProfile
  scores: DeveloperScores
  insights: AIInsights | null
  warnings: string[]
  fetchedAt: string
}
