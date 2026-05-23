// ─── Frontend-specific data types ─────────────────────────────────────────────
// These are the shapes that every UI component expects.
// The page transforms the raw API response (AnalysisResult) into this contract.

export interface ProfileStats {
  username: string
  name: string | null
  bio: string | null
  avatar: string
  location: string | null
  profileUrl: string
  followers: number
  following: number
  publicRepos: number
}

export interface DomainScores {
  backend: number
  frontend: number
  devops: number
  testing: number
  consistency: number
  projectDepth: number
  overallScore: number
}

export interface LanguageEntry {
  name: string
  percentage: number
}

export interface Insights {
  summary: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  careerFit: { role: string; confidence: number }[]
}

export interface EngineeringSignals {
  hasTests: boolean
  hasDockerfile: boolean
  hasCICD: boolean
  hasReadme: boolean
  hasDeployment: boolean
}

export interface ProfileData {
  profile: ProfileStats
  scores: DomainScores
  topLanguages: LanguageEntry[]
  insights: Insights
  engineering: EngineeringSignals
}
