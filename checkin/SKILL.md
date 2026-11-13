---
name: checkin
description: Daily check-in. Pull Jira statuses, scan email and workspaces, diff changes, update the tracking dashboard, newsfeed, and daily log.
allowed-tools: Bash, Read, Edit, Write, WebFetch, Agent, AskUserQuestion{{EMAIL_TOOLS}}
---

# Daily Check-in Workflow

Run the daily check-in for {{PRODUCT_NAME}} project tracking. Follow these steps in order.

The project tracking workspace uses a data-driven template system. All page content lives in JS data files under `{{PROJECT_DIR}}/data/`, plus `{{PROJECT_DIR}}/newsfeed.md`. The templates in `js/templates/` render the HTML. During check-ins, edit only the data files, `daily-status.md`, and `newsfeed.md`. Never edit the templates or HTML.

## Response style

Do not narrate what you are about to do or announce steps ("Let me start the check-in", "Now I'll pull Jira statuses"). Do the work and present the report.

Only report sections that have updates. If a data source produced no changes or no relevant findings, omit that section from the report. Do not include empty sections or "no changes" placeholders. For example:
- No Jira status changes? Omit the status changes table.
- No new backlog tickets? Omit the new backlog section.
- No open to-do items? Omit the to-do open items list.

The report contains only actionable information.

## Interaction flow

Ask questions one at a time. Do not present all proposed updates, confirmations, and questions in a single message. Follow this sequence:

1. Report first. Present the check-in report (status changes, new tickets, email news, workspace activity, newsfeed changes). This is informational and requires no response.
2. Then walk through decisions one at a time. Each question or confirmation gets its own message. Wait for the user's answer before you move to the next one. Examples:
   - "Release 2.1 shipped on July 16 and all tickets are closed. Mark this milestone as complete?"
   - "These Jira status changes need to go into the dashboard: [list]. Apply these updates?"
   - "Any open to-do items to mark done? [numbered list]"
3. Batch mechanical updates. Updates that follow directly from Jira data (status changes, SP changes, new tickets added to the snapshot) go into a single confirmation. Ask separately only about updates that need the user's judgment.
4. End with the daily log entry. After all updates are applied, propose the daily log entry for `daily-status.md` as the final step. The daily log is the user's personal summary. Include only the user's own work and action items (see "Email news section" in step 3).

## 0. Start the project tracking server

Check if the HTTP server is already running on port 8765. If not, start it in the background:

```bash
lsof -i :8765 >/dev/null 2>&1 || (cd {{PROJECT_DIR}} && python3 -m http.server 8765 &>/dev/null &)
```

