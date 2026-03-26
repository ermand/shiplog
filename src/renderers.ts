// Markdown and Slack report renderers

import type { PR, Config } from './utils'
import { emojiStatus } from './utils'

interface RepoGroup {
  repo: string
  prs: PR[]
}

function groupByRepo(prs: PR[]): RepoGroup[] {
  const map = new Map<string, PR[]>()
  for (const pr of prs) {
    const list = map.get(pr.repo) ?? []
    list.push(pr)
    map.set(pr.repo, list)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([repo, prs]) => ({ repo, prs }))
}

export function renderMarkdown(prs: PR[], config: Config, startDate: string, today: string): string {
  const lines: string[] = []
  lines.push(`## Standup Report — ${startDate} to ${today}`)
  lines.push('')

  if (prs.length === 0) {
    lines.push('No PRs found for this period.')
    return lines.join('\n')
  }

  const groups = groupByRepo(prs)
  for (const group of groups) {
    lines.push(`### ${group.repo}`)
    for (const pr of group.prs) {
      const status = emojiStatus(pr.state)
      lines.push(`- **${status}** ${pr.title} ([#${pr.number}](${pr.url}))`)
      if (config.aiProvider !== 'false' && pr.description !== pr.title) {
        lines.push(`  > ${pr.description}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

function slackStatus(state: string): string {
  switch (state.toUpperCase()) {
    case 'MERGED': return 'merged'
    case 'OPEN': return 'open'
    case 'CLOSED': return 'closed'
    default: return state.toLowerCase()
  }
}

// Extract just the repo short name from "owner/repo"
function shortRepo(repo: string): string {
  return repo.split('/').pop() ?? repo
}

export function renderSlack(prs: PR[], config: Config, startDate: string, today: string): string {
  const lines: string[] = []
  lines.push(`Standup ${startDate} → ${today}`)
  lines.push('')

  if (prs.length === 0) {
    lines.push('No PRs found for this period.')
    return lines.join('\n')
  }

  const groups = groupByRepo(prs)
  for (const group of groups) {
    lines.push(`${shortRepo(group.repo)}:`)
    for (const pr of group.prs) {
      const status = slackStatus(pr.state)
      let line = `  • [${status}] ${pr.title} ${pr.url}`
      if (config.aiProvider !== 'false' && pr.description !== pr.title) {
        line += `\n    ↳ ${pr.description}`
      }
      lines.push(line)
    }
    lines.push('')
  }

  return lines.join('\n')
}
