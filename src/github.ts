// gh CLI wrappers for fetching PR data

interface GHSearchResult {
  repository: { nameWithOwner: string }
  title: string
  state: string
  url: string
  number: number
}

export interface RawPR {
  repo: string
  number: number
  state: string
  title: string
  url: string
}

// Run a command and return stdout
async function exec(cmd: string, args: string[]): Promise<string> {
  const proc = Bun.spawn([cmd, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdout = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`${cmd} failed (exit ${exitCode}): ${stderr.trim()}`)
  }
  return stdout.trim()
}

// Search PRs authored by current user since a given date
export async function searchPRs(since: string): Promise<RawPR[]> {
  const stdout = await exec('gh', [
    'search', 'prs',
    '--author=@me',
    `--created=>=${since}`,
    '--limit', '100',
    '--json', 'repository,title,state,url,number',
  ])

  if (!stdout || stdout === '[]') return []

  const results: GHSearchResult[] = JSON.parse(stdout)
  return results.map((r) => ({
    repo: r.repository.nameWithOwner,
    number: r.number,
    state: r.state,
    title: r.title,
    url: r.url,
  }))
}

// Fetch PR body via gh api
export async function fetchPRBody(repo: string, number: number): Promise<string> {
  try {
    const stdout = await exec('gh', [
      'api', `repos/${repo}/pulls/${number}`,
      '--jq', '.body // ""',
    ])
    return stdout
  } catch {
    return ''
  }
}
