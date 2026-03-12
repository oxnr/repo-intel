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
    recent: Array<{
        tag: string;
        name: string;
        date: string;
        prerelease: boolean;
    }>;
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
export declare function fetchRepoData(octokit: Octokit, owner: string, repo: string, periodDays: number): Promise<RepoData>;
export {};