Report the URL (http://localhost:8765) so the user can open the dashboard.

Run `date` to get the current day and date. Do not trust date metadata from the conversation.

## 1. Read current state

Read `{{PROJECT_DIR}}/daily-status.md` to get the last known ticket snapshot, priority queue, and blockers. Read the last check-in timestamp from `{{PROJECT_DIR}}/.last-checkin`. If the file is missing, use 7 days ago.

## 2. Pull current Jira statuses

Load credentials from `~/.env` (`JIRA_EMAIL` and `JIRA_API_TOKEN`). Use Python with `urllib.request` to query Jira. Do not use shell loops with a variable named `status`. It is read-only in zsh.

Fetch the status and story points of every ticket in the snapshot, including closed tickets. Do not assume that closed tickets are unchanged.

- Tickets on {{JIRA_HOSTS}} ({{JIRA_PREFIXES}}): use REST API v2 for single issues (`/rest/api/2/issue/TICKET-ID`) and v3 for search (`POST /rest/api/3/search/jql`). Use basic auth with email:token.
- Story points field: `{{STORY_POINTS_FIELD}}`

Use this Python pattern to fetch all tickets at once:

```python
import urllib.request, json, base64, os

env = {}
with open(os.path.expanduser("~/.env")) as f:
    for line in f:
        line = line.strip()
        if line.startswith("export "):
            line = line[7:]
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k] = v.strip('"').strip("'")

auth = base64.b64encode(f"{env['JIRA_EMAIL']}:{env['JIRA_API_TOKEN']}".encode()).decode()
HEADERS = {"Authorization": f"Basic {auth}", "Content-Type": "application/json"}

PREFIX_HOSTS = {
{{PREFIX_HOST_MAP}}
}

tickets = [...]  # ticket IDs from the snapshot

for ticket_id in tickets:
    host = PREFIX_HOSTS.get(ticket_id.split("-")[0], "{{DEFAULT_JIRA_HOST}}")
    url = f"https://{host}/rest/api/2/issue/{ticket_id}?fields=status,{{STORY_POINTS_FIELD}},summary,assignee,parent"
    try:
        data = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS)).read())
        f = data["fields"]
        print(f"{ticket_id}|{f['status']['name']}|{f.get('{{STORY_POINTS_FIELD}}')}|{(f.get('assignee') or {}).get('displayName')}|{f['summary']}")
    except Exception as e:
        print(f"{ticket_id}|ERROR|{e}")
```

Check the assignee of each ticket. If a ticket is now assigned to someone else, propose to remove it from the dashboard.

## 2a. Check related Jira activity

{{JIRA_PREFERENCES}}

Skip related-ticket lookups for tickets that are already Closed or Resolved.

## 2b. Scan for new ticket assignments

Search Jira for tickets assigned to the user that are not in the `daily-status.md` snapshot. Use `POST /rest/api/3/search/jql` on each Jira host with body `{"jql": "...", "fields": ["status", "summary", "issuetype", "parent", "fixVersions", "{{STORY_POINTS_FIELD}}", "created"], "maxResults": 30}`.

1. Tickets created in the last 7 days: `assignee = currentUser() AND created >= -7d ORDER BY created DESC`
2. Tickets updated in the last 2 days, to catch reassignments: `assignee = currentUser() AND updated >= -2d AND statusCategory != Done ORDER BY updated DESC`
3. Compare the results against the ticket IDs in the snapshot.
4. Report each ticket that is not in the snapshot under New Backlog Tickets. Show the ticket ID, summary, type, parent, fix version, SP, and creation date.
5. Always add new tickets to the snapshot and to `data/project-tracking.js`. Do not ask. Put each ticket in the release section that matches its fix version. If it has no fix version, put it in the latest release.

## 2c. Scan email

{{EMAIL_SECTION}}

## 2d. Scan workspaces

{{GIT_SECTION}}

{{WORKSPACE_DIRS_SECTION}}

For each relevant file, determine which tracked ticket or project it belongs to, what the work is (draft, review, plan, notes), and its state. Report these under Workspace activity, grouped by ticket or project. This is the user's own work. It belongs in the daily log.

## 2e. Check to-do list state

1. Read `{{PROJECT_DIR}}/todo-state.json`. It holds key-value pairs where `true` means completed.
2. Read `{{PROJECT_DIR}}/data/todo-list.js` and examine the `groups` array. Each group has an `id`, `title`, and `items` array. Each item has:
   - `key`: unique identifier
   - `text`: item description
   - `ticket`: object with `key` and `url`, or null
   - `release`: release tag string
   - `priority`: "high", "medium", or "low"
   - `waiting`: boolean (optional)
3. Cross-reference the JSON state with the items. Identify items that were checked off since the last check-in, items that are still open, and items with `waiting: true` that may be stale.

## 2f. Review the newsfeed

The newsfeed holds check-in news that does not go into the daily log. The file is `{{PROJECT_DIR}}/newsfeed.md`. The site shows it at http://localhost:8765/#/newsfeed. The page parses the file, so keep the format exact. The format rules are in the HTML comment at the top of the file.

Read `newsfeed.md` before you scan new data. Then do these steps:

1. Remove the sample item and the `sample-launch` key date if they are still in the file.
2. Remove expired items. An item is expired when its `expires` date is before today.
3. Remove past key dates. Delete a `## Key dates` row when its date is before today. Then remove or rewrite each item that uses that key.
4. Find changed dates. Compare each date in the new emails, Jira data, and notes against the `## Key dates` table. If a newer source gives a different date for the same fact, do these steps:
   - Overwrite the row date, source, and received date. In the source cell, write which earlier date this replaces.
   - Search all item text for the old date as plain text (for example, "Dec 2" or "2026-12-02"). Change it to a `{{key}}` token or to the new date.
   - Update the `expires` value of each item that uses the key.
   - Remove the old date everywhere. Keep no history of it in item text.
   - When two sources on the same day disagree, use the one with the later timestamp.
5. Find superseded items. If a new item replaces an older item on the same subject (for example, a new weekly status), remove the older item.

## 3. Diff and report

Compare the Jira statuses against the snapshot in `daily-status.md`. Report:

- Tickets whose status changed (old -> new)
- New tickets from step 2b
- Resolved or closed tickets
- Stale blockers (items in the blockers section older than 3 days)

Put a summary at the top.

### Email news section

Report the relevant findings from step 2c in an Email news section. Summarize each finding as one bullet. Group the bullets by type (release and planning, meetings, calendar, tickets, community). Omit the section if nothing relevant was found.

Email news is informational only. Do not copy it into the daily log, with one exception. Copy a finding into the daily log only when it is work the user did or an item that requires the user's action:
- A Jira ticket update that the user made.
- An email addressed directly to the user with a request, question, or review ask.
- An action item assigned to the user, for example in meeting notes.

General news, other people's ticket activity, announcements, CI results, and FYI threads stay out of the daily log.

### Newsfeed changes section

List the newsfeed removals and date changes from step 2f. Show each date change as old date -> new date, with the source. Omit the section if nothing changed.

### Write the newsfeed

Every report finding that does not go into the daily log also goes into `newsfeed.md`. This includes Email news and Related Jira activity. Write the newsfeed during step 5, after the user confirms the updates. Do not ask a separate question for it.

For each new item:
- Put it under the matching `## ` section. Default sections: Release and planning, Process, Tickets, Tooling, Team, Calendar, Community. Add a new section only if no section fits.
- Use a short, specific `### ` title.
- Add the metadata lines: `received`, `source`, `tags`, `expires`, and `dates` or `ticket` when they apply.
- Use 2 to 5 tags. Use existing tags first. Starter tags: release, risk, process, tooling, team, kudos, meeting, calendar, company, community. Add project or version tags as you need them (for example, `v2.1`).
- Set `expires` with these rules:
  - Calendar items: the event date.
  - Items about a key date: the last key date the item uses.
  - Weekly status items: 7 days after `received`.
  - All other items: {{RETENTION_DAYS}} days after `received`.
- Put every release, freeze, or deadline date in the `## Key dates` table. Write `{{key}}` in the item text. Do not write the date as plain text. Then one table edit updates all references.
- Do not put other people's personal status in the newsfeed (time off, leave, health).
- Do not put the user's personal email in the newsfeed (benefits, medical, finance).

Set `Last reviewed:` to today's date.

### Workspace activity section

Report the findings from step 2d, grouped by ticket or project. Flag open questions, drafts that wait for review, and decisions that need the user.

### To-do list section

Completed items: list the items where `todo-state.json` has the key set to `true`. Show the item text, ticket, and release.

Open items: list all open items grouped by release. Show the priority and any waiting tags.

Suggested new items: suggest new to-do items from the Jira and email data. Use these heuristics:
- Ticket moved to Review: suggest "Complete peer review for {ticket}".
- Ticket moved to Resolved or Closed: suggest "Verify publishing for {ticket}".
- New ticket in the snapshot with no to-do items: suggest a first action item.
- Parent epic status changed: suggest "Check if {ticket} is unblocked by the parent epic change".
- A waiting item has waited more than 5 days: flag it as possibly stale.

Show each suggestion with a proposed key, text, ticket, release, and priority. Ask the user which suggestions to add.

Ask about completions: ask if any open items are done. Show the open items as a numbered list.

## 4. Propose updates

Infer what changed and propose concrete updates. Use Jira status changes and blocker age to draft changes to these files.

`data/project-tracking.js` (`{{PROJECT_DIR}}/data/project-tracking.js`):

This file uses `export default { ... }`. Only edit tickets in the active release section (`type: "active"`). Do not edit archive sections during check-ins.

- `status`: update from Jira. Use these values: `"Done"`, `"In progress"`, `"Not started"`, `"Review"`, `"Blocked"`.
- `sp`: update (number or null) if story points changed in Jira. For epics, leave `sp` as null. The template sums the child SP into the epic row.
- `children`: put the child tickets of an epic here. Each child has `jira`, `jiraUrl`, `description`, `sp`, `status`. The template shows children in a sub-table under the epic.
- `mrUrl` (optional): a merge request or pull request link. The template shows it after the description.

Sort tickets by status in each sub-release: in progress first, not started in the middle, done at the bottom.

```js
{
  jira: "PROJ-123",
  jiraUrl: "{{TICKET_BASE_URL}}PROJ-123",
  description: "Document feature X",
  sp: null,
  status: "In progress",
  children: [
    { jira: "PROJ-124", jiraUrl: "{{TICKET_BASE_URL}}PROJ-124", description: "Write feature X docs", sp: 5, status: "In progress" },
    { jira: "PROJ-125", jiraUrl: "{{TICKET_BASE_URL}}PROJ-125", description: "Feature X signoff", sp: 1, status: "Done" }
  ]
}
```

`daily-status.md`:
- Ticket Status Snapshot: update statuses and SP from Jira. Mark changed items.
- Priority Queue: if a ticket moved to Review, Resolved, or Closed, suggest moving it down or to Completed.
- Active Blockers: if a blocker's ticket status changed, suggest resolving it. Flag stale blockers (more than 3 days).
- Last updated and Total story points: recalculate. Total SP is the planned scope of the release. Do not subtract SP when tickets close.
- Daily log entry: write it from the user's own work. Use Jira updates the user made, workspace activity (step 2d), to-do changes, and action items assigned to the user. Use one bullet per update.

Present all proposed changes, then apply them after the user confirms. If the user corrects or adds detail, include it before you write.

### To-do list updates

Items to mark completed: list the keys to set to `true` in `todo-state.json`.

New items: show each object to add to `data/todo-list.js`:

```js
{
  key: "todo-{ticket_number}-{short_slug}",
  text: "{description}",
  ticket: { key: "{TICKET_ID}", url: "{{TICKET_BASE_URL}}{TICKET_ID}" },
  release: "{release}",
  priority: "{high|medium|low}"
}
```

For items without a ticket, use `ticket: null` and the key pattern `todo-{short_slug}`.

Items to remove: if a ticket is closed and all its to-do items are done, suggest removing the items from both files.

## 4a. Check for completed milestones

Check whether any sub-release milestone has passed its release date and all its tickets are done. Compare today's date against the release dates in `data/project-tracking.js` and `data/release-summary-current.js`. If both are true, ask: "Release 2.1 shipped on July 16 and all tickets are closed. Mark this milestone as complete?"

On confirmation:

`data/project-tracking.js`:
- Set `collapsible: true` on the completed sub-release. This collapses its ticket table.

`data/release-summary-current.js`:
- In the matching `releases` entry: remove `statusChip`, set `progressPercent: 100`, and set `statusCounts` to `{ done: N }` only.
- In `velocity.bars`: set `projected: false` on the matching bar.
- In `stats`: add the milestone SP to the completed SP card. Set the active release card to the next milestone.

Skip this step if the date has not passed, tickets are still open, or the user declines.

## 4b. Advance the active release card when a release ships

A release can ship while its tickets are still open (for example, docs still in review). When an email or Jira signal confirms that a release is live and its date has passed, ask the user. On confirmation, update `data/release-summary-current.js` `stats`:
- Set the active release card to the next release.
- Set the planned SP card label and value to the next release's planned SP (the SP sum of its tickets in `data/project-tracking.js`).

Do not change the shipped release's `velocity.bars` or `releases` entry until its tickets close. Step 4a does that.

## 5. Apply updates

After the user confirms, update these files. Read each file before you edit it. Only change fields that changed.

- `{{PROJECT_DIR}}/data/project-tracking.js`: ticket `status`, `sp`, `children`, and `mrUrl` in the active release section.
- `{{PROJECT_DIR}}/daily-status.md`: snapshot, priority queue, blockers, last updated, story points, daily log entry.
- `{{PROJECT_DIR}}/data/release-summary-current.js`: keep in sync with the project tracking data.
  - `stats`: the 4 stat card values.
  - `velocity.bars`: update the `value` of each bar. The template calculates bar heights. Set `projected: true` for unreleased sub-releases.
  - `releases`: update `statusCounts`, `progressPercent`, and `sp`.
- `{{PROJECT_DIR}}/newsfeed.md`: apply the step 2f removals and date changes, then add the new items. Follow "Write the newsfeed" in step 3.
- `{{PROJECT_DIR}}/data/quarterly-connection.js`: when tickets complete, add them to the current quarter's delivered subsection as `{ release: "2.1", text: "Description" }`. Add work outside Jira as `{ text: "Description" }`.
- `{{PROJECT_DIR}}/.last-checkin`: write the current timestamp after the check-in completes.

### To-do list files

- `{{PROJECT_DIR}}/todo-state.json`: set completed keys to `true`. Add new keys as `false`. Remove keys for deleted items.
- `{{PROJECT_DIR}}/data/todo-list.js`: move completed items to the `completed` group. Append new items to the matching group. Delete removed items.

Keep `todo-state.json` and `data/todo-list.js` in sync. Read both files before you edit them.
