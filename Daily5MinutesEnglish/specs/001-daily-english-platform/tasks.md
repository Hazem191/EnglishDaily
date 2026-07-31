# Tasks: Daily English Learning Platform

**Input**: Design documents from `/specs/001-daily-english-platform/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not explicitly requested in spec. Validation tasks reference `quickstart.md` manual scenarios. Playwright E2E included as optional polish task.

**Organization**: Tasks grouped by user story. Most features are **already implemented** — tasks focus on gap closure, hardening, and spec compliance validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US8)
- Include exact file paths in descriptions

## Path Conventions

- **Web app (MPA)**: HTML pages and `js/` modules at repository root
- **Backend**: `api.php`, `db.json` at repository root
- **Styles**: `css/style.css`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Remove dead code, align dependencies, establish dev workflow

- [x] T001 Remove unused `firebase` and `cors` dependencies from `package.json`
- [x] T002 [P] Delete stale file `temp_teacher.js` from repository root
- [x] T003 [P] Delete unused stub `js/firebase-config.js` and remove its `<script>` tags from all HTML pages
- [x] T004 [P] Add project `README.md` with PHP dev server instructions per `specs/001-daily-english-platform/quickstart.md`
- [x] T005 Update `render.yaml` to document PHP deployment target or add comment redirecting to Apache/`api.php` setup in `README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Security hardening and data-layer fixes that ALL user stories depend on

**⚠️ CRITICAL**: No user story gap-fix work should begin until this phase is complete

- [x] T006 Replace plain-text seed passwords with SHA-256 hashes in `db.json` and `js/db-service.js` defaultData admin entry
- [x] T007 Add role-guard redirect in `js/student.js` — reject users whose UID is not in `users.students`
- [x] T008 Add role-guard redirect in `js/teacher.js` — reject users whose UID is not in `users.admins`
- [x] T009 [P] Ensure `auth.js` login error messages are generic (no email-existence leak) in `js/auth.js` and `admin-login.html` inline script
- [x] T010 [P] Add `deny direct access` comment block to `server.js` warning that `db.json` is served statically without auth in Node dev mode
- [x] T011 Verify `api.php` admin-protection merge rule matches `specs/001-daily-english-platform/contracts/api-contract.md` and add teacher-create merge path if missing in `api.php`

**Checkpoint**: Foundation ready — user story validation and gap fixes can begin

---

## Phase 3: User Story 1 — Student Completes Daily Quiz (Priority: P1) 🎯 MVP

**Goal**: Student opens dashboard, completes today's shared quiz, sees score + review, cumulative points update; one attempt per day enforced

**Independent Test**: Register student → complete quiz → verify score and totalScore → refresh → see completion screen (quickstart Scenario 1 & 3)

### Implementation for User Story 1

- [x] T012 [US1] Add empty-state UI when question bank is empty or no exam available in `js/student.js` and `student.html` (bilingual `data-en`/`data-ar` strings)
- [x] T013 [US1] Implement mid-day exam republish rule in `js/student.js` — students with existing `dailyResults/{uid}/{today}` keep original score; unsubmitted students load new exam
- [x] T014 [US1] Add network-error handling on quiz submit in `js/student.js` — show error toast, preserve in-memory answers until retry succeeds
- [x] T015 [P] [US1] Verify progress indicator (`current / total`) and question type badges render for all 5 types in `js/student.js` and `student.html`
- [x] T016 [US1] Verify `getOrGenerateDailyExam()` in `js/db-service.js` falls back to auto-generate when `config.currentExamDate` is not today
- [x] T017 [US1] Verify one-quiz-per-day enforcement blocks retake when `dailyResults/{uid}/{today}` exists in `js/student.js`
- [x] T018 [US1] Run quickstart Scenarios 1 and 3 from `specs/001-daily-english-platform/quickstart.md` and fix any failures

**Checkpoint**: User Story 1 fully spec-compliant and independently testable

---

## Phase 4: User Story 2 — Student Registration and Profile (Priority: P1)

