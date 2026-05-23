import { fetchRepoContents } from "@/lib/github/fetcher"
import type { EngineeringSignals, GitHubContentItem, GitHubRepo } from "@/types"

const TEST_PATTERNS = [/^test$/i, /^tests$/i, /__tests__/i, /\.test\.[a-z0-9]+$/i, /\.spec\.[a-z0-9]+$/i]
const CICD_PATTERNS = [/^\.github$/i, /^\.gitlab-ci\.yml$/i, /^circle\.yml$/i]
const DEPLOY_PATTERNS = [/^vercel\.json$/i, /^netlify\.toml$/i, /^render\.yaml$/i, /^docker-compose\.ya?ml$/i]

function hasMatch(items: GitHubContentItem[], patterns: RegExp[]) {
  return items.some((item) => patterns.some((pattern) => pattern.test(item.name) || pattern.test(item.path)))
}

async function collectSignalsFromRepo(repo: GitHubRepo) {
  const owner = repo.owner.login
  const root = await fetchRepoContents(owner, repo.name)

  const hasReadme = root.some((item) => /^readme(\.[a-z0-9]+)?$/i.test(item.name))
  const hasDockerfile = root.some((item) => /^dockerfile$/i.test(item.name))
  const hasCICDInRoot = hasMatch(root, CICD_PATTERNS)
  const hasDeploymentInRoot = hasMatch(root, DEPLOY_PATTERNS)
  const hasTestsInRoot = hasMatch(root, TEST_PATTERNS)

  let nestedItems: GitHubContentItem[] = []
  const candidateDirs = root.filter((item) => item.type === "dir")

  for (const dir of candidateDirs) {
    const lower = dir.name.toLowerCase()
    if (![".github", "test", "tests", "src", "app", "packages"].includes(lower)) {
      continue
    }

    try {
      const children = await fetchRepoContents(owner, repo.name, dir.path)
      nestedItems = nestedItems.concat(children)
    } catch {
      continue
    }
  }

  const hasTests = hasTestsInRoot || hasMatch(nestedItems, TEST_PATTERNS)
  const hasCICD =
    hasCICDInRoot ||
    nestedItems.some((item) => /\.github\/workflows\/.+\.ya?ml$/i.test(item.path) || /^workflow/i.test(item.name))
  const hasDeployment = hasDeploymentInRoot || hasMatch(nestedItems, DEPLOY_PATTERNS)

  return {
    hasTests,
    hasDockerfile,
    hasCICD,
    hasReadme,
    hasDeployment
  }
}

export async function analyzeEngineering(repos: GitHubRepo[]): Promise<EngineeringSignals> {
  if (repos.length === 0) {
    return {
      hasTests: false,
      hasDockerfile: false,
      hasCICD: false,
      hasReadme: false,
      hasDeployment: false,
      testRepoRatio: 0,
      reposWithReadmeRatio: 0,
      reposWithCICDRatio: 0,
      reposWithDockerRatio: 0
    }
  }

  let testRepos = 0
  let dockerRepos = 0
  let cicdRepos = 0
  let readmeRepos = 0
  let deploymentRepos = 0

  for (const repo of repos) {
    try {
      const repoSignals = await collectSignalsFromRepo(repo)
      if (repoSignals.hasTests) testRepos += 1
      if (repoSignals.hasDockerfile) dockerRepos += 1
      if (repoSignals.hasCICD) cicdRepos += 1
      if (repoSignals.hasReadme) readmeRepos += 1
      if (repoSignals.hasDeployment) deploymentRepos += 1
    } catch {
      continue
    }
  }

  const total = repos.length

  return {
    hasTests: testRepos > 0,
    hasDockerfile: dockerRepos > 0,
    hasCICD: cicdRepos > 0,
    hasReadme: readmeRepos > 0,
    hasDeployment: deploymentRepos > 0,
    testRepoRatio: Number((testRepos / total).toFixed(4)),
    reposWithReadmeRatio: Number((readmeRepos / total).toFixed(4)),
    reposWithCICDRatio: Number((cicdRepos / total).toFixed(4)),
    reposWithDockerRatio: Number((dockerRepos / total).toFixed(4))
  }
}
