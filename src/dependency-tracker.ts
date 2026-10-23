import * as github from '@actions/github';
import * as core from '@actions/core';

type Octokit = ReturnType<typeof github.getOctokit>;

export interface DependencySnapshot {
  source: 'requirements.txt' | 'pyproject.toml' | null;
  dependencies: Record<string, string>; // name -> version specifier
}

/**
 * Parse a requirements.txt file into a name→version map.
 */
function parseRequirementsTxt(content: string): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_\-]+)([><=!~][^;#]*)?/);
    if (match) {
      deps[match[1].toLowerCase()] = (match[2] || '').trim();
    }
  }
  return deps;
}

/**
 * Parse a pyproject.toml file and extract [project.dependencies].
 */
function parsePyprojectToml(content: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const depSection = content.match(/\[project\.dependencies\]([\s\S]*?)(?=\[|$)/);
  if (!depSection) return deps;
  for (const line of depSection[1].split('\n')) {
    const trimmed = line.replace(/["',]/g, '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_\-]+)([><=!~][^;#]*)?/);
    if (match) {
      deps[match[1].toLowerCase()] = (match[2] || '').trim();
    }
  }
  return deps;
}

/**
 * Fetch Python dependency file from a GitHub repo.
 */
export async function fetchDependencies(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<DependencySnapshot> {
  const candidates = ['requirements.txt', 'pyproject.toml'];

  for (const filename of candidates) {
    try {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path: filename });
      if ('content' in data && typeof data.content === 'string') {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        const dependencies = filename === 'requirements.txt'
          ? parseRequirementsTxt(content)
          : parsePyprojectToml(content);
        return { source: filename as DependencySnapshot['source'], dependencies };
      }
    } catch {
      // File not found, try next
    }
  }

  return { source: null, dependencies: {} };
}

/**
 * Diff two dependency snapshots and return a human-readable summary.
 */
export function diffDependencies(
  before: Record<string, string>,
  after: Record<string, string>
): string {
  const lines: string[] = [];

  for (const [name, version] of Object.entries(after)) {
    if (!(name in before)) {
      lines.push(`  + Added: ${name}${version ? ` ${version}` : ''}`);
    } else if (before[name] !== version) {
      lines.push(`  ~ Updated: ${name} ${before[name] || '*'} → ${version || '*'}`);
    }
  }

  for (const name of Object.keys(before)) {
    if (!(name in after)) {
      lines.push(`  - Removed: ${name}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : '  No dependency changes.';
}
