# Standup Report Generator

Generate daily standup reports from your GitHub pull requests, enriched with AI-generated descriptions.

## Features

- Pulls PRs you authored from **all repos** via `gh` CLI
- Fetches PR body and generates a **1-sentence AI summary**
- **3 AI providers:** Gemini Flash, OpenAI GPT-4o Mini, Anthropic Claude Haiku
- Outputs a **Markdown report** grouped by repository
- Saves reports to `reports/YYYY-MM-DD.md`
- Configurable time range via `--days` or `--since`

## Prerequisites

- [gh CLI](https://cli.github.com/) — authenticated (`gh auth login`)
- [jq](https://jqlang.github.io/jq/) — JSON processor
- `curl` — pre-installed on macOS/Linux
- API key for at least one provider (see below)

```bash
brew install gh jq
gh auth login
```

## Setup

```bash
git clone <your-repo-url> standups
cd standups
cp .env.example .env
# Add your API key(s) to .env
chmod +x standup.sh
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
# PRs from the last 24 hours (default provider)
./standup.sh

# PRs from the last 7 days
./standup.sh --days 7

# PRs since a specific date
./standup.sh --since 2026-03-01

# Use a specific AI provider
./standup.sh --ai openai
./standup.sh --ai anthropic
./standup.sh --days 7 --ai anthropic

# Disable AI (just PR titles, no API key needed)
./standup.sh --ai false

# Help
./standup.sh --help
```

## Sample Output

```markdown
## Standup Report - 2026-03-24 to 2026-03-25

### nebulaltd/tokitoki
- **[Merged]** PokPay payment integration (#47)
  > Integrated PokPay card sync and webhook handling with React 19 shim.
- **[Merged]** Guest checkout, quantity modal, checkout UI fixes (#49)
  > Added guest checkout flow and fixed quantity selection UI.

### nebulaltd/oddsy-backend
- **[Open]** feat: tenant competition and team ordering (#188)
  > Added tenant-level competition support with configurable team ordering.
```

## Project Structure

```
standups/
├── standup.sh          # Main script
├── .env.example        # Template for API keys
├── .env                # Your keys (git-ignored)
├── .gitignore
├── reports/            # Generated reports (one per day)
│   └── 2026-03-25.md
└── README.md
```

## How It Works

1. **Fetch PRs** — `gh search prs --author=@me` for the given date range
2. **Fetch PR bodies** — `gh api repos/{owner}/{repo}/pulls/{number}` for each PR
3. **AI summarize** — sends title + body (truncated to 1000 chars) to the selected provider for a 1-sentence description
4. **Write report** — groups PRs by repo, formats as Markdown, saves to `reports/`
