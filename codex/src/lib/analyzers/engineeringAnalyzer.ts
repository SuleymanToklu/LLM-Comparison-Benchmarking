import { fetchRepoFileSnapshot, GitHubApiError } from "@/lib/github/fetcher";
import type { EngineeringSignals, GitHubRepo, RepoFileSnapshot, RepoSignal } from "@/types";

const RECENT_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
const DEFAULT_CONTENT_REPO_LIMIT = 30;

export async function analyzeEngineeringSignals(repos: GitHubRepo[]): Promise<EngineeringSignals> {
  const repoLimit = readBoundedInteger(process.env.GITHUB_CONTENT_REPO_LIMIT, DEFAULT_CONTENT_REPO_LIMIT, 1, 100);
  const reposToInspect = repos.slice(0, repoLimit);
  const warnings: string[] = [];

  if (repos.length > reposToInspect.length) {
    warnings.push(
      `Engineering file signals inspected ${reposToInspect.length} of ${repos.length} owned repositories. Increase GITHUB_CONTENT_REPO_LIMIT for deeper coverage.`
    );
  }

  const inspectedSignals = await mapWithConcurrency(reposToInspect, 4, async (repo) => {
    try {
      const snapshot = await fetchRepoFileSnapshot(repo);
      if (snapshot.truncated) {
        warnings.push(`${repo.full_name}: content traversal was truncated, so some file signals may be missing.`);
      }
      if (snapshot.error) {
        warnings.push(`${repo.full_name}: ${snapshot.error}`);
      }
      return analyzeRepoSignal(repo, snapshot);
    } catch (error) {
      const message = formatRepoInspectionError(error);
      warnings.push(`${repo.full_name}: ${message}`);
      return emptyRepoSignal(repo, message);
    }
  });

  const skippedSignals = repos.slice(repoLimit).map((repo) => emptyRepoSignal(repo, "Skipped by repository inspection limit."));
  const repoSignals = [...inspectedSignals, ...skippedSignals];
  const reposWithTests = count(repoSignals, (signal) => signal.hasTests);
  const reposWithDockerfile = count(repoSignals, (signal) => signal.hasDockerfile);
  const reposWithCICD = count(repoSignals, (signal) => signal.hasCICD);
  const reposWithReadme = count(repoSignals, (signal) => signal.hasReadme);
  const reposWithDeployment = count(repoSignals, (signal) => signal.hasDeployment);
  const frontendRepoCount = count(repoSignals, (signal) => signal.frontendTechnologies.length > 0);
  const backendRepoCount = count(repoSignals, (signal) => signal.backendTechnologies.length > 0);
  const devopsRepoCount = count(repoSignals, (signal) => signal.devopsTechnologies.length > 0);
  const mlRepoCount = count(repoSignals, (signal) => signal.mlTechnologies.length > 0);

  return {
    hasTests: reposWithTests > 0,
    hasDockerfile: reposWithDockerfile > 0,
    hasCICD: reposWithCICD > 0,
    hasReadme: reposWithReadme > 0,
    hasDeployment: reposWithDeployment > 0,
    reposWithTests,
    reposWithDockerfile,
    reposWithCICD,
    reposWithReadme,
    reposWithDeployment,
    frontendRepoCount,
    backendRepoCount,
    devopsRepoCount,
    mlRepoCount,
    frontendTechnologies: collectTechnologies(repoSignals, "frontendTechnologies"),
    backendTechnologies: collectTechnologies(repoSignals, "backendTechnologies"),
    devopsTechnologies: collectTechnologies(repoSignals, "devopsTechnologies"),
    mlTechnologies: collectTechnologies(repoSignals, "mlTechnologies"),
    repoQualityScore: calculateRepoQualityScore(repos, repoSignals),
    repoSignals,
    warnings
  };
}

