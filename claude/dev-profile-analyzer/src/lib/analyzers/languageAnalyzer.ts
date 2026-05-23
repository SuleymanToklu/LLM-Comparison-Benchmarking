import { GitHubRepo, LanguageEntry, ExposureLevel } from '@/types'

// ─── Language classification sets ────────────────────────────────────────────

/**
 * Languages that are exclusively or primarily frontend/UI.
 * JavaScript and TypeScript are intentionally excluded (they're ambiguous).
 */
const PURE_FRONTEND_LANGUAGES = new Set([
  'html', 'css', 'scss', 'less', 'sass', 'svelte', 'vue', 'coffeescript',
])

/**
 * Languages strongly associated with backend / server / systems work.
 * Python and R are excluded here because they're also ML languages
 * (resolved via topic context instead).
 */
const BACKEND_LANGUAGES = new Set([
  'java', 'go', 'rust', 'kotlin', 'scala', 'elixir', 'erlang',
  'haskell', 'c', 'c++', 'c#', 'ruby', 'php', 'perl', 'lua',
  'clojure', 'groovy', 'dart', 'swift', 'crystal',
])

/** Languages used for infrastructure, scripting, and configuration. */
const DEVOPS_LANGUAGES = new Set([
  'hcl', 'dockerfile', 'makefile', 'shell', 'powershell', 'nix', 'puppet', 'jinja',
])

/** Primary ML/data-science languages. Python is tracked separately due to dual-use. */
const ML_LANGUAGES = new Set(['r', 'julia', 'matlab', 'fortran', 'cuda'])

/** Canonical display names for languages that need special casing */
const DISPLAY_NAMES: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  'c++': 'C++',
  'c#': 'C#',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  kotlin: 'Kotlin',
  swift: 'Swift',
  php: 'PHP',
  scala: 'Scala',
  shell: 'Shell',
  dart: 'Dart',
  r: 'R',
  hcl: 'HCL',
  vue: 'Vue',
  svelte: 'Svelte',
  lua: 'Lua',
  elixir: 'Elixir',
  erlang: 'Erlang',
  haskell: 'Haskell',
  'c': 'C',
}

// ─── Topic-to-domain maps ─────────────────────────────────────────────────────

const FRONTEND_TOPICS = new Set([
  'react', 'reactjs', 'vue', 'vuejs', 'angular', 'angularjs',
  'svelte', 'sveltekit', 'nextjs', 'next-js', 'gatsby', 'remix',
  'nuxt', 'nuxtjs', 'astro', 'qwik', 'solid', 'solidjs',
  'tailwindcss', 'tailwind', 'bootstrap', 'material-ui', 'shadcn',
  'electron', 'ionic', 'react-native', 'expo', 'pwa',
  'storybook', 'vite', 'webpack', 'parcel',
  'frontend', 'ui', 'web-components', 'web', 'spa',
])

const BACKEND_TOPICS = new Set([
  'express', 'expressjs', 'fastapi', 'django', 'flask', 'rails',
  'laravel', 'nestjs', 'koa', 'hapi', 'fastify', 'strapi',
  'spring', 'spring-boot', 'quarkus', 'micronaut',
  'graphql', 'rest', 'rest-api', 'grpc', 'trpc',
  'microservices', 'api', 'backend', 'server', 'serverless',
  'nodejs', 'node', 'deno', 'bun',
  'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite',
  'prisma', 'typeorm', 'sequelize', 'drizzle',
  'auth', 'jwt', 'oauth', 'websocket',
])

const DEVOPS_TOPICS = new Set([
  'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'helm',
  'nginx', 'apache', 'traefik', 'ci-cd', 'cicd', 'devops',
  'infrastructure', 'iac', 'linux', 'bash', 'sysadmin',
  'monitoring', 'prometheus', 'grafana', 'loki', 'datadog',
  'jenkins', 'github-actions', 'gitlab-ci', 'argocd', 'fluxcd',
  'aws', 'azure', 'gcp', 'cloud', 'deployment', 'pulumi', 'cdk',
])

const ML_TOPICS = new Set([
  'machine-learning', 'deep-learning', 'artificial-intelligence', 'ai', 'ml',
  'pytorch', 'tensorflow', 'keras', 'scikit-learn', 'sklearn',
  'pandas', 'numpy', 'scipy', 'matplotlib', 'seaborn',
  'huggingface', 'transformers', 'nlp', 'computer-vision', 'cv',
  'data-science', 'neural-network', 'llm', 'openai', 'langchain',
  'llama', 'rag', 'embeddings', 'fine-tuning',
])

// ─── Language distribution ────────────────────────────────────────────────────

/**
 * Compute the language distribution across a list of repos.
 * Counts one vote per repo for its primary language; percentage is
 * relative to repos-that-have-a-language (not total repos).
 */
