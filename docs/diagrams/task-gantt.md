# Task Timeline (Gantt)

_Auto-generated from the draft tasks in `docs/draft_tasks/`. Do not edit by hand._

Open in **[Mermaid Live](https://mermaid.live/edit#pako:eNqVVttu2zgQ_ZWBgQQuNq4lyte8OZZzAZrWG6cNdtEXWqItNpQokJSdbNGv2Nf9j773U_ZLdijZkpJNbMcwINMUz5yZOTPD741Ahqxx2ljSxJivCeDHcCMYTJX8xgIDtzxmgies2AupYedSxdQA_IGf1vV1y_eLPfrA9XbvaA5H4dek2NCIw2UCF3gY3JbPAq5xrYtdxy1tzZjJUjiGCyXxOZaJURT__vefv-EUQpmwEyAO6bWcYcvpnIAbbhAI-NTQOdUMxpHkAQOf6yDT1sr-0x7c8HTNFYORCiJukEmWLwxfoHn9MkK_QnjiH2nNArpYSLGF71TkfKb5MkEHC0f34Tpd-MgezPtvGn6DW8rFmichjGczXOqIhkHSzvihWD04o8E9Q4Cn0W5uTdzIDOlf0iQUTOmcpFphLPW7_eB9uH1M2SxQPEVcozjCY_oWfJkpal7NQh1iAJPZB54Y9G2qmDGcqbdCDGEq6ONa8WVkYEImcMu04cny5ZM9_L056Tpwwc1lNodRnkkN46v22Ic7qe4XQq7fpgCvdc6oldBG4K5bhn40vcLAjjITscTwYIdfwxo7AucKa8ECfL5CEa2YkGmMCNAcekfw6yeQQdtz7I9Qor_vEA6Fy1fPAL0toAdTNG0BvnC2zlNNUfovMnE7NSYduGYh8hbwURqmYc1NhBiaz7ng5rEoWSmgSdycV7dNOjtpEVIF0e3CmZDBfRBRnmAmUHoaPsjl8rUUEqdGrQdTMsV6MWtMGlzFqWA2RK-HuH76Sf46rSsM9rJQ3Qa9D581CvJGCmZLY0OudHfQzd11-22yOw3Eq1EewAzdZeY9l3CmJBY0LfTaHAyKtLp74zd4RYRdbLMCX1WPG2PDshqO4feM5ukaaY3FlWC_fDFApOKKbvkyyKqIHsPNZORfT6Dpkpxrp-3toTqsqBLb85ku0XCR0k2ZN50cz2kTbyee91r-PmF1qY0dgiEWNKFww1IJsxTdBuxwcCulKHTWdAupkjbmA59GhvJ_5lwHvzX6HlYkY38xQFNg1aJwUrBqYlU-uAdjdrZUsT-j-GLYzpGD0dwaWhemdohdUh3hTLSOXssww7legqEiDgXrgY86mePpT5mZy4c8hBu25yLTGO8ayc4-3FJUfTjLODpoozhKgkiq0vmK5uBgmgPbGxNm8JEK-VjD6B6MMXyeBVs1-i0J3XqHDXkDNRZ5r7VBmyQrjr28aN4lprMTs9YiPReFHMtVIbxLGbOYhqzeNt-glZIogTt7-9lm0sgc_VkcDg1mnW01Z-6oEJiYWmOtAfYPZlrWyBem-GI7QHEovkEuJVg3vyPkUs7mMS9ui_biKKS2tVNhegd73MOKC-6piSzUk4Z5aH3U0fo1tBpHSxkv0ff6ea_c5bYd_o2TxlLxsHFqVMZOGjHDy7pdNr7_wK2UJn9KGW938Q6-jBqnCyo0rrLUXv19Tq0Yild-_AewobpC)** (pako/zlib-compressed, verified to round-trip).

Regenerate whenever task metadata changes:

```bash
python3 -m project_management plan gantt --output docs/diagrams/task-gantt.md
```

## Legend

| Bar | Meaning |
|---|---|
| `✓` task | **done** — rendered in the mermaid `done` style |
| plain task | **active** — scheduled work (or in progress) |
| `(50% · 3/6 · doing)` | checkbox progress + status, same format as the dependency graph |

Same design as the dependency graph: every task ends on its deadline (or on the
earliest deadline of the tasks that depend on it); duration comes from the
Estimated Effort. Tasks are grouped into Gate sections. Tasks with no usable
date cannot be drawn as a bar — they are listed under the chart until they get
a **Deadline**. (Mermaid gantt has no 'skipped' row state.)

```mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Gate 1-Decisions
    01 Project Setup & Group Contract ✓ : done, 2026-09-04, 1d
    02 Database Choice Discussion ✓ : done, 2026-09-04, 1d
    03 Ripwire Architecture Artifacts ✓ : done, 2026-09-07, 1d
    section Gate 2-Scaffold
    04 Database Design & Setup ✓ : done, 2026-09-07, 1d
    05 Next.js + Tailwind CSS + shadcn/ui Setup ✓ : done, 2026-09-07, 1d
    06 Backend Project Setup (Next.js Route Handlers & Services) ✓ : done, 2026-09-07, 1d
    07 TypeScript Strict Configuration ✓ : done, 2026-09-07, 1d
    08 ESLint + Prettier Configuration ✓ : done, 2026-09-07, 1d
    09 Playwright E2E Testing ✓ : done, 2026-09-06, 2d
    10 GitHub Actions CI/CD Workflow ✓ : done, 2026-09-07, 1d
    section Gate 3-Features
    11 Backend API & Authentication ✓ : done, 2026-09-09, 2d
    12 Frontend UI Development (93% · 28/30 · doing) : active, 2026-09-09, 3d
    13 Patient View & Search ✓ : done, 2026-09-14, 2d
    14 Medical Notes with Visibility Control (21% · 5/24 · doing) : active, 2026-09-22, 1d
    15 Blockchain Access Logging ✓ : done, 2026-09-20, 2d
    16 P2P Network Implementation ✓ : done, 2026-09-20, 2d
    section Gate 4-Integration
    17 User Roles & Access Control (85% · 17/20 · doing) : active, 2026-09-23, 2d
    18 Socket.io Broadcasting (88% · 21/24 · doing) : active, 2026-09-28, 1d
    section Gate 5-Delivery
    19 Testing & Quality Assurance ✓ : done, 2026-09-22, 2d
    20 Documentation & README (12% · 4/34 · doing) : active, 2026-09-29, 1d
    21 Presentation Preparation (0% · 0/23 · doing) : active, 2026-09-30, 2d
    section Gate Other
    22 Solana Repo Split and Toolchain (11% · 2/18 · todo) : active, 2026-10-10, 1d
    23 Freeze the Interface Contract (0% · 0/21 · todo) : active, 2026-10-10, 1d
    24 Solana Program Scaffold (0% · 0/21 · todo) : active, 2026-10-11, 1d
    25 Pure Hash Chain Module (0% · 0/19 · todo) : active, 2026-10-11, 1d
    26 Durable Outbox and Solana Flusher (0% · 0/24 · todo) : active, 2026-10-11, 2d
    27 Build the Anchor Program (0% · 0/18 · todo) : active, 2026-10-11, 1d
    28 Devnet Deploy (0% · 0/15 · todo) : active, 2026-10-11, 1d
    29 Solana Program Tests (0% · 0/21 · todo) : active, 2026-10-10, 2d
    30 Solana Client and Environment (0% · 0/20 · todo) : active, 2026-10-12, 1d
    31 Remove the Homemade Blockchain (0% · 0/21 · todo) : active, 2026-10-11, 2d
    32 Wire Flusher to the Solana Program (0% · 0/15 · todo) : active, 2026-10-12, 1d
    33 Patient Wallet Integration (0% · 0/17 · todo) : active, 2026-10-11, 2d
    34 Solana Verification UI (0% · 0/18 · todo) : active, 2026-10-11, 2d
    35 E2E and Submission Disclosure (0% · 0/13 · todo) : active, 2026-10-12, 1d
    36 Hackathon Documentation (0% · 0/24 · todo) : active, 2026-10-12, 1d
    37 Hackathon Submission and Decks (0% · 0/23 · todo) : active, 2026-10-11, 3d
```
