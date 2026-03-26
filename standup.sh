#!/bin/bash
set -euo pipefail

# Standup report generator - pulls PRs from GitHub via gh CLI + AI descriptions
# Usage: ./standup.sh [--days N] [--since YYYY-MM-DD] [--ai PROVIDER] [--format FORMAT] [--copy]

DAYS=1
SINCE=""
AI_PROVIDER="${AI_PROVIDER:-gemini}"
OUTPUT_FORMAT="${OUTPUT_FORMAT:-markdown}"
COPY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --days) DAYS="$2"; shift 2 ;;
    --since) SINCE="$2"; shift 2 ;;
    --ai) AI_PROVIDER="$2"; shift 2 ;;
    --format) OUTPUT_FORMAT="$2"; shift 2 ;;
    --copy) COPY=true; shift ;;
    -h|--help)
      echo "Usage: ./standup.sh [--days N] [--since YYYY-MM-DD] [--ai PROVIDER] [--format FORMAT] [--copy]"
      echo "  --days N          PRs from the last N days (default: 1)"
      echo "  --since DATE      PRs since a specific date (YYYY-MM-DD)"
      echo "  --ai PROVIDER     AI provider: gemini, openai, anthropic, false (default: gemini)"
      echo "  --format FORMAT   Output format: markdown, slack (default: markdown)"
      echo "  --copy            Copy output to clipboard (pbcopy)"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Load .env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  set -a
  source "${SCRIPT_DIR}/.env"
  set +a
fi

# Calculate start date (macOS date syntax)
if [[ -n "$SINCE" ]]; then
  START_DATE="$SINCE"
else
  START_DATE=$(date -v-"${DAYS}"d +%Y-%m-%d)
fi

TODAY=$(date +%Y-%m-%d)

# Output directory
REPORTS_DIR="${SCRIPT_DIR}/reports"
mkdir -p "$REPORTS_DIR"
if [[ "$OUTPUT_FORMAT" == "slack" ]]; then
  OUTPUT_FILE="${REPORTS_DIR}/${TODAY}.slack.txt"
else
  OUTPUT_FILE="${REPORTS_DIR}/${TODAY}.md"
fi

# Check dependencies
if ! command -v gh &>/dev/null; then
  echo "Error: gh CLI not installed. Install via: brew install gh" >&2
  exit 1
fi
if ! command -v jq &>/dev/null; then
  echo "Error: jq not installed. Install via: brew install jq" >&2
  exit 1
fi

# Validate format
case "$OUTPUT_FORMAT" in
  markdown|slack) ;;
  *)
    echo "Error: Unknown format '${OUTPUT_FORMAT}'. Use: markdown, slack" >&2
    exit 1
    ;;
esac

# Validate provider and API key
case "$AI_PROVIDER" in
  gemini)
    if [[ -z "${GEMINI_API_KEY:-}" ]]; then
      echo "Error: GEMINI_API_KEY not set. Add it to .env or export it." >&2
      exit 1
    fi
    ;;
  openai)
    if [[ -z "${OPENAI_API_KEY:-}" ]]; then
      echo "Error: OPENAI_API_KEY not set. Add it to .env or export it." >&2
      exit 1
    fi
    ;;
  anthropic)
    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
      echo "Error: ANTHROPIC_API_KEY not set. Add it to .env or export it." >&2
      exit 1
    fi
    ;;
  false) ;; # AI disabled, no key needed
  *)
    echo "Error: Unknown AI provider '${AI_PROVIDER}'. Use: gemini, openai, anthropic, false" >&2
    exit 1
    ;;
esac

# --- Emoji status ---

emoji_status() {
  local state
  state=$(echo "$1" | tr '[:lower:]' '[:upper:]')
  case "$state" in
    MERGED) echo "✅ Merged" ;;
    OPEN)   echo "🔄 Open" ;;
    CLOSED) echo "❌ Closed" ;;
    *)      echo "$1" ;;
  esac
}

# --- Shared prompt for all providers ---

PR_PROMPT="Given this pull request, write a 1-sentence plain-text summary (max 15 words) of what was done. No markdown, no quotes, no prefix."

# --- Provider functions ---

describe_pr_gemini() {
  local title="$1" body="$2"
  local url="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}"

  local payload
  payload=$(jq -n --arg prompt "${PR_PROMPT}

Title: ${title}
Body: ${body}" '{
    contents: [{ parts: [{ text: $prompt }] }],
    generationConfig: { maxOutputTokens: 60, temperature: 0.2 }
  }')

  local response
  response=$(curl -s -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null) || true

  echo "$response" | jq -r '.candidates[0].content.parts[0].text // empty' 2>/dev/null | head -1
}

describe_pr_openai() {
  local title="$1" body="$2"

  local payload
  payload=$(jq -n --arg system "$PR_PROMPT" --arg user "Title: ${title}
Body: ${body}" '{
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: $system },
      { role: "user", content: $user }
    ],
    max_tokens: 60,
    temperature: 0.2
  }')

  local response
  response=$(curl -s -X POST "https://api.openai.com/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${OPENAI_API_KEY}" \
    -d "$payload" 2>/dev/null) || true

  echo "$response" | jq -r '.choices[0].message.content // empty' 2>/dev/null | head -1
}