export function computeLanguageDistribution(repos: GitHubRepo[]): LanguageEntry[] {
  if (repos.length === 0) return []

  const langCount: Record<string, number> = {}

  for (const repo of repos) {
    if (!repo.language) continue
    const key = repo.language.toLowerCase()
    langCount[key] = (langCount[key] ?? 0) + 1
  }

  const totalWithLanguage = Object.values(langCount).reduce((a, b) => a + b, 0)
  if (totalWithLanguage === 0) return []

  return Object.entries(langCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([rawName, count]) => ({
      name: DISPLAY_NAMES[rawName] ?? capitalise(rawName),
      percentage: Math.round((count / totalWithLanguage) * 100),
      repoCount: count,
    }))
}

// ─── Tech-domain exposure ─────────────────────────────────────────────────────

export interface ExposureAnalysis {
  frontendExposure: ExposureLevel
  backendExposure: ExposureLevel
  devopsExposure: ExposureLevel
  mlExposure: ExposureLevel
  detectedFrontendFrameworks: string[]
  detectedBackendFrameworks: string[]
  detectedDevOpsTools: string[]
  detectedMLFrameworks: string[]
}

/**
 * Score each repo's language + topics + description tokens against domain
 * vocabulary, then normalise per-repo to get an exposure level.
 *
 * Disambiguation rules for ambiguous languages:
 * - JavaScript/TypeScript: neutral until topic context settles the domain.
 * - Python: backend by default, overridden to ML when ML topics are present.
 */
export function analyzeExposure(repos: GitHubRepo[]): ExposureAnalysis {
  let frontendScore = 0
  let backendScore = 0
  let devopsScore = 0
  let mlScore = 0

  const frontendFrameworks = new Set<string>()
  const backendFrameworks  = new Set<string>()
  const devopsTools        = new Set<string>()
  const mlFrameworksSet    = new Set<string>()

  for (const repo of repos) {
    const lang      = repo.language?.toLowerCase() ?? ''
    const topics    = (repo.topics ?? []).map(t => t.toLowerCase())
    const descWords = (repo.description ?? '').toLowerCase().split(/\W+/).filter(Boolean)
    const nameParts = repo.name.toLowerCase().split(/[-_]/)

    // A combined token set for O(1) membership tests
    const allTokens = new Set([...topics, ...descWords, ...nameParts])

    // ── Language-based votes ─────────────────────────────────────────────────
    if (PURE_FRONTEND_LANGUAGES.has(lang))   frontendScore += 2
    if (BACKEND_LANGUAGES.has(lang))          backendScore  += 2
    if (DEVOPS_LANGUAGES.has(lang))           devopsScore   += 2
    if (ML_LANGUAGES.has(lang))               mlScore       += 2

    if (lang === 'python') {
      const topicMl      = topics.some(t => ML_TOPICS.has(t))
      const topicBackend = topics.some(t => BACKEND_TOPICS.has(t))
      if (topicMl)                         mlScore      += 2
      if (topicBackend)                    backendScore += 2
      if (!topicMl && !topicBackend)       backendScore += 1 // default lean
    }

    if (lang === 'javascript' || lang === 'typescript') {
      const topicFrontend = topics.some(t => FRONTEND_TOPICS.has(t))
      const topicBackend  = topics.some(t => BACKEND_TOPICS.has(t))
      if (topicFrontend)                  frontendScore += 2
      if (topicBackend)                   backendScore  += 2
      if (!topicFrontend && !topicBackend) {
        // Neutral JS/TS — contribute 0.5 to both sides
        frontendScore += 0.5
        backendScore  += 0.5
      }
    }

    // ── Topic-based votes + framework accumulation ───────────────────────────
    for (const token of allTokens) {
      if (FRONTEND_TOPICS.has(token)) { frontendScore += 1; frontendFrameworks.add(token) }
      if (BACKEND_TOPICS.has(token))  { backendScore  += 1; backendFrameworks.add(token) }
      if (DEVOPS_TOPICS.has(token))   { devopsScore   += 1; devopsTools.add(token) }
      if (ML_TOPICS.has(token))       { mlScore       += 1; mlFrameworksSet.add(token) }
    }
  }

  const n = repos.length || 1

  return {
    frontendExposure: scoreToLevel(frontendScore / n),
    backendExposure:  scoreToLevel(backendScore  / n),
    devopsExposure:   scoreToLevel(devopsScore   / n),
    mlExposure:       scoreToLevel(mlScore       / n),
    detectedFrontendFrameworks: Array.from(frontendFrameworks).slice(0, 8),
    detectedBackendFrameworks:  Array.from(backendFrameworks).slice(0, 8),
    detectedDevOpsTools:        Array.from(devopsTools).slice(0, 8),
    detectedMLFrameworks:       Array.from(mlFrameworksSet).slice(0, 8),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a per-repo average score to a qualitative exposure level.
 *
 * The thresholds are intentionally generous:
 * - < 0.3 → low (occasional use)
 * - < 1.2 → medium (regular use)
 * - ≥ 1.2 → high (dominant focus)
 */
function scoreToLevel(normalised: number): ExposureLevel {
  if (normalised <= 0)  return 'none'
  if (normalised < 0.3) return 'low'
  if (normalised < 1.2) return 'medium'
  return 'high'
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
