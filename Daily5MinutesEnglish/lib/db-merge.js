/**
 * Server-side merge logic — mirrors api.php behaviour for Vercel serverless.
 */

function mergeDatabase(currentState, inputData, requestingAdmin) {
  const state = currentState && typeof currentState === 'object' ? { ...currentState } : {};

  if (!state.users) state.users = {};
  if (!state.users.students) state.users.students = {};
  if (!state.users.admins) state.users.admins = {};
  if (!state.dailyResults) state.dailyResults = {};
  if (!state.questions) state.questions = state.questions || {};
  if (!state.config) state.config = state.config || {};

  if (inputData.users?.students) {
    for (const [id, user] of Object.entries(inputData.users.students)) {
      state.users.students[id] = { ...user, role: 'student' };
    }
  }

  if (inputData.dailyResults) {
    for (const [uid, results] of Object.entries(inputData.dailyResults)) {
      if (!state.dailyResults[uid]) state.dailyResults[uid] = {};
      for (const [date, res] of Object.entries(results)) {
        state.dailyResults[uid][date] = res;
      }
    }
  }

  if (inputData.questions) {
    state.questions = inputData.questions;
  }

  if (inputData.config) {
    state.config = inputData.config;
  }

  if (inputData.users?.admins) {
    for (const [id, admin] of Object.entries(inputData.users.admins)) {
      const isNew = !state.users.admins[id];
      if (isNew) {
        if (!requestingAdmin || !state.users.admins[requestingAdmin]) {
          continue;
        }
      }
      state.users.admins[id] = { ...admin, role: 'teacher' };
    }
  }

  return state;
}

module.exports = { mergeDatabase };
