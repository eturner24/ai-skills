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

# -- Docs repo -------------------------------------------------------------
read -p "Path to your docs git repo (leave blank to skip git activity checks): " DOCS_REPO
DOCS_REPO="${DOCS_REPO/#\~/$HOME}"

# -- Extra monitored directories -------------------------------------------
read -p "Additional directories to monitor for .md status files (comma-separated, or blank): " EXTRA_DIRS_INPUT

# -- Jira configuration ---------------------------------------------------
echo ""
echo "-- Jira Configuration --"
read -p "Default Jira host [your-org.atlassian.net]: " DEFAULT_JIRA_HOST
DEFAULT_JIRA_HOST="${DEFAULT_JIRA_HOST:-your-org.atlassian.net}"

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
  if [ -z "$prefix" ] || [ -z "$host" ]; then
    echo "  Invalid format. Use PREFIX=host"
    continue
  fi
  PREFIX_HOST_MAP="${PREFIX_HOST_MAP}    \"${prefix}\": \"${host}\",\n"
  JIRA_PREFIXES="${JIRA_PREFIXES}${prefix}-*, "
  if [[ ! "$JIRA_HOSTS" == *"$host"* ]]; then
    JIRA_HOSTS="${JIRA_HOSTS}${host}, "
  fi
done

# Clean trailing commas
JIRA_PREFIXES="${JIRA_PREFIXES%, }"
JIRA_HOSTS="${JIRA_HOSTS%, }"

# Default if nothing entered
if [ -z "$JIRA_PREFIXES" ]; then
  JIRA_PREFIXES="PROJ-*"
  JIRA_HOSTS="$DEFAULT_JIRA_HOST"
  PREFIX_HOST_MAP="    \"PROJ\": \"${DEFAULT_JIRA_HOST}\",\n"
fi

read -p "Story points custom field ID [customfield_10028]: " STORY_POINTS_FIELD
STORY_POINTS_FIELD="${STORY_POINTS_FIELD:-customfield_10028}"

# -- Jira check-in preferences --------------------------------------------
echo ""
echo "-- What should /checkin surface from Jira? --"
echo ""
echo "Your doc tickets may be linked to parent epics, engineering tickets,"
echo "or other upstream work. Tell the skill what context is useful to you."
echo ""

read -p "Check parent/epic ticket status? (e.g., is the eng feature done yet) [Y/n]: " PREF_PARENT
read -p "Check linked tickets? (e.g., related eng or QE tickets) [y/N]: " PREF_LINKED
read -p "Report fix version / target release from Jira? [Y/n]: " PREF_FIX_VERSION
read -p "Report ticket labels? [y/N]: " PREF_LABELS
read -p "Report assignee? [y/N]: " PREF_ASSIGNEE

echo ""
echo "Anything else the check-in should look for or report on?"
echo "Describe in plain English (or blank to skip)."
echo "Examples:"
echo "  - 'Flag tickets with no description -- I need eng specs before I can start'"
echo "  - 'Show the last Jira comment if it was added since my last check-in'"
echo "  - 'Check if the parent epic has a refinement doc linked'"
echo ""
read -p "Custom instructions: " PREF_CUSTOM

# Build the preferences block for the skill
JIRA_PREFS=""

if [[ ! "$PREF_PARENT" =~ ^[Nn] ]]; then
  JIRA_PREFS="${JIRA_PREFS}
- **Parent/epic tickets**: For each ticket, check if it has a parent epic or issue link of type \"is child of\" / \"belongs to epic\". Fetch the parent's status and summary. Report the parent status alongside the ticket (e.g., \"Parent EPIC-123: In Progress\"). Flag if the parent is blocked or unstarted -- that may affect your ability to start doc work."
fi

if [[ "$PREF_LINKED" =~ ^[Yy] ]]; then
  JIRA_PREFS="${JIRA_PREFS}
