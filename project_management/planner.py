import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path


@dataclass(frozen=True)
class Task:
    key: str
    title: str
    deadline: date | None
    status: str
    assignee: str
    tags: tuple[str, ...]
    dependencies: str
    related: tuple[str, ...]
    effort: str
    path: Path


# ── Team roster ──────────────────────────────────────────────
TEAM_MEMBERS = {
    "matdevstamp": "Matias Marti",
    "Kassim10": "Kassim Segerberg",
    "rcilomba": "Ramadan",
    "umoraghad0-del": "Najma Hasan",
}

# Role-to-username mapping for legacy "Person N" prose in docs.
# The kickoff (2026-09-04) deviated from the example Person 1-4 split in
# ``docs/Raw_Requirements.md``: the team now works backend (Kassim), UI
# (Ramadan), coordinator/lead + Gate 2 setup (Matias), and Stream D owner
# (Najma), who declared her focus on 2026-09-05: blockchain/access-logging
# (task 15) as main responsibility, pair-programming P2P (16) and
# Socket.IO (18).
ROLE_TO_USER = {
    "Person 1": "umoraghad0-del",  # Crypto & ledger (chain core) → Najma
    "Person 2": "umoraghad0-del",  # P2P network → Najma (pair)
    "Person 3": None,  # legacy Express API & middleware label (no longer used)
    "Person 4": None,  # legacy frontend label (no longer used)
}

KICKOFF_ASSIGNMENTS = {
    "01": "Team",
    "02": "Team",
    "03": "Team",
    "04": "matdevstamp",
    "05": "matdevstamp",
    "06": "matdevstamp",
    "07": "matdevstamp",
    "08": "matdevstamp",
    "09": "matdevstamp",
    "10": "matdevstamp",
    "11": "Kassim10",
    "12": "rcilomba",
    "13": "rcilomba",
    "14": "Kassim10",
    "15": "umoraghad0-del",
    "16": "umoraghad0-del",
    "17": "Kassim10",
    "18": "umoraghad0-del",
    "19": "Team",
    "20": "matdevstamp",
    "21": "Team",
    # Colosseum Crypto World's Fair hackathon (solo submission).
    "22": "matdevstamp",
    "23": "matdevstamp",
    "24": "matdevstamp",
    "25": "matdevstamp",
    "26": "matdevstamp",
    "27": "matdevstamp",
    "28": "matdevstamp",
    "29": "matdevstamp",
    "30": "matdevstamp",
    "31": "matdevstamp",
    "32": "matdevstamp",
    "33": "matdevstamp",
    "34": "matdevstamp",
}


_METADATA = {
    "deadline": re.compile(r"^- \*\*Deadline:\*\*\s*(.+)$", re.MULTILINE),
    "status": re.compile(r"^- \*\*Status:\*\*\s*(.+)$", re.MULTILINE),
    "assignee": re.compile(r"^- \*\*Assignee:\*\*\s*(.+)$", re.MULTILINE),
    "tags": re.compile(r"^- \*\*Tags:\*\*\s*(.+)$", re.MULTILINE),
    "dependencies": re.compile(r"^- \*\*Dependencies:\*\*\s*(.+)$", re.MULTILINE),
    "related": re.compile(r"^- \*\*Related:\*\*\s*(.+)$", re.MULTILINE),
    "effort": re.compile(r"^- \*\*Estimated Effort:\*\*\s*(.+)$", re.MULTILINE),
}

# A reference to another draft task file, e.g. ``01-project-setup-group-contract.md``.
# Tolerates surrounding prose such as ``01-x.md; final update depends on ...``.
_REF_TOKEN = re.compile(r"\b(\d{2})-[a-z0-9-]+\.md\b")

# The ``- **GitHub Issue:** #N`` stamp written by update_task_reference().
_ISSUE_STAMP = re.compile(r"^- \*\*GitHub Issue:\*\*\s*#(\d+)", re.MULTILINE)

_RELATED_LINE = re.compile(r"^(\*\*Related:\*\*.*)$", re.MULTILINE)

GATE_TAG_TO_NAME = {
    "gate:1-decisions": "1-Decisions",
    "gate:2-scaffold": "2-Scaffold",
    "gate:3-features": "3-Features",
    "gate:4-integration": "4-Integration",
    "gate:5-delivery": "5-Delivery",
}
GATE_ORDER = ["1-Decisions", "2-Scaffold", "3-Features", "4-Integration", "5-Delivery"]

