/* ========================================
   Student Module - Daily Quiz
   ======================================== */

const TYPE_LABELS = {
    'vocabulary': 'Vocabulary 📚',
    'grammar': 'Grammar ✏️',
    'sentence-ordering': 'Sentence Ordering 🔤',
    'multiple-choice': 'Multiple Choice ☑️',
    'error-correction': 'Error Correction 🔍'
};

let currentUser = null;
let dailyQuestions = [];
let currentQuestionIndex = 0;
let answers = {};

// State tracking for re-renders
let quizState = 'loading'; // 'playing', 'results', 'completed'
let cachedResults = null;
let isSubmitting = false;  // prevents double-submit

document.addEventListener('DOMContentLoaded', () => {
    requireAuth('student', initStudentPage);
});

async function initStudentPage(userData) {
    currentUser = userData;

    // UI updates
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) {
        welcomeMsg.setAttribute('data-en', `Hello, ${userData.name}! 👋`);
        welcomeMsg.setAttribute('data-ar', `مرحباً، ${userData.name}! 👋`);
        welcomeMsg.textContent = `Hello, ${userData.name}! 👋`;
    }

    const scoreDisplay = document.getElementById('nav-score-display');
    if (scoreDisplay) scoreDisplay.textContent = `${userData.totalScore || 0} pts`;

    const navAvatar = document.getElementById('nav-avatar');
    if (navAvatar) navAvatar.textContent = getInitials(userData.name);

    const navName = document.getElementById('nav-user-name');
    if (navName) navName.textContent = userData.name;

    // Profile section
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const statsTotal = document.getElementById('stats-total-score');
    const statsCount = document.getElementById('stats-count');

    if (profileName) profileName.value = userData.name || '';
    if (profileEmail) profileEmail.value = userData.email || '';
    if (statsTotal) statsTotal.textContent = userData.totalScore || 0;

    const resultsSnap = await rtdb.ref(`dailyResults/${userData.id}`).once('value');
    if (statsCount) statsCount.textContent = resultsSnap.numChildren() || 0;

    // Check if quiz done today
    const alreadyDone = await checkIfAnsweredToday();
    if (alreadyDone) {
        quizState = 'completed';
        cachedResults = alreadyDone;
        showAlreadyCompleted(alreadyDone);
    } else {
        quizState = 'playing';
        await loadDailyQuestions();
    }
}

async function checkIfAnsweredToday() {
    const today = getTodayString();
    const snap = await rtdb.ref(`dailyResults/${currentUser.id}/${today}`).once('value');
    return snap.exists() ? snap.val() : null;
}

function showAlreadyCompleted(resultData) {
    const quizArea = document.getElementById('quiz-area');
    const progressArea = document.getElementById('progress-area');
    if (progressArea) progressArea.classList.add('hidden');

    const total = resultData.total || dailyQuestions.length || 5;

    quizArea.innerHTML = `
    <div class="quiz-card text-center" style="padding: 60px 40px;">
      <div style="font-size: 5rem; margin-bottom: 20px; animation: bounceIn 0.6s ease">🎉</div>
      <h2 class="mb-2" data-en="Great Work!" data-ar="عمل رائع!">Great Work!</h2>
      <p class="text-muted mb-4" data-en="You've already completed today's challenge. Come back tomorrow!" data-ar="لقد أنهيت تحدي اليوم. عد غداً!">You've already completed today's challenge. Come back tomorrow!</p>
      <div class="stats-grid" style="max-width: 320px; margin: 0 auto 32px;">
        <div class="stats-card">
          <span class="label" data-en="Today's Score" data-ar="نتيجة اليوم">Today's Score</span>
          <span class="value text-gradient">${resultData.score} / ${total}</span>
        </div>
      </div>
      <a href="leaderboard.html" class="btn btn-primary" data-en="🏆 View Rankings" data-ar="🏆 مشاهدة الترتيب">🏆 View Rankings</a>
    </div>`;

    if (window.ui) ui.translate(quizArea);
}

async function loadDailyQuestions() {
    showLoading();
    try {
        // Use the shared daily exam (same for all students, reset every 24h)
        dailyQuestions = await getOrGenerateDailyExam();
        hideLoading();
        renderQuestion();
    } catch (e) {
        hideLoading();
        console.error('Quiz load error:', e);
        showToast('Error loading quiz. Please refresh.', 'error');
    }
}

