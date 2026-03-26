# Standup Report Generator

Cross-platform CLI that generates daily standup reports from your GitHub pull requests, enriched with AI-generated descriptions. Built with TypeScript + Bun for single-binary executables on macOS, Linux, and Windows.

## Features

- Pulls PRs you authored from **all repos** via `gh` CLI
- Fetches PR body and generates a **1-sentence AI summary**
- **3 AI providers:** Gemini Flash, OpenAI GPT-4o Mini, Anthropic Claude Haiku (or disable AI entirely)
- **Markdown + Slack** output formats with emoji status indicators
- Clickable PR links in both formats
- `--copy` to clipboard (cross-platform: pbcopy, clip, xclip)
- Saves reports to `reports/`
- Configurable time range via `--days` or `--since`
- **Compiles to a single binary** — no runtime needed

## Prerequisites

- [gh CLI](https://cli.github.com/) — authenticated (`gh auth login`)
- [Bun](https://bun.sh/) — for development and building (not needed if using compiled binary)
- API key for an AI provider (optional — see below)

```bash
# macOS
brew install gh
curl -fsSL https://bun.sh/install | bash

# Windows
winget install GitHub.cli
powershell -c "irm bun.sh/install.ps1 | iex"

gh auth login
```

## Setup

```bash
git clone <your-repo-url> standups
cd standups
bun install
cp .env.example .env
# Add your API key(s) to .env
```

## AI Providers

| Provider | Model | Env Var | Get a key |
|---|---|---|---|
| `gemini` (default) | Gemini 2.0 Flash | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/apikey) |
| `openai` | GPT-4o Mini | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) |
| `anthropic` | Claude Haiku 4 | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `false` | — (disabled) | — | — |

You only need the key for the provider you use. Set `AI_PROVIDER` in `.env` to change the default, or use `--ai` per run. Use `false` to disable AI entirely — the report will show PR titles only, and no API calls are made.

## Usage

```bash
# Dev mode (requires Bun)
bun run dev -- --days 7

# Or with compiled binary
./standup --days 7

# PRs from the last 24 hours (default)
./standup

# PRs since a specific date
./standup --since 2026-03-01

# Use a specific AI provider
./standup --ai openai
./standup --ai anthropic

# Disable AI (just PR titles, no API key needed)
./standup --ai false

# Slack format
./standup --format slack

# Slack format + copy to clipboard
./standup --days 7 --format slack --copy

# Copy markdown to clipboard
./standup --days 7 --copy

# Help
./standup --help
```

## Building

```bash
# Build for current platform
bun run build

# Cross-compile
bun run build:macos     # → dist/standup-macos
bun run build:linux     # → dist/standup-linux
bun run build:windows   # → dist/standup.exe
```

The compiled binary includes the Bun runtime — no dependencies needed on the target machine (except `gh`).

## Output Formats

### Markdown (default)

```markdown
## Standup Report — 2026-03-24 to 2026-03-25

### nebulaltd/tokitoki
- **✅ Merged** PokPay payment integration ([#47](https://github.com/...))
  > Integrated PokPay card sync and webhook handling with React 19 shim.
- **✅ Merged** Guest checkout, quantity modal, checkout UI fixes ([#49](https://github.com/...))
  > Added guest checkout flow and fixed quantity selection UI.

### nebulaltd/oddsy-backend
- **🔄 Open** feat: tenant competition and team ordering ([#188](https://github.com/...))
  > Added tenant-level competition support with configurable team ordering.
```

### Slack

```
Standup — 2026-03-24 to 2026-03-25

*nebulaltd/tokitoki* — 2 PRs
1. [Merged] PokPay payment integration — PR#47
    Integrated PokPay card sync and webhook handling with React 19 shim.
2. [Merged] Guest checkout fixes — PR#49
    Added guest checkout flow and fixed quantity selection UI.

*nebulaltd/oddsy-backend* — 1 PR
1. [Open] feat: tenant competition and team ordering — PR#188
    Added tenant-level competition support with configurable team ordering.
```

## Project Structure

```
standups/
├── src/
│   ├── index.ts        # CLI entry point
│   ├── github.ts       # gh CLI wrappers
│   ├── providers.ts    # AI provider API calls
│   ├── renderers.ts    # Markdown + Slack formatters
│   ├── clipboard.ts    # Cross-platform clipboard
│   └── utils.ts        # Env loader, date helpers, emoji status
├── standup.sh          # Legacy bash script
├── package.json
├── tsconfig.json
├── .env.example
├── .env                # Your keys (git-ignored)
├── .gitignore
└── reports/            # Generated reports
```

## How It Works

1. **Fetch PRs** — `gh search prs --author=@me` for the given date range
2. **Fetch PR bodies** — `gh api repos/{owner}/{repo}/pulls/{number}` for each PR (skipped when `--ai false`)
3. **AI summarize** — sends title + body (truncated to 1000 chars) to the selected provider for a 1-sentence description
4. **Render** — formats as Markdown or Slack with emoji statuses and PR links
5. **Save + copy** — writes to `reports/`, optionally copies to clipboard