- **Linked tickets**: Fetch issue links (\"blocks\", \"is blocked by\", \"relates to\") for each ticket. Report any linked tickets whose status changed since last check-in or that are in a blocking state."
fi

if [[ ! "$PREF_FIX_VERSION" =~ ^[Nn] ]]; then
  JIRA_PREFS="${JIRA_PREFS}
- **Fix version / target release**: Include the \`fixVersions\` field when fetching tickets. Report the target release alongside each ticket and flag any mismatches with where the ticket sits in the tracking page."
fi

if [[ "$PREF_LABELS" =~ ^[Yy] ]]; then
  JIRA_PREFS="${JIRA_PREFS}
- **Labels**: Include the \`labels\` field when fetching tickets. Report labels in the diff output so you can spot tag changes."
fi

if [[ "$PREF_ASSIGNEE" =~ ^[Yy] ]]; then
  JIRA_PREFS="${JIRA_PREFS}
- **Assignee**: Include the \`assignee\` field when fetching tickets. Report who each ticket is assigned to and flag any unassigned tickets."
fi

if [ -n "$PREF_CUSTOM" ]; then
  JIRA_PREFS="${JIRA_PREFS}
- **Custom**: ${PREF_CUSTOM}"
fi

# -- Release configuration ------------------------------------------------
echo ""
echo "-- Release Configuration --"
echo "Set up your initial release for the tracking pages."
echo ""

read -p "Current release name (e.g. '2.5 GA', 'Q3 Sprint'): " RELEASE_1_NAME
RELEASE_1_NAME="${RELEASE_1_NAME:-Release 1}"
read -p "Short ID for this release (lowercase, no spaces, e.g. '25ga'): " RELEASE_1_ID
RELEASE_1_ID="${RELEASE_1_ID:-release1}"

# -- Build extra dirs section for SKILL.md ---------------------------------
EXTRA_DIRS_SECTION=""
if [ -n "$EXTRA_DIRS_INPUT" ]; then
  IFS=',' read -ra DIRS <<< "$EXTRA_DIRS_INPUT"
  for dir in "${DIRS[@]}"; do
    dir=$(echo "$dir" | xargs)  # trim whitespace
    dir="${dir/#\~/$HOME}"
    EXTRA_DIRS_SECTION="${EXTRA_DIRS_SECTION}
**Additional directory** (\`${dir}\`):
- Check for new \`.md\` files containing the tag \"status\"
- Run: \`find ${dir} -name \"*.md\" -newer ${dir}/.last-checkin 2>/dev/null | xargs grep -l \"status\" 2>/dev/null\`
- Skip everything else in this directory
"
  done
fi

# -- Summary ---------------------------------------------------------------
echo ""
echo "============================================"
echo "  Configuration Summary"
echo "============================================"
echo "  Product name:       $PRODUCT_NAME"
echo "  Project directory:  $PROJECT_DIR"
echo "  Docs repo:          ${DOCS_REPO:-<none>}"
echo "  Extra directories:  ${EXTRA_DIRS_INPUT:-<none>}"
echo "  Default Jira host:  $DEFAULT_JIRA_HOST"
echo "  Jira prefixes:      $JIRA_PREFIXES"
echo "  Story points field: $STORY_POINTS_FIELD"
echo "  Release:            $RELEASE_1_NAME ($RELEASE_1_ID)"
if [ -n "$JIRA_PREFS" ]; then
echo "  Jira preferences:   (configured)"
else
echo "  Jira preferences:   (defaults)"
fi
echo "============================================"
echo ""
read -p "Proceed with installation? [Y/n]: " confirm
if [[ "$confirm" =~ ^[Nn] ]]; then
  echo "Setup cancelled."
  exit 0
fi

# -- Resolve script directory ----------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# -- Create project directory and subdirectories ---------------------------
mkdir -p "$PROJECT_DIR/css" "$PROJECT_DIR/js/templates" "$PROJECT_DIR/data"
echo "Created $PROJECT_DIR"

# -- Current year ----------------------------------------------------------
CURRENT_YEAR=$(date +%Y)

# -- Install static files (no substitution needed) -------------------------
for static_file in css/layout.css css/project-tracking.css css/todo-list.css css/release-summary.css css/quarterly-connection.css js/app.js js/templates/shell.js js/templates/project-tracking.js js/templates/todo-list.js js/templates/release-summary.js js/templates/release-summary-all.js js/templates/quarterly-connection.js todo-state.json; do
  target="$PROJECT_DIR/$static_file"
  if [ -f "$target" ]; then
    echo "  Skipping $static_file (already exists)"
  else
    cp "$SCRIPT_DIR/templates/$static_file" "$target"
    echo "  Installed $static_file"
  fi
done

# -- Install serve.sh ------------------------------------------------------
if [ -f "$PROJECT_DIR/serve.sh" ]; then
  echo "  Skipping serve.sh (already exists)"
else
  cp "$SCRIPT_DIR/templates/serve.sh" "$PROJECT_DIR/serve.sh"
  chmod +x "$PROJECT_DIR/serve.sh"
  echo "  Installed serve.sh"
fi

# -- Install templated files (with substitution) ---------------------------
for template in index.html data/nav.js data/project-tracking.js data/todo-list.js data/release-summary-current.js data/release-summary-all.js data/quarterly-connection.js daily-status.md; do
  target="$PROJECT_DIR/$(basename "$template" | sed 's/-current//')"
  # Keep the full path for data/ files
  if [[ "$template" == data/* ]]; then
    target="$PROJECT_DIR/$template"
  else
    target="$PROJECT_DIR/$template"
  fi
  if [ -f "$target" ]; then
    echo "  Skipping $template (already exists)"
  else
    sed \
      -e "s|{{PRODUCT_NAME}}|${PRODUCT_NAME}|g" \
      -e "s|{{CURRENT_YEAR}}|${CURRENT_YEAR}|g" \
      -e "s|{{RELEASE_1_NAME}}|${RELEASE_1_NAME}|g" \
      -e "s|{{RELEASE_1_ID}}|${RELEASE_1_ID}|g" \
      "$SCRIPT_DIR/templates/$template" > "$target"
    echo "  Installed $template"
  fi
done

# -- Install Claude Code skill ---------------------------------------------
SKILL_DIR="$HOME/.claude/skills/checkin"
mkdir -p "$SKILL_DIR"

sed \
  -e "s|{{PRODUCT_NAME}}|${PRODUCT_NAME}|g" \
  -e "s|{{PROJECT_DIR}}|${PROJECT_DIR}|g" \
  -e "s|{{DOCS_REPO}}|${DOCS_REPO:-/path/to/your/docs/repo}|g" \
  -e "s|{{JIRA_HOSTS}}|${JIRA_HOSTS}|g" \
  -e "s|{{JIRA_PREFIXES}}|${JIRA_PREFIXES}|g" \
  -e "s|{{DEFAULT_JIRA_HOST}}|${DEFAULT_JIRA_HOST}|g" \
  -e "s|{{STORY_POINTS_FIELD}}|${STORY_POINTS_FIELD}|g" \
  "$SCRIPT_DIR/SKILL.md" > "$SKILL_DIR/SKILL.md.tmp"

# Replace multi-line placeholders
python3 -c "
import sys
content = open('$SKILL_DIR/SKILL.md.tmp').read()
map_entries = '''$(echo -e "$PREFIX_HOST_MAP")'''
content = content.replace('{{PREFIX_HOST_MAP}}', map_entries.rstrip().rstrip(','))
extra = '''${EXTRA_DIRS_SECTION}'''
if extra.strip():
    content = content.replace('{{EXTRA_DIRS_SECTION}}', extra.strip())
else:
    content = content.replace('{{EXTRA_DIRS_SECTION}}', '')
jira_prefs = '''${JIRA_PREFS}'''
if jira_prefs.strip():
    content = content.replace('{{JIRA_PREFERENCES}}', jira_prefs.strip())
else:
    content = content.replace('{{JIRA_PREFERENCES}}', 'No additional Jira context configured. Only fetch status, story points, and summary for each ticket.')
open('$SKILL_DIR/SKILL.md', 'w').write(content)
" 2>/dev/null

rm -f "$SKILL_DIR/SKILL.md.tmp"
echo "  Installed skill to $SKILL_DIR/SKILL.md"

# -- Reminder --------------------------------------------------------------
echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Add your Jira credentials to ~/.env:"
echo "     export JIRA_EMAIL=your-email@example.com"
echo "     export JIRA_AUTH_TOKEN=your-api-token"
echo ""
echo "  2. Start the local server and open the dashboard:"
echo "     cd \"$PROJECT_DIR\" && ./serve.sh"
echo "     Then open http://localhost:8765 in your browser."
echo ""
echo "  3. Add your tickets to data/project-tracking.js,"
echo "     then run /checkin in Claude Code to sync."
echo ""
echo "  Installed files:"
echo "    $PROJECT_DIR/index.html"
echo "    $PROJECT_DIR/serve.sh"
echo "    $PROJECT_DIR/css/ (5 stylesheets)"
echo "    $PROJECT_DIR/js/ (6 template modules + router)"
echo "    $PROJECT_DIR/data/ (6 data files)"
echo "    $PROJECT_DIR/daily-status.md"
echo "    $PROJECT_DIR/todo-state.json"
echo "    $SKILL_DIR/SKILL.md"
echo ""
