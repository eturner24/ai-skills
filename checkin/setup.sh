#!/bin/bash
set -e

echo "============================================"
echo "  Project Tracking Kit -- Setup"
echo "============================================"
echo ""

# -- Product name ----------------------------------------------------------
read -p "Product/team name (used in page titles, e.g. 'Platform Docs'): " PRODUCT_NAME
if [ -z "$PRODUCT_NAME" ]; then
  echo "Error: Product name is required."
  exit 1
fi

# -- Project directory -----------------------------------------------------
read -p "Directory for project tracking files [~/Documents/project-tracking]: " PROJECT_DIR
PROJECT_DIR="${PROJECT_DIR:-$HOME/Documents/project-tracking}"
PROJECT_DIR="${PROJECT_DIR/#\~/$HOME}"

# -- Git repo --------------------------------------------------------------
read -p "Path to a git repo to check for activity (leave blank to skip): " GIT_REPO
GIT_REPO="${GIT_REPO/#\~/$HOME}"

# -- Workspace directories -------------------------------------------------
echo ""
echo "Workspace directories hold drafts, notes, or review files that never reach Jira."
echo "The check-in lists files changed in them since the last check-in."
read -p "Workspace directories to scan (comma-separated, or blank): " WORKSPACE_DIRS_INPUT

# -- Email -----------------------------------------------------------------
echo ""
echo "-- Email scan --"
echo "The email scan needs a Gmail MCP server in Claude Code that provides"
echo "the search_emails and read_email tools (server name 'gmail')."
read -p "Scan email during check-ins? [y/N]: " PREF_EMAIL
EMAIL_FOCUS=""
if [[ "$PREF_EMAIL" =~ ^[Yy] ]]; then
  echo "Describe what email is relevant to you, in plain English (or blank for the default)."
  echo "Example: 'Release announcements from the platform team, meeting notes, and review requests'"
  read -p "Email focus: " EMAIL_FOCUS
fi

# -- Newsfeed --------------------------------------------------------------
read -p "Days to keep undated newsfeed items [14]: " RETENTION_DAYS
RETENTION_DAYS="${RETENTION_DAYS:-14}"
if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "Error: retention days must be a number."
  exit 1
fi

# -- Jira configuration ---------------------------------------------------
echo ""
echo "-- Jira Configuration --"
read -p "Default Jira host [your-org.atlassian.net]: " DEFAULT_JIRA_HOST
DEFAULT_JIRA_HOST="${DEFAULT_JIRA_HOST:-your-org.atlassian.net}"
TICKET_BASE_URL="https://${DEFAULT_JIRA_HOST}/browse/"

echo ""
echo "Enter your Jira project prefixes and their hosts."
echo "Format: PREFIX=host (one per line, blank line to finish)"
echo "Example: PROJKEY=myorg.atlassian.net"
echo ""

PREFIX_HOST_MAP=""
JIRA_PREFIXES=""
JIRA_HOSTS=""
while true; do
  read -p "  prefix=host (or blank to finish): " entry
  [ -z "$entry" ] && break
  prefix="${entry%%=*}"
  host="${entry#*=}"
  if [ -z "$prefix" ] || [ -z "$host" ] || [ "$prefix" == "$entry" ]; then
    echo "  Invalid format. Use PREFIX=host"
    continue
  fi
  PREFIX_HOST_MAP="${PREFIX_HOST_MAP}    \"${prefix}\": \"${host}\",
"
  JIRA_PREFIXES="${JIRA_PREFIXES}${prefix}-*, "
  if [[ ! "$JIRA_HOSTS" == *"$host"* ]]; then
    JIRA_HOSTS="${JIRA_HOSTS}${host}, "
  fi
done

JIRA_PREFIXES="${JIRA_PREFIXES%, }"
JIRA_HOSTS="${JIRA_HOSTS%, }"

if [ -z "$JIRA_PREFIXES" ]; then
  JIRA_PREFIXES="PROJ-*"
  JIRA_HOSTS="$DEFAULT_JIRA_HOST"
  PREFIX_HOST_MAP="    \"PROJ\": \"${DEFAULT_JIRA_HOST}\",
"
fi

read -p "Story points custom field ID [customfield_10028]: " STORY_POINTS_FIELD
STORY_POINTS_FIELD="${STORY_POINTS_FIELD:-customfield_10028}"