describe_pr_anthropic() {
  local title="$1" body="$2"

  local payload
  payload=$(jq -n --arg system "$PR_PROMPT" --arg user "Title: ${title}
Body: ${body}" '{
    model: "claude-haiku-4-20250414",
    max_tokens: 60,
    messages: [
      { role: "user", content: $user }
    ],
    system: $system,
    temperature: 0.2
  }')

  local response
  response=$(curl -s -X POST "https://api.anthropic.com/v1/messages" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${ANTHROPIC_API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -d "$payload" 2>/dev/null) || true

  echo "$response" | jq -r '.content[0].text // empty' 2>/dev/null | head -1
}

# --- Dispatcher ---

describe_pr() {
  local title="$1"
  local body="${2:0:1000}" # truncate body to ~1000 chars

  case "$AI_PROVIDER" in
    gemini)    describe_pr_gemini "$title" "$body" ;;
    openai)    describe_pr_openai "$title" "$body" ;;
    anthropic) describe_pr_anthropic "$title" "$body" ;;
  esac
}

# --- Renderers ---

render_markdown() {
  echo "## Standup Report — ${START_DATE} to ${TODAY}"
  echo ""

  local current_repo=""
  while IFS=$'\t' read -r repo number state title description url; do
    if [[ "$repo" != "$current_repo" ]]; then
      [[ -n "$current_repo" ]] && echo ""
      echo "### ${repo}"
      current_repo="$repo"
    fi

    local status
    status=$(emoji_status "$state")
    echo "- **${status}** ${title} ([#${number}](${url}))"
    if [[ "$AI_PROVIDER" != "false" && "$description" != "$title" ]]; then
      echo "  > ${description}"
    fi
  done < <(sort -t$'\t' -k1,1 "$ENRICHED")

  echo ""
}

slack_status() {
  local state
  state=$(echo "$1" | tr '[:lower:]' '[:upper:]')
  case "$state" in
    MERGED) echo "merged" ;;
    OPEN)   echo "open" ;;
    CLOSED) echo "closed" ;;
    *)      echo "$1" ;;
  esac
}

# Extract short repo name from "owner/repo"
short_repo() {
  echo "$1" | sed 's|.*/||'
}

render_slack() {
  echo "Standup ${START_DATE} → ${TODAY}"
  echo ""

  local current_repo=""
  local repo_lines=""

  while IFS=$'\t' read -r repo number state title description url; do
    if [[ "$repo" != "$current_repo" ]]; then
      if [[ -n "$current_repo" ]]; then
        echo "$(short_repo "$current_repo"):"
        echo "$repo_lines"
        echo ""
      fi
      current_repo="$repo"
      repo_lines=""
    fi

    local status
    status=$(slack_status "$state")
    repo_lines+="  • [${status}] ${title} ${url}"
    if [[ "$AI_PROVIDER" != "false" && "$description" != "$title" ]]; then
      repo_lines+=$'\n'"    ↳ ${description}"
    fi
    repo_lines+=$'\n'
  done < <(sort -t$'\t' -k1,1 "$ENRICHED")

  if [[ -n "$current_repo" ]]; then
    echo "$(short_repo "$current_repo"):"
    echo "$repo_lines"
  fi
}

# --- Main ---

echo "Fetching PRs since ${START_DATE} (AI: ${AI_PROVIDER}, format: ${OUTPUT_FORMAT})..." >&2

# Fetch PRs
PRS=$(gh search prs \
  --author=@me \
  --created=">=${START_DATE}" \
  --limit 100 \
  --json repository,title,state,url,number 2>&1) || {
  echo "Error fetching PRs: $PRS" >&2
  exit 1
}

if [[ "$PRS" == "[]" || -z "$PRS" ]]; then
  {
    if [[ "$OUTPUT_FORMAT" == "slack" ]]; then
      echo "Standup ${START_DATE} → ${TODAY}"
      echo ""
      echo "No PRs found for this period."
    else
      echo "## Standup Report — ${START_DATE} to ${TODAY}"
      echo ""
      echo "No PRs found for this period."
    fi
  } | tee "$OUTPUT_FILE"
  echo "Report saved to ${OUTPUT_FILE}" >&2
  exit 0
fi

# Extract PR list as tab-separated: repo, number, state, title, url
PR_LIST=$(echo "$PRS" | jq -r '.[] | [.repository.nameWithOwner, (.number|tostring), .state, .title, .url] | @tsv')

# Fetch PR bodies and generate descriptions
TOTAL=$(echo "$PR_LIST" | wc -l | tr -d ' ')
COUNT=0

# Temp file for enriched data
ENRICHED=$(mktemp)
trap 'rm -f "$ENRICHED"' EXIT

while IFS=$'\t' read -r repo number state title url; do
  COUNT=$((COUNT + 1))
  echo "  [${COUNT}/${TOTAL}] ${repo}#${number}..." >&2

  if [[ "$AI_PROVIDER" == "false" ]]; then
    description="$title"
  else
    # Fetch PR body via gh api
    body=$(gh api "repos/${repo}/pulls/${number}" --jq '.body // ""' 2>/dev/null || echo "")

    # Get AI description
    description=$(describe_pr "$title" "$body")
    if [[ -z "$description" ]]; then
      description="$title"
    fi
  fi

  echo -e "${repo}\t${number}\t${state}\t${title}\t${description}\t${url}" >> "$ENRICHED"
done <<< "$PR_LIST"

# Build report
{
  if [[ "$OUTPUT_FORMAT" == "slack" ]]; then
    render_slack
  else
    render_markdown
  fi
} | tee "$OUTPUT_FILE"

# Copy to clipboard
if [[ "$COPY" == true ]]; then
  if command -v pbcopy &>/dev/null; then
    pbcopy < "$OUTPUT_FILE"
    echo "Copied to clipboard." >&2
  else
    echo "Warning: pbcopy not found. Skipping clipboard copy." >&2
  fi
fi

echo "Report saved to ${OUTPUT_FILE}" >&2