**Goal**: New learner registers, logs in, edits profile; email uniqueness and password rules enforced

**Independent Test**: Register → logout → login → edit display name → name updates on navbar (quickstart Scenario 1 steps 1–5)

### Implementation for User Story 2

- [x] T019 [US2] Verify email uniqueness check covers both `users.students` and `users.admins` in `js/auth.js` registration handler
- [x] T020 [US2] Verify minimum 6-character password validation with bilingual error message in `js/auth.js` and `login.html`
- [x] T021 [US2] Verify profile tab saves display name and shows email, totalScore, challenges-completed count in `js/student.js` and `student.html`
- [x] T022 [US2] Verify `createdAt` timestamp is set on student registration in `js/db-service.js` `createUserWithEmailAndPassword` path
- [x] T023 [US2] Run quickstart Scenario 1 registration steps and fix any failures in `login.html` / `js/auth.js`

**Checkpoint**: User Stories 1 AND 2 both independently functional

---

## Phase 5: User Story 3 — Teacher Publishes Daily Exam (Priority: P1)

**Goal**: Teacher sets quiz size, auto-generates or manually selects questions, publishes shared daily exam

**Independent Test**: Teacher publishes 5-question exam → new student sees exact same 5 questions (quickstart Scenario 2)

### Implementation for User Story 3

- [x] T024 [US3] Verify quiz size input enforces range 3–20 in `js/teacher.js` and `teacher.html` Daily Exam tab
- [x] T025 [US3] Add insufficient-pool warning toast when bank has fewer questions than `quizSize` in `js/teacher.js` (uses all available, warns teacher)
- [x] T026 [US3] Verify publish sets `config.currentExamDate` to today and `config.currentExamQuestions` to selected IDs in `js/teacher.js`
- [x] T027 [US3] Verify auto-generate selects random `quizSize` questions from `questions` bank in `js/teacher.js`
- [x] T028 [US3] Run quickstart Scenarios 2 and 3 from `specs/001-daily-english-platform/quickstart.md` and fix any failures

**Checkpoint**: All P1 user stories (US1, US2, US3) complete — **MVP ready**

---

## Phase 6: User Story 4 — Leaderboard and Competition (Priority: P2)

**Goal**: Public leaderboard ranks students by totalScore; top 3 podium; current user highlighted

**Independent Test**: 3 students with different scores → correct rank order + highlight when logged in (quickstart Scenario 4)

### Implementation for User Story 4

- [x] T029 [US4] Verify sort order descending by `totalScore` in `js/leaderboard.js`
- [x] T030 [US4] Verify podium renders top 3 with medal badges in `leaderboard.html` and `js/leaderboard.js`
- [x] T031 [US4] Verify logged-in student row highlight uses `logged_user` from localStorage in `js/leaderboard.js`
- [x] T032 [US4] Run quickstart Scenario 4 and fix any failures in `leaderboard.html` / `js/leaderboard.js`

**Checkpoint**: Leaderboard independently testable

---

## Phase 7: User Story 5 — Teacher Manages Question Bank (Priority: P2)

**Goal**: Teacher creates, views, deletes questions; MC validation prevents invalid correct answers

**Independent Test**: Create MC question → appears in bank → use in exam → delete (quickstart Scenario 5)

### Implementation for User Story 5

- [x] T033 [US5] Verify New Question form supports all 5 types with 2–6 dynamic options in `js/teacher.js` and `teacher.html`
- [x] T034 [US5] Verify correct-answer ∈ options validation blocks save for MC types in `js/teacher.js`
- [x] T035 [US5] Verify Manage Bank list and delete removes question from `questions` in `js/teacher.js`
- [x] T036 [US5] Run quickstart Scenario 5 and fix any failures

**Checkpoint**: Question bank CRUD independently testable

---

## Phase 8: User Story 6 — Teacher Monitors Learner Progress (Priority: P2)

**Goal**: Teacher sees aggregate stats and per-learner table with recent quiz history

**Independent Test**: 2+ students complete quiz → teacher Insights and Learners tabs show correct data (quickstart Scenario 6)