# -- Jira check-in preferences --------------------------------------------
echo ""
echo "-- What should /checkin surface from Jira? --"
echo ""
echo "Your tickets may be linked to parent epics, engineering tickets,"
echo "or other upstream work. Tell the skill what context is useful to you."
echo ""

read -p "Check parent epics and sibling tickets? (e.g., is the eng feature done yet) [Y/n]: " PREF_PARENT
read -p "Check linked tickets? (e.g., related eng or QE tickets) [y/N]: " PREF_LINKED
read -p "Report fix version / target release from Jira? [Y/n]: " PREF_FIX_VERSION
read -p "Report ticket labels? [y/N]: " PREF_LABELS

echo ""
echo "Anything else the check-in should look for or report on?"
echo "Describe in plain English (or blank to skip)."
echo "Examples:"
echo "  - 'Flag tickets with no description -- I need eng specs before I can start'"
echo "  - 'Show the last Jira comment if it was added since my last check-in'"
echo ""
read -p "Custom instructions: " PREF_CUSTOM

JIRA_PREFS=""

if [[ ! "$PREF_PARENT" =~ ^[Nn] ]]; then
  JIRA_PREFS="${JIRA_PREFS}
Parent epics and sibling tickets. Your own tickets may stay static while the parent epic and sibling engineering tickets move. For each tracked ticket:
1. Read the \`parent\` field from step 2. If a parent exists, fetch it: \`/rest/api/2/issue/{parent_key}?fields=status,summary\`.
2. Search for siblings: JQL \`parent = {parent_key}\` with \`fields: [\"status\", \"summary\", \"updated\"]\`.
3. Report siblings that changed status or were updated since the last check-in.

In the report, include a Related Jira Activity section. Show the parent status for each tracked ticket and whether it changed, and recently updated siblings with their status. Flag siblings that moved to Done, Resolved, or Closed, because they may unblock your work.
"
fi

if [[ "$PREF_LINKED" =~ ^[Yy] ]]; then
  JIRA_PREFS="${JIRA_PREFS}
Linked tickets. Fetch issue links (\"blocks\", \"is blocked by\", \"relates to\") for each ticket. Report linked tickets whose status changed since the last check-in or that are in a blocking state.
"
fi

if [[ ! "$PREF_FIX_VERSION" =~ ^[Nn] ]]; then
  JIRA_PREFS="${JIRA_PREFS}
Fix version. Include the \`fixVersions\` field when you fetch tickets. Report the target release of each ticket. Flag a ticket when its fix version does not match its release section on the tracking page.
"
fi

if [[ "$PREF_LABELS" =~ ^[Yy] ]]; then
  JIRA_PREFS="${JIRA_PREFS}
Labels. Include the \`labels\` field when you fetch tickets. Report label changes.
"
fi

if [ -n "$PREF_CUSTOM" ]; then
  JIRA_PREFS="${JIRA_PREFS}
Custom: ${PREF_CUSTOM}
"
fi

# -- Release configuration ------------------------------------------------
echo ""
echo "-- Release Configuration --"
read -p "Current release name (e.g. '2.5 GA', 'Q3 Sprint'): " RELEASE_1_NAME
RELEASE_1_NAME="${RELEASE_1_NAME:-Release 1}"
read -p "Short ID for this release (lowercase, no spaces, e.g. '25ga'): " RELEASE_1_ID
RELEASE_1_ID="${RELEASE_1_ID:-release1}"

# -- Summary ---------------------------------------------------------------
echo ""
echo "============================================"
echo "  Configuration Summary"
echo "============================================"
echo "  Product name:       $PRODUCT_NAME"
echo "  Project directory:  $PROJECT_DIR"
echo "  Git repo:           ${GIT_REPO:-<none>}"
echo "  Workspace dirs:     ${WORKSPACE_DIRS_INPUT:-<none>}"
echo "  Email scan:         $([[ "$PREF_EMAIL" =~ ^[Yy] ]] && echo on || echo off)"
echo "  Newsfeed retention: $RETENTION_DAYS days"
echo "  Default Jira host:  $DEFAULT_JIRA_HOST"
echo "  Jira prefixes:      $JIRA_PREFIXES"
echo "  Story points field: $STORY_POINTS_FIELD"
echo "  Release:            $RELEASE_1_NAME ($RELEASE_1_ID)"
echo "============================================"
echo ""
read -p "Proceed with installation? [Y/n]: " confirm
if [[ "$confirm" =~ ^[Nn] ]]; then
  echo "Setup cancelled."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CURRENT_YEAR=$(date +%Y)

mkdir -p "$PROJECT_DIR/css" "$PROJECT_DIR/js/templates" "$PROJECT_DIR/data"
echo "Created $PROJECT_DIR"

# -- Install static files (no substitution) --------------------------------
for static_file in css/layout.css css/project-tracking.css css/todo-list.css css/release-summary.css css/quarterly-connection.css css/newsfeed.css js/app.js js/templates/shell.js js/templates/project-tracking.js js/templates/todo-list.js js/templates/release-summary.js js/templates/release-summary-all.js js/templates/quarterly-connection.js js/templates/newsfeed.js todo-state.json; do
  target="$PROJECT_DIR/$static_file"
  if [ -f "$target" ]; then
    echo "  Skipping $static_file (already exists)"
  else
    cp "$SCRIPT_DIR/templates/$static_file" "$target"
    echo "  Installed $static_file"
  fi
done

if [ -f "$PROJECT_DIR/serve.sh" ]; then
  echo "  Skipping serve.sh (already exists)"
else
  cp "$SCRIPT_DIR/templates/serve.sh" "$PROJECT_DIR/serve.sh"
  chmod +x "$PROJECT_DIR/serve.sh"
  echo "  Installed serve.sh"
fi

# -- Install templated files (with substitution) ---------------------------
export PRODUCT_NAME CURRENT_YEAR RELEASE_1_NAME RELEASE_1_ID TICKET_BASE_URL

fill() {
  # Replace named {{PLACEHOLDERS}} from environment variables. Other {{...}} tokens stay.
  python3 - "$1" "$2" <<'PY'
import os, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src).read()
for k in ["PRODUCT_NAME", "CURRENT_YEAR", "RELEASE_1_NAME", "RELEASE_1_ID", "TICKET_BASE_URL"]:
    s = s.replace("{{%s}}" % k, os.environ.get(k, ""))
open(dst, "w").write(s)
PY
}

for template in index.html data/nav.js data/project-tracking.js data/todo-list.js data/release-summary-current.js data/release-summary-all.js data/quarterly-connection.js daily-status.md newsfeed.md; do
  target="$PROJECT_DIR/$template"
  if [ -f "$target" ]; then
    echo "  Skipping $template (already exists)"
  else
    fill "$SCRIPT_DIR/templates/$template" "$target"
    echo "  Installed $template"
  fi
done

# -- Build skill sections --------------------------------------------------
if [ -n "$GIT_REPO" ]; then
  GIT_SECTION="Git repo (\`${GIT_REPO}\`):
- \`git -C ${GIT_REPO} log --oneline --since=\"<last-checkin-timestamp>\" --all\` to list commits since the last check-in.
- \`git -C ${GIT_REPO} branch --show-current\` to show the active branch.
- \`git -C ${GIT_REPO} status --short\` to see uncommitted changes.
- Report the branch, the commits since the last check-in, and ticket IDs in commit messages."
else
  GIT_SECTION=""
fi

WORKSPACE_DIRS_SECTION=""
if [ -n "$WORKSPACE_DIRS_INPUT" ]; then
  WORKSPACE_DIRS_SECTION="Scan these directories for files changed since the last check-in. Use one \`find <dir> -type f -newer {{PROJECT_DIR}}/.last-checkin\` pass per directory. If \`.last-checkin\` is missing, use \`-mtime -7\`. Skip binaries, caches, and \`.git\`. Read only the changed files that look like work products (drafts, reviews, plans, notes).
"
  IFS=',' read -ra DIRS <<< "$WORKSPACE_DIRS_INPUT"
  for dir in "${DIRS[@]}"; do
    dir=$(echo "$dir" | xargs)
    dir="${dir/#\~/$HOME}"
    WORKSPACE_DIRS_SECTION="${WORKSPACE_DIRS_SECTION}
- \`${dir}\`"
  done
fi

if [ -z "$GIT_SECTION" ] && [ -z "$WORKSPACE_DIRS_SECTION" ]; then
  GIT_SECTION="No workspaces are configured. Skip this step."
fi

if [[ "$PREF_EMAIL" =~ ^[Yy] ]]; then
  EMAIL_TOOLS=", mcp__gmail__search_emails, mcp__gmail__read_email"
  EMAIL_FOCUS="${EMAIL_FOCUS:-Release and planning announcements, meeting notes, calendar changes, Jira notifications, review requests, and questions addressed to the user.}"
  EMAIL_SECTION="Search email for all messages received since the last check-in.

1. Search with \`after:YYYY/MM/DD\`, using the date from \`.last-checkin\`.
2. Read each relevant email body with \`read_email\`. Skip newsletters, marketing, and automated noise.
3. Relevant email: ${EMAIL_FOCUS}
4. Jira notifications: extract the ticket ID, summary, what changed, and who changed it. If the ticket is not in the snapshot, flag it as a possible new backlog item.
5. Chat notifications (for example, Slack email digests): skip direct messages. Report channel content as context only. Never suggest replying, because you cannot see whether the user already replied.
6. Meeting notes: extract decisions, dates, and action items assigned to the user.
7. Report the findings in the Email news section (step 3). Omit the section if nothing is relevant."
else
  EMAIL_TOOLS=""
  EMAIL_SECTION="Email scan is off. Skip this step."
fi

# -- Install Claude Code skill ---------------------------------------------
SKILL_DIR="$HOME/.claude/skills/checkin"
mkdir -p "$SKILL_DIR"
if [ -f "$SKILL_DIR/SKILL.md" ]; then
  cp "$SKILL_DIR/SKILL.md" "$SKILL_DIR/SKILL.md.bak"
  echo "  Backed up existing skill to $SKILL_DIR/SKILL.md.bak"
fi

export PROJECT_DIR GIT_SECTION WORKSPACE_DIRS_SECTION EMAIL_SECTION EMAIL_TOOLS RETENTION_DAYS \
  JIRA_HOSTS JIRA_PREFIXES DEFAULT_JIRA_HOST STORY_POINTS_FIELD PREFIX_HOST_MAP JIRA_PREFS

python3 - "$SCRIPT_DIR/SKILL.md" "$SKILL_DIR/SKILL.md" <<'PY'
import os, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src).read()
e = os.environ
prefs = e.get("JIRA_PREFS", "").strip() or "No related Jira context is configured. Skip this step."
values = {
    # Multi-line sections first, so placeholders inside them get filled too.
    "JIRA_PREFERENCES": prefs,
    "EMAIL_SECTION": e.get("EMAIL_SECTION", ""),
    "GIT_SECTION": e.get("GIT_SECTION", ""),
    "WORKSPACE_DIRS_SECTION": e.get("WORKSPACE_DIRS_SECTION", ""),
    "PREFIX_HOST_MAP": e.get("PREFIX_HOST_MAP", "").rstrip().rstrip(","),
    "EMAIL_TOOLS": e.get("EMAIL_TOOLS", ""),
    "PRODUCT_NAME": e.get("PRODUCT_NAME", ""),
    "PROJECT_DIR": e.get("PROJECT_DIR", ""),
    "RETENTION_DAYS": e.get("RETENTION_DAYS", "14"),
    "JIRA_HOSTS": e.get("JIRA_HOSTS", ""),
    "JIRA_PREFIXES": e.get("JIRA_PREFIXES", ""),
    "DEFAULT_JIRA_HOST": e.get("DEFAULT_JIRA_HOST", ""),
    "STORY_POINTS_FIELD": e.get("STORY_POINTS_FIELD", ""),
    "TICKET_BASE_URL": e.get("TICKET_BASE_URL", ""),
}
for k, v in values.items():
    s = s.replace("{{%s}}" % k, v)
while "\n\n\n" in s:
    s = s.replace("\n\n\n", "\n\n")
open(dst, "w").write(s)
PY
echo "  Installed skill to $SKILL_DIR/SKILL.md"

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Add your Jira credentials to ~/.env:"
echo "     export JIRA_EMAIL=your-email@example.com"
echo "     export JIRA_API_TOKEN=your-api-token"
echo ""
echo "  2. Start the local server and open the dashboard:"
echo "     cd \"$PROJECT_DIR\" && ./serve.sh"
echo "     Then open http://localhost:8765 in your browser."
echo ""
echo "  3. Add your tickets to data/project-tracking.js,"
echo "     then run /checkin in Claude Code to sync."
echo ""
