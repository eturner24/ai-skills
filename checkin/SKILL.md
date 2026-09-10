---
name: checkin
description: Daily check-in — pull Jira statuses, diff changes, update daily status tracker
allowed-tools: Bash, Read, Edit, Write, WebFetch, Agent, AskUserQuestion
---

# Daily Check-in Workflow

Run the daily check-in for {{PRODUCT_NAME}} project tracking. Follow these steps in order.

The project tracking workspace uses a data-driven template system. All page content lives in JS data files under `{{PROJECT_DIR}}/data/`. The HTML rendering is handled by templates in `js/templates/`. During check-ins, you edit only the data files and `daily-status.md`, never the templates or HTML.

## 1. Read current state

Read `{{PROJECT_DIR}}/daily-status.md` to get the last known ticket snapshot, priority queue, and blockers.

## 2. Pull current Jira statuses

Load credentials from `~/.env` (JIRA_EMAIL and JIRA_AUTH_TOKEN). Use Python with `urllib.request` to query Jira (do NOT use shell loops with a variable named `status` — it's read-only in zsh).

For each ticket in the snapshot, fetch the current status and story points:

- For tickets on {{JIRA_HOSTS}} ({{JIRA_PREFIXES}}): use REST API v2 for single issues (`/rest/api/2/issue/TICKET-ID`), v3 for search (`POST /rest/api/3/search/jql`). Basic auth with email:token.
- Story points field: `{{STORY_POINTS_FIELD}}`

Use this Python pattern to fetch all tickets at once:

```python
import urllib.request, json, base64, os

# Load creds
env = {}
with open(os.path.expanduser("~/.env")) as f:
    for line in f:
        line = line.strip()
        if line.startswith("export "):
            line = line[7:]
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k] = v

email = env["JIRA_EMAIL"]
token = env["JIRA_AUTH_TOKEN"]
auth = base64.b64encode(f"{email}:{token}".encode()).decode()

# Map prefixes to Jira hosts
PREFIX_HOSTS = {
{{PREFIX_HOST_MAP}}
}

tickets = [...]  # list of ticket IDs from the snapshot

for ticket_id in tickets:
    prefix = ticket_id.split("-")[0]
    host = PREFIX_HOSTS.get(prefix, "{{DEFAULT_JIRA_HOST}}")
    url = f"https://{host}/rest/api/2/issue/{ticket_id}?fields=status,{{STORY_POINTS_FIELD}},summary"
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {auth}", "Content-Type": "application/json"})
    try:
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read())
        status_name = data["fields"]["status"]["name"]
        sp = data["fields"].get("{{STORY_POINTS_FIELD}}")
        summary = data["fields"]["summary"]
        print(f"{ticket_id}|{status_name}|{sp}|{summary}")
    except Exception as e:
        print(f"{ticket_id}|ERROR|{e}")
```

## 2a. Check parent epic and sibling ticket activity

{{JIRA_PREFERENCES}}

## 2b. Check local repo activity

Check recent activity in these sources:

**Docs repo** (`{{DOCS_REPO}}`):
- Read the last-checkin timestamp from `{{PROJECT_DIR}}/.last-checkin` (create with current date if missing)
- `git log --oneline --since="<last-checkin-timestamp>" --all | wc -l` to get commit count since last check-in
- `git branch --show-current` to show the active branch
- `git status --short` to see uncommitted changes
- Report: branch name, number of commits since last check-in, timestamp of last check-in
- Update `{{PROJECT_DIR}}/.last-checkin` with current timestamp after check-in completes

{{EXTRA_DIRS_SECTION}}

## 2c. Check to-do list state

Read the to-do data file and state file to identify completed and open items.

1. Read `{{PROJECT_DIR}}/todo-state.json` to get the current completion state (key-value pairs where `true` = completed).
2. Read `{{PROJECT_DIR}}/data/todo-list.js` and examine the `groups` array. Each group has an `id`, `title`, and `items` array. Each item has:
   - `key` — unique identifier
   - `text` — item description
   - `ticket` — object with `key` and `url`, or null
   - `release` — release tag string
   - `priority` — "high", "medium", or "low"
   - `waiting` — boolean (optional)
3. Cross-reference the JSON state with the items. Identify:
   - Items marked completed in `todo-state.json` (these were checked off since last check-in)
   - Items still open (in non-completed groups)
   - Items with `waiting: true` that may be stale

## 3. Diff and report

Compare the Jira statuses against the snapshot in daily-status.md. Report to the user:

- Tickets whose status changed (show old -> new)
- Any new tickets not in the snapshot
- Any resolved/closed tickets
- Stale blockers (items in the blockers section older than 3 days)

Format the report clearly with a summary at the top.

### To-do list section

Include a **To-Do List** section in the report:

**Completed items:** List any items where `todo-state.json` has the key set to `true`. Show the item text, ticket, and release.

**Open items:** List all open items grouped by release, showing priority and any waiting tags.

**Suggested new items:** Based on the Jira and git data collected in steps 2-2b, suggest new to-do items. Use these heuristics:
- Jira ticket moved to Review -> suggest "Complete peer review for {ticket}"
- Jira ticket moved to Resolved/Closed -> suggest "Verify publishing for {ticket}" (if docs ticket)
- New ticket appeared in snapshot that has no to-do items -> suggest initial action item
- Parent epic status changed -> suggest "Check if {ticket} is unblocked by parent epic change"
- Git commits reference a ticket with no existing to-do -> suggest next step based on commit messages
- A "Waiting" tagged item has been waiting >5 days -> flag it as potentially stale

Present suggested items with a proposed key, text, ticket, release, and priority. Ask the user to confirm which suggestions to add.

**Ask about completions:** Ask the user if any currently-open items should be marked as done. Present the open items as a numbered list for easy reference.

## 4. Propose updates

Instead of asking questions, infer what changed and propose concrete updates. Use Jira status changes, local git activity (commit messages, branch names, ticket IDs in commits), and blocker age to draft proposed changes to:

**`data/project-tracking.js`** (`{{PROJECT_DIR}}/data/project-tracking.js`):

This file uses `export default { ... }` with the following structure. Only edit tickets in the active release section (section with `type: "active"`). Archive sections should not be modified during check-ins.

- **status field**: Update the `status` string based on Jira status. Use these values: `"Done"`, `"In progress"`, `"Not started"`, `"Review"`, `"Blocked"`.
- **sp field**: Update `sp` (number or null) if story points changed in Jira.
- **children array**: For epics with child tickets (doc stories, CQA, signoffs), list children in the `children` array. Each child has `jira`, `jiraUrl`, `description`, `sp`, `status`. The template renders children as a sub-table inside an accordion row under the parent epic. Update child ticket statuses the same way as parent tickets.

Ticket objects have these fields only: `jira`, `jiraUrl`, `description`, `sp`, `status`, and optionally `children`. Do not add `notes` or `claudeSession` fields. Historical context belongs in daily-status.md.

Sort tickets by status within each sub-release: in-progress first, not-started middle, done at bottom.

Example ticket structure in the data file:
```js
{
  jira: "PROJ-123",
  jiraUrl: "https://your-jira/browse/PROJ-123",
  description: "Document feature X (TP)",
  sp: 5,
  status: "In progress",
  children: [
    { jira: "PROJ-124", jiraUrl: "https://your-jira/browse/PROJ-124", description: "Doc story for feature X", sp: 5, status: "Not started" },
    { jira: "PROJ-125", jiraUrl: "https://your-jira/browse/PROJ-125", description: "Docs signoff for feature X", sp: 1, status: "Done" }
  ]
}
```

**daily-status.md**:
- **Ticket Status Snapshot**: Update statuses and SP from Jira, mark changed items.
- **Priority Queue**: If a ticket moved to Review/Resolved/Closed, suggest moving it down or to Completed.
- **Active Blockers**: If a blocker's ticket status changed, suggest resolving it. Flag stale blockers (>3 days).
- **Last updated** and **Total story points**: Recalculate.

Present all proposed changes clearly, then apply them after user confirmation. If the user corrects or adds detail, incorporate that before writing.

### To-do list updates

Based on user confirmation from the to-do list section in the report, propose concrete changes:

**Items to mark completed:** List the keys to set to `true` in `todo-state.json`.

**New items to add:** For each confirmed new item, show the object that will be added to `data/todo-list.js`. Use this structure:

```js
{
  key: "todo-{ticket_number}-{short_slug}",
  text: "{description}",
  ticket: { key: "{TICKET_ID}", url: "https://your-jira/browse/{TICKET_ID}" },
  release: "{release}",
  priority: "{high|medium|low}"
}
```

For the key, use the pattern: `todo-{ticket_number}-{short_slug}` (e.g., `todo-123-peer-review`). For items without a ticket, set `ticket: null`.

**Items to remove:** If a ticket is closed and all related to-do items are done, suggest removing the items from both files.

## 5. Apply updates

Based on Jira data, git activity, and user confirmation, update these files:

- `{{PROJECT_DIR}}/data/project-tracking.js` — update ticket `status`, `sp`, and `children` fields in the active release section. Read the file before editing. Only update fields that actually changed.

- `{{PROJECT_DIR}}/daily-status.md` — update snapshot, priority queue, blockers, last updated, story points.

- `{{PROJECT_DIR}}/data/release-summary-current.js` — keep in sync with project-tracking data. Any time a ticket status changes, a release completes, or story points are updated, reflect those changes. Specifically:
  - **stats array**: Update the 4 stat card values (Releases, Total SP, Avg SP / Release, Active Release)
  - **velocity.bars**: If SP totals change, update bar values. Bar heights are auto-calculated by the template (max value = 100%), so you only need to update the `value` field. Set `projected: true` for unreleased sub-releases.
  - **releases array**: Update `statusCounts` (done/inProgress/notStarted counts), `progressPercent`, and `sp`. When a release completes, remove the `statusChip` field and set `progressPercent: 100`.

- `{{PROJECT_DIR}}/data/quarterly-connection.js` — when tickets complete, add them to the appropriate quarter's "Documentation Delivered" subsection. Each item is `{ release: "Release Name", text: "Description" }`. Add non-Jira contributions as they occur, using `{ text: "Description" }` (no release field).

Read each file before editing. Only update fields that actually changed.

### To-do list files

Based on user-confirmed to-do changes, update:

- `{{PROJECT_DIR}}/todo-state.json` — Set completed item keys to `true`. Add new item keys as `false`. Remove keys for deleted items.

- `{{PROJECT_DIR}}/data/todo-list.js` — For completed items: move the item object from its current group's `items` array to the `completed` group's `items` array. For new items: append the item object to the appropriate group's `items` array. For removed items: delete the item object from the group's `items` array.

Always keep `todo-state.json` and `data/todo-list.js` in sync. Read both files before editing.