function analyzeRepoSignal(repo: GitHubRepo, snapshot: RepoFileSnapshot): RepoSignal {
  const paths = snapshot.paths.map((path) => path.replace(/\\/g, "/"));
  const lowerPaths = paths.map((path) => path.toLowerCase());
  const manifestText = snapshot.manifests.map((manifest) => manifest.content).join("\n").toLowerCase();
  const metadataText = [
    repo.name,
    repo.description ?? "",
    repo.language ?? "",
    ...(repo.topics ?? [])
  ]
    .join("\n")
    .toLowerCase();
  const evidence = `${metadataText}\n${manifestText}\n${lowerPaths.join("\n")}`;
  const hasTests = lowerPaths.some(isTestPath);
  const hasDockerfile = lowerPaths.some((path) => /(^|\/)dockerfile($|[.\w-]*)/.test(path));
  const hasCICD = lowerPaths.some(isCiPath);
  const hasReadme = lowerPaths.some((path) => /(^|\/)readme(\.[a-z0-9]+)?$/.test(path));
  const hasDeployment = Boolean(repo.homepage?.trim()) || lowerPaths.some(isDeploymentPath);

  return {
    repoName: repo.name,
    repoFullName: repo.full_name,
    hasTests,
    hasDockerfile,
    hasCICD,
    hasReadme,
    hasDeployment,
    frontendTechnologies: detectFrontendTechnologies(evidence),
    backendTechnologies: detectBackendTechnologies(evidence),
    devopsTechnologies: detectDevopsTechnologies(evidence, { hasDockerfile, hasCICD, hasDeployment }),
    mlTechnologies: detectMlTechnologies(evidence, lowerPaths),
    error: snapshot.error
  };
}

function emptyRepoSignal(repo: GitHubRepo, error?: string): RepoSignal {
  return {
    repoName: repo.name,
    repoFullName: repo.full_name,
    hasTests: false,
    hasDockerfile: false,
    hasCICD: false,
    hasReadme: false,
    hasDeployment: Boolean(repo.homepage?.trim()),
    frontendTechnologies: [],
    backendTechnologies: [],
    devopsTechnologies: repo.homepage?.trim() ? ["Deployment config"] : [],
    mlTechnologies: [],
    error
  };
}

function isTestPath(path: string): boolean {
  return (
    /(^|\/)(__tests__|tests?|specs?|test)(\/|$)/.test(path) ||
    /\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs|py|rb|go|java|cs|php)$/.test(path) ||
    /(^|\/)(pytest\.ini|jest\.config|vitest\.config|playwright\.config|cypress\.config|karma\.conf|phpunit\.xml)$/.test(path)
  );
}

function isCiPath(path: string): boolean {
  return (
    path.startsWith(".github/workflows/") ||
    path === ".gitlab-ci.yml" ||
    path === ".travis.yml" ||
    path === "circle.yml" ||
    path === ".circleci/config.yml" ||
    path === "azure-pipelines.yml" ||
    path === "bitbucket-pipelines.yml" ||
    path === "jenkinsfile" ||
    path === ".drone.yml" ||
    path === "cloudbuild.yaml"
  );
}

function isDeploymentPath(path: string): boolean {
  return (
    path === "vercel.json" ||
    path === "netlify.toml" ||
    path === "render.yaml" ||
    path === "render.yml" ||
    path === "railway.json" ||
    path === "fly.toml" ||
    path === "procfile" ||
    path === "app.yaml" ||
    path === "serverless.yml" ||
    path === "serverless.yaml" ||
    path === "wrangler.toml" ||
    path.startsWith("terraform/") ||
    path.startsWith("k8s/") ||
    path.startsWith("kubernetes/") ||
    path.startsWith("helm/") ||
    path.endsWith("/chart.yaml")
  );
}

function detectFrontendTechnologies(evidence: string): string[] {
  const technologies = new Set<string>();

  if (hasDependency(evidence, "next") || evidence.includes("next.config") || evidence.includes("nextjs")) {
    technologies.add("Next.js");
  }
  if (hasDependency(evidence, "react") || evidence.includes("reactjs")) {
    technologies.add("React");
  }
  if (hasDependency(evidence, "vue") || evidence.includes("vue.config") || evidence.includes("nuxt.config")) {
    technologies.add("Vue");
  }
  if (hasDependency(evidence, "@angular/core") || evidence.includes("angular.json")) {
    technologies.add("Angular");
  }
  if (hasDependency(evidence, "svelte") || evidence.includes("svelte.config")) {
    technologies.add("Svelte");
  }
  if (hasDependency(evidence, "tailwindcss") || evidence.includes("tailwind.config")) {
    technologies.add("Tailwind");
  }

  return Array.from(technologies).sort();
}

function detectBackendTechnologies(evidence: string): string[] {
  const technologies = new Set<string>();

  if (hasDependency(evidence, "express")) {
    technologies.add("Express");
  }
  if (hasDependency(evidence, "@nestjs/core") || evidence.includes("nest-cli.json")) {
    technologies.add("NestJS");
  }
  if (/\bfastapi\b/.test(evidence)) {
    technologies.add("FastAPI");
  }
  if (/\bdjango\b/.test(evidence) || evidence.includes("manage.py")) {
    technologies.add("Django");
  }
  if (evidence.includes("spring-boot") || evidence.includes("org.springframework.boot") || evidence.includes("springframework")) {
    technologies.add("Spring");
  }
  if (evidence.includes("laravel/framework") || evidence.includes("\nartisan\n")) {
    technologies.add("Laravel");
  }
  if (/\bflask\b/.test(evidence)) {
    technologies.add("Flask");
  }
  if (evidence.includes("rails") || evidence.includes("gem 'rails'") || evidence.includes("\"rails\"")) {
    technologies.add("Rails");
  }

  return Array.from(technologies).sort();
}

