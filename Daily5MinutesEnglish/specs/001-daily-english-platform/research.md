# Research: Daily English Learning Platform

**Date**: 2026-07-31  
**Feature**: `001-daily-english-platform`

## R-001: Backend Persistence Strategy

**Decision**: Keep JSON file storage (`db.json`) with `api.php` as the production sync bridge.

**Rationale**:
- Already implemented and working with file locking, merge logic, and auto-backup (last 5).
- Suitable for classroom scale (tens to low hundreds of concurrent users).
- Compatible with low-cost shared hosting (Apache + PHP) — the likely deployment target given `.htaccess`.
- No database server setup or hosting cost increase.

**Alternatives considered**:
| Alternative | Rejected because |
|-------------|-----------------|
| Real Firebase | Listed in `package.json` but never wired; mock layer already provides Firebase-compatible API |
| SQLite via PHP | Adds complexity; JSON merge logic already handles concurrent writes adequately at this scale |
| PostgreSQL + Node API | Requires build pipeline and paid hosting; overkill for classroom MVP |
| Node `server.js` only | No file locking, no auth token, serves `db.json` statically — insecure for production |

---

## R-002: Frontend Architecture

**Decision**: Retain vanilla HTML/CSS/JS multi-page application (no framework migration).

**Rationale**:
- Entire app is already built and functional across 6 pages and 7 JS modules.
- No build step means teachers/students can use it immediately on any hosting.
- Bootstrap 5 provides responsive grid and components.
- Bilingual toggle and RTL are implemented in `ui-sync.js` without i18n library overhead.

**Alternatives considered**:
| Alternative | Rejected because |
|-------------|-----------------|
| React/Vue SPA | Full rewrite; no business value for current scope |
| Next.js | Requires Node hosting; conflicts with PHP deployment path |
| PWA with service worker | Out of scope per spec assumptions; adds offline complexity |

---

## R-003: Authentication & Password Security

**Decision**: Continue client-side SHA-256 hashing via Web Crypto API; session in `localStorage` (`logged_user`).

**Rationale**:
- `hashPassword()` and `isHashed()` already in `db-service.js` with auto-upgrade from plain-text on login.
- Classroom-trusted environment; no payment or PII beyond name/email.
- Separate student (`login.html`) and teacher (`admin-login.html`) portals enforce role separation.

**Alternatives considered**:
| Alternative | Rejected because |
|-------------|-----------------|
| bcrypt server-side | No server-side auth endpoint exists; would require PHP auth layer |
| JWT tokens | Overkill for file-based JSON store at this scale |
| OAuth2 / Google login | Out of scope per spec assumptions |

**Known limitation**: SHA-256 without salt is weak against rainbow tables. Acceptable for classroom MVP; upgrade path documented for future `speckit-tasks`.

---

## R-004: Real-Time Data Synchronization

**Decision**: Keep 30-second polling interval in `db-service.js` for `dailyResults` and student profile updates.

**Rationale**:
- Meets SC-004 (leaderboard updates within 1 minute).
- Simpler than WebSockets on shared PHP hosting.
- `DB.init()` merges local and remote state with `_deepMergeDefaults()` to prevent data loss.

**Alternatives considered**:
| Alternative | Rejected because |
|-------------|-----------------|
| WebSockets | Not supported on basic shared hosting |
| Server-Sent Events | Requires persistent PHP process |
| Firebase Realtime listeners | Firebase not actually connected |
| Manual refresh only | Poor UX for competitive leaderboard |

---

## R-005: Deployment Target

**Decision**: Primary deployment = Apache + PHP (shared hosting); secondary = Node dev server for local development only.

**Rationale**:
- `.htaccess` blocks direct `db.json` access — Apache-specific.
- `api.php` has CORS, auth token, file locking, backup rotation.
- `render.yaml` references Node but app code calls `api.php`, not `/api/db` — deployment config is inconsistent and must be aligned in tasks phase.

**Alternatives considered**:
| Alternative | Rejected because |
|-------------|-----------------|
| Render Node-only | Client code doesn't use `/api/db`; would break sync |
| Vercel/Netlify static | No PHP support for `api.php` |

---

## R-006: Question Types & Scoring

**Decision**: Support five types with unified scoring: 1 point per correct answer; free-text fallback when no `options` array.

**Rationale**:
- Types already defined in seed data and `gen_questions.py`: grammar, vocabulary, sentence-ordering, multiple-choice, error-correction.
- `student.js` renders MC buttons when options exist, text input otherwise.
- Teacher form validates correct answer ∈ options for MC types.

**Alternatives considered**:
| Alternative | Rejected because |
|-------------|-----------------|
| Weighted scoring by difficulty | No difficulty field exists; out of spec scope |
| Partial credit | Adds complexity; spec requires simple score/total |

---

## R-007: Testing Strategy

**Decision**: Manual validation via `quickstart.md` for Phase 1; recommend Playwright E2E in tasks phase for P1 regression.

**Rationale**:
- No test infrastructure exists today.
- Quickstart scenarios map directly to user stories and acceptance criteria.
- Playwright can test multi-page flows without a build step.

**Alternatives considered**:
| Alternative | Rejected because |
|-------------|-----------------|
| Jest unit tests | No module bundler; functions are not exported |
| Cypress | Heavier setup; Playwright has better multi-tab support for teacher+student flows |
| No testing | Violates quality gate; spec has 30 testable FRs |

---

## R-008: Bilingual & RTL Support

**Decision**: Keep `data-en` / `data-ar` attribute pattern in HTML with `ui-sync.js` toggle; CSS `[dir="rtl"]` overrides.

**Rationale**:
- Already implemented across all pages.
- Preferences persist in `localStorage` (`lang`, `theme`).
- No i18n library needed for two languages.

**Alternatives considered**:
| Alternative | Rejected because |
|-------------|-----------------|
| i18next | Overkill for 2 languages with static copy |
| Separate AR pages | Doubles maintenance burden |

---

## R-009: Marketing vs Implementation Gaps

**Decision**: Defer listening practice and class grouping to v2; update landing page copy to match implemented features OR flag as future roadmap items.

**Rationale**:
- Spec explicitly scopes these out in Assumptions section.
- Implementing audio questions requires new question type, media storage, and player UI — significant scope increase.
- Class grouping requires new entity, teacher assignment UI, and per-class exam logic.

**Alternatives considered**:
| Alternative | Rejected because |
|-------------|-----------------|
| Implement listening now | Out of spec scope; would delay P1 stabilization |
| Remove marketing claims silently | Misleading; better to align copy in tasks phase |

---

## Summary

All technical unknowns from the implementation context are resolved. The project follows a **JSON-file + PHP bridge + vanilla JS MPA** architecture that is appropriate for its classroom-scale deployment target. The primary work ahead is **gap closure, security hardening, deployment alignment, and test coverage** — not architectural redesign.