# ── Status colors & progress (shared by graph + gantt) ────────
# Mermaid 11 classDef syntax: a space between the class name and the styles
# (`classDef name,fill:...` no longer parses and shows "Parse error").
_STATUS_STYLES = {
    "done": "fill:#dcedc8,stroke:#558b2f,color:#1b5e20",
    "doing": "fill:#dbe9fb,stroke:#1565c0,color:#0d47a1",
    "todo": "fill:#ffffff,stroke:#b0bec5,color:#546e7a,stroke-dasharray:5 4",
}
_DONE_STATUS = {"DONE", "COMPLETE", "COMPLETED"}
_DOING_STATUS = {"DOING", "IN PROGRESS", "IN-PROGRESS", "INPROGRESS", "WIP", "ACTIVE", "STARTED", "IN REVIEW", "IN-REVIEW", "INREVIEW", "REVIEW", "REVIEWING"}
_BOX_RE = re.compile(r"(?m)^\s*-\s*\[(.)\]")


def _status_class(status):
    """Map a raw task status to one of done | doing | todo."""
    raw = (status or "").strip().upper()
    if raw in _DONE_STATUS:
        return "done"
    if raw in _DOING_STATUS:
        return "doing"
    return "todo"


def _checkbox_counts(text):
    """Count checked vs total '- [x]' boxes in a task file."""
    boxes = _BOX_RE.findall(text or "")
    checked = sum(1 for mark in boxes if mark.lower() == "x")
    return checked, len(boxes)


def _task_text(task):
    """Safely read a task file's text (missing fixture paths -> empty)."""
    try:
        return task.path.read_text(encoding="utf-8")
    except (OSError, ValueError):
        return ""


# ── Project board → draft sync (plan sync) ─────────────────────
# GitHub Project Status field values mapped onto draft *Metadata*
# ``Status`` lines so the local plan "listens to" the board.
_BOARD_TO_STATUS = {
    "Backlog": "TODO",
    "Ready": "READY",
    "In progress": "IN PROGRESS",
    "In review": "IN REVIEW",
    "Done": "DONE",
}


def board_status_to_status(board_status, issue_state):
    """Map a project board Status + issue state to draft Status metadata.

    A closed issue without a board status counts as done (its PR merged).
    An open issue without a board status returns None, meaning "leave the
    draft alone" rather than inventing a status.
    """
    if board_status and board_status.strip():
        normalized = board_status.strip()
        return _BOARD_TO_STATUS.get(normalized, normalized.upper())
    if (issue_state or "").lower() == "closed":
        return "DONE"
    return None


def _normalize_checkbox_text(line):
    """Lowercase and strip everything except letters/digits for matching."""
    return re.sub(r"[^a-z0-9]+", "", line.lower())


def _checkbox_body(line):
    """Normalize a checkbox line excluding its `- [x]`/`- [ ]` marker."""
    match = _BOX_RE.match(line)
    body = line[match.end() :] if match else line
    return _normalize_checkbox_text(body)


def _checkbox_candidates(body, index):
    """Return candidate marks for ``body`` from a {normalized: [marks]} index.

    A key matches when it equals ``body`` or one is a prefix of the other;
    that tolerates GitHub-side annotations such as
    ``~~task~~ — moved to issue #N`` in either direction. Only unique,
    unambiguous matches are returned.
    """
    if body in index:
        return index[body]
    related = [
        key
        for key, marks in index.items()
        if body.startswith(key) or key.startswith(body)
    ]
    if len(related) == 1 and len(index[related[0]]) == 1:
        return index[related[0]]
    return []


def sync_checkboxes(draft_text, issue_text):
    """Flip draft `- [ ]` boxes to `- [x]` where the issue has them checked.

    Checked always wins: a box checked on GitHub is checked in the draft, and a
    box checked in the draft is never unchecked by the sync (progress is
    monotonic). Returns ``(new_text, changed_count)``.
    """
    issue_marks = {}
    for line in (issue_text or "").splitlines():
        match = _BOX_RE.match(line)
        if not match:
            continue
        body = _checkbox_body(line)
        issue_marks.setdefault(body, []).append(match.group(1))

    changed = 0
    lines = draft_text.splitlines()
    for i, line in enumerate(lines):
        match = _BOX_RE.match(line)
        if not match:
            continue
        if match.group(1).lower() == "x":
            continue
        candidates = _checkbox_candidates(_checkbox_body(line), issue_marks)
        if len(candidates) == 1 and candidates[0].lower() == "x":
            lines[i] = re.sub(r"\[.\]", "[x]", line, count=1)
            changed += 1
    new_text = "\n".join(lines)
    if draft_text.endswith("\n"):
        new_text += "\n"
    return new_text, changed