### Implementation for User Story 6

- [x] T037 [US6] Verify Insights stat cards (student count, pool size, today submissions, avg score) in `js/teacher.js` and `teacher.html`
- [x] T038 [US6] Verify Chart.js doughnut chart renders question-type distribution in `js/teacher.js`
- [x] T039 [US6] Verify Learners table shows name, email, totalScore, last 5 results per student in `js/teacher.js`
- [x] T040 [US6] Run quickstart Scenario 6 and fix any failures

**Checkpoint**: Teacher monitoring independently testable

---

## Phase 9: User Story 7 — Bilingual Experience and Accessibility (Priority: P2)

**Goal**: EN/AR toggle with RTL; light/dark theme; preferences persist across pages

**Independent Test**: Toggle AR + dark → navigate → refresh → preferences persist (quickstart Scenario 7)

### Implementation for User Story 7

- [x] T041 [P] [US7] Audit all 6 HTML pages for complete `data-en`/`data-ar` attribute pairs per `specs/001-daily-english-platform/contracts/ui-pages-contract.md`
- [x] T042 [US7] Verify `ui-sync.js` sets `dir="rtl"` and `lang="ar"` on `<html>` when Arabic selected in `js/ui-sync.js`
- [x] T043 [US7] Verify theme and language persist via `localStorage` across page navigation in `js/ui-sync.js`
- [x] T044 [US7] Run quickstart Scenario 7 and fix any missing translations or RTL layout issues in `css/style.css`

**Checkpoint**: Bilingual and theme support independently testable

---

## Phase 10: User Story 8 — Teacher System Administration (Priority: P3)

**Goal**: Export backup, reset today's exam, wipe results, create new teacher accounts

**Independent Test**: Export JSON → add teacher → login as new teacher → wipe results (quickstart Scenario 8)

### Implementation for User Story 8

- [x] T045 [US8] Verify export backup downloads full `db.json` content in `js/teacher.js` System tab
- [x] T046 [US8] Verify reset today's exam clears `config.currentExamDate` and `config.currentExamQuestions` in `js/teacher.js`
- [x] T047 [US8] Verify wipe all results clears `dailyResults` object in `js/teacher.js`
- [x] T048 [US8] Verify add-teacher form creates hashed-password entry in `users.admins` via `js/teacher.js` and confirm login works at `admin-login.html`

**Checkpoint**: System admin tools independently testable

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Mobile UX, marketing alignment, security, full validation

- [x] T049 [P] Audit responsive CSS at 320px viewport on all 6 HTML pages — fix horizontal scroll in `css/style.css`
- [x] T050 [P] Update landing page copy in `index.html` to remove unimplemented "listening practice" and "tailored to your class" claims (or mark as "coming soon")
- [x] T051 Verify smart Home redirect sends logged-in students to `student.html` and teachers to `teacher.html` in `js/ui-sync.js` (FR-030)
- [x] T052 [P] Add `.cursor/` or `backups/` to `.gitignore` if not already present to prevent credential/data leakage
- [x] T053 Run full quickstart validation checklist (all 10 scenarios) from `specs/001-daily-english-platform/quickstart.md` and document results
- [x] T054 [P] Optional: Add Playwright E2E smoke test for P1 flows (register → quiz → leaderboard) in `tests/e2e/daily-quiz.spec.js`

---

## Phase 12: Client Handoff Hardening

**Purpose**: Close gaps identified by `/speckit-analyze` before client delivery

- [x] T055 Hash plain-text passwords on disk in `db.json` via `scripts/migrate-db-passwords.js` and remove demo student with empty password
- [x] T056 Add confirm-password field to `login.html` and mismatch validation in `js/auth.js`
- [x] T057 Require `X-Requesting-Admin` header for new teacher account creation in `api.php`; send header from `js/db-service.js` sync
- [x] T058 [P] Align Playwright landing CTA with `index.html` ("Create student account") in `tests/e2e/daily-quiz.spec.js`
- [x] T059 [P] Update `plan.md` gap analysis and `validation-results.md` to reflect current implementation state
- [x] T060 [P] Document teacher login and password migration in `README.md`

