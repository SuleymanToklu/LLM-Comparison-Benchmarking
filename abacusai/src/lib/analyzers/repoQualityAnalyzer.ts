import { fetchRepoContents } from "@/lib/github/fetcher"
import type { GitHubContentItem, GitHubRepo } from "@/types"

const TEST_PATTERNS = [/^test$/i, /^tests$/i, /__tests__/i, /\.test\.[a-z0-9]+$/i, /\.spec\.[a-z0-9]+$/i]
const CI_PATTERNS = [/^\.github$/i, /^\.gitlab-ci\.yml$/i, /^circle\.yml$/i]
const DEPLOY_PATTERNS = [/^vercel\.json$/i, /^netlify\.toml$/i, /^render\.yaml$/i, /^docker-compose\.ya?ml$/i]

function matchesAny(items: GitHubContentItem[], patterns: RegExp[]) {
  return items.some((item) => patterns.some((pattern) => pattern.test(item.name) || pattern.test(item.path)))
}

export async function analyzeRepoQuality(repos: GitHubRepo[]) {
  if (repos.length === 0) {
    return {
      hasTests: false,
      hasDockerfile: false,
      hasCICD: false,
      hasReadme: false,
      hasDeployment: false,
      testRepoRatio: 0,
      repoQualityScore: 0
    }
  }

  let testRepos = 0
  let dockerRepos = 0
  let cicdRepos = 0
  let readmeRepos = 0
  let deploymentRepos = 0

  for (const repo of repos) {
    try {
      const root = await fetchRepoContents(repo.owner.login, repo.name)
      const rootDirs = root.filter((item) => item.type === "dir")
      let nested: GitHubContentItem[] = []

      for (const dir of rootDirs) {
        const lower = dir.name.toLowerCase()
        if (![".github", "test", "tests", "src", "app", "packages"].includes(lower)) {
          continue
        }
        try {
          const children = await fetchRepoContents(repo.owner.login, repo.name, dir.path)
          nested = nested.concat(children)
        } catch {
          continue
        }
      }

      const hasTests = matchesAny(root, TEST_PATTERNS) || matchesAny(nested, TEST_PATTERNS)
      const hasDockerfile = root.some((item) => /^dockerfile$/i.test(item.name))
      const hasCICD =
        matchesAny(root, CI_PATTERNS) ||
        nested.some((item) => /\.github\/workflows\/.+\.ya?ml$/i.test(item.path) || /^workflow/i.test(item.name))
      const hasReadme = root.some((item) => /^readme(\.[a-z0-9]+)?$/i.test(item.name))
      const hasDeployment = matchesAny(root, DEPLOY_PATTERNS) || matchesAny(nested, DEPLOY_PATTERNS)

      if (hasTests) testRepos += 1
      if (hasDockerfile) dockerRepos += 1
      if (hasCICD) cicdRepos += 1
      if (hasReadme) readmeRepos += 1
      if (hasDeployment) deploymentRepos += 1
    } catch {
      continue
    }
  }

  const total = repos.length
  const repoQualityScore = Number(
    (testRepos / total * 30 + readmeRepos / total * 30 + cicdRepos / total * 20 + dockerRepos / total * 20).toFixed(2)
  )

  return {
    hasTests: testRepos > 0,
    hasDockerfile: dockerRepos > 0,
    hasCICD: cicdRepos > 0,
    hasReadme: readmeRepos > 0,
    hasDeployment: deploymentRepos > 0,
    testRepoRatio: Number((testRepos / total).toFixed(4)),
    repoQualityScore
  }
}
