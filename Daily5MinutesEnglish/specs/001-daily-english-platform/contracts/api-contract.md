# API Contract: Daily English Data Bridge

**Version**: 1.0  
**Date**: 2026-07-31  
**Endpoint**: `api.php` (production)  
**Reference**: [data-model.md](../data-model.md)

## Overview

The platform exposes a single JSON REST-like endpoint for reading and writing the entire application database. All requests require a shared API secret token. The client (`db-service.js`) wraps this in a Firebase-compatible mock API.

---

## Authentication

All requests MUST include:

```http
X-API-Token: daily-english-secure-2025-key
```

| Condition | Response |
|-----------|----------|
| Token missing or invalid | `401 Unauthorized` |

```json
{ "error": "Unauthorized — missing or invalid API token" }
```

> **Security note**: Token is currently hardcoded in client JS. Future task: move to environment config or server-generated session tokens.

---

## GET — Read Database

Retrieves the full `db.json` document.

### Request

```http
GET /api.php HTTP/1.1
X-API-Token: daily-english-secure-2025-key
```

### Response `200 OK`

```json
{
  "users": {
    "admins": { "...": "..." },
    "students": { "...": "..." }
  },
  "questions": { "...": "..." },
  "dailyResults": { "...": "..." },
  "config": {
    "quizSize": 5,
    "currentExamDate": "2026-07-31",
    "currentExamQuestions": ["q-1", "q-2"]
  }
}
```

### Error Responses

| Status | Body | Condition |
|--------|------|-----------|
| `401` | `{"error": "Unauthorized..."}` | Invalid token |
| `500` | `{"error": "Could not obtain read lock"}` | File lock failure |
| `200` | `{"status": "error", "message": "Database not found"}` | `db.json` missing |

---

## POST — Sync/Update Database

Merges incoming data into the existing database using field-specific rules. Does **not** blindly overwrite.

### Request

```http
POST /api.php HTTP/1.1
Content-Type: application/json
X-API-Token: daily-english-secure-2025-key

{ <partial or full db.json document> }
```

### Merge Rules

| Section | Merge behavior |
|---------|---------------|
| `users.students` | Upsert each student by ID; force `role: "student"` |
| `users.admins` | Upsert by ID; force `role: "teacher"`. **New** admin IDs require `X-Requesting-Admin` header with an existing admin UID |
| `dailyResults` | Deep merge by `studentId → date → result` |
| `questions` | Full replace (teacher write) |
| `config` | Full replace (teacher write) |

### Response `200 OK`

```json
{
  "status": "success",
  "synced_at": 1722403200
}
```

### Error Responses

| Status | Body | Condition |
|--------|------|-----------|
| `400` | `{"error": "Invalid JSON payload"}` | Malformed body |
| `401` | `{"error": "Unauthorized..."}` | Invalid token |
| `500` | `{"error": "Permission denied opening database"}` | File permission |
| `500` | `{"error": "Could not obtain write lock"}` | Lock timeout |

### Side Effects

- Auto-creates backup at `backups/db_YYYY-MM-DD_HH-mm-ss.json`
- Rotates backups — keeps last 5 only

---

## CORS

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, X-Requested-With, X-API-Token
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

Preflight `OPTIONS` requests return `200` with no body.

---

## Client Sync Protocol (`db-service.js`)

The client layer adds behavior on top of the raw API:

| Operation | Client method | Server call |
|-----------|--------------|-------------|
| Initial load | `DB.init()` | `GET api.php` → fallback `GET db.json` |
| Save changes | `DB.save()` | `POST api.php` with full local state |
| Real-time updates | 30s polling | `GET api.php` → merge into localStorage |
| Auth state | `auth.signInWithEmailAndPassword()` | Local lookup in `users` — no server auth endpoint |

### Fallback Chain

```
1. GET api.php (with token)
2. If fail → GET db.json (direct, no auth)
3. If fail → use localStorage cache
4. If fail → use defaultData seed
```

---

## Mock Firebase API Surface

`db-service.js` exposes these Firebase-compatible objects used by page scripts:

### `auth`

| Method | Signature | Behavior |
|--------|-----------|----------|
| `signInWithEmailAndPassword` | `(email, password) → Promise<{user}>` | Lookup user by email, verify password hash |
| `createUserWithEmailAndPassword` | `(email, password) → Promise<{user}>` | Create student in `users.students` |
| `signOut` | `() → void` | Clear `logged_user` from localStorage |
| `onAuthStateChanged` | `(callback) → unsubscribe` | Fire callback with current session |

### `rtdb` (Realtime Database mock)

| Method | Signature | Behavior |
|--------|-----------|----------|
| `ref(path)` | `(path) → MockRef` | Returns reference to JSON path |
| `MockRef.set(value)` | Write value at path | Updates local DB + triggers save |
| `MockRef.once('value')` | Read once | Returns snapshot at path |
| `MockRef.on('value', cb)` | Subscribe | Registers listener; fires on DB changes |
| `MockRef.off()` | Unsubscribe | Removes listener |

### `DB` (high-level controller)

| Method | Behavior |
|--------|----------|
| `init()` | Load + merge remote/local data |
| `get()` | Return current in-memory DB object |
| `save()` | POST to api.php |
| `notify()` | Fire all registered listeners |

---

## Deprecated Endpoint (Do Not Use in Production)

`server.js` exposes unauthenticated endpoints:

| Method | Path | Status |
|--------|------|--------|
| `GET` | `/api/db` | ⚠️ Deprecated — no auth, no locking |
| `POST` | `/api/db` | ⚠️ Deprecated — overwrites entire file |

Client code does **not** call these endpoints. Remove or align in implementation tasks.
