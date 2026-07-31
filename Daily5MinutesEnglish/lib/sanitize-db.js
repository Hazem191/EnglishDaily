/**
 * Remove sensitive fields before sending database JSON to browsers.
 */
function stripSensitiveFields(data) {
  if (!data || typeof data !== 'object') return data;
  const copy = JSON.parse(JSON.stringify(data));
  if (copy.users) {
    for (const role of ['admins', 'students']) {
      const bucket = copy.users[role];
      if (!bucket) continue;
      for (const id of Object.keys(bucket)) {
        if (bucket[id] && typeof bucket[id] === 'object') {
          delete bucket[id].password;
        }
      }
    }
  }
  return copy;
}

module.exports = { stripSensitiveFields };
