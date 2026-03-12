import * as github from '@actions/github';

export interface RepoData {
  owner: string;
  repo: string;
  commits: CommitData;
  releases: ReleaseData;
  contributors: ContributorData;
  issues: IssueData;
  pullRequests: PullRequestData;
  stars: StarData;
  languages: Record<string, number>;
}

export interface CommitData {
  current: number;
  prior: number;
  recentMessages: string[];
}

export interface ReleaseData {
  recent: Array<{ tag: string; name: string; date: string; prerelease: boolean }>;
  totalCount: number;
}

export interface ContributorData {
  total: number;
  newInPeriod: number;
}

export interface IssueData {
  openCount: number;
  closedInPeriod: number;
  openedInPeriod: number;
  avgCloseTimeDays: number | null;
}

export interface PullRequestData {
  openCount: number;
  mergedInPeriod: number;
  openedInPeriod: number;
}

export interface StarData {
  current: number;
  forkCount: number;
}

type Octokit = ReturnType<typeof github.getOctokit>;

export async function fetchRepoData(
  octokit: Octokit,
  owner: string,
  repo: string,
  periodDays: number
): Promise<RepoData> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 86400000);
  const priorStart = new Date(periodStart.getTime() - periodDays * 86400000);

  const [commits, releases, contributors, issues, pullRequests, repoInfo, languages] =
    await Promise.all([
      fetchCommits(octokit, owner, repo, periodStart, priorStart),
      fetchReleases(octokit, owner, repo, periodDays),
      fetchContributors(octokit, owner, repo, periodStart),
      fetchIssues(octokit, owner, repo, periodStart),
      fetchPullRequests(octokit, owner, repo, periodStart),
      fetchRepoInfo(octokit, owner, repo),
      fetchLanguages(octokit, owner, repo),
    ]);

  return {
    owner,
    repo,
    commits,
    releases,
    contributors,
    issues,
    pullRequests,
    stars: repoInfo,
    languages,
  };
}

async function fetchCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  periodStart: Date,
  priorStart: Date
): Promise<CommitData> {
  const [currentPage, priorPage] = await Promise.all([
    octokit.rest.repos.listCommits({
      owner, repo, since: periodStart.toISOString(), per_page: 100,
    }),
    octokit.rest.repos.listCommits({
      owner, repo, since: priorStart.toISOString(), until: periodStart.toISOString(), per_page: 100,
    }),
  ]);

  return {
    current: currentPage.data.length,
    prior: priorPage.data.length,
    recentMessages: currentPage.data.slice(0, 5).map(
      c => c.commit.message.split('\n')[0]
    ),
  };
}

async function fetchReleases(
  octokit: Octokit,
  owner: string,
  repo: string,
  periodDays: number
): Promise<ReleaseData> {
  const { data } = await octokit.rest.repos.listReleases({ owner, repo, per_page: 20 });
  const cutoff = new Date(Date.now() - periodDays * 86400000);
  const recent = data
    .filter(r => new Date(r.published_at || r.created_at) >= cutoff)
    .map(r => ({
      tag: r.tag_name,
      name: r.name || r.tag_name,
      date: r.published_at || r.created_at,
      prerelease: r.prerelease,
    }));

  return { recent, totalCount: data.length };
}

async function fetchContributors(
  octokit: Octokit,
  owner: string,
  repo: string,
  periodStart: Date
): Promise<ContributorData> {
  try {
    const { data: contributors } = await octokit.rest.repos.listContributors({
      owner, repo, per_page: 100,
    });

    const { data: recentCommits } = await octokit.rest.repos.listCommits({
      owner, repo, since: periodStart.toISOString(), per_page: 100,
    });

    const recentAuthors = new Set(
      recentCommits.map(c => c.author?.login).filter(Boolean)
    );

    // Rough heuristic: contributors with only 1 contribution who appear in recent commits
    const newContributors = contributors.filter(
      c => c.login && c.contributions <= 3 && recentAuthors.has(c.login)
    );

    return { total: contributors.length, newInPeriod: newContributors.length };
  } catch {
    return { total: 0, newInPeriod: 0 };
  }
}

async function fetchIssues(
  octokit: Octokit,
  owner: string,
  repo: string,
  periodStart: Date
): Promise<IssueData> {
  const [openIssues, closedIssues] = await Promise.all([
    octokit.rest.issues.listForRepo({
      owner, repo, state: 'open', per_page: 1,
    }),
    octokit.rest.issues.listForRepo({
      owner, repo, state: 'closed', since: periodStart.toISOString(), per_page: 100,
    }),
  ]);

  // Get total open count from headers
  const openCount = openIssues.data.length > 0
    ? parseInt(String(openIssues.headers['x-total-count'] || '0'), 10) || openIssues.data.length
    : 0;

  // Filter out PRs (GitHub API includes them in issues)
  const closedReal = closedIssues.data.filter(i => !i.pull_request);

  const closeTimes = closedReal
    .map(i => {
      const opened = new Date(i.created_at).getTime();
      const closed = new Date(i.closed_at!).getTime();
      return (closed - opened) / 86400000;
    })
    .filter(d => d >= 0);

  const avgCloseTimeDays = closeTimes.length > 0
    ? closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length
    : null;

  // Count issues opened in period
  const recentOpen = await octokit.rest.issues.listForRepo({
    owner, repo, state: 'all', since: periodStart.toISOString(), per_page: 100,
  });
  const openedInPeriod = recentOpen.data.filter(
    i => !i.pull_request && new Date(i.created_at) >= periodStart
  ).length;

  return {
    openCount,
    closedInPeriod: closedReal.length,
    openedInPeriod,
    avgCloseTimeDays,
  };
}

async function fetchPullRequests(
  octokit: Octokit,
  owner: string,
  repo: string,
  periodStart: Date
): Promise<PullRequestData> {
  const [openPRs, closedPRs] = await Promise.all([
    octokit.rest.pulls.list({ owner, repo, state: 'open', per_page: 1 }),
    octokit.rest.pulls.list({
      owner, repo, state: 'closed', sort: 'updated', direction: 'desc', per_page: 100,
    }),
  ]);

  const mergedInPeriod = closedPRs.data.filter(
    pr => pr.merged_at && new Date(pr.merged_at) >= periodStart
  ).length;

  const openedInPeriod = closedPRs.data.filter(
    pr => new Date(pr.created_at) >= periodStart
  ).length;

  return {
    openCount: openPRs.data.length,
    mergedInPeriod,
    openedInPeriod,
  };
}

async function fetchRepoInfo(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<StarData> {
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return {
    current: data.stargazers_count,
    forkCount: data.forks_count,
  };
}

async function fetchLanguages(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<Record<string, number>> {
  const { data } = await octokit.rest.repos.listLanguages({ owner, repo });
  return data;
}
