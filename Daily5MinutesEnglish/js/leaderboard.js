/* ========================================
   Leaderboard Module
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async (user) => {
    let userData = null;
    if (user) {
      const data = DB.get();
      userData = data.users?.students?.[user.uid] || data.users?.admins?.[user.uid];
      if (userData) userData.id = user.uid;
    }
    setupRealtimeLeaderboard(userData);
  });
});

function setupRealtimeLeaderboard(currentUser) {
  const container = document.getElementById('leaderboard-container');

  // Sync listener
  rtdb.ref('users/students').on('value', (snapshot) => {
    if (!snapshot.exists()) {
      container.innerHTML = `<div class="text-center py-5"><p class="text-muted" data-en="No students yet." data-ar="لا يوجد طلاب بعد.">No students yet.</p></div>`;
      if (window.ui) ui.translate(container);
      return;
    }

    const students = [];
    snapshot.forEach(child => { students.push({ id: child.key, ...child.val() }); });

    // Sort
    students.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

    // Render podium
    renderPodium(students.slice(0, 3));

    // Render Table
    let html = `
      <div class="leaderboard-table-wrapper">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th data-en="Rank" data-ar="المركز">Rank</th>
              <th data-en="Student" data-ar="الطالب">Student</th>
              <th data-en="Total Score" data-ar="إجمالي النقاط">Total Score</th>
            </tr>
          </thead>
          <tbody>
    `;

    students.forEach((s, idx) => {
      const isMe = currentUser && s.id === currentUser.id;
      const rank = idx + 1;
      let badge = rank;
      if (rank === 1) badge = '🥇';
      else if (rank === 2) badge = '🥈';
      else if (rank === 3) badge = '🥉';

      html += `
        <tr class="${isMe ? 'highlight' : ''}">
          <td class="rank-number">${badge}</td>
          <td>
            <div class="student-name-cell">
              <div class="student-avatar" style="background:${isMe ? 'var(--primary)' : 'var(--bg-deep)'}">${getInitials(s.name)}</div>
              <div>
                <div class="fw-bold">${escapeHTML(s.name)} ${isMe ? `<span class="badge bg-primary ms-1" data-en="(You)" data-ar="(أنت)">(You)</span>` : ''}</div>
                <div class="text-dim small" style="font-size:0.75rem">${s.level || 'Beginner'}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="score-badge">${s.totalScore || 0} <span style="font-size:0.7em">pts</span></span>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
    if (window.ui) ui.translate(container);
  });
}

function renderPodium(top3) {
  const container = document.getElementById('podium-container');
  if (!container) return;

  const [one, two, three] = top3;
  let html = '';

  // Order: 2, 1, 3 for visual pyramid
  if (two) html += renderPodiumCard(two, 2, 'second');
  if (one) html += renderPodiumCard(one, '👑', 'first');
  if (three) html += renderPodiumCard(three, 3, 'third');

  container.innerHTML = html;
  if (window.ui) ui.translate(container);
}

function renderPodiumCard(s, rank, cls) {
  return `
    <div class="podium-card ${cls} animate-up">
      <div class="podium-rank">${rank}</div>
      <div class="podium-avatar">${getInitials(s.name)}</div>
      <div class="podium-name">${escapeHTML(s.name)}</div>
      <div class="podium-score">${s.totalScore || 0} pts</div>
    </div>
  `;
}

function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}
