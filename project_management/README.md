# Project Management CLI

A Python CLI that lets the team manage the entire GitHub project from the terminal — issues, labels, pull requests, project boards, and the local draft-plan — so nobody has to open the GitHub web UI.

## Quick Start

```bash
# Authenticate once with gh CLI (browser-based login)
gh auth login

# That's it — the CLI auto-detects your token from gh.
# No GITHUB_TOKEN or env vars needed.
```

The repo defaults to `matdevstamp/inl-3-awesome-journal`. Override with:

```bash
export GITHUB_REPOSITORY=owner/repo-name
```

---

## Commands at a Glance

### See What's Going On

| Command | What it does |
|---------|-------------|
| `python3 -m project_management status` | Lists open GitHub issues with labels and links |
| `python3 -m project_management issue list --state all` | Lists every issue (open, closed, or both) |
| `python3 -m project_management issue view 3` | Shows the full JSON for one issue |
| `python3 -m project_management project status` | Shows the GitHub Projects board with custom fields |
| `python3 -m project_management pr list` | Lists open pull requests |

### Create Work

| Command | What it does |
|---------|-------------|
| `python3 -m project_management task create --title "Do the thing"` | Creates a GitHub issue (alias for `issue create`) |
| `python3 -m project_management task create --title "X" --label type:feature --label gate:2-scaffold` | Creates an issue with labels |
| `python3 -m project_management task create --title "X" --assignee octocat` | Creates and assigns to a GitHub user |
| `python3 -m project_management task create --title "X" --deadline 2026-09-10` | Adds a deadline line to the issue body |
| `python3 -m project_management task create --title "X" --draft docs/draft_tasks/05-nextjs-tailwind-shadcn.md` | Creates the issue **and** stamps the draft file with the issue URL, plus sets project fields (Priority, Size, Estimate, Target date, Gate, Stream) |

### Update Work

| Command | What it does |
|---------|-------------|
| `python3 -m project_management issue edit 3 --state closed` | Closes an issue |
| `python3 -m project_management issue edit 3 --assignee octocat` | Assigns or reassigns |
| `python3 -m project_management issue close 3 --yes` | Closes with explicit confirmation |
| `python3 -m project_management issue comment 3 "Done in PR #12"` | Adds a comment |

### Local Plan (No GitHub Needed)

These commands read the draft task files in `docs/draft_tasks/` and give you a quick overview.

| Command | What it does |
|---------|-------------|
| `python3 -m project_management plan show` | Shows all draft tasks with deadlines, state, and assignees |
| `python3 -m project_management plan show --only overdue` | Filters to overdue tasks only |
| `python3 -m project_management plan show --only unassigned` | Filters to tasks with no assignee |
| `python3 -m project_management plan kickoff` | Shows the recommended 4-person task split |
| `python3 -m project_management plan check` | Warns about deadline collisions and broken dependencies |
| `python3 -m project_management plan graph` | Prints a Mermaid graph of task dependencies and relations |
| `python3 -m project_management plan graph --output docs/diagrams/task-dependencies.md` | Writes a markdown page that renders the graph on GitHub (use a `.mmd` suffix for the raw Mermaid source) |

### Issue Relationships (Dependencies & Related)

| Command | What it does |
|---------|-------------|
| `python3 -m project_management deps sync` | Applies draft `Dependencies:`/`Related:` metadata to stamped GitHub issues as native "blocked by" links and `**Related:**` body lines (idempotent — creates no issues) |
| `python3 -m project_management deps sync --dry-run` | Shows what `deps sync` would change without writing |
| `python3 -m project_management task create --title "X" --depends-on 4 --related-to 7` | Creates an issue and links it as blocked by #4, with #7 in the Related line |

### Labels

| Command | What it does |
|---------|-------------|
| `python3 -m project_management labels sync` | Creates/updates the standard label set (idempotent, safe to re-run) |

---

## Workflow: Draft Task → GitHub Issue

The typical flow when turning a planned task into real work:

1. **Write the draft** in `docs/draft_tasks/XX-name.md` (already done for all 21 tasks).
2. **Create the issue** with `--draft` to link them:
   ```bash
   python3 -m project_management task create \
     --title "04 - Database Design & Setup" \
     --label type:feature --label gate:2-scaffold --label area:database \
     --draft docs/draft_tasks/04-database-design.md
   ```
