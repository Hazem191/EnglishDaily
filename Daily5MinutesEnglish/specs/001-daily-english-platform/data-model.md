# Data Model: Daily English Learning Platform

**Date**: 2026-07-31  
**Feature**: `001-daily-english-platform`  
**Storage**: `db.json` (canonical) + `localStorage` cache (`daily_english_db`)

## Root Document Schema

```json
{
  "users": {
    "admins": { "<adminId>": Admin },
    "students": { "<studentId>": Student }
  },
  "questions": { "<questionId>": Question },
  "dailyResults": {
    "<studentId>": {
      "<YYYY-MM-DD>": QuizResult
    }
  },
  "config": PlatformConfig
}
```

---

## Entity: Student

**Path**: `users.students.{studentId}`  
**ID format**: Auto-generated UID (e.g., `stu-abc123`)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `id` | string | ✅ | Matches parent key | Same as map key |
| `name` | string | ✅ | Non-empty, max 100 chars | Display name; editable in profile |
| `email` | string | ✅ | Valid email format, unique across all users | Used for login lookup |
| `password` | string | ✅ | SHA-256 hex (64 chars) after first login | Hashed client-side via `hashPassword()` |
| `role` | string | ✅ | Must be `"student"` | Enforced server-side in `api.php` merge |
| `totalScore` | number | ✅ | ≥ 0, integer | Cumulative points from all quizzes |
| `createdAt` | number | ❌ | Unix timestamp ms | Set on registration |

**State transitions**:
```
[New] --register--> [Active] --complete quiz--> [Active, totalScore += score]
                  --edit profile--> [Active, name updated]
```

**Business rules**:
- One quiz result per calendar day (enforced in `student.js` via `dailyResults/{id}/{date}` check).
- Email uniqueness checked at registration time against both `students` and `admins`.
- `level` field referenced in leaderboard UI but **not stored** — defaults to `"Beginner"` (future feature).

---

## Entity: Teacher (Admin)

**Path**: `users.admins.{adminId}`  
**ID format**: Auto-generated UID or fixed seed ID (e.g., `admin-main`)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `id` | string | ✅ | Matches parent key | — |
| `name` | string | ✅ | Non-empty | Display name |
| `email` | string | ✅ | Valid email, unique | Login via `admin-login.html` |
| `password` | string | ✅ | SHA-256 hex after first login | — |
| `role` | string | ✅ | Must be `"teacher"` | — |
| `createdAt` | number | ❌ | Unix timestamp ms | Set when created via System tab |

**Business rules**:
- Admin section protected in `api.php` — cannot be overwritten by student API payloads.
- New teachers created via teacher System tab; must log in separately at `admin-login.html`.
- Role check on login: UID must exist in `users.admins`.

---

## Entity: Question

**Path**: `questions.{questionId}`  
**ID format**: Auto-generated (e.g., `q-1704067200000`)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `questionText` | string | ✅ | Non-empty | The question prompt |
| `type` | enum | ✅ | One of 5 types (see below) | Determines UI rendering |
| `options` | string[] | ⚠️ | 2–6 items when present | Required for MC types; optional for free-text types |
| `correctAnswer` | string | ✅ | Must match one option for MC types | Case-sensitive comparison |
| `createdAt` | number | ✅ | Unix timestamp ms | — |
| `createdBy` | string | ❌ | Valid admin UID | Set when teacher creates via UI |

**Question types** (`type` enum):
| Value | UI behavior | Options required |
|-------|-------------|-----------------|
| `grammar` | Multiple choice buttons | ✅ Recommended |
| `vocabulary` | Multiple choice buttons | ✅ Recommended |
| `multiple-choice` | Multiple choice buttons | ✅ Required |
| `sentence-ordering` | MC or free-text | ⚠️ Optional |
| `error-correction` | MC or free-text | ⚠️ Optional |

**Business rules**:
- Teacher form validates `correctAnswer ∈ options` for types with options.
- Deleting a question removes it from bank; may invalidate today's exam if question was selected.
- Seeded bank: 100 questions (20 per type) via `gen_questions.py`.

---

## Entity: Quiz Result

**Path**: `dailyResults.{studentId}.{YYYY-MM-DD}`

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `score` | number | ✅ | 0 ≤ score ≤ total | Points earned |
| `total` | number | ✅ | > 0 | Number of questions in exam |
| `timestamp` | number | ✅ | Unix timestamp ms | Submission time |

**Business rules**:
- **Immutable after creation** — one record per student per date; retakes blocked (FR-009).
- On submit: `student.totalScore += result.score`.
- Mid-day exam republish: students who already have a result for today keep their original score; only unsubmitted students see the new exam.

**State transitions**:
```
[No result for today] --submit quiz--> [Result saved, totalScore updated]
[Result exists] --open dashboard--> [Show completion screen, no retake]
```

---

## Entity: Platform Config (Daily Exam)

**Path**: `config`

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `quizSize` | number | ✅ | 3–20 | Default: 5 |
| `currentExamDate` | string \| null | ✅ | ISO date `YYYY-MM-DD` or null | Date exam was published for |
| `currentExamQuestions` | string[] | ✅ | Array of question IDs | Length ≤ quizSize |

**Business rules**:
- When teacher publishes: `currentExamDate = today`, `currentExamQuestions = selected IDs`.
- When student loads quiz: if `currentExamDate === today`, use `currentExamQuestions`; else auto-generate from bank.
- If bank has fewer questions than `quizSize`, use all available and warn teacher.
- Teacher "Reset Today's Exam" clears `currentExamDate` and `currentExamQuestions`, allowing retakes.

**Relationship to Daily Exam concept**:
```
PlatformConfig (when currentExamDate = today)
  └── currentExamQuestions[] → references Question entities
```

---

## Entity Relationships

```text
Teacher ──creates──> Question
Teacher ──publishes──> PlatformConfig (daily exam selection)
Student ──completes──> QuizResult (per day)
QuizResult ──references──> Question[] (via exam at time of completion)
Student ──accumulates──> totalScore (from QuizResult.score)
Leaderboard ──sorts──> Student[] by totalScore DESC
```

---

## Client-Side Cache Keys (localStorage)

| Key | Type | Purpose |
|-----|------|---------|
| `daily_english_db` | JSON string | Full DB snapshot for offline read |
| `daily_english_db_version` | string | Schema version (`"8"`); triggers migration on change |
| `logged_user` | JSON `{uid, email}` | Active session |
| `theme` | string | `"light"` or `"dark"` |
| `lang` | string | `"en"` or `"ar"` |

---

## Server-Side Files

| File | Purpose |
|------|---------|
| `db.json` | Canonical data store |
| `backups/db_YYYY-MM-DD_HH-mm-ss.json` | Auto-rotated backups (last 5 kept) |

---

## Validation Rules Summary

| Rule | Enforced by |
|------|-------------|
| Student role cannot escalate to admin | `api.php` merge (forces `role: "student"`) |
| Admin section protected from client overwrite | `api.php` merge |
| Password minimum 6 characters | `auth.js` registration form |
| Email uniqueness | `auth.js` registration lookup |
| MC correct answer ∈ options | `teacher.js` form validation |
| Quiz size 3–20 | `teacher.js` input constraints |
| One quiz per day per student | `student.js` result check before quiz render |
| API token required | `api.php` auth guard + `db-service.js` fetch headers |