def issue_checkboxes_from_draft(issue_text, draft_text):
    """Flip issue `- [ ]` boxes to `- [x]` where the draft has them checked.

    The mirror-image of :func:`sync_checkboxes`: checked always wins, so a box
    the reviewer ticked locally is promoted to the GitHub issue body without
    ever unchecking a box the issue already has checked. Returns
    ``(new_issue_text, changed_count)``.
    """
    draft_marks = {}
    for line in (draft_text or "").splitlines():
        match = _BOX_RE.match(line)
        if not match:
            continue
        body = _checkbox_body(line)
        draft_marks.setdefault(body, []).append(match.group(1))

    changed = 0
    lines = (issue_text or "").splitlines()
    for i, line in enumerate(lines):
        match = _BOX_RE.match(line)
        if not match:
            continue
        if match.group(1).lower() == "x":
            continue
        candidates = _checkbox_candidates(_checkbox_body(line), draft_marks)
        if len(candidates) == 1 and candidates[0].lower() == "x":
            lines[i] = re.sub(r"\[.\]", "[x]", line, count=1)
            changed += 1
    new_text = "\n".join(lines)
    if issue_text and issue_text.endswith("\n"):
        new_text += "\n"
    return new_text, changed


def sync_task_text(text, issue_state, issue_body, board_status):
    """Reconcile a draft task file text against GitHub issue state.

    Returns ``(new_text, changes)`` where ``changes`` is a list of human
    readable strings describing what differs. No changes -> unchanged text.
    Checkbox reconciliation keeps a box checked once either side checks it.
    """
    changes = []
    new_text = text
    status = board_status_to_status(board_status, issue_state)
    if status:
        match = _METADATA["status"].search(new_text)
        if match and match.group(1).strip().upper() != status:
            start, end = match.span(1)
            new_text = new_text[:start] + status + new_text[end:]
            changes.append(f"Status: {match.group(1).strip()} -> {status}")
    new_text, flipped = sync_checkboxes(new_text, issue_body)
    if flipped:
        changes.append(f"checkboxes: {flipped} checked on GitHub")
    return new_text, changes


def _task_label(task, text):
    """Node/task label: '01 Title (50% · 3/6 · doing)' or '01 Title ✓' when done."""
    title = task.title.replace('"', "'").strip()
    status = _status_class(task.status)
    if status == "done":
        return f"{task.key} {title} ✓"
    checked, total = _checkbox_counts(text)
    if total:
        pct = round(100 * checked / total)
        return f"{task.key} {title} ({pct}% · {checked}/{total} · {status})"
    return f"{task.key} {title} (0/0 · {status})"


def parse_task_refs(value):
    """Extract ``(key, filename)`` pairs from a Dependencies/Related metadata value.

    Non-file prose (e.g. "final update depends on all tasks") is ignored.
    """
    return [(match.group(1), match.group(0)) for match in _REF_TOKEN.finditer(value or "")]


