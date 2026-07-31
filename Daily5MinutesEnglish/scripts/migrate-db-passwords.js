/**
 * Hash plain-text passwords in db.json (reads secrets from file, not CLI).
 * Run: node scripts/migrate-db-passwords.js
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const dbFile = path.join(__dirname, '..', 'db.json');
const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));

function isHashed(value) {
  return typeof value === 'string' && value.length === 64 && /^[0-9a-f]+$/i.test(value);
}

let hashedCount = 0;
let removedStudents = 0;

for (const role of ['admins', 'students']) {
  const users = data.users?.[role];
  if (!users) continue;

  for (const [id, user] of Object.entries(users)) {
    const password = user.password ?? '';

    if (role === 'students' && password === '') {
      delete users[id];
      removedStudents++;
      continue;
    }

    if (password && !isHashed(password)) {
      users[id].password = crypto.createHash('sha256').update(password).digest('hex');
      hashedCount++;
    }
  }
}

fs.writeFileSync(dbFile, JSON.stringify(data, null, 4));
console.log(`Done: ${hashedCount} hashed, ${removedStudents} empty student(s) removed.`);