function detectDevopsTechnologies(
  evidence: string,
  signals: { hasDockerfile: boolean; hasCICD: boolean; hasDeployment: boolean }
): string[] {
  const technologies = new Set<string>();

  if (signals.hasDockerfile || evidence.includes("docker-compose")) {
    technologies.add("Docker");
  }
  if (signals.hasCICD || evidence.includes(".github/workflows")) {
    technologies.add("CI/CD");
  }
  if (evidence.includes("kubernetes") || evidence.includes("\nk8s/") || evidence.includes("helm/")) {
    technologies.add("Kubernetes");
  }
  if (evidence.includes("terraform")) {
    technologies.add("Terraform");
  }
  if (evidence.includes("vercel")) {
    technologies.add("Vercel");
  }
  if (evidence.includes("netlify")) {
    technologies.add("Netlify");
  }
  if (signals.hasDeployment) {
    technologies.add("Deployment config");
  }

  return Array.from(technologies).sort();
}

function detectMlTechnologies(evidence: string, paths: string[]): string[] {
  const technologies = new Set<string>();

  if (paths.some((path) => path.endsWith(".ipynb"))) {
    technologies.add("Jupyter");
  }
  if (/\b(torch|pytorch)\b/.test(evidence)) {
    technologies.add("PyTorch");
  }
  if (/\btensorflow\b/.test(evidence)) {
    technologies.add("TensorFlow");
  }
  if (evidence.includes("scikit-learn") || evidence.includes("sklearn")) {
    technologies.add("scikit-learn");
  }
  if (/\bkeras\b/.test(evidence)) {
    technologies.add("Keras");
  }
  if (/\b(transformers|langchain|llamaindex)\b/.test(evidence)) {
    technologies.add("AI tooling");
  }

  return Array.from(technologies).sort();
}

function calculateRepoQualityScore(repos: GitHubRepo[], repoSignals: RepoSignal[]): number {
  if (repos.length === 0) {
    return 0;
  }

  const readmeRatio = ratio(count(repoSignals, (signal) => signal.hasReadme), repos.length);
  const testRatio = ratio(count(repoSignals, (signal) => signal.hasTests), repos.length);
  const ciRatio = ratio(count(repoSignals, (signal) => signal.hasCICD), repos.length);
  const dockerRatio = ratio(count(repoSignals, (signal) => signal.hasDockerfile), repos.length);
  const deploymentRatio = ratio(count(repoSignals, (signal) => signal.hasDeployment), repos.length);
  const describedRatio = ratio(count(repos, (repo) => Boolean(repo.description?.trim())), repos.length);
  const topicRatio = ratio(count(repos, (repo) => (repo.topics?.length ?? 0) > 0), repos.length);
  const recentRatio = ratio(
    count(repos, (repo) => Boolean(repo.pushed_at && Date.now() - new Date(repo.pushed_at).getTime() <= RECENT_WINDOW_MS)),
    repos.length
  );

  return clampScore(
    Math.round(
      readmeRatio * 22 +
        testRatio * 20 +
        ciRatio * 16 +
        dockerRatio * 10 +
        deploymentRatio * 10 +
        describedRatio * 10 +
        topicRatio * 7 +
        recentRatio * 5
    )
  );
}

function hasDependency(evidence: string, dependencyName: string): boolean {
  const escaped = escapeRegExp(dependencyName.toLowerCase());
  return new RegExp(`["']${escaped}["']\\s*:`).test(evidence);
}

function collectTechnologies(
  signals: RepoSignal[],
  key: "frontendTechnologies" | "backendTechnologies" | "devopsTechnologies" | "mlTechnologies"
): string[] {
  const technologies = new Set<string>();

  for (const signal of signals) {
    for (const technology of signal[key]) {
      technologies.add(technology);
    }
  }

  return Array.from(technologies).sort();
}

function formatRepoInspectionError(error: unknown): string {
  if (error instanceof GitHubApiError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Repository inspection failed.";
}

function count<T>(items: T[], predicate: (item: T) => boolean): number {
  return items.reduce((sum, item) => sum + (predicate(item) ? 1 : 0), 0);
}

function ratio(value: number, total: number): number {
  return total > 0 ? value / total : 0;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readBoundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(parsed), min), max);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
