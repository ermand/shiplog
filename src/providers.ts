// AI provider API calls for PR description generation

import type { AIProvider } from './utils'

const PR_PROMPT = 'Given this pull request, write a 1-sentence plain-text summary (max 15 words) of what was done. No markdown, no quotes, no prefix.'

// Truncate body to keep requests fast
function truncate(text: string, maxLen = 1000): string {
  return text.slice(0, maxLen)
}

async function describeGemini(title: string, body: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${PR_PROMPT}\n\nTitle: ${title}\nBody: ${body}` }] }],
      generationConfig: { maxOutputTokens: 60, temperature: 0.2 },
    }),
  })

  const data = await res.json() as any
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.split('\n')[0] ?? ''
}

async function describeOpenAI(title: string, body: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: PR_PROMPT },
        { role: 'user', content: `Title: ${title}\nBody: ${body}` },
      ],
      max_tokens: 60,
      temperature: 0.2,
    }),
  })

  const data = await res.json() as any
  return data?.choices?.[0]?.message?.content?.split('\n')[0] ?? ''
}

async function describeAnthropic(title: string, body: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-20250414',
      max_tokens: 60,
      system: PR_PROMPT,
      messages: [
        { role: 'user', content: `Title: ${title}\nBody: ${body}` },
      ],
      temperature: 0.2,
    }),
  })

  const data = await res.json() as any
  return data?.content?.[0]?.text?.split('\n')[0] ?? ''
}

// Dispatcher — returns AI description or empty string
export async function describePR(
  title: string,
  body: string,
  provider: AIProvider,
): Promise<string> {
  if (provider === 'false') return title

  const truncatedBody = truncate(body)

  try {
    switch (provider) {
      case 'gemini': return await describeGemini(title, truncatedBody)
      case 'openai': return await describeOpenAI(title, truncatedBody)
      case 'anthropic': return await describeAnthropic(title, truncatedBody)
    }
  } catch {
    return ''
  }
}