3. The CLI creates the GitHub issue, **stamps the draft file** with the issue URL, and **sets project fields** automatically:
   - `Priority` — from effort size (P0/P1/P2)
   - `Size` — from effort (XS/S/M/L/XL)
   - `Estimate` — numeric hours
   - `Target date` — from draft deadline
   - `Gate` — from `gate:` tag
   - `Stream` — from `stream:` tag
   - `Status` — left blank (kanban columns handle workflow; Status is for exceptions only: Blocked / Stuck / Needs review)
   - **Dependencies** — each `Dependencies:` draft reference with a stamped issue becomes a native GitHub "blocked by" relationship
   - **Related** — `Related:` draft references are listed as a `**Related:**` line in the issue body (GitHub has no native "related" type)

## Relationships Workflow

Draft tasks carry two relationship metadata lines:

- `- **Dependencies:** 04-database-design.md, 11-backend-api-auth.md` — hard prerequisites. When the draft is created as an issue (or via `deps sync`), each resolved reference is linked as a native **blocked by** relationship, so GitHub shows the dependency in the issue sidebar and a "Blocked" marker on the board.
- `- **Related:** 14-medical-notes.md` — parallel/cross-cutting tasks that are reviewed together but do not block each other. These become a `**Related:** #N` line in the issue body (GitHub offers no API for a related relationship).

References are resolved to issue numbers through the `- **GitHub Issue:** #N` stamp on the referenced draft. Unstamped drafts (future work not yet on GitHub) are reported as skipped. Re-running `deps sync` only adds missing links, so it is safe to run after every issue creation round.

To see the whole relationship map as a Mermaid diagram (regenerate after any metadata change):

```bash
python3 -m project_management plan graph --output docs/diagrams/task-dependencies.md
```

GitHub does not render raw `.mmd` files; the `.md` output above is what renders the diagram when someone opens it on GitHub.

---

## Stakeholder Reports (Excel)

Export a stakeholder `.xlsx` any time — it merges **live GitHub state** (issue open/closed, card links) with the **local draft plan** (epics/gates, streams, owners, deadlines, dependencies, questions). The export never writes to GitHub.

```bash
python3 -m project_management report export --output docs/stakeholder-report.xlsx
```

| Sheet | What it shows |
|-------|---------------|
| **Overview** | Summary counts, then one row per epic (Gate) and per Stream: planned/open/closed, blocked, overdue, unassigned, next deadline |
| **Changelog** | What changed since the previous export (new cards, closed tasks, deadline/owner moves, resolved questions) — compared against the `.snapshot.json` stored next to the workbook |
| **Tasks** | All draft tasks with merged state: epic, stream, title, state, owner, deadline, effort, blocked by, related, GitHub link |
| **Questions** | Every open `## Questions to Resolve` item from the drafts |

Re-running the command produces a fresh workbook whose Changelog sheet shows only what changed. Works without GitHub access too (planned view, with a warning). The snapshot file is the diff baseline; commit it alongside the workbook if you want changelogs to track across commits.

---

## JSON Mode

Any command can output machine-readable JSON with `--json` before the subcommand:

```bash
python3 -m project_management --json status
python3 -m project_management --json issue list
python3 -m project_management --json plan show
```

---

## Labels

Status and priority live in **GitHub Projects custom fields**, not as labels. The label set covers type, area, stream, and gate:

| Category | Examples |
|----------|---------|
| Type | `type:feature`, `type:bug`, `type:docs`, `type:chore`, `type:testing`, `type:architecture` |
| Area | `area:frontend`, `area:backend`, `area:database`, `area:blockchain`, `area:p2p`, `area:auth`, `area:devops` |
| Stream | `stream:A-identity`, `stream:B-patient`, `stream:C-notes`, `stream:D-audit` |
| Gate | `gate:1-decisions`, `gate:2-scaffold`, `gate:3-features`, `gate:4-integration`, `gate:5-delivery` |

Run `python3 -m project_management labels sync` to create or refresh them.

---

## Ripwire

Ripwire is a standalone CLI (not a project dependency):

```bash
ripwire --version
```

To generate the tracked architecture artifacts:

```bash
npm run ripwire          # ripwire-out/graph.html + ripwire-out/GRAPH_REPORT.md
```

Keep only `ripwire-out/graph.html` and `ripwire-out/GRAPH_REPORT.md` under version
control. See [docs/ripwire.md](../docs/ripwire.md) for the full guide.

---

## Project Structure

```
project_management/
├── __init__.py      # Package metadata
├── __main__.py      # Entry point: python3 -m project_management
├── cli.py           # Argument parsing and command routing
├── github.py        # GitHub REST + GraphQL client (auto-authenticates via gh)
├── planner.py       # Local draft-task reader, schedule checker, reference stamper
└── README.md        # This file
```