def task_gantt_mermaid(tasks):
    """Build a Mermaid Gantt chart from task deadlines, effort, and dependencies.

    Scheduling: every task ends on its deadline (or on the earliest deadline of
    the tasks that depend on it); duration comes from Estimated Effort; start is
    end minus duration. Tasks are grouped into gate sections.
    """
    import datetime as _dt

    def _effort_days(effort):
        """Map an effort string to calendar days (rounded up)."""
        effort = effort.strip().lower()
        match = re.search(r"(\d+)", effort)
        if not match:
            return 2
        num = float(match.group(1))
        if "day" in effort:
            return max(1, int(num))
        if "week" in effort:
            return max(1, int(num * 5))
        return max(1, int(num / 6.0) + 1)  # hours -> ~6h work days

    by_key = {task.key: task for task in tasks}

    # Section per gate, in the canonical order.
    gate_tasks = {gate: [] for gate in GATE_ORDER}
    other = []
    for task in tasks:
        gate = next(
            (GATE_TAG_TO_NAME[tag] for tag in task.tags if tag.lower().strip() in GATE_TAG_TO_NAME),
            None,
        )
        (gate_tasks[gate] if gate else other).append(task)

    def _deadline(task):
        """A task's due date: its own deadline, or the earliest deadline of its dependents."""
        if task.deadline:
            return task.deadline
        dependent_deadlines = [
            dep.deadline for dep in by_key.values() if task.key in {
                k for k, _fn in parse_task_refs(dep.dependencies)
            }
        ]
        return min(dependent_deadlines) if dependent_deadlines else None

    # Compute start/end dates.
    rows = []  # (key, title, gate, start, end, status)
    for task in tasks:
        end = _deadline(task)
        days = _effort_days(task.effort)
        gate = next(
            (GATE_TAG_TO_NAME[tag] for tag in task.tags if tag.lower().strip() in GATE_TAG_TO_NAME),
            "Other",
        )
        if end:
            start = end - _dt.timedelta(days=days - 1)
        else:
            start = None
        rows.append((task.key, task.title, gate, start, end, task.status))

    # Earliest start -> chart range.
    dated = [r for r in rows if r[3]]
    if not dated:
        return "gantt\n    title Task Timeline (no dates)\n"
    min_start = min(r[3] for r in dated)
    max_end = max(r[4] for r in dated)

    lines = [
        "gantt",
        "    title Project Timeline",
        "    dateFormat  YYYY-MM-DD",
        "    axisFormat  %b %d",
        "",
    ]
    for gate in GATE_ORDER + ["Other"]:
        gate_rows = [r for r in rows if r[2] == gate]
        if not gate_rows:
            continue
        lines.append(f"    section Gate {gate}")
        for key, title, _g, start, end, status in gate_rows:
            if start is None or end is None:
                # Undated tasks cannot be drawn (mermaid gantt has no 'skipped'
                # state; `: skipped, 0d` is a hard render error). They are listed
                # under the chart via gantt_unscheduled() instead.
                continue
            task = by_key[key]
            # Unquoted gantt task names split on ':', so colons are sanitized.
            label = _task_label(task, _task_text(task)).replace(":", "-")
            state = "done" if _status_class(status) == "done" else "active"
            duration = max(1, (end - start).days + 1)
            lines.append(f"    {label} : {state}, {start.isoformat()}, {duration}d")
    return "\n".join(lines) + "\n"


def gantt_unscheduled(tasks):
    """Keys of tasks with no usable end date (own Deadline or a dependent's).

    These cannot appear as gantt bars; callers list them under the chart.
    """
    by_key = {task.key: task for task in tasks}
    unscheduled = []
    for task in tasks:
        end = task.deadline
        if end is None:
            dependent_deadlines = [
                dep.deadline for dep in by_key.values()
                if task.key in {k for k, _fn in parse_task_refs(dep.dependencies)}
            ]
            end = min(dependent_deadlines) if dependent_deadlines else None
        if end is None:
            unscheduled.append(task.key)
    return unscheduled


def task_issue_stamp(path):
    """Return the GitHub issue number stamped on a draft file, or None."""
    match = _ISSUE_STAMP.search(path.read_text(encoding="utf-8"))
    return int(match.group(1)) if match else None


def resolve_issue_stamps(draft_path, value):
    """Resolve draft file references to stamped GitHub issue numbers.

    Returns ``(issue_numbers, unresolved)`` where ``unresolved`` lists the
    references whose draft file is missing or has no ``GitHub Issue`` stamp.
    """
    numbers, unresolved = [], []
    directory = Path(draft_path).parent
    for _key, filename in parse_task_refs(value):
        dep_path = directory / filename
        match = None
        if dep_path.exists():
            match = _ISSUE_STAMP.search(dep_path.read_text(encoding="utf-8"))
        if match:
            numbers.append(int(match.group(1)))
        else:
            unresolved.append(filename)
    return numbers, unresolved


def update_related_line(body, related_numbers):
    """Return ``body`` with the ``**Related:**`` line set to the given issue numbers.

    Replaces an existing Related line in place, so the operation is idempotent.
    """
    line = "**Related:** " + ", ".join(f"#{number}" for number in related_numbers)
    if _RELATED_LINE.search(body):
        return _RELATED_LINE.sub(line, body)
    if body.strip():
        return f"{body.rstrip()}\n\n{line}\n"
    return line


