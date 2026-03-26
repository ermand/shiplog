#!/usr/bin/env bun

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { loadEnv, getStartDate, formatDate } from './utils'
import type { Config, PR, AIProvider, OutputFormat } from './utils'
import { searchPRs, fetchPRBody } from './github'
import { describePR } from './providers'
import { renderMarkdown, renderSlack } from './renderers'
import { copyToClipboard } from './clipboard'

// --- Parse CLI args ---

function parseArgs(): Config {
  const args = process.argv.slice(2)
  const config: Config = {
    days: 1,
    since: '',
    aiProvider: (process.env.AI_PROVIDER as AIProvider) ?? 'gemini',
    format: (process.env.OUTPUT_FORMAT as OutputFormat) ?? 'markdown',
    copy: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--days':
        config.days = parseInt(args[++i], 10)
        break
      case '--since':
        config.since = args[++i]
        break
      case '--ai':
        config.aiProvider = args[++i] as AIProvider
        break
      case '--format':
        config.format = args[++i] as OutputFormat
        break
      case '--copy':
        config.copy = true
        break
      case '-h':
      case '--help':
        console.log('Usage: standup [--days N] [--since YYYY-MM-DD] [--ai PROVIDER] [--format FORMAT] [--copy]')
        console.log('  --days N          PRs from the last N days (default: 1)')
        console.log('  --since DATE      PRs since a specific date (YYYY-MM-DD)')
        console.log('  --ai PROVIDER     AI provider: gemini, openai, anthropic, false (default: gemini)')
        console.log('  --format FORMAT   Output format: markdown, slack (default: markdown)')
        console.log('  --copy            Copy output to clipboard')
        process.exit(0)
      default:
        console.error(`Unknown option: ${args[i]}`)
        process.exit(1)
    }
  }

  return config
}

// --- Validate config ---

function validate(config: Config): void {
  const validProviders = ['gemini', 'openai', 'anthropic', 'false']
  if (!validProviders.includes(config.aiProvider)) {
    console.error(`Error: Unknown AI provider '${config.aiProvider}'. Use: ${validProviders.join(', ')}`)
    process.exit(1)
  }

  const validFormats = ['markdown', 'slack']
  if (!validFormats.includes(config.format)) {
    console.error(`Error: Unknown format '${config.format}'. Use: ${validFormats.join(', ')}`)
    process.exit(1)
  }

  const keyMap: Record<string, string> = {
    gemini: 'GEMINI_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
  }

  if (config.aiProvider !== 'false') {
    const envVar = keyMap[config.aiProvider]
    if (!process.env[envVar]) {
      console.error(`Error: ${envVar} not set. Add it to .env or export it.`)
      process.exit(1)
    }
  }
}

// --- Main ---

async function main() {
  // Load .env from current working directory
  const projectDir = process.cwd()
  loadEnv(projectDir)

  const config = parseArgs()
  validate(config)

  const startDate = getStartDate(config.days, config.since)
  const today = formatDate(new Date())

  // Output file
  const reportsDir = join(projectDir, 'reports')
  mkdirSync(reportsDir, { recursive: true })
  const ext = config.format === 'slack' ? 'slack.txt' : 'md'
  const outputFile = join(reportsDir, `${today}.${ext}`)

  console.error(`Fetching PRs since ${startDate} (AI: ${config.aiProvider}, format: ${config.format})...`)

  // Fetch PRs
  const rawPRs = await searchPRs(startDate)

  if (rawPRs.length === 0) {
    const renderer = config.format === 'slack' ? renderSlack : renderMarkdown
    const output = renderer([], config, startDate, today)
    console.log(output)
    writeFileSync(outputFile, output)
    console.error(`Report saved to ${outputFile}`)
    return
  }

  // Enrich PRs with AI descriptions
  const prs: PR[] = []
  for (let i = 0; i < rawPRs.length; i++) {
    const raw = rawPRs[i]
    console.error(`  [${i + 1}/${rawPRs.length}] ${raw.repo}#${raw.number}...`)

    let description = raw.title
    if (config.aiProvider !== 'false') {
      const body = await fetchPRBody(raw.repo, raw.number)
      const aiDesc = await describePR(raw.title, body, config.aiProvider)
      if (aiDesc) description = aiDesc
    }

    prs.push({ ...raw, description })
  }

  // Render
  const renderer = config.format === 'slack' ? renderSlack : renderMarkdown
  const output = renderer(prs, config, startDate, today)

  // Output to stdout + file
  console.log(output)
  writeFileSync(outputFile, output)

  // Copy to clipboard
  if (config.copy) {
    const copied = await copyToClipboard(output)
    if (copied) console.error('Copied to clipboard.')
  }

  console.error(`Report saved to ${outputFile}`)
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
