# Newsfeed

Last reviewed: never
Ticket base URL: {{TICKET_BASE_URL}}

<!--
Format rules (the newsfeed page parses this file):
- "## Key dates" holds one table row per dated fact. Each key is unique.
  When a newer source changes a date, overwrite the row. Do not keep the old date anywhere.
  Remove a row when its date passes and no item uses it.
- Write {{key}} in item text to show a key date. The page fills in the date from the table.
- Every other "## " heading is a section. Every "### " heading is one item.
- Item metadata lines come directly after the item heading:
  received (YYYY-MM-DD), source, tags (comma list), expires (YYYY-MM-DD),
  dates (comma list of key-date keys, optional), ticket (optional, a ticket key such as PROJ-123).
- Item body text comes after the metadata. Use paragraphs or "- " bullets.
- "Ticket base URL" is the link prefix for ticket keys. Leave it blank for no links.
- The /checkin skill removes this sample item and the sample key date on its first run.
-->

## Key dates

| Key | Date | Label | Source | Received |
| :--- | :--- | :--- | :--- | :--- |
| sample-launch | 2099-01-01 | Sample launch date | Sample source | 2099-01-01 |

## Release and planning

### Sample item: this is how a news item looks
- received: 2099-01-01
- source: Sample email
- tags: sample, release
- expires: 2099-01-01
- dates: sample-launch

The launch is on {{sample-launch}}. Change the date in the Key dates table, and this text changes with it.