def task_graph_mermaid(tasks):
    """Build a Mermaid flowchart of task dependencies and related tasks.

    Solid arrow ``A --> B`` means B depends on A (B is blocked by A).
    Dotted line ``A -. related .- B`` means the tasks are related.
    Nodes are grouped into GitHub Project gate subgraphs when tagged.
    """
    by_key = {task.key: task for task in tasks}
    edges, seen_edges, related = [], set(), set()
    for task in tasks:
        for key, _filename in parse_task_refs(task.dependencies):
            if key in by_key and key != task.key and (key, task.key) not in seen_edges:
                seen_edges.add((key, task.key))
                edges.append((key, task.key))
        for key, _filename in parse_task_refs(", ".join(task.related)):
            if key in by_key and key != task.key:
                pair = tuple(sorted((key, task.key)))
                if (key, task.key) not in seen_edges and (task.key, key) not in seen_edges:
                    related.add(pair)

    lines = [
        "flowchart TD",
        "    %% Solid arrow A --> B: B depends on A (blocked by A)",
        "    %% Dotted line A -. related .- B: A and B are related",
        "    %% Colors: green done · blue in progress · dashed gray todo (not started)",
    ]
    gate_groups = {gate: [] for gate in GATE_ORDER}
    ungated = []
    for task in tasks:
        label = _task_label(task, _task_text(task))
        node = f'    T{task.key}["{label}"]'
        gate = next(
            (GATE_TAG_TO_NAME[tag] for tag in task.tags if tag.lower().strip() in GATE_TAG_TO_NAME),
            None,
        )
        if gate:
            gate_groups[gate].append(node)
        else:
            ungated.append(node)
    for gate in GATE_ORDER:
        if gate_groups[gate]:
            slug = gate.split("-", 1)[1].lower()
            lines.append(f'    subgraph {slug}["Gate {gate}"]')
            lines.extend(gate_groups[gate])
            lines.append("    end")
    if ungated:
        lines.append('    subgraph other["Other"]')
        lines.extend(ungated)
        lines.append("    end")
    for source, target in edges:
        lines.append(f"    T{source} --> T{target}")
    for source, target in sorted(related):
        lines.append(f"    T{source} -. related .- T{target}")
    # Status classes (mermaid 11 syntax) + per-node assignment.
    for status in ("done", "doing", "todo"):
        lines.append(f"    classDef {status} {_STATUS_STYLES[status]}")
    for task in tasks:
        status = _status_class(task.status)
        lines.append(f"    class T{task.key} {status};")
    return "\n".join(lines) + "\n"


def _metadata(text, name, default=""):
    match = _METADATA[name].search(text)
    return match.group(1).strip() if match else default


def read_task(path):
    text = path.read_text(encoding="utf-8")
    title_match = re.search(r"^# Task:\s*(.+)$", text, re.MULTILINE)
    if not title_match:
        raise ValueError(f"Missing task title in {path}")
    key = path.stem.split("-", 1)[0]
    deadline_text = _metadata(text, "deadline")
    deadline_match = re.search(r"\d{4}-\d{2}-\d{2}", deadline_text)
    deadline = date.fromisoformat(deadline_match.group(0)) if deadline_match else None
    tags = tuple(tag.strip() for tag in _metadata(text, "tags").split(",") if tag.strip())
    related = tuple(ref.strip() for ref in _metadata(text, "related").split(",") if ref.strip())
    return Task(
        key=key,
        title=title_match.group(1).strip(),
        deadline=deadline,
        status=_metadata(text, "status", "TODO"),
        assignee=_metadata(text, "assignee", "TBD"),
        tags=tags,
        dependencies=_metadata(text, "dependencies", "None"),
        related=related,
        effort=_metadata(text, "effort", "unspecified"),
        path=path,
    )


def load_tasks(directory):
    return tuple(read_task(path) for path in sorted(Path(directory).glob("*.md")))


def task_state(task, today=None):
    today = today or date.today()
    if task.status.upper() in {"DONE", "COMPLETE", "COMPLETED"}:
        return "done"
    if task.deadline and task.deadline < today:
        return "overdue"
    if task.assignee.upper() in {"TBD", "TEAM"}:
        return "unassigned"
    return "planned"


def task_line(task, today=None):
    deadline = task.deadline.isoformat() if task.deadline else "no deadline"
    return (
        f"{task.key} | {deadline} | {task_state(task, today):9} | {task.assignee:12} | {task.title}"
    )


def schedule_warnings(tasks):
    warnings = []
    by_deadline = defaultdict(list)
    by_key = {task.key: task for task in tasks}
    for task in tasks:
        if task.deadline:
            by_deadline[task.deadline].append(task)
    for deadline, grouped in sorted(by_deadline.items()):
        if len(grouped) > 1:
            names = ", ".join(f"{task.key} {task.title}" for task in grouped)
            warnings.append(f"Duplicate deadline {deadline}: {names}")
    for task in tasks:
        if not task.deadline:
            continue
        for dependency_key, _filename in parse_task_refs(task.dependencies):
            prerequisite = by_key.get(dependency_key)
            if prerequisite and prerequisite.deadline and prerequisite.deadline > task.deadline:
                warnings.append(
                    f"Dependency deadline violation: {task.key} is due {task.deadline} "
                    f"before {dependency_key} is due {prerequisite.deadline}"
                )
    return tuple(warnings)


