export async function analyzeRepoQuality(repos: any[], username: string) {
  let hasTests = false;
  let hasDockerfile = false;
  let hasCICD = false;
  let hasReadme = false;
  let hasDeployment = false;

  let reposWithTests = 0;
  
  // We'll analyze up to 10 most recently updated repos to avoid rate limits
  const reposToAnalyze = repos.slice(0, 10);
  
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
    if (repo.topics && (repo.topics.includes('docker') || repo.topics.includes('kubernetes'))) {
      hasDockerfile = true;
    }
    if (repo.topics && (repo.topics.includes('ci') || repo.topics.includes('cd') || repo.topics.includes('github-actions'))) {
      hasCICD = true;
    }
    if (repo.topics && (repo.topics.includes('testing') || repo.topics.includes('jest') || repo.topics.includes('pytest'))) {
      hasTests = true;
      reposWithTests++;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${username}/${repo.name}/git/trees/${repo.default_branch}`, { headers, next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        const files = data.tree?.map((t: any) => t.path.toLowerCase()) || [];
        
        if (files.some((f: string) => f.includes('test') || f.includes('spec'))) {
          hasTests = true;
          reposWithTests++;
        }
        if (files.includes('dockerfile') || files.includes('docker-compose.yml')) {
          hasDockerfile = true;
        }
        if (files.includes('.github') || files.includes('.gitlab-ci.yml') || files.includes('.circleci')) {
          hasCICD = true;
        }
        if (files.some((f: string) => f.startsWith('readme'))) {
          hasReadme = true;
        }
        if (files.includes('vercel.json') || files.includes('netlify.toml') || files.includes('.fly')) {
          hasDeployment = true;
        }
      }
    } catch (e) {
      // Ignore errors to proceed
    }
  }

  const testRatio = reposToAnalyze.length > 0 ? reposWithTests / reposToAnalyze.length : 0;

  return {
    hasTests,
    hasDockerfile,
    hasCICD,
    hasReadme,
    hasDeployment,
    testRatio,
  };
}
