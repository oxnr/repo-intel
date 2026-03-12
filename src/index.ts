import * as core from '@actions/core';
import * as github from '@actions/github';
import { fetchRepoData } from './github-client';
import { analyzeRepo, RepoReport } from './analyzer';
import { createIssue, createPRComment, outputJson } from './output';
import { sendSlackNotification } from './slack-notifier';

async function run(): Promise<void> {
  try {
    const reposInput = core.getInput('repos', { required: true });
    const slackWebhookUrl = core.getInput('slack-webhook-url');
    const token = core.getInput('github-token', { required: true });
    const outputFormat = core.getInput('output-format') || 'issue';
    const periodDays = parseInt(core.getInput('period-days') || '7', 10);

    const repos = reposInput
      .split(',')
      .map(r => r.trim())
      .filter(Boolean)
      .map(r => {
        const parts = r.replace(/^https?:\/\/github\.com\//, '').split('/');
        if (parts.length < 2) {
          throw new Error(`Invalid repo format: "${r}". Use "owner/repo".`);
        }
        return { owner: parts[0], repo: parts[1] };
      });

    if (repos.length === 0) {
      throw new Error('No repos specified. Provide comma-separated "owner/repo" values.');
    }

    core.info(`Analyzing ${repos.length} repo(s) over ${periodDays}-day period...`);

    const octokit = github.getOctokit(token);
    const reports: RepoReport[] = [];

    for (const { owner, repo } of repos) {
      core.info(`Fetching data for ${owner}/${repo}...`);
      try {
        const data = await fetchRepoData(octokit, owner, repo, periodDays);
        const report = analyzeRepo(data, periodDays);
        reports.push(report);
        core.info(`Analysis complete for ${owner}/${repo}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        core.warning(`Failed to analyze ${owner}/${repo}: ${msg}`);
      }
    }

    if (reports.length === 0) {
      throw new Error('All repo analyses failed. Check repo names and token permissions.');
    }

    // Set JSON output regardless of format
    const json = outputJson(reports);
    core.setOutput('report', json);

    // Create output based on format
    switch (outputFormat) {
      case 'issue': {
        const issueUrl = await createIssue(token, reports);
        core.setOutput('issue-url', issueUrl);
        break;
      }
      case 'pr-comment':
        await createPRComment(token, reports);
        break;
      case 'json':
        // Already output above
        break;
      default:
        core.warning(`Unknown output format "${outputFormat}", defaulting to JSON`);
    }

    if (slackWebhookUrl) {
      await sendSlackNotification(slackWebhookUrl, reports);
    }
    core.info('repo-intel analysis complete!');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(msg);
  }
}

run();