def update_task_reference(path, issue_number, issue_url):
    """Stamp a draft task file with the GitHub issue it was created from.

    Inserts a ``- **GitHub Issue:**`` line into the Metadata section.
    If one already exists it is replaced in place.
    """
    text = path.read_text(encoding="utf-8")
    new_line = f"- **GitHub Issue:** #{issue_number} ({issue_url})"
    existing = re.compile(r"^- \*\*GitHub Issue:\*\*.*$", re.MULTILINE)
    if existing.search(text):
        text = existing.sub(new_line, text)
    else:
        # Insert after the Dependencies or Estimated Effort line
        anchor = re.compile(
            r"(^- \*\*(?:Estimated Effort|Dependencies):\*\*.*$)",
            re.MULTILINE,
        )
        match = anchor.search(text)
        if match:
            insert_pos = match.end()
            text = text[:insert_pos] + "\n" + new_line + text[insert_pos:]
        else:
            # Fallback: insert after the Metadata header
            header = re.compile(r"^(## Metadata\n)", re.MULTILINE)
            match = header.search(text)
            if match:
                insert_pos = match.end()
                text = text[:insert_pos] + new_line + "\n" + text[insert_pos:]
    path.write_text(text, encoding="utf-8")


def draft_task_to_project_fields(task):
    """Map a draft task's metadata to GitHub Projects custom field values.

    Returns a dict like ``{"Priority": "P0", "Gate": "1-Decisions", ...}``.
    Only fields that can be derived from the draft are included.
    """
    fields = {}
    # Priority: map from effort or default to P0
    effort_map = {
        "unspecified": "P0",
        "1h": "P0",
        "2h": "P0",
        "3h": "P1",
        "4h": "P1",
        "6h": "P1",
        "8h": "P2",
    }
    fields["Priority"] = effort_map.get(task.effort.lower(), "P0")
    # Status: NOT set automatically — the kanban columns handle workflow.
    # Only set manually when something is stuck or needs attention.
    # Size: map from effort
    size_map = {
        "unspecified": "M",
        "1h": "XS",
        "2h": "S",
        "3h": "S",
        "4h": "M",
        "6h": "M",
        "8h": "L",
    }
    fields["Size"] = size_map.get(task.effort.lower(), "M")
    # Estimate: extract numeric hours from effort string
    import re as _re

    hours_match = _re.search(r"(\d+)", task.effort)
    if hours_match:
        fields["Estimate"] = hours_match.group(1)
    # Target date: use the deadline if present
    if task.deadline:
        fields["Target date"] = task.deadline.isoformat()
    # Gate and Stream: extract from tags
    stream_map = {
        "stream:a-identity": "A-Identity",
        "stream:b-patient": "B-Patient",
        "stream:c-notes": "C-Notes",
        "stream:d-audit": "D-Audit",
    }
    for tag in task.tags:
        tag_lower = tag.lower().strip()
        if tag_lower in GATE_TAG_TO_NAME:
            fields["Gate"] = GATE_TAG_TO_NAME[tag_lower]
        if tag_lower in stream_map:
            fields["Stream"] = stream_map[tag_lower]
    return fields


def draft_task_clean_body(path):
    """Extract a clean issue body from a draft task markdown file.

    Returns only the Requirements, Tasks, and Done Criteria sections —
    no metadata lines (Deadline, Assignee, etc.) since those belong in
    GitHub Projects custom fields.
    """
    text = path.read_text(encoding="utf-8")
    # Strip the title line
    text = re.sub(r"^# Task:.*\n", "", text, count=1, flags=re.MULTILINE)
    # Strip the Metadata section entirely
    text = re.sub(
        r"## Metadata\n.*?(?=## |\Z)",
        "",
        text,
        flags=re.DOTALL | re.MULTILINE,
    )
    # Strip Design and Notes sections (too verbose for issue body)
    text = re.sub(
        r"## (?:Design|Notes|Questions to Resolve|User Stories)\n.*?(?=## |\Z)",
        "",
        text,
        flags=re.DOTALL | re.MULTILINE,
    )
    # Clean up excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
