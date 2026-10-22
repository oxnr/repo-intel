# repo-intel

[![Test](https://github.com/oxnr/repo-intel/actions/workflows/test.yml/badge.svg)](https://github.com/oxnr/repo-intel/actions/workflows/test.yml)

AI-powered competitive intelligence from GitHub repos. Monitor competitor activity, releases, and strategic signals — delivered as GitHub Issues.

## Features

- **Commit velocity tracking** — detect acceleration or slowdowns
- **Release monitoring** — track shipping cadence, hotfixes, and versioning
- **Contributor analysis** — spot team growth and new contributors
- **Issue/PR throughput** — measure development health
- **Strategic signals** — HIGH/MED/LOW prioritized intelligence
- **Automated recommendations** — actionable insights per repo

## Runtime and security release

The action selects GitHub Actions' `node24` runtime. Self-hosted runners need
[runner 2.327.1 or newer](https://github.com/actions/runner/releases/tag/v2.327.1)
for Node 24 support. That compatibility minimum is not a security patch floor:
verify the actual runner-bundled Node binary is **24.22.1 or newer** on the 24.x
line before running it. `actions/setup-node` and this repository's `.node-version`
set shell/tooling Node; they do not replace the runtime that executes an action.
See the [October Node security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).

The repository's manual/demo workflows use the checked-out action so they test
its current metadata. The disabled example schedule remains disabled. Existing
external consumers of `oxnr/repo-intel@v1` keep using the previously published tag
until an approved release advances it; merging the runtime change alone does
not update that tag. Publish and select the reviewed release separately.

## Quick Start

```yaml
# .github/workflows/repo-intel.yml
name: Competitive Intelligence
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am
  workflow_dispatch:

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: oxnr/repo-intel@v1
        with:
          repos: 'facebook/react,vercel/next.js,sveltejs/svelte'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `repos` | Comma-separated repos to monitor (e.g., `owner/repo`) | Yes | — |
| `github-token` | GitHub token for API access | Yes | `${{ github.token }}` |
| `output-format` | Output: `issue`, `pr-comment`, or `json` | No | `issue` |
| `period-days` | Analysis period in days | No | `7` |

## Outputs

| Output | Description |
|--------|-------------|
| `report` | Full JSON report |
| `issue-url` | URL of created issue (when `output-format: issue`) |

## Output Formats

### Issue (default)
Creates a GitHub Issue in your repo with the full intelligence digest.

### PR Comment
Posts the report as a comment on the triggering pull request.

### JSON
Outputs structured JSON for downstream consumption in your workflow.

## See It in Action

Check out a **live demo** with real data from facebook/react, vercel/next.js, and sveltejs/svelte:

**[oxnr/repo-intel-demo](https://github.com/oxnr/repo-intel-demo)** — full example report generated from real GitHub data.

## Example Report

Here's what a repo-intel report looks like (real data from 2026-03-12):

```
## repo-intel Report: vercel/next.js
Period: 2026-03-05 to 2026-03-12 (7 days)

### Activity Summary
- 99 commits (↓1% vs prior period)
- 12 release(s): v16.2.0-canary.81 ... v16.2.0-canary.93
- 100 total contributors
- Issues: 10 opened, 18 closed (avg close: 2.8 days)
- PRs: 100 opened, 25 merged
- ⭐ 138,308 stars | 🍴 30,621 forks

### Strategic Signals
🔴 HIGH: 12 releases in period — rapid shipping cadence
🔴 HIGH: 25 PRs merged — very high development throughput
🟢 LOW: Issue backlog shrinking — strong bug-fixing focus

### Recommendation
Action required — Multiple high-priority signals detected for
vercel/next.js. Investigate specific changes and assess competitive impact.
```

```
## repo-intel Report: sveltejs/svelte
Period: 2026-03-05 to 2026-03-12 (7 days)

### Activity Summary
- 25 commits (↓19% vs prior period)
- 4 release(s): svelte@5.53.8, svelte@5.53.9, svelte@5.53.10, svelte@5.53.11
- 100 total contributors
- Issues: 16 opened, 15 closed (avg close: 1.9 days)
- PRs: 32 opened, 25 merged
- ⭐ 86,101 stars | 🍴 4,801 forks

### Strategic Signals
🔴 HIGH: 4 releases in period — rapid shipping cadence
🔴 HIGH: 25 PRs merged — very high development throughput

### Recommendation
Action required — Multiple high-priority signals detected for
sveltejs/svelte. Investigate specific changes and assess competitive impact.
```

## License

MIT
