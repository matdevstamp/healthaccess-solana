<!-- ripwire markdown: no run of 4-or-more backticks in this output — safe to embed inside a wider fence -->

# ripwire architecture report

275 files · 2293 symbols · 825 edges · 151 modules (1712 call-graph isolated)

Root: `.`

Call-graph isolate provenance: 211 declaration, 0 header, 277 source, 1224 document; 0 connected Louvain singletons

## Modules (call-graph clusters; showing 12 of 151)
- **project_management/tests::_make_task@test_project_management.py:53:1333 [make]** — 23 symbols
- **demo::sleep@human.ts:23:980 [move]** — 18 symbols
- **demo::settle@human.ts:391:13300 [open]** — 15 symbols
- **src/lib/solana::loadIdl@idl.ts:188:7370 [read,encode,load]** — 14 symbols
- **project_management::load_reports@bug_reports.py:41:724 [load,write,resolve]** — 9 symbols
- **project_management::graphql@github.py:63:2170 [set,get]** — 9 symbols
- **project_management/tests::read_task@project_management/planner.py:538:19664 [read,write]** — 9 symbols
- **src/lib/outbox::flushEntry@flusher.ts:59:2075 [mark,fetch,resolve]** — 9 symbols
- **demo::ffmpeg@compose.ts:79:2286** — 8 symbols
- **docs/meetings::2026-09-08-standup@2026-09-08-standup.md:1:0** — 8 symbols
- **project_management/tests::plan_sync@project_management/cli.py:271:11364 [write]** — 8 symbols
- **project_management/tests::GitHubClient@project_management/github.py:14:268** — 8 symbols

## God files (most depended-on; showing 10 of 32)
- `src/lib/solana/types.ts` — 5 dependents
- `demo/human.ts` — 4 dependents
- `demo/overlay.ts` — 4 dependents
- `project_management/cli.py` — 4 dependents
- `demo/scenes.ts` — 3 dependents
- `e2e/solana/helpers.ts` — 3 dependents
- `programs/healthaccess_audit/src/state.rs` — 3 dependents
- `project_management/planner.py` — 3 dependents
- `src/lib/outbox/store.ts` — 3 dependents
- `src/lib/solana/program.ts` — 3 dependents

## Dependency cycles (showing 1 of 1)
- `src/lib/solana/submitter.ts` ↔ `src/lib/solana/client.ts` ↔ `src/lib/solana/chain.ts`

## Top symbols (PageRank; showing 10 of 2293)
- `GitHubError` (project_management/github.py:10)
- `request` (project_management/github.py:42)
- `Task` (project_management/planner.py:9)
- `parse_task_refs` (project_management/planner.py:310)
- `_make_task` (project_management/tests/test_project_management.py:53)
- `canonical_bytes` (programs/healthaccess_audit/src/state.rs:122)
- `chain_head` (programs/healthaccess_audit/src/hash_chain.rs:28)
- `sync_checkboxes` (project_management/planner.py:208)
- `read_task` (project_management/planner.py:538)
- `graphql` (project_management/github.py:63)

## Cross-module bridges (showing 8 of 225)
- demo::sleep@human.ts:23:980 [move] ↔ demo::settle@human.ts:391:13300 [open] (14 edges)
- project_management/tests::_make_task@test_project_management.py:53:1333 [make] ↔ project_management/tests::task_state@project_management/planner.py:567:20818 (7 edges)
- project_management/tests::_make_task@test_project_management.py:53:1333 [make] ↔ project_management/tests::draft_task_to_project_fields@project_management/planner.py:640:23655 (6 edges)
- project_management::load_reports@bug_reports.py:41:724 [load,write,resolve] ↔ project_management::update_issue@github.py:140:5278 [update,add] (5 edges)
- project_management::load_reports@bug_reports.py:41:724 [load,write,resolve] ↔ project_management::request@github.py:42:1280 [create,remove,delete] (5 edges)
- project_management::update_issue@github.py:140:5278 [update,add] ↔ project_management::request@github.py:42:1280 [create,remove,delete] (4 edges)
- project_management/tests::_make_task@test_project_management.py:53:1333 [make] ↔ project_management/tests::schedule_warnings@project_management/planner.py:585:21378 (4 edges)
- project_management::load_reports@bug_reports.py:41:724 [load,write,resolve] ↔ project_management::graphql@github.py:63:2170 [set,get] (3 edges)
