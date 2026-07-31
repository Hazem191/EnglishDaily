# Daily English (Daily5MinutesEnglish)

A bilingual micro-learning web app for daily 5-minute English quizzes. Students complete shared daily challenges; teachers curate questions and publish exams.

## Quick Start (Recommended)

Requires **PHP 7.4+** for multi-user data sync via `api.php`.

```bash
cd Daily5MinutesEnglish
php -S localhost:8080
```

Open [http://localhost:8080](http://localhost:8080)

### Default Teacher Account

| Field | Value |
|-------|-------|
| Email | `Shrouk@admin.com` |
| Password | Set in `db.json` (contact project owner for initial password) |

Passwords are stored as SHA-256 hashes. If upgrading from a legacy plain-text seed, run:

```bash
node scripts/migrate-db-passwords.js
```

Teacher login: [http://localhost:8080/admin-login.html](http://localhost:8080/admin-login.html)

## Alternative: Node Dev Server

```bash
npm install
npm start
```

> **Warning**: The Node server (`server.js`) serves static files only and does **not** provide the secured `api.php` sync bridge. Use PHP for full functionality.

## Production Deployment

**Primary target**: Apache + PHP shared hosting

1. Upload all files to your web root
2. Ensure `.htaccess` is active (blocks direct `db.json` access)
3. Ensure `api.php` and `db.json` are writable by PHP
4. Access the app via your domain

`render.yaml` is provided for optional Node static hosting but **does not** replace `api.php` for production sync. For production, deploy to PHP-capable hosting.

## Project Structure

```
index.html          Landing page
login.html          Student login + registration
admin-login.html    Teacher login
student.html        Student dashboard (quiz + profile)
teacher.html        Teacher hub
leaderboard.html    Rankings
api.php             JSON database bridge (production)
db.json             Data store
js/                 Application modules
css/style.css       Global styles
```

## Validation

See [specs/001-daily-english-platform/quickstart.md](specs/001-daily-english-platform/quickstart.md) for end-to-end test scenarios.

## Spec Kit

This project uses [GitHub Spec Kit](https://github.com/github/spec-kit) for spec-driven development:

- Spec: `specs/001-daily-english-platform/spec.md`
- Plan: `specs/001-daily-english-platform/plan.md`
- Tasks: `specs/001-daily-english-platform/tasks.md`
