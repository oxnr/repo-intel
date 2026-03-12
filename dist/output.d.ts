import { RepoReport } from './analyzer';
export declare function createIssue(token: string, reports: RepoReport[]): Promise<string>;
export declare function createPRComment(token: string, reports: RepoReport[]): Promise<void>;
export declare function outputJson(reports: RepoReport[]): string;
