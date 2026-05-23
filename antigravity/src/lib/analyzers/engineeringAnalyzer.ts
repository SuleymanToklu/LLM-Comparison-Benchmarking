export async function checkEngineeringSignals(
  username: string,
  repos: any[]
): Promise<{ hasTests: boolean; hasDockerfile: boolean; hasCICD: boolean; hasReadme: boolean; hasDeployment: boolean }> {
  let hasTests = false;
  let hasDockerfile = false;
  let hasCICD = false;
  let hasReadme = false;
  let hasDeployment = false;

  const reposToAnalyze = repos.slice(0, 5); // Limit to top 5 to avoid strict rate limits

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  for (const repo of reposToAnalyze) {
    if (repo.homepage) {
      hasDeployment = true;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${username}/${repo.name}/contents`, { headers });
      if (res.ok) {
        const files = await res.json();
        if (Array.isArray(files)) {
          const fileNames = files.map((f: any) => f.name.toLowerCase());
          
          if (fileNames.some((f) => f.includes("test") || f.includes("spec") || f === "__tests__")) {
            hasTests = true;
          }
          if (fileNames.includes("dockerfile") || fileNames.includes("docker-compose.yml")) {
            hasDockerfile = true;
          }
          if (fileNames.includes(".github") || fileNames.includes(".gitlab-ci.yml") || fileNames.includes(".circleci")) {
            hasCICD = true;
          }
          if (fileNames.some((f) => f.startsWith("readme"))) {
            hasReadme = true;
          }
          if (fileNames.includes("vercel.json") || fileNames.includes("netlify.toml") || fileNames.includes(".fly")) {
            hasDeployment = true;
          }
        }
      }
    } catch (e) {
      // Graceful fallback
    }

    // fallback using topics if contents fail or are insufficient
    if (repo.topics) {
      if (repo.topics.includes('docker') || repo.topics.includes('kubernetes')) hasDockerfile = true;
      if (repo.topics.includes('ci') || repo.topics.includes('cd') || repo.topics.includes('github-actions')) hasCICD = true;
      if (repo.topics.includes('testing') || repo.topics.includes('jest') || repo.topics.includes('pytest')) hasTests = true;
    }
  }

  return {
    hasTests,
    hasDockerfile,
    hasCICD,
    hasReadme,
    hasDeployment,
  };
}