---

## Phase 13: Delivery Polish (Security, Business, UI)

**Purpose**: Quick wins from `/speckit-analyze` before client handoff

- [x] T061 Block direct access to `backups/` directory in `.htaccess`
- [x] T062 [P] Add `favicon.svg` and link it from all 6 HTML pages
- [x] T063 Replace browser `confirm()` with bilingual `showConfirmDialog()` modal in `js/db-service.js` and `js/teacher.js`
- [x] T064 Add today's attendance report on teacher overview in `teacher.html` and `js/teacher.js`
- [x] T065 Add 5-minute quiz countdown timer in `student.html` and `js/student.js`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS** all user story work
- **User Stories (Phases 3–10)**: Depend on Phase 2 completion
  - P1 stories (Phases 3–5) should complete before P2/P3
  - P2 stories (Phases 6–9) can run in parallel after P1 MVP
  - P3 story (Phase 10) can run anytime after Phase 2
- **Polish (Phase 11)**: Depends on desired user stories being complete

### User Story Dependencies

| Story | Priority | Depends on | Can parallel with |
|-------|----------|-----------|-------------------|
| US1 Daily Quiz | P1 | Phase 2 | US2, US3 (after Phase 2) |
| US2 Registration | P1 | Phase 2 | US1, US3 |
| US3 Teacher Exam | P1 | Phase 2 | US1, US2 |
| US4 Leaderboard | P2 | US1 (needs scores) | US5, US6, US7 |
| US5 Question Bank | P2 | Phase 2 | US4, US6, US7 |
| US6 Teacher Insights | P2 | US1 (needs results) | US4, US5, US7 |
| US7 Bilingual/Theme | P2 | Phase 2 | US4, US5, US6 |
| US8 System Admin | P3 | Phase 2 | Any P2 story |

### Within Each User Story

- Gap-fix implementation tasks before quickstart validation task
- Each story ends with a quickstart scenario run task

### Parallel Opportunities

- **Phase 1**: T002, T003, T004 can run in parallel after T001
- **Phase 2**: T009, T010 can run in parallel
- **After Phase 2**: US1 + US2 + US3 can be worked in parallel (different JS files)
- **P2 stories**: US4, US5, US6, US7 can all run in parallel (different files)
- **Phase 11**: T049, T050, T052, T054 can run in parallel

---

## Parallel Example: P1 Stories (after Phase 2)

```bash
# Developer A — Daily Quiz gaps:
T012 Empty state in js/student.js
T013 Mid-day republish rule in js/student.js
T014 Network error handling in js/student.js

# Developer B — Registration gaps:
T019 Email uniqueness in js/auth.js
T020 Password validation in js/auth.js
T021 Profile tab in js/student.js

# Developer C — Teacher exam gaps:
T024 Quiz size range in js/teacher.js
T025 Insufficient pool warning in js/teacher.js
T026 Publish exam flow in js/teacher.js
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T011)
3. Complete Phases 3–5: US1 + US2 + US3 (T012–T028)
4. **STOP and VALIDATE**: Run quickstart Scenarios 1, 2, 3
5. Demo/deploy MVP

### Incremental Delivery

1. Setup + Foundational → stable base
2. P1 (US1–US3) → MVP daily learning loop
3. P2 (US4–US7) → gamification, content management, monitoring, i18n
4. P3 (US8) → admin tools
5. Polish → mobile, marketing, full validation

### Suggested MVP Scope

**Minimum viable product = Phases 1–5 (T001–T028)**:
- Student can register, take daily quiz, see score
- Teacher can publish daily exam
- Security hardened, dead code removed

---

## Notes

- Most tasks are **verify-and-fix** rather than greenfield — the codebase is ~90% complete
- Each story's final task runs the matching quickstart scenario as acceptance test
- No unit test tasks unless T054 (optional Playwright) is chosen
- Commit after each phase checkpoint
- Avoid editing `db.json` seed data structure — only hash passwords (T006)
