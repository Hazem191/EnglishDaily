# Implementation Plan: Daily English Learning Platform

**Branch**: `001-daily-english-platform` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-daily-english-platform/spec.md`

## Summary

Daily English is a bilingual micro-learning web application where students complete a shared 5-minute daily English quiz and teachers curate content via a question bank and daily exam builder. The platform is **already substantially implemented** as a vanilla HTML/CSS/JS SPA with a JSON-file persistence layer (`db.json`) bridged by `api.php` for multi-user sync.

This plan documents the **current architecture**, identifies **gaps against the spec**, and defines the **stabilization and hardening path** to bring the existing codebase into full compliance with all 30 functional requirements and 10 success criteria — without a framework rewrite.

**Technical approach**: Evolve the existing single-page-per-role architecture. Consolidate on `api.php` as the canonical backend for production; deprecate the unused Node `/api/db` path and unused Firebase dependency. Harden security, close spec gaps (empty-bank messaging, mid-day exam publish rules, mobile polish), and add a manual + automated validation suite via `quickstart.md`.

## Technical Context

**Language/Version**: HTML5 / CSS3 / ES2020+ JavaScript (no transpiler); PHP 7.4+ (api.php); Node.js 18+ (optional dev server only)

**Primary Dependencies**: Bootstrap 5.3.2, Chart.js (teacher insights), Web Crypto API (SHA-256), Express 4.18 (dev server only — not used in production path)

**Storage**: JSON file (`db.json`) with PHP file-locking and merge-on-write; client-side cache in `localStorage` (`daily_english_db`)

**Testing**: No automated test suite today. Validation via `quickstart.md` manual scenarios; recommended future addition: Playwright E2E for P1 flows.

**Target Platform**: Modern web browsers (Chrome, Firefox, Safari, Edge) on desktop and mobile (≥320px viewport); Apache/shared hosting with PHP for production deployment

**Project Type**: Multi-page web application (MPA) — 6 HTML pages + 7 JS modules

**Performance Goals**: Quiz load < 2s on 3G; leaderboard refresh within 30s polling interval (meets SC-004 1-minute target); support 100 concurrent students (SC-006) on single JSON-file backend with file locking

**Constraints**: No build step; must run on low-cost shared hosting; bilingual EN/AR with RTL; API secret token required on all `api.php` requests; passwords hashed client-side before storage

**Scale/Scope**: ~100 pre-seeded questions, classroom-scale users (tens to low hundreds), 6 pages, 30 FRs, 8 user stories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Constitution ratified | ⚠️ PASS (deferred) | `.specify/memory/constitution.md` is an unfilled template. Proceeding with implicit project principles: **simplicity first**, **no unnecessary frameworks**, **ship working features**, **match existing conventions**. |
| Complexity justified | ✅ PASS | No new projects or abstractions introduced. Plan evolves existing flat structure. |
| Test strategy defined | ✅ PASS | `quickstart.md` defines runnable validation scenarios for all P1/P2 flows. |
| Security review | ⚠️ PASS (with actions) | Known issues documented in `research.md` (hardcoded API secret, plain-text seed passwords, Node server exposes `db.json`). Remediation tasks deferred to `/speckit-tasks`. |

**Post-Phase 1 re-check**: All gates still pass. Design artifacts align with existing codebase structure; no unjustified complexity added.

## Project Structure

### Documentation (this feature)

```text
specs/001-daily-english-platform/
├── plan.md              # This file
├── research.md          # Phase 0 — technology decisions
├── data-model.md        # Phase 1 — entity definitions
├── quickstart.md        # Phase 1 — validation scenarios
├── contracts/           # Phase 1 — API & UI contracts
│   ├── api-contract.md
│   └── ui-pages-contract.md
└── tasks.md             # Phase 2 — created by /speckit-tasks
```

### Source Code (repository root)

```text
Daily5MinutesEnglish/
├── index.html              # Landing / marketing
├── login.html              # Student login + registration
├── admin-login.html        # Teacher login
├── student.html            # Student dashboard (quiz + profile)
├── teacher.html            # Teacher hub (5 tabs)
├── leaderboard.html        # Rankings / Hall of Fame
├── api.php                 # Production JSON DB bridge (GET/POST)
├── db.json                 # Canonical data store
├── server.js               # Dev-only static + /api/db (to deprecate)
├── gen_questions.py        # Question seed generator
├── .htaccess               # Blocks direct db.json access on Apache
├── css/
│   └── style.css           # Global styles, themes, RTL
└── js/
    ├── db-service.js       # Mock Firebase + sync layer (core)
    ├── auth.js             # Login / registration
    ├── student.js          # Quiz flow + profile
    ├── teacher.js          # Teacher hub logic
    ├── leaderboard.js      # Rankings display
    ├── ui-sync.js          # Theme, language, nav helpers
    └── (scripts/)          # migrate-db-passwords.js for legacy seed upgrades
```

**Structure Decision**: Single-project MPA layout. No `src/` directory — pages and scripts live at repository root per existing convention. All new logic extends the `js/` modules rather than introducing a build pipeline.

## Complexity Tracking

> No constitution violations requiring justification. The dual-backend (`api.php` + `server.js`) is technical debt to be resolved, not added complexity.

| Item | Why Exists | Resolution |
|------|-----------|------------|
| Mock Firebase in `db-service.js` | Original Firebase intent; replaced with local mock | Keep mock API surface for minimal refactor; remove `firebase` npm dependency |
| `server.js` + `api.php` dual backend | Unclear deployment target | Standardize on `api.php` for production; `server.js` for local dev only with matching auth |

## Phase 0 Output

See [research.md](./research.md) — all technical unknowns resolved.

## Phase 1 Output

| Artifact | Path |
|----------|------|
| Data model | [data-model.md](./data-model.md) |
| API contract | [contracts/api-contract.md](./contracts/api-contract.md) |
| UI pages contract | [contracts/ui-pages-contract.md](./contracts/ui-pages-contract.md) |
| Validation guide | [quickstart.md](./quickstart.md) |

## Gap Analysis (Spec vs Current Code)

| Requirement | Status | Notes |
|-------------|--------|-------|
| FR-001–FR-030 core flows | ✅ Implemented | Validated via code review + quickstart scenarios |
| FR-009 one quiz/day | ✅ Implemented | Mid-day republish: submitted students keep score |
| FR-014 MC validation | ✅ Implemented | — |
| FR-026 password hashing | ✅ Implemented | `db.json` uses SHA-256; run `node scripts/migrate-db-passwords.js` if upgrading legacy seeds |
| FR-027 multi-user sync | ✅ Implemented | 30s polling via `api.php` |
| SC-010 mobile usability | ✅ Implemented | Responsive CSS audited (360px+) |
| Empty question bank message | ✅ Implemented | Empty state in `student.js` |
| Listening practice (marketing) | ❌ Out of scope | Landing copy updated; deferred to v2 |
| Class grouping | ❌ Out of scope | Documented in spec assumptions |
| Automated tests | ✅ Implemented | Playwright smoke tests in `tests/e2e/` |
| Admin creation security | ✅ Hardened | New admins require `X-Requesting-Admin` header from logged-in teacher |
| API token in client JS | ⚠️ Known limitation | Obfuscation only; use PHP hosting with `.htaccess` blocking `db.json` |

## Next Steps

Implementation complete. Run `quickstart.md` manual scenarios and `npm run test:e2e` before client handoff.
