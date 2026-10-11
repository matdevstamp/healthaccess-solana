# Project Management Automation

The repository includes a Python CLI for GitHub work. It is designed for use from a terminal, VS Code text box, or an assistant command workflow, so routine status checks and task creation do not require opening GitHub in a browser.

## Setup

```bash
export GITHUB_TOKEN=your_token
export GITHUB_REPOSITORY=matdevstamp/inl-3-awesome-journal
```

The token should have access to issues, labels, and Projects. Do not commit it.

## Status and Tasks

Run these commands from the repository root:

```bash
python3 -m project_management status
python3 -m project_management status --state all
python3 -m project_management task create \
  --title "Add login smoke test" \
  --body "Implement and verify the login acceptance flow." \
  --label type:testing
python3 -m project_management labels sync
```

For the Friday kickoff, review the complete deadline plan and recommended split:

```bash
python3 -m project_management plan show
python3 -m project_management plan kickoff
python3 -m project_management plan check
python3 -m project_management plan graph  # Mermaid diagram of dependencies and relations
```

Draft `Dependencies:` references become native GitHub "blocked by" relationships and `Related:` references become a `**Related:**` body line. Sync existing issues idempotently (no new issues are created) with:

```bash
python3 -m project_management deps sync          # apply missing relationships
python3 -m project_management deps sync --dry-run  # preview first
```

Stakeholders get a merged Excel status workbook (no GitHub writes):

```bash
python3 -m project_management report export --output docs/stakeholder-report.xlsx
```

It contains Overview (per-epic/stream rollups), Changelog (diff vs. the previous export's snapshot), Tasks, and Questions sheets. A companion `.snapshot.json` stores the previous state so each export doubles as a "what changed since last time" report. See `docs/business-role-collaboration.md` for the business-facing explanation.

Status and priority belong in GitHub Projects custom fields. They are intentionally not duplicated as issue labels.

The CLI also supports the full daily issue workflow without the GitHub web UI:

```bash
python3 -m project_management issue list --state all
python3 -m project_management issue view 42
python3 -m project_management issue edit 42 --title "Updated task title"
python3 -m project_management issue comment 42 "Blocked by the database decision."
python3 -m project_management issue close 42 --yes
python3 -m project_management project status
python3 -m project_management pr list
```

Use `--json` before a command for assistant integrations and scripts. Destructive actions require an explicit confirmation flag.

The schedule intentionally includes Saturday and Sunday work because this is a school project.

Bug reports follow a separate intake workflow documented in [BUG_REPORTING.md](BUG_REPORTING.md). Record raw observations first, let the lead triage them, then create a draft task or GitHub issue. User-facing bugs should gain a failing Playwright reproduction test before the fix and a passing test afterward.

The lead can inspect and promote reports with `python3 -m project_management bug list`, `bug triage REPORT_ID --status accepted`, and `bug promote REPORT_ID --yes`. Promotion creates a stamped draft task and writes its path back to the CSV, preserving the report-to-task lineage.

Meeting scope policy: each meeting protects its stated purpose. When a topic needs a longer discussion, different participants, or preparation, the facilitator parks it in the meeting note and books a separate meeting with a clear decision question. Urgent blockers and decisions required for the current agenda stay in the current meeting.

## Global Ripwire

Ripwire is a standalone CLI, installed globally rather than as a project dependency:

```bash
ripwire --version
ripwire --help
```

To generate the tracked architecture artifacts:

```bash
npm run ripwire          # writes ripwire-out/graph.html + ripwire-out/GRAPH_REPORT.md
```

Keep only `ripwire-out/graph.html` and `ripwire-out/GRAPH_REPORT.md` under version
control; ripwire's parse cache stays in `TMPDIR`. See [docs/ripwire.md](ripwire.md)
for the full guide.