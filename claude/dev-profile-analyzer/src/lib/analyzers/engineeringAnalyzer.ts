import { GitHubRepo, EngineeringSignals } from '@/types'
import { fetchRepoContents } from '@/lib/github/fetcher'

// ─── File-name patterns ───────────────────────────────────────────────────────
//
// All comparisons are lower-cased. Patterns are matched against the file/dir
// name at the repo root, with the exception of CI/CD where we additionally
// check `.github/workflows/`.

const PATTERNS = {
  test: new Set([
    'test', 'tests', 'spec', 'specs', '__tests__', '__test__',
    'jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs',
    'vitest.config.ts', 'vitest.config.js', 'vitest.config.mts',
    'pytest.ini', 'conftest.py', 'setup.cfg',
    '.mocharc.js', '.mocharc.yml', '.mocharc.json', '.mocharc.yaml',
    'cypress.config.ts', 'cypress.config.js',
    'playwright.config.ts', 'playwright.config.js',
    'karma.conf.js', 'jasmine.json',
    'phpunit.xml', 'phpunit.xml.dist',
    'rspec.opts', '.rspec',
  ]),

  dockerfile: new Set([
    'dockerfile',
    'dockerfile.dev', 'dockerfile.prod', 'dockerfile.staging', 'dockerfile.test',
    'docker-compose.yml', 'docker-compose.yaml',
    'docker-compose.dev.yml', 'docker-compose.prod.yml',
    'docker-compose.override.yml',
    'compose.yml', 'compose.yaml',
  ]),

  /** Root-level CI indicators (no additional sub-directory check needed) */
  cicdRoot: new Set([
    '.travis.yml', '.travis.yaml',
    '.circleci',            // directory
    '.gitlab-ci.yml', '.gitlab-ci.yaml',
    'jenkinsfile',
    '.drone.yml', '.drone.yaml',
    'bitbucket-pipelines.yml',
    '.buildkite',           // directory
    'appveyor.yml', 'appveyor.yaml',
    'azure-pipelines.yml', 'azure-pipelines.yaml',
    '.semaphore',           // directory
    'circle.yml',           // old CircleCI v1
    'codefresh.yml',
    'wercker.yml',
  ]),

  readme: new Set([
    'readme.md', 'readme.txt', 'readme.rst', 'readme.adoc',
    'readme', 'readme.html', 'readme.org', 'readme.markdown',
  ]),

  deployment: new Set([
    'vercel.json', '.vercelignore',
    'netlify.toml', '_redirects', '_headers',
    'render.yaml', 'render.yml',
    'fly.toml',
    'railway.json', 'railway.toml',
    'heroku.yml', 'procfile',
    'appspec.yml',              // AWS CodeDeploy
    '.elasticbeanstalk',        // directory
    'serverless.yml', 'serverless.yaml', 'serverless.ts', 'serverless.js',
    'now.json',                 // legacy Vercel
    'k8s', 'kubernetes',        // directories
    'helm',                     // directory
    'cloudbuild.yaml', 'cloudbuild.yml',
    'app.yaml',                 // Google App Engine
    'cdk.json',                 // AWS CDK
    'pulumi.yaml',
    '.platform',                // Platform.sh
    'caprover-definition.json',
  ]),
} as const

// ─── Bounded concurrency helper ───────────────────────────────────────────────

/**
 * Execute an array of async tasks with at most `limit` running in parallel.
 * Failed tasks resolve as `null` (non-fatal).
 */
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<Array<T | null>> {
  const results: Array<T | null> = new Array(tasks.length).fill(null)
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      const idx = cursor++
      try {
        results[idx] = await tasks[idx]()
      } catch {
        // Leave as null; analysed count will reflect actual successes
      }
    }
  }

  const workerCount = Math.min(limit, tasks.length)
  if (workerCount === 0) return results

  await Promise.all(Array.from({ length: workerCount }, worker))
  return results
}

// ─── Per-repo signal extraction ───────────────────────────────────────────────

interface RepoSignals {
  hasTests:      boolean
  hasDockerfile: boolean
  hasCICD:       boolean
  hasReadme:     boolean
  hasDeployment: boolean
}

