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
    commitChange: number; // percentage
    releases: Array<{ tag: string; name: string; date: string }>;
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

export function analyzeRepo(data: RepoData, periodDays: number): RepoReport {
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 86400000);

  const commitChange = data.commits.prior > 0
    ? Math.round(((data.commits.current - data.commits.prior) / data.commits.prior) * 100)
    : data.commits.current > 0 ? 100 : 0;

  const signals = detectSignals(data, commitChange);
  const recommendation = generateRecommendation(signals, data);

  const activity = {
    commits: data.commits.current,
    commitChange,
    releases: data.releases.recent,
    newContributors: data.contributors.newInPeriod,
    totalContributors: data.contributors.total,
    issuesOpened: data.issues.openedInPeriod,
    issuesClosed: data.issues.closedInPeriod,
    avgCloseTimeDays: data.issues.avgCloseTimeDays,
    prsMerged: data.pullRequests.mergedInPeriod,
    prsOpened: data.pullRequests.openedInPeriod,
    stars: data.stars.current,
    forks: data.stars.forkCount,
  };

  const report: RepoReport = {
    owner: data.owner,
    repo: data.repo,
    periodDays,
    periodStart: periodStart.toISOString().split('T')[0],
    periodEnd: now.toISOString().split('T')[0],
    activity,
    signals,
    recommendation,
    markdown: '',
  };

  report.markdown = renderMarkdown(report);
  return report;
}

function detectSignals(data: RepoData, commitChange: number): Signal[] {
  const signals: Signal[] = [];

  // Commit velocity signals
  if (commitChange >= 50) {
    signals.push({
      level: 'HIGH', emoji: '🔴',
      message: `Commit velocity surged ${commitChange}% — significant acceleration in development`,
    });
  } else if (commitChange >= 20) {
    signals.push({
      level: 'MED', emoji: '🟡',
      message: `Commit velocity up ${commitChange}% — increased development activity`,
    });
  } else if (commitChange <= -30) {
    signals.push({
      level: 'MED', emoji: '🟡',
      message: `Commit velocity dropped ${Math.abs(commitChange)}% — possible slowdown or stabilization`,
    });
  }

  // Release signals
  if (data.releases.recent.length >= 3) {
    signals.push({
      level: 'HIGH', emoji: '🔴',
      message: `${data.releases.recent.length} releases in period — rapid shipping cadence`,
    });
  } else if (data.releases.recent.length >= 1) {
    const hasHotfix = data.releases.recent.some(
      r => r.tag.includes('hotfix') || r.tag.includes('patch') || r.prerelease
    );
    if (hasHotfix) {
      signals.push({
        level: 'MED', emoji: '🟡',
        message: `Hotfix/patch release detected — possible production issue`,
      });
    } else {
      signals.push({
        level: 'LOW', emoji: '🟢',
        message: `${data.releases.recent.length} release(s) shipped in period`,
      });
    }
  }

  // New contributors
  if (data.contributors.newInPeriod >= 5) {
    signals.push({
      level: 'HIGH', emoji: '🔴',
      message: `${data.contributors.newInPeriod} new contributors — team is scaling rapidly`,
    });
  } else if (data.contributors.newInPeriod >= 2) {
    signals.push({
      level: 'MED', emoji: '🟡',
      message: `${data.contributors.newInPeriod} new contributors joined`,
    });
  }

  // Issue backlog
  if (data.issues.openedInPeriod > data.issues.closedInPeriod * 1.5 && data.issues.openedInPeriod > 5) {
    signals.push({
      level: 'MED', emoji: '🟡',
      message: `Issue backlog growing — ${data.issues.openedInPeriod} opened vs ${data.issues.closedInPeriod} closed`,
    });
  } else if (data.issues.closedInPeriod > data.issues.openedInPeriod * 1.5 && data.issues.closedInPeriod > 5) {
    signals.push({
      level: 'LOW', emoji: '🟢',
      message: `Issue backlog shrinking — strong bug-fixing focus`,
    });
  }

  // PR activity
  if (data.pullRequests.mergedInPeriod >= 20) {
    signals.push({
      level: 'HIGH', emoji: '🔴',
      message: `${data.pullRequests.mergedInPeriod} PRs merged — very high development throughput`,
    });
  } else if (data.pullRequests.mergedInPeriod >= 10) {
    signals.push({
      level: 'MED', emoji: '🟡',
      message: `${data.pullRequests.mergedInPeriod} PRs merged — active development`,
    });
  }

  // Language changes (detect if top language shifted)
  const langEntries = Object.entries(data.languages);
  if (langEntries.length > 0) {
    const topLang = langEntries.sort((a, b) => b[1] - a[1])[0];
    const totalBytes = langEntries.reduce((s, [, v]) => s + v, 0);
    const topPercent = Math.round((topLang[1] / totalBytes) * 100);
    if (topPercent < 50 && langEntries.length > 3) {
      signals.push({
        level: 'LOW', emoji: '🟢',
        message: `Polyglot codebase — ${langEntries.length} languages, top is ${topLang[0]} at ${topPercent}%`,
      });
    }
  }

  if (signals.length === 0) {
    signals.push({
      level: 'LOW', emoji: '🟢',
      message: 'No significant changes detected — stable period',
    });
  }

  return signals.sort((a, b) => {
    const order = { HIGH: 0, MED: 1, LOW: 2 };
    return order[a.level] - order[b.level];
  });
}

