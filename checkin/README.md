# Project Tracking Kit

A Claude Code skill and a data-driven dashboard to track Jira-based work across releases. Run `/checkin` once a day. The skill pulls Jira statuses, scans your email and workspaces, compares the results with your tracking data, and proposes updates. News that does not belong in your daily log goes into a newsfeed with tags and key dates.

## What's included

| File | Description |
|------|-------------|
| `SKILL.md` | Claude Code skill for daily check-ins. `setup.sh` fills in its placeholders. |
| `setup.sh` | Interactive installer for the dashboard and the skill. |
| `templates/index.html` | Single-page shell with hash routing. |
| `templates/css/` | PatternFly 6 stylesheets for each page. |
| `templates/js/app.js` | Client-side router. Loads JS data modules and Markdown data files. |
| `templates/js/templates/` | Render functions for each page type. |
| `templates/data/` | Data files with `{{PLACEHOLDERS}}` for the setup script. |
| `templates/newsfeed.md` | Newsfeed source file, with format rules and one sample item. |
| `templates/daily-status.md` | Ticket snapshot and daily log. |
| `templates/serve.sh` | Starts a local HTTP server (`python3 -m http.server 8765`). |

## Architecture

The dashboard is a single-page app with no build step, no npm, and no framework. One `index.html` file loads ES module templates that render pages from data files.

```
project-dir/
  index.html          # Shell page (masthead, sidebar, main content area)
  serve.sh            # python3 -m http.server 8765
  css/                # Stylesheets (loaded per page)
  js/app.js           # Hash router, data loader, CSS switcher
  js/templates/       # Render functions and page behavior
  data/               # JS data modules (export default {...})
    project-tracking.js
    todo-list.js
    release-summary-current.js
    release-summary-all.js
    quarterly-connection.js
    nav.js
  newsfeed.md         # Newsfeed source (parsed by the page at load time)
  todo-state.json     # Checkbox state
  daily-status.md     # Ticket snapshot and daily log
```

During check-ins, Claude edits only the data files, `newsfeed.md`, and `daily-status.md`. The templates handle the rendering, so a check-in cannot break the HTML.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- Jira access with an API token
- Python 3, for Jira API calls and the local HTTP server
- Optional: a Gmail MCP server in Claude Code named `gmail`, with the `search_emails` and `read_email` tools. The email scan uses it.

## Setup

```bash
chmod +x setup.sh
./setup.sh
```

The setup script asks for these values:

| Prompt | What it does |
|--------|-------------|
| Product/team name | Used in page titles and headers. |
| Project directory | Where the tracking files go. |
| Git repo | A repo to check for commits since the last check-in. Optional. |
| Workspace directories | Folders with drafts or notes to scan for changed files. Optional. |
| Email scan | Turns on the Gmail scan and asks what email is relevant to you. |
| Newsfeed retention | Days to keep undated newsfeed items. Default 14. |
| Jira host and prefixes | Your Jira instance and project keys (for example, `PROJ=myorg.atlassian.net`). |
| Story points field | Custom field ID for story points. Default `customfield_10028`. |
| Jira preferences | Parent epics and siblings, linked tickets, fix versions, labels, custom rules. |
| Release name | Name and ID of your current release. |

The script does not overwrite existing project files. It backs up an existing skill to `SKILL.md.bak` before it installs the new one.

Add your Jira credentials to `~/.env`:

```bash
export JIRA_EMAIL=your-email@example.com
export JIRA_API_TOKEN=your-api-token
```

## Usage

1. Start the server: `cd your-project-dir && ./serve.sh`
2. Open the dashboard: http://localhost:8765
3. Add your tickets to `data/project-tracking.js`.
4. Run `/checkin` in Claude Code.
5. Read the report. Then answer the questions one at a time.

## Pages

### Project Tracking

The main dashboard. Each release is a card with sortable tables.

- Click an epic row to see its child tickets in a sub-table.
- Epic SP is the sum of its child SP. Sub-release and release totals are calculated.
- Add `mrUrl` to a ticket to show a merge request link after its description.
- Status labels are color-coded.

```js
{
  jira: "PROJ-123",
  jiraUrl: "https://your-jira/browse/PROJ-123",
  description: "Document feature X",
  sp: null,
  status: "In progress",
  children: [
    { jira: "PROJ-124", jiraUrl: "https://your-jira/browse/PROJ-124", description: "Write feature X docs", sp: 5, status: "Not started" }
  ]
}
```

### To-Do List

An interactive to-do list grouped by release, with priority and waiting tags. Checkbox state is saved in `todo-state.json` and in your browser. The save button downloads an updated state file.

### Newsfeed

News from check-ins that does not go into your daily log. The source is `newsfeed.md`.

- A Key dates table at the top shows each release, freeze, or deadline date with a countdown.
- Items are grouped by section. Each item has a received date, source, tags, and expiry date.
- Filter by one or more tags, search the text, or sort by section, newest first, or expires soonest.
- Expired items are hidden until a check-in removes them. Select "Show expired" to see them.

Dates are stored once. Item text uses `{{key}}` tokens that point to the Key dates table. When a newer email changes a date, the check-in overwrites the table row, so every item shows the new date. The check-in also removes the old date from all item text.

The check-in removes items when they expire:

- Calendar items expire on the event date.
- Items about a key date expire on the last date they use.
- Weekly status items expire after 7 days.
- All other items expire after the retention period you set.

### Release Summary

Stat cards, a velocity bar chart, and release cards with progress bars. To add a year, create `data/release-summary-YYYY.js` and add it to `data/nav.js`.

### Quarterly Connection

Accomplishments by quarter, for performance reviews.

## How `/checkin` works

1. Starts the local server and reads `daily-status.md`.
2. Fetches the Jira status, SP, and assignee of every tracked ticket.
3. Checks related Jira activity (parent epics, siblings, links), based on your preferences.
4. Searches Jira for new tickets assigned to you.
5. Scans email since the last check-in, if turned on.
6. Scans your git repo and workspace directories for changes.
7. Reads the to-do list state.
8. Reviews the newsfeed. Removes expired items and past dates, and overwrites dates that changed.
9. Reports the changes. Then asks you to confirm updates, one question at a time.
10. Updates the dashboard data, the newsfeed, and the daily log.

## Customizing

- Release phases: add sub-release objects to the `subReleases` array in `data/project-tracking.js`.
- Archive a release: move the release object to a section with `type: "archive"`.
- To-do groups: add a group to the `groups` array in `data/todo-list.js` and to its `sidebarNav`.
- Newsfeed sections and tags: edit the defaults in "Write the newsfeed" in the installed `SKILL.md`.