const EMPTY_SIGNALS: RepoSignals = {
  hasTests: false, hasDockerfile: false, hasCICD: false,
  hasReadme: false, hasDeployment: false,
}

/**
 * Check whether a `.github` directory contains a `workflows` sub-directory,
 * which indicates GitHub Actions CI/CD.  Returns `false` on any error.
 */
async function hasGitHubActionsWorkflows(owner: string, repoName: string): Promise<boolean> {
  const contents = await fetchRepoContents(owner, repoName, '.github')
  return contents.some(f => f.name.toLowerCase() === 'workflows' && f.type === 'dir')
}

async function analyzeRepo(owner: string, repo: GitHubRepo): Promise<RepoSignals> {
  const rootContents = await fetchRepoContents(owner, repo.name)
  if (rootContents.length === 0) return EMPTY_SIGNALS

  // Index root entries by lower-cased name for O(1) look-up
  const byName = new Map(rootContents.map(f => [f.name.toLowerCase(), f]))

  // ── CI/CD detection ─────────────────────────────────────────────────────
  // Check root-level CI files first (cheap), then GitHub Actions sub-path
  let hasCICD = [...byName.keys()].some(name => PATTERNS.cicdRoot.has(name))

  if (!hasCICD) {
    const githubDir = byName.get('.github')
    if (githubDir?.type === 'dir') {
      hasCICD = await hasGitHubActionsWorkflows(owner, repo.name)
    }
  }

  return {
    hasTests:      [...byName.keys()].some(name => PATTERNS.test.has(name)),
    hasDockerfile: [...byName.keys()].some(name => PATTERNS.dockerfile.has(name)),
    hasCICD,
    hasReadme:     [...byName.keys()].some(name => PATTERNS.readme.has(name)),
    hasDeployment: [...byName.keys()].some(name => PATTERNS.deployment.has(name)),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

const MAX_REPOS_TO_ANALYSE = 8
const MAX_CONCURRENCY       = 3

/**
 * Inspect the file trees of a sample of repos and aggregate engineering
 * maturity signals across them.
 *
 * Repo selection strategy: top by star count (most complete / mature repos),
 * then by most-recently pushed (to capture active work).
 */
export async function analyzeEngineeringSignals(
  repos: GitHubRepo[],
  ownerLogin: string
): Promise<EngineeringSignals> {
  const empty: EngineeringSignals = {
    hasTests: false, hasDockerfile: false, hasCICD: false,
    hasReadme: false, hasDeployment: false,
    reposAnalyzed: 0, reposWithTests: 0, reposWithReadme: 0,
  }

  if (repos.length === 0) return empty

  // Prioritise: high-star repos (most likely to have mature tooling) then recency
  const sorted = [...repos].sort((a, b) => {
    const starDiff = b.stargazers_count - a.stargazers_count
    if (starDiff !== 0) return starDiff
    const aTs = a.pushed_at ?? a.updated_at
    const bTs = b.pushed_at ?? b.updated_at
    return new Date(bTs).getTime() - new Date(aTs).getTime()
  })

  const sample = sorted.slice(0, MAX_REPOS_TO_ANALYSE)
  const tasks  = sample.map(repo => () => analyzeRepo(ownerLogin, repo))

  const rawResults = await withConcurrency(tasks, MAX_CONCURRENCY)

  // Filter successful results
  const valid = rawResults.filter((r): r is RepoSignals => r !== null)

  if (valid.length === 0) return empty

  const reposWithTests  = valid.filter(s => s.hasTests).length
  const reposWithReadme = valid.filter(s => s.hasReadme).length

  return {
    hasTests:      valid.some(s => s.hasTests),
    hasDockerfile: valid.some(s => s.hasDockerfile),
    hasCICD:       valid.some(s => s.hasCICD),
    hasReadme:     valid.some(s => s.hasReadme),
    hasDeployment: valid.some(s => s.hasDeployment),
    reposAnalyzed: valid.length,
    reposWithTests,
    reposWithReadme,
  }
}
