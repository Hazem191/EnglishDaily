# Quickstart: Daily English Learning Platform

**Date**: 2026-07-31  
**Purpose**: Runnable validation scenarios proving spec compliance end-to-end  
**Reference**: [spec.md](./spec.md) | [data-model.md](./data-model.md) | [contracts/](./contracts/)

## Prerequisites

1. **PHP 7.4+** installed (for `api.php`)
2. **Modern browser** (Chrome, Firefox, Edge, Safari)
3. Project files at repository root

### Start the Server

**Option A — PHP built-in server (recommended)**:

```bash
cd "D:\_iTi\_FreeLancing\Shrock Omran\Daily5MinutesEnglish"
php -S localhost:8080
```

Open: `http://localhost:8080`

**Option B — Node dev server** (static only; sync may not work without PHP):

```bash
npm install
npm start
```

Open: `http://localhost:3000`

> For full sync validation, use Option A. The client calls `api.php` for all data operations.

### Seed Data

The app ships with 100 questions in `db.json` and a default teacher account:

| Role | Email | Password |
|------|-------|----------|
| Teacher | `Shrouk@Admin.com` | `Shrouk@2003` |

---

## Scenario 1: Student Registration & First Quiz (P1)

**Validates**: US-1, US-2, FR-002, FR-005, FR-007, FR-008, SC-001

### Steps

1. Open `http://localhost:8080/index.html`
2. Click **"Get Started"** → arrives at `login.html`
3. Switch to **Register** tab
4. Enter: Name = `Test Student`, Email = `test@student.com`, Password = `test1234`
5. Submit → redirected to `student.html`
6. On **Daily Quiz** tab, verify:
   - Progress bar shows `1 / N`
   - Question type badge is visible
   - Answer options or text input appears
7. Answer all questions and click **Submit**
8. Verify:
   - Score displayed (e.g., `4 / 5`)
   - Per-question review shows ✓/✗
   - Navbar score pill updated
9. Refresh page → verify "Great Work!" completion screen (no retake)

### Expected Outcome

- Registration completes in < 2 minutes
- Full first quiz flow completes in < 7 minutes total (SC-001)
- `db.json` contains new student in `users.students` and result in `dailyResults`

---

## Scenario 2: Teacher Publishes Daily Exam (P1)

**Validates**: US-3, FR-010, FR-011, FR-012, SC-003

### Steps

1. Open `http://localhost:8080/admin-login.html`
2. Login: `Shrouk@Admin.com` / `Shrouk@2003`
3. Navigate to **Daily Exam** tab
4. Set quiz size to `5`
5. Click **Auto-Generate** → verify 5 questions appear in preview
6. Click **Publish This Exam**
7. Open a new browser tab (or incognito) → register a new student
8. Verify the student sees exactly the 5 published questions

### Expected Outcome

- Teacher publishes exam in < 3 minutes (SC-003)
- `config.currentExamDate` = today's date in `db.json`
- Student quiz matches published question IDs

---

## Scenario 3: One Quiz Per Day Enforcement (P1)

**Validates**: FR-009, edge case "already completed"

### Steps

