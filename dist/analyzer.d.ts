import { RepoData } from './github-client';
export interface Signal {
    level: 'HIGH' | 'MED' | 'LOW';
    emoji: string;
    message: string;
}
export interface RepoReport {
    owner: string;
    repo: string;
    periodDays: number;
    periodStart: string;
    periodEnd: string;
    activity: {
        commits: number;
        commitChange: number;
        releases: Array<{
            tag: string;
            name: string;
            date: string;
        }>;
        newContributors: number;
        totalContributors: number;
        issuesOpened: number;
        issuesClosed: number;
        avgCloseTimeDays: number | null;
        prsMerged: number;
        prsOpened: number;
        stars: number;
        forks: number;
    };
    signals: Signal[];
    recommendation: string;
    markdown: string;
}
export declare function analyzeRepo(data: RepoData, periodDays: number): RepoReport;
