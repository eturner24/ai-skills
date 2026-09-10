# Project Tracking Kit

A Claude Code skill and data-driven dashboard for tracking Jira-based documentation (or any project) work across releases. Runs `/checkin` daily to pull Jira statuses, diff changes against your tracking data, check git activity, manage to-do items, and propose updates.

## What's included

| File | Description |
|------|-------------|
| `SKILL.md` | Claude Code skill that automates daily check-ins: Jira statuses, parent epic tracking, git activity, to-do list management |
| `templates/index.html` | Single-page shell with hash routing; loads page content from JS data files |
| `templates/css/` | PatternFly 6 stylesheets: layout, project tracking tables, to-do list, release summary charts, quarterly connection cards |
| `templates/js/app.js` | Client-side router that loads data modules and renders via template functions |
| `templates/js/templates/` | Render functions for each page type (project tracking, to-do list, release summary, quarterly connection) |
| `templates/data/` | Template data files with `{{PLACEHOLDERS}}` for setup script substitution |
| `templates/daily-status.md` | Markdown template for daily status snapshots |
| `templates/serve.sh` | Launch script for local HTTP server (`python3 -m http.server`) |

## Architecture

The dashboard is a single-page app with no build step, no npm, and no framework. One `index.html` file loads ES module templates that render pages from JS data files.

```
project-dir/
  index.html          # Shell page (masthead, sidebar, main content area)
  serve.sh            # python3 -m http.server 8765
  css/                # Stylesheets (loaded dynamically per page)
  js/app.js           # Hash router, data loader, CSS switcher
  js/templates/       # Render functions + post-render behaviors
  data/               # JS data modules (export default {...})
    project-tracking.js
    todo-list.js
    release-summary-current.js
    release-summary-all.js
    quarterly-connection.js
    nav.js
  todo-state.json     # Checkbox persistence
  daily-status.md     # Daily check-in log
```

During check-ins, Claude edits only the `data/*.js` files and `daily-status.md`. The templates handle rendering. This means no risk of breaking HTML structure and simple programmatic updates (append to an array, change a status string, update a number).

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed
- Jira access with an API token
- Python 3 (for Jira API calls and local HTTP server)

## Setup

```bash
chmod +x setup.sh
./setup.sh
```

The setup script will prompt you for:

| Prompt | What it does |
|--------|-------------|
| Product/team name | Used in page titles, masthead, and headers |
| Project directory | Where tracking files are stored |
| Docs repo path | Git repo to monitor for activity (optional) |
| Extra directories | Additional dirs to scan for status files (optional) |
| Jira host(s) | Your Jira instance URL(s) |
| Project prefixes | Jira project keys (e.g., `PROJ`, `TEAM`) and their hosts |
| Story points field | Custom field ID for story points (default: `customfield_10028`) |
| Release name | Name and ID for your current release |

After setup, add your Jira credentials to `~/.env`:

```bash
export JIRA_EMAIL=your-email@example.com
export JIRA_AUTH_TOKEN=your-api-token
```

## Usage

1. Start the server: `cd your-project-dir && ./serve.sh`
2. Open the dashboard: http://localhost:8765
3. Add your tickets to `data/project-tracking.js`
4. Run `/checkin` in Claude Code from your project directory
5. Claude will pull Jira statuses, check parent epics, review git activity, and propose updates
6. Review and approve the proposed changes

## Pages

### Project Tracking

The main dashboard. Each release is a card with sortable tables. Features:

- Expandable detail rows: click an epic row to see child tickets (doc stories, CQA, signoffs) in a sub-table
- Auto-calculated story points: sub-release and release-level SP totals update automatically
- Sortable columns: click any column header to sort
- Sidebar navigation: jump between active releases, upcoming work, and archived releases
- Status labels: color-coded PatternFly labels (green = done, blue = in progress, grey = new)

Adding a ticket in `data/project-tracking.js`:

```js
{
  jira: "PROJ-123",
  jiraUrl: "https://your-jira/browse/PROJ-123",
  description: "Document feature X (TP)",
  sp: 5,
  status: "In progress",
  children: [
    { jira: "PROJ-124", jiraUrl: "https://your-jira/browse/PROJ-124", description: "Doc story for feature X", sp: 5, status: "Not started" }
  ]
}
```

Standalone tickets (no children) omit the `children` field. Sort tickets by status: in-progress first, not-started middle, done at bottom.

### To-Do List

Interactive to-do list organized by release. Features:

- Checkbox persistence via `todo-state.json` and localStorage
- Priority tags: High (red), Medium (amber), Low (grey)
- Waiting tags for blocked items
- Release grouping with open/done counts
- Save button downloads updated state file

Adding a to-do item in `data/todo-list.js`:

```js
{
  key: "todo-123-short-slug",
  text: "Description of the action item",
  ticket: { key: "PROJ-123", url: "https://your-jira/browse/PROJ-123" },
  release: "Release Name",
  priority: "high"
}
```

### Release Summary

Metrics dashboard showing:

- Overview stat cards (releases, story points, averages)
- Velocity bar chart (heights auto-calculated from values)
- Release breakdown cards with status dots and progress bars

Create year-specific data files (`data/release-summary-2025.js`) and add entries to `data/nav.js` for additional years.

### Quarterly Connection

Accomplishment tracker organized by quarter. Each quarter has subsections for documentation delivered and non-Jira contributions. Useful for performance reviews.

## How `/checkin` works

1. Reads `data/project-tracking.js` for the current ticket list and statuses
2. Queries Jira APIs for each ticket's current status, story points, and summary
3. Fetches parent epic status and sibling ticket activity for upstream visibility
4. Checks your docs repo for git activity since last check-in
5. Reads the to-do list state and identifies completed/open items
6. Diffs Jira statuses against current and reports changes
7. Suggests new to-do items based on status changes and git commits
8. Proposes updates to `data/project-tracking.js`, `data/release-summary-current.js`, and to-do files
9. Applies updates after your confirmation

## Customizing

Adding release phases: Add sub-release objects to the `subReleases` array in the release entry in `data/project-tracking.js`.

Archiving a release: Move the release object to an archive section (type `"archive"`). Archive sections render inside collapsible expandable panels.

Adding to-do groups: Add a new group object to the `groups` array in `data/todo-list.js` and update the `sidebarNav`.

Year-specific release summaries: Create `data/release-summary-YYYY.js` with the same schema as the current year's file. Add a page entry to `data/nav.js`.
