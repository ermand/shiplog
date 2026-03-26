import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface PR {
  repo: string
  number: number
  state: string
  title: string
  url: string
  description: string
}

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'false'
export type OutputFormat = 'markdown' | 'slack'

export interface Config {
  days: number
  since: string
  aiProvider: AIProvider
  format: OutputFormat
  copy: boolean
}

// Load .env file into process.env
export function loadEnv(dir: string): void {
  const envPath = join(dir, '.env')
  if (!existsSync(envPath)) return

  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

// Map PR state to emoji label
export function emojiStatus(state: string): string {
  switch (state.toUpperCase()) {
    case 'MERGED': return '✅ Merged'
    case 'OPEN': return '🔄 Open'
    case 'CLOSED': return '❌ Closed'
    default: return state
  }
}

// Format a Date as YYYY-MM-DD
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Calculate start date from days offset or explicit date string
export function getStartDate(days: number, since: string): string {
  if (since) return since
  const date = new Date()
  date.setDate(date.getDate() - days)
  return formatDate(date)
}