function generateRecommendation(signals: Signal[], data: RepoData): string {
  const highSignals = signals.filter(s => s.level === 'HIGH');
  const medSignals = signals.filter(s => s.level === 'MED');

  if (highSignals.length >= 2) {
    return `**Action required** — Multiple high-priority signals detected for ${data.owner}/${data.repo}. This repo shows significant acceleration in activity. Investigate specific changes and assess competitive impact.`;
  }
  if (highSignals.length === 1) {
    return `**Monitor closely** — ${data.owner}/${data.repo} shows notable activity changes. Track this trend over the next reporting period to determine if it represents a strategic shift.`;
  }
  if (medSignals.length >= 2) {
    return `**Keep watching** — ${data.owner}/${data.repo} has moderate activity signals. No immediate action needed but worth tracking.`;
  }
  return `**Stable** — ${data.owner}/${data.repo} shows normal activity patterns. Continue routine monitoring.`;
}

function renderMarkdown(report: RepoReport): string {
  const { activity, signals, recommendation } = report;
  const changeArrow = activity.commitChange >= 0 ? '↑' : '↓';
  const changeStr = activity.commitChange !== 0
    ? ` (${changeArrow}${Math.abs(activity.commitChange)}% vs prior period)`
    : '';

  let md = `## repo-intel Report: ${report.owner}/${report.repo}\n`;
  md += `**Period:** ${report.periodStart} to ${report.periodEnd} (${report.periodDays} days)\n\n`;

  md += `### Activity Summary\n`;
  md += `- **${activity.commits}** commits${changeStr}\n`;
  if (activity.releases.length > 0) {
    const relList = activity.releases.map(r => r.tag).join(', ');
    md += `- **${activity.releases.length}** release(s): ${relList}\n`;
  } else {
    md += `- No new releases\n`;
  }
  md += `- **${activity.totalContributors}** total contributors`;
  if (activity.newContributors > 0) {
    md += ` (${activity.newContributors} new)`;
  }
  md += `\n`;
  md += `- Issues: **${activity.issuesOpened}** opened, **${activity.issuesClosed}** closed`;
  if (activity.avgCloseTimeDays !== null) {
    md += ` (avg close: ${activity.avgCloseTimeDays.toFixed(1)} days)`;
  }
  md += `\n`;
  md += `- PRs: **${activity.prsOpened}** opened, **${activity.prsMerged}** merged\n`;
  md += `- ⭐ **${activity.stars.toLocaleString()}** stars | 🍴 **${activity.forks.toLocaleString()}** forks\n\n`;

  md += `### Strategic Signals\n`;
  for (const signal of signals) {
    md += `${signal.emoji} **${signal.level}:** ${signal.message}\n`;
  }
  md += `\n`;

  md += `### Recommendation\n`;
  md += `${recommendation}\n`;

  return md;
}
