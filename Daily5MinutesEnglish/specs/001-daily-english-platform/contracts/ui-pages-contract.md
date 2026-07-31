# UI Pages Contract: Daily English Learning Platform

**Version**: 1.0  
**Date**: 2026-07-31  
**Reference**: [spec.md](../spec.md) user stories

## Global UI Elements

Present on all pages unless noted:

| Element | ID / Class | Behavior |
|---------|-----------|----------|
| Brand logo | `.brand` | Links to `index.html`; smart redirect if logged in (via `ui-sync.js`) |
| Theme toggle | `#theme-toggle` | Toggles `light`/`dark`; persists to `localStorage.theme` |
| Language toggle | `#lang-toggle` | Toggles `en`/`ar`; sets `dir` and `lang` on `<html>`; persists to `localStorage.lang` |
| Navbar | `.navbar` | Responsive; collapses on mobile |

**Bilingual pattern**: All translatable text uses `data-en` and `data-ar` attributes. `ui-sync.js` swaps text content on language change.

---

## Page: Landing (`index.html`)

**Access**: Public  
**Maps to**: FR-001

| Section | Content | Actions |
|---------|---------|---------|
| Hero | Product tagline, CTA | "Start Today Free" → `login.html` |
| Features | 3–4 feature cards | Anchor scroll |
| Navbar | Rankings link | → `leaderboard.html` |

**Expected states**:
- Logged-in user clicking "Get Started" → redirected to their dashboard (via `ui-sync.js`)

---

## Page: Student Login (`login.html`)

**Access**: Public  
**Maps to**: FR-002, FR-003 (student), US-2

| Tab | Fields | Submit behavior |
|-----|--------|----------------|
| Login | email, password | `auth.signInWithEmailAndPassword` → redirect to `student.html` |
| Register | name, email, password | `auth.createUserWithEmailAndPassword` → create student → redirect |

| Validation | Error display |
|------------|--------------|
| Empty fields | `#login-error` or `#register-error` |
| Duplicate email | "Email already registered" |
| Password < 6 chars | "Password must be at least 6 characters" |
| Wrong credentials | Generic error (no email existence leak) |

**Footer link**: "Teacher/Administrator Access" → `admin-login.html`

---

## Page: Admin Login (`admin-login.html`)

**Access**: Public (teacher-only)  
**Maps to**: FR-003 (teacher), FR-004

| Fields | Submit behavior |
|--------|----------------|
| email, password | Verify UID in `users.admins` → redirect to `teacher.html` |

**Expected states**:
- Valid student credentials → error (not in admins)
- Valid admin credentials → `teacher.html`

---

## Page: Student Dashboard (`student.html`)

**Access**: Authenticated students only  
**Maps to**: FR-005–FR-009, FR-025, FR-028, FR-029, US-1, US-2

### Tab: Daily Quiz

| State | UI shown |
|-------|----------|
| Loading | Spinner |
| Quiz available | Progress bar, question counter, type badge, answer options/input, Submit button |
| Already completed | "Great Work!" card with score; no retake option |
| No questions available | Friendly empty-state message (gap — to implement) |
| Submitting | Disabled submit, spinner |

**Quiz interaction contract**:

| Question type | Input widget |
|--------------|-------------|
| grammar, vocabulary, multiple-choice | Button per option (single select) |
| sentence-ordering, error-correction (with options) | Button per option |
| Any type without options | Text input field |

**On submit**:
1. Calculate score (1 point per correct answer)
2. Save to `dailyResults/{uid}/{today}`
3. Increment `totalScore`
4. Show results review (correct ✓ / incorrect ✗ per question)
5. Sync to server

### Tab: Profile

| Field | Editable | Display |
|-------|----------|---------|
| Display name | ✅ | Input + Save button |
| Email | ❌ (read-only) | Text |
| Total points | ❌ | Number from `totalScore` |
| Challenges completed | ❌ | Count of `dailyResults` entries |

**Navbar**: Score pill showing `totalScore`; Sign Out button.

---

## Page: Teacher Hub (`teacher.html`)

**Access**: Authenticated teachers only  
**Maps to**: FR-010–FR-021, US-3, US-5, US-6, US-8

### Tab: Insights

| Stat card | Data source |
|-----------|------------|
| Active students | Count of `users.students` |
| Question pool | Count of `questions` |
| Today's submissions | Count of `dailyResults.*.{today}` |
| Average score today | Mean of today's `score/total` ratios |
| Chart | Doughnut chart of question types (Chart.js) |

### Tab: Daily Exam

| Control | Behavior |
|---------|----------|
| Quiz size input | Range 3–20; updates `config.quizSize` |
| Auto-generate button | Random selection of `quizSize` questions from bank |
| Question checklist | Manual select/deselect individual questions |
| Publish button | Sets `config.currentExamDate = today`, `config.currentExamQuestions = selected IDs` |
| Preview area | Shows selected questions before publish |

### Tab: New Question

| Field | Validation |
|-------|-----------|
| Question text | Required |
| Type | Dropdown: 5 types |
| Options (dynamic) | 2–6 addable fields |
| Correct answer | Required; must match an option for MC types |

### Tab: Manage Bank

| Column | Actions |
|--------|---------|
| Question text, type, options count | Delete button per row |

### Tab: Learners

| Column | Data |
|--------|------|
| Name | `student.name` |
| Email | `student.email` |
| Total score | `student.totalScore` |
| Recent results | Last 5 entries from `dailyResults/{id}` |

### Tab: System

| Action | Behavior |
|--------|----------|
| Export backup | Download `db.json` as file |
| Reset today's exam | Clear `config.currentExamDate` and `currentExamQuestions` |
| Wipe all results | Clear entire `dailyResults` object |
| Add teacher | Form: name, email, password → create in `users.admins` |

---

## Page: Leaderboard (`leaderboard.html`)

**Access**: Public (enhanced when logged in)  
**Maps to**: FR-015, FR-016, US-4

| Section | Content |
|---------|---------|
| Podium | Top 3 students by `totalScore` with medals 🥇🥈🥉 |
| Table | All students ranked; columns: rank, name, level (default "Beginner"), score |
| Highlight | Current user's row styled distinctly when `logged_user` exists |

**Update frequency**: Reflects data on page load + 30s polling if `db-service.js` listener active.

---

## Responsive Breakpoints

| Viewport | Requirement |
|----------|------------|
| ≥ 992px (desktop) | Full layout, side-by-side panels |
| ≥ 768px (tablet) | Stacked cards, readable tables |
| ≥ 320px (mobile) | No horizontal scroll; touch-friendly buttons (min 44px); collapsible nav |

**Maps to**: SC-010, edge case "mobile browser access"

---

## Navigation Flow

```text
index.html
  ├── login.html ──register──> student.html
  │                └──login──> student.html
  ├── admin-login.html ──login──> teacher.html
  └── leaderboard.html

student.html ──sign out──> login.html
teacher.html ──sign out──> admin-login.html

Any page: "Home" / brand click
  ├── logged in as student → student.html
  ├── logged in as teacher → teacher.html
  └── not logged in → index.html
```

---

## Error & Empty States

| Scenario | Page | Expected UI |
|----------|------|-------------|
| Network error on submit | student.html | Error toast; answers preserved in memory |
| Empty question bank | student.html | "No quiz available yet" message |
| Bank < quiz size | teacher.html | Warning toast; uses all available |
| Unauthorized page access | any protected | Redirect to appropriate login page |
| Session expired | any protected | Redirect to login; clear `logged_user` |
