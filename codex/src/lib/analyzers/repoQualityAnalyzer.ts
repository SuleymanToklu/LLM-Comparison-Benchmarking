import type { GitHubRepo, RepoFileSnapshot, RepoSignal, RepositoryQualityAnalysis } from "@/types";

const RECENT_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export function analyzeRepoQuality(repos: GitHubRepo[], snapshots: RepoFileSnapshot[]): RepositoryQualityAnalysis {
  const snapshotByRepo = new Map(snapshots.map((snapshot) => [snapshot.repoFullName.toLowerCase(), snapshot]));
  const repoSignals = repos.map((repo) => analyzeRepoSignal(repo, snapshotByRepo.get(repo.full_name.toLowerCase()) ?? null));

  const reposWithTests = repoSignals.filter((signal) => signal.hasTests).length;
  const reposWithDockerfile = repoSignals.filter((signal) => signal.hasDockerfile).length;
  const reposWithCICD = repoSignals.filter((signal) => signal.hasCICD).length;
  const reposWithReadme = repoSignals.filter((signal) => signal.hasReadme).length;
  const reposWithDeployment = repoSignals.filter((signal) => signal.hasDeployment).length;
  const frontendRepoCount = repoSignals.filter((signal) => signal.frontendTechnologies.length > 0).length;
  const backendRepoCount = repoSignals.filter((signal) => signal.backendTechnologies.length > 0).length;
  const devopsRepoCount = repoSignals.filter((signal) => signal.devopsTechnologies.length > 0).length;
  const mlRepoCount = repoSignals.filter((signal) => signal.mlTechnologies.length > 0).length;

  return {
    hasTests: reposWithTests > 0,
    hasDockerfile: reposWithDockerfile > 0,
    hasCICD: reposWithCICD > 0,
    hasReadme: reposWithReadme > 0,
    hasDeployment: reposWithDeployment > 0,
    repoSignals,
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
    warnings: []
  };
}

function analyzeRepoSignal(repo: GitHubRepo, snapshot: RepoFileSnapshot | null): RepoSignal {
  const paths = snapshot?.paths ?? [];
  const lowerPaths = paths.map((path) => path.toLowerCase());
  const manifestText = (snapshot?.manifests ?? []).map((manifest) => manifest.content).join("\n").toLowerCase();
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
  const hasDeployment = Boolean(repo.homepage) || lowerPaths.some(isDeploymentPath);

  const frontendTechnologies = detectFrontendTechnologies(evidence);
  const backendTechnologies = detectBackendTechnologies(evidence);
  const devopsTechnologies = detectDevopsTechnologies(evidence, {
    hasDockerfile,
    hasCICD,
    hasDeployment
  });
  const mlTechnologies = detectMlTechnologies(evidence, lowerPaths);

  return {
    repoName: repo.name,
    repoFullName: repo.full_name,
    hasTests,
    hasDockerfile,
    hasCICD,
    hasReadme,
    hasDeployment,
    frontendTechnologies,
    backendTechnologies,
    devopsTechnologies,
    mlTechnologies
  };
}

function isTestPath(path: string): boolean {
  return (
    /(^|\/)(__tests__|tests?|specs?)(\/|$)/.test(path) ||
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
  if (hasDependency(evidence, "vite") || evidence.includes("vite.config")) {
    technologies.add("Vite");
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
  if (evidence.includes("github.com/gin-gonic/gin")) {
    technologies.add("Gin");
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

function calculateRepoQualityScore(repos: GitHubRepo[], repoSignals: RepoSignal[]): number {
  if (repos.length === 0) {
    return 0;
  }

  const readmeRatio = ratio(repoSignals.filter((signal) => signal.hasReadme).length, repos.length);
  const testRatio = ratio(repoSignals.filter((signal) => signal.hasTests).length, repos.length);
  const ciRatio = ratio(repoSignals.filter((signal) => signal.hasCICD).length, repos.length);
  const dockerRatio = ratio(repoSignals.filter((signal) => signal.hasDockerfile).length, repos.length);
  const deploymentRatio = ratio(repoSignals.filter((signal) => signal.hasDeployment).length, repos.length);
  const describedRatio = ratio(repos.filter((repo) => Boolean(repo.description?.trim())).length, repos.length);
  const topicRatio = ratio(repos.filter((repo) => (repo.topics?.length ?? 0) > 0).length, repos.length);
  const recentlyTouchedRatio = ratio(
    repos.filter((repo) => repo.pushed_at && Date.now() - new Date(repo.pushed_at).getTime() <= RECENT_WINDOW_MS).length,
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
        recentlyTouchedRatio * 5
    )
  );
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