1. Complete Scenario 1 (student has today's result)
2. Refresh `student.html`
3. Verify completion screen appears — no quiz questions shown
4. As teacher, go to **System** tab → click **Reset Today's Exam**
5. Refresh student page
6. Verify student can now take a new quiz

### Expected Outcome

- Retake blocked before reset
- Retake allowed after teacher reset

---

## Scenario 4: Leaderboard Ranking (P2)

**Validates**: US-4, FR-015, FR-016, SC-004

### Steps

1. Register 3 students with different names
2. Complete quizzes with varying scores (use different answer patterns)
3. Open `leaderboard.html`
4. Verify:
   - Students ranked by total score (highest first)
   - Top 3 shown on podium with medals
5. Log in as one student → revisit leaderboard
6. Verify that student's row is highlighted

### Expected Outcome

- Rankings correct
- Highlight visible for logged-in user
- Updates visible within 1 minute of submission (SC-004)

---

## Scenario 5: Question Bank Management (P2)

**Validates**: US-5, FR-013, FR-014

### Steps

1. Login as teacher → **New Question** tab
2. Create a multiple-choice question:
   - Text: `What color is the sky?`
   - Type: `multiple-choice`
   - Options: `Blue`, `Red`, `Green`
   - Correct answer: `Blue`
3. Submit → verify success toast
4. Go to **Manage Bank** → verify new question listed
5. Try creating a question with correct answer `Yellow` (not in options) → verify validation error
6. Use the new question in a daily exam → verify student sees it

### Expected Outcome

- CRUD works for questions
- MC validation prevents invalid correct answers

---

## Scenario 6: Teacher Insights & Learners (P2)

**Validates**: US-6, FR-017, FR-018, SC-009

### Steps

1. Ensure at least 2 students have completed today's quiz (from prior scenarios)
2. Login as teacher → **Insights** tab
3. Verify stat cards show:
   - Student count ≥ 2
   - Question pool count ≥ 100
   - Today's submissions ≥ 2
   - Average score is a percentage
4. Go to **Learners** tab
5. Verify each student shows name, email, score, and recent results

### Expected Outcome

- Teacher can identify student performance within 30 seconds (SC-009)

---

## Scenario 7: Bilingual & Theme Toggle (P2)

**Validates**: US-7, FR-022, FR-023, FR-024, SC-007

### Steps

1. Open any page
2. Click **AR** language toggle
3. Verify:
   - All labels switch to Arabic
   - Page direction becomes RTL (`dir="rtl"` on `<html>`)
4. Click **🌙** theme toggle
5. Verify dark theme applied
6. Navigate to another page (e.g., leaderboard)
7. Verify Arabic + dark theme persist
8. Close browser, reopen → verify preferences still active

### Expected Outcome

- Language and theme persist across 100% of navigations (SC-007)

---

## Scenario 8: System Administration (P3)

**Validates**: US-8, FR-019, FR-020, FR-021

### Steps

1. Login as teacher → **System** tab
2. Click **Export Backup** → verify JSON file downloads
3. Click **Add Teacher**:
   - Name: `New Teacher`, Email: `teacher2@test.com`, Password: `pass1234`
4. Logout → login at `admin-login.html` with new credentials
5. Verify access to `teacher.html`
6. Back as original teacher: click **Wipe All Results**
7. Verify leaderboard shows zero scores

### Expected Outcome

- Backup export works
- New teacher can log in
- Results wipe clears all `dailyResults`

---

## Scenario 9: Mobile Responsiveness (P2)

**Validates**: SC-010, mobile edge case

### Steps

1. Open browser DevTools → toggle device mode (iPhone SE, 320px width)
2. Navigate through: `index.html` → `login.html` → complete registration → take quiz → `leaderboard.html`
3. At each step verify:
   - No horizontal scrolling required
   - Buttons are tappable (not overlapping)
   - Text is readable without zooming

### Expected Outcome

- All core flows usable at 320px width without horizontal scroll

---

## Scenario 10: Multi-User Sync (P1)

**Validates**: FR-027, SC-005

### Steps

1. Open two browser windows side by side
2. Window A: Login as teacher, publish an exam
3. Window B: Login as student (different account), complete the quiz
4. Window A: Refresh **Learners** tab
5. Verify student's result appears within 30 seconds

### Expected Outcome

- Cross-user data visible after polling interval
- 95%+ submissions save on first attempt (SC-005)

---

## Validation Checklist

| # | Scenario | User Story | Pass? |
|---|----------|-----------|-------|
| 1 | Student registration & quiz | US-1, US-2 | ☐ |
| 2 | Teacher publishes exam | US-3 | ☐ |
| 3 | One quiz per day | FR-009 | ☐ |
| 4 | Leaderboard | US-4 | ☐ |
| 5 | Question bank | US-5 | ☐ |
| 6 | Teacher insights | US-6 | ☐ |
| 7 | Bilingual & theme | US-7 | ☐ |
| 8 | System admin | US-8 | ☐ |
| 9 | Mobile responsive | SC-010 | ☐ |
| 10 | Multi-user sync | FR-027 | ☐ |

Mark each scenario after running. All 10 must pass before considering the feature complete.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `api.php` returns 401 | Ensure PHP server is running; check `X-API-Token` in browser Network tab |
| Quiz shows no questions | Teacher must publish exam, or bank must have questions |
| Changes not syncing | Verify `api.php` is accessible; check browser console for fetch errors |
| Login fails after registration | Wait for `DB.init()` to complete; check `db.json` for new student entry |
| Dark theme not applying | Clear `localStorage` and retry; check `css/style.css` dark variables |
