const cache = new Map<string, { data: any, expiry: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

async function fetchWithHandling(url: string, key: string) {
  const cached = getCached(key);
  if (cached) return cached;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(url, { headers, next: { revalidate: 3600 } });
    if (!res.ok) {
      if (res.status === 404) throw new Error('User not found');
      if (res.status === 403) throw new Error('Rate limit exceeded');
      throw new Error(`Failed with status: ${res.status}`);
    }
    const data = await res.json();
    setCache(key, data);
    return data;
  } catch (error: any) {
    if (error.name === 'TypeError') {
      throw new Error('Network error occurred');
    }
    throw error;
  }
}

export async function fetchUserProfile(username: string) {
  return fetchWithHandling(`https://api.github.com/users/${username}`, `profile_${username}`);
}

export async function fetchUserRepos(username: string) {
  const repos = await fetchWithHandling(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, `repos_${username}`);
  return repos.filter((r: any) => !r.fork);
}

export async function fetchUserEvents(username: string) {
  return fetchWithHandling(`https://api.github.com/users/${username}/events/public?per_page=100`, `events_${username}`);
}