function renderQuestion() {
    if (quizState === 'results' && cachedResults) {
        return showResult(cachedResults.score, cachedResults.total);
    }
    if (quizState === 'completed' && cachedResults) {
        return showAlreadyCompleted(cachedResults);
    }

    const quizArea = document.getElementById('quiz-area');
    const progressArea = document.getElementById('progress-area');
    const qCounter = document.getElementById('q-counter');
    const qBadge = document.getElementById('q-type-badge');
    const bar = document.getElementById('progress-fill');

    if (dailyQuestions.length === 0) {
        quizArea.innerHTML = `
            <div class="quiz-card text-center" style="padding:60px 40px;">
                <div style="font-size: 3rem; margin-bottom: 16px;">📭</div>
                <h3 data-en="No questions yet" data-ar="لا توجد أسئلة بعد">No questions yet</h3>
                <p class="text-muted" data-en="Your teacher hasn't added any questions yet. Check back soon!" data-ar="لم يضف معلمك أسئلة حتى الآن. تحقق لاحقاً!">Your teacher hasn't added any questions yet. Check back soon!</p>
            </div>`;
        if (progressArea) progressArea.classList.add('hidden');
        return;
    }

    const q = dailyQuestions[currentQuestionIndex];
    if (!q) return;

    // Update progress UI
    if (progressArea) progressArea.classList.remove('hidden');
    if (qCounter) qCounter.textContent = `${currentQuestionIndex + 1} / ${dailyQuestions.length}`;
    if (qBadge) {
        qBadge.textContent = TYPE_LABELS[q.type] || q.type;
        qBadge.className = `tag type-${q.type}`;
    }
    const pct = ((currentQuestionIndex) / dailyQuestions.length) * 100;
    if (bar) bar.style.width = pct + '%';

    // Build options HTML
    let optionsHTML = '';
    if (q.options && q.options.length > 0) {
        optionsHTML = '<div class="quiz-options">';
        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        q.options.forEach((opt, idx) => {
            const isSelected = answers[q.id] === opt;
            optionsHTML += `
                <button class="quiz-option ${isSelected ? 'selected' : ''}"
                    onclick="selectOption(this, '${q.id}', ${idx})">
                    <span class="option-letter">${letters[idx]}</span>
                    <span class="option-text">${escapeHTML(opt)}</span>
                </button>`;
        });
        optionsHTML += '</div>';
    } else {
        // Free text answer
        optionsHTML = `
            <div class="form-group" style="margin: 24px 0;">
                <input type="text" class="form-input" id="text-answer"
                    placeholder="Type your answer..."
                    value="${escapeHTML(answers[q.id] || '')}"
                    oninput="answers['${q.id}']=this.value">
            </div>`;
    }

    const isLast = currentQuestionIndex === dailyQuestions.length - 1;
    const answered = answers[q.id] !== undefined && answers[q.id] !== '';

    quizArea.innerHTML = `
        <div class="quiz-card fade-in">
            <div class="question-text">${escapeHTML(q.questionText)}</div>
            ${optionsHTML}
            <div class="quiz-actions">
                <button class="btn btn-outline" onclick="prevQuestion()" ${currentQuestionIndex === 0 ? 'disabled' : ''}>
                    ← <span data-en="Back" data-ar="رجوع">Back</span>
                </button>
                <div style="flex-grow:1; text-align:center; color:var(--text-dim); font-size:0.85rem;">
                    ${answered ? '✅' : '○'} ${currentQuestionIndex + 1} / ${dailyQuestions.length}
                </div>
                ${isLast
            ? `<button class="btn btn-primary" onclick="submitQuiz()">
                           <span data-en="Finish ✓" data-ar="إنهاء ✓">Finish ✓</span>
                       </button>`
            : `<button class="btn btn-primary" onclick="nextQuestion()">
                           <span data-en="Next →" data-ar="التالي →">Next →</span>
                       </button>`
        }
            </div>
        </div>`;

    // Re-apply current language translation to the newly injected elements
    if (window.ui) ui.translate(quizArea);
}

window.renderQuestion = renderQuestion;

window.selectOption = function (el, qid, idx) {
    const q = dailyQuestions.find(i => i.id === qid);
    if (!q || !q.options) return;

    const val = q.options[idx];
    el.parentElement.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    answers[qid] = val;
    console.log(`[Student] Selected index ${idx} for ${qid}: ${val}`);
};

window.nextQuestion = function () {
    if (currentQuestionIndex < dailyQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    }
};

window.prevQuestion = function () {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
};

window.submitQuiz = async function () {
    // Prevent double-submit if user taps Finish more than once
    if (isSubmitting) return;
    isSubmitting = true;

    // Visually disable the Finish button immediately
    const finishBtn = document.querySelector('#quiz-area .btn-primary');
    if (finishBtn) { finishBtn.disabled = true; finishBtn.textContent = 'Submitting...'; }

    console.log('Submitting quiz...');
    // Calculate score
    let score = 0;
    dailyQuestions.forEach(q => {
        const given = (answers[q.id] || '').toString().toLowerCase().trim();
        const correct = (q.correctAnswer || '').toString().toLowerCase().trim();
        if (given === correct) score++;
    });

    showLoading();
    const today = getTodayString();
    try {
        // 1. Save results for this user/date
        await rtdb.ref(`dailyResults/${currentUser.id}/${today}`).set({
            score,
            total: dailyQuestions.length,
            timestamp: Date.now()
        });

        // 2. Update user's cumulative total score
        const userRef = rtdb.ref(`users/students/${currentUser.id}`);
        const userSnap = await userRef.once('value');
        const userData = userSnap.val() || {};
        const currentTotal = userData.totalScore || 0;

        await userRef.update({ totalScore: currentTotal + score });

        console.log('Quiz submitted successfully. Score:', score);
        hideLoading();

        quizState = 'results';
        cachedResults = { score, total: dailyQuestions.length };
        showResult(score, dailyQuestions.length);
    } catch (e) {
        hideLoading();
        isSubmitting = false; // allow retry on network error
        if (finishBtn) { finishBtn.disabled = false; finishBtn.textContent = 'Finish ✓'; }
        console.error('Submit error:', e);
        showToast('Error saving result. Please try again.', 'error');
    }
};

function showResult(score, total) {
    const pct = Math.round((score / total) * 100);
    const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '😊' : '💪';
    const msg = pct >= 80
        ? { en: 'Excellent! You nailed it!', ar: 'ممتاز! أحسنت!' }
        : pct >= 60
            ? { en: 'Good job! Keep it up!', ar: 'عمل جيد! استمر!' }
            : { en: 'Keep practicing, you\'ll do better!', ar: 'استمر في التدريب، ستتحسن!' };

    const bar = document.getElementById('progress-fill');
    if (bar) bar.style.width = '100%';

    const container = document.getElementById('quiz-area');
    container.innerHTML = `
        <div class="quiz-card text-center fade-in" style="padding:60px 40px;">
            <div style="font-size:5rem; margin-bottom:20px;">${emoji}</div>
            <h2 class="hero-title mb-2" style="font-size:2rem;" data-en="${msg.en}" data-ar="${msg.ar}">${msg.en}</h2>
            <p class="text-muted mb-4" data-en="Daily challenge complete!" data-ar="اكتمل تحدي اليوم!">Daily challenge complete!</p>

            <div class="score-ring" style="
                width:140px; height:140px; border-radius:50%;
                background: conic-gradient(var(--primary) ${pct * 3.6}deg, var(--border) 0deg);
                display:flex; align-items:center; justify-content:center;
                margin: 0 auto 32px; position:relative;">
                <div style="width:110px; height:110px; background:var(--bg-card); border-radius:50%;
                    display:flex; flex-direction:column; align-items:center; justify-content:center;">
                    <span style="font-size:1.8rem; font-weight:900; color:var(--primary);">${score}/${total}</span>
                    <span style="font-size:0.75rem; color:var(--text-dim);">${pct}%</span>
                </div>
            </div>

            <div class="quiz-review mb-4" style="text-align:left; max-width:480px; margin:0 auto 32px;">
                ${dailyQuestions.map((q, i) => {
        const given = (answers[q.id] || '').toLowerCase().trim();
        const correct = (q.correctAnswer || '').toLowerCase().trim();
        const ok = given === correct;
        return `
                    <div style="display:flex; justify-content:space-between; align-items:center;
                        padding:12px 16px; margin-bottom:10px; border-radius:12px;
                        background:${ok ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)'};
                        border:1px solid ${ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};">
                        <span style="font-size:0.9rem; flex:1; font-weight:500;">Q${i + 1}: ${escapeHTML(q.questionText.substring(0, 40))}${q.questionText.length > 40 ? '...' : ''}</span>
                        <span style="font-size:1.2rem;">${ok ? '✅' : '❌'}</span>
                    </div>`;
    }).join('')}
            </div>

            <div class="d-flex gap-3 justify-content-center flex-wrap">
                <a href="leaderboard.html" class="btn btn-primary" data-en="🏆 Hall of Fame" data-ar="🏆 لوحة الشرف">🏆 Hall of Fame</a>
                <button class="btn btn-outline" onclick="location.reload()" data-en="↩ Done" data-ar="↩ تم">↩ Done</button>
            </div>
        </div>`;

    if (window.ui) ui.translate(container);

    // Update global points display
    const scoreDisplay = document.getElementById('nav-score-display');
    if (scoreDisplay) scoreDisplay.textContent = `${(currentUser.totalScore || 0) + score} pts`;
}

// Profile update
window.updateProfile = async function () {
    const nameEl = document.getElementById('profile-name');
    const newName = nameEl?.value.trim();
    if (!newName) return showToast('Name cannot be empty', 'error');

    showLoading();
    try {
        await rtdb.ref(`users/students/${currentUser.id}`).update({ name: newName });
        currentUser.name = newName;

        const welcomeMsg = document.getElementById('welcome-msg');
        if (welcomeMsg) {
            welcomeMsg.setAttribute('data-en', `Hello, ${newName}! 👋`);
            welcomeMsg.setAttribute('data-ar', `مرحباً، ${newName}! 👋`);
            if (window.ui) ui.translate(welcomeMsg);
        }

        const navName = document.getElementById('nav-user-name');
        if (navName) navName.textContent = newName;
        const navAvatar = document.getElementById('nav-avatar');
        if (navAvatar) navAvatar.textContent = getInitials(newName);

        hideLoading();
        showToast('Profile updated!', 'success');
    } catch (e) {
        hideLoading();
        showToast('Error updating profile', 'error');
    }
};

// Tab switching
window.switchTab = function (tab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`${tab}-section`)?.classList.remove('hidden');
    document.getElementById(`tab-${tab}`)?.classList.add('active');
};

function escapeHTML(str) {
    if (!str) return '';
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}
