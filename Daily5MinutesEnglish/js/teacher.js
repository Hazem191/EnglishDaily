/* ========================================
   Teacher / Admin Dashboard Module
   ======================================== */

let currentTeacher = null;
let distributionChart = null;
let currentTab = 'overview';

/* ========================================
   Listener Manager — prevents memory leaks
   Tracks active on() listeners per path and
   calls off() before re-subscribing.
   ======================================== */
const _activeListeners = {};

function managedOn(path, callback) {
    if (_activeListeners[path]) {
        rtdb.ref(path).off('value', _activeListeners[path]);
    }
    _activeListeners[path] = callback;
    rtdb.ref(path).on('value', callback);
}

document.addEventListener('DOMContentLoaded', () => {
    requireAuth('teacher', initTeacherPage);
});

async function initTeacherPage(userData) {
    currentTeacher = userData;
    await DB.reloadFromServer();

    const navName = document.getElementById('nav-user-name');
    if (navName) navName.textContent = userData.name;



    const addTeacherForm = document.getElementById('add-teacher-form');
    if (addTeacherForm) {
        addTeacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('teacher-name').value.trim();
            const email = document.getElementById('teacher-email').value.trim();
            const password = document.getElementById('teacher-password').value;
            const btn = document.getElementById('btn-add-teacher');

            if (!name || !email || !password) return;
            if (password.length < 6) {
                showToast('Password must be at least 6 characters.', 'error');
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<div class="spinner spinner-sm"></div> Saving...';

            try {
                // Ensure email is unique across all users
                const allUsers = DB.get().users || {};
                const admins = allUsers.admins || {};
                const students = allUsers.students || {};
                
                const emailExists = Object.values(admins).concat(Object.values(students))
                    .some(u => u.email?.toLowerCase() === email.toLowerCase());
                
                if (emailExists) {
                    throw new Error('Email is already registered in the system.');
                }

                const uid = 'admin-' + Math.random().toString(36).substr(2, 9);
                const hashedPw = await hashPassword(password);
                
                await rtdb.ref(`users/admins/${uid}`).set({
                    id: uid,
                    name,
                    email,
                    password: hashedPw,
                    role: 'teacher',
                    createdAt: Date.now()
                });

                showToast('Teacher account created successfully!', 'success');
                addTeacherForm.reset();
            } catch (error) {
                showToast(error.message || 'Error creating account', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = window.ui && window.ui.currentLang === 'ar' ? 'إضافة مدرس' : 'Add Teacher';
            }
        });
    }

    setupDashboardTabs();
    setupRealtimeStats();
    setupQuestionForm();
    loadExamSettings();
    updateAttendanceReport();
    showTab('overview');
}

/* ========================================
   Dashboard Tabs
   ======================================== */
function setupDashboardTabs() {
    document.querySelectorAll('.dashboard-tab').forEach(btn => {
        btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });
}

function showTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.dashboard-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.dashboard-tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`)?.classList.remove('hidden');

    if (tabName === 'students') loadStudentsList();
    if (tabName === 'view-questions') loadQuestionsList();
    if (tabName === 'exam-builder') loadExamBuilder();
    if (tabName === 'overview') updateAttendanceReport();
}

/* ========================================
   Realtime Stats & Charts
   ======================================== */
function setupRealtimeStats() {
    const today = getTodayString();

    managedOn('questions', (snap) => {
        const count = snap.numChildren();
        const el = document.getElementById('stat-questions');
        if (el) el.textContent = count;
        generateDistributionChart(snap.val());
    });

    managedOn('users/students', (snap) => {
        const count = snap.numChildren();
        const el = document.getElementById('stat-students');
        if (el) el.textContent = count;
        updateAttendanceReport();
    });

    managedOn('dailyResults', (snap) => {
        let todayCount = 0, totalScore = 0;
        const val = snap.val() || {};
        Object.values(val).forEach(userResults => {
            if (userResults[today]) {
                todayCount++;
                totalScore += userResults[today].score || 0;
            }
        });
        const avgScore = todayCount > 0 ? (totalScore / todayCount).toFixed(1) : 0;
        const statT = document.getElementById('stat-today');
        const statA = document.getElementById('stat-avg');
        if (statT) statT.textContent = todayCount;
        if (statA) statA.textContent = avgScore;
        updateAttendanceReport();
    });
}

function updateAttendanceReport() {
    const container = document.getElementById('attendance-report');
    if (!container) return;

    const today = getTodayString();
    const data = DB.get();
    const students = Object.values(data.users?.students || {});
    const results = data.dailyResults || {};
    const isAr = window.ui?.lang === 'ar';

    if (students.length === 0) {
        container.innerHTML = `<p class="text-muted mb-0" data-en="No students registered yet." data-ar="لا يوجد طلاب مسجلون بعد.">No students registered yet.</p>`;
        if (window.ui) ui.translate(container);
        return;
    }

    const completed = [];
    const pending = [];
    students.forEach((student) => {
        const result = results[student.id]?.[today];
        if (result) completed.push({ student, result });
        else pending.push(student);
    });

    completed.sort((a, b) => (b.result.score || 0) - (a.result.score || 0));
    pending.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const summary = isAr
        ? `${completed.length} من ${students.length} أكملوا اختبار اليوم`
        : `${completed.length} of ${students.length} completed today's quiz`;

    let html = `
        <div class="attendance-summary">
            <span class="attendance-pill">${summary}</span>
            <span class="attendance-pill">${isAr ? `${pending.length} لم يكملوا` : `${pending.length} pending`}</span>
        </div>
        <div class="attendance-list">`;

    completed.forEach(({ student, result }) => {
        html += `
            <div class="attendance-row done">
                <div>
                    <strong>${escapeHTML(student.name)}</strong>
                    <div class="text-muted" style="font-size:0.85rem;">${escapeHTML(student.email || '')}</div>
                </div>
                <span class="tag" style="background:rgba(21,128,61,0.12); color:#15803d;">${result.score || 0}/${result.total || '—'}</span>
            </div>`;
    });

    pending.forEach((student) => {
        html += `
            <div class="attendance-row pending">
                <div>
                    <strong>${escapeHTML(student.name)}</strong>
                    <div class="text-muted" style="font-size:0.85rem;">${escapeHTML(student.email || '')}</div>
                </div>
                <span class="tag">${isAr ? 'لم يكمل' : 'Not submitted'}</span>
            </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

function generateDistributionChart(questions) {
    const wrapper = document.getElementById('type-distribution-chart');
    if (!wrapper) return;

    if (!questions || Object.keys(questions).length === 0) {
        wrapper.innerHTML = `<div class="text-center py-40 text-muted">No questions yet to chart.</div>`;
        return;
    }

    if (distributionChart) { distributionChart.destroy(); distributionChart = null; }
    wrapper.innerHTML = '<canvas id="type-chart" style="max-height:300px;"></canvas>';

    const distribution = {};
    Object.values(questions).forEach(q => {
        distribution[q.type] = (distribution[q.type] || 0) + 1;
    });

    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-main') || '#f8fafc';

    distributionChart = new Chart(document.getElementById('type-chart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(distribution),
            datasets: [{
                data: Object.values(distribution),
                backgroundColor: [
                    'rgba(99,102,241,0.75)', 'rgba(236,72,153,0.75)',
                    'rgba(16,185,129,0.75)', 'rgba(245,158,11,0.75)',
                    'rgba(107,114,128,0.75)'
                ],
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor.trim(), font: { family: 'Segoe UI, system-ui, sans-serif', size: 13 }, padding: 16 }
                }
            }
        }
    });
}

window.initPage = () => {
    // Called when theme/lang changes
    const data = DB.get();
    generateDistributionChart(data.questions || null);
};

/* ========================================
   Add Question Form
   ======================================== */
function setupQuestionForm() {
    const form = document.getElementById('add-question-form');
    if (!form) return;

    const typeSelect = document.getElementById('q-type');
    const optionsSection = document.getElementById('options-section');

    if (typeSelect && optionsSection) {
        const toggleOptions = () => {
            const needsOptions = ['vocabulary', 'grammar', 'multiple-choice', 'sentence-ordering', 'error-correction'];
            optionsSection.classList.toggle('hidden', !needsOptions.includes(typeSelect.value));
        };
        typeSelect.addEventListener('change', toggleOptions);
        toggleOptions();
    }

    form.addEventListener('submit', async (e) => { e.preventDefault(); await saveQuestion(); });
}

window.addOptionRow = function () {
    const container = document.getElementById('options-list');
    const rows = container.querySelectorAll('.option-input-row');
    if (rows.length >= 6) return showToast('Max 6 options allowed', 'error');
    const num = rows.length + 1;
    const row = document.createElement('div');
    row.className = 'option-input-row';
    row.style.cssText = 'display:flex; gap:10px; margin-bottom:10px;';
    row.innerHTML = `
        <input type="text" class="form-input option-value" placeholder="Option ${num}">
        <button type="button" onclick="removeOptionRow(this)"
            style="color:#ef4444; background:rgba(239,68,68,0.1); border-radius:8px; min-width:42px; height:50px; font-size:1.1rem;">✕</button>`;
    container.appendChild(row);
};

window.removeOptionRow = function (btn) {
    const container = document.getElementById('options-list');
    const rows = container.querySelectorAll('.option-input-row');
    if (rows.length > 2) {
        btn.closest('.option-input-row').remove();
        container.querySelectorAll('.option-input-row').forEach((r, i) => {
            const inp = r.querySelector('input');
            if (inp) inp.placeholder = `Option ${i + 1}`;
        });
    } else {
        showToast('Min 2 options required', 'info');
    }
};

async function saveQuestion() {
    const text = document.getElementById('q-text')?.value.trim();
    const type = document.getElementById('q-type')?.value;
    const correctAnswer = document.getElementById('q-correct')?.value.trim();
    const errorEl = document.getElementById('form-error');

    if (errorEl) errorEl.textContent = '';
    if (!text || !type || !correctAnswer) {
        if (errorEl) errorEl.textContent = 'Please fill in all required fields.';
        return;
    }

    const options = [];
    document.querySelectorAll('.option-value').forEach(i => {
        if (i.value.trim()) options.push(i.value.trim());
    });

    if (['vocabulary', 'grammar', 'multiple-choice', 'sentence-ordering', 'error-correction'].includes(type) && options.length < 2) {
        if (errorEl) errorEl.textContent = 'Please add at least 2 options.';
        return;
    }

    // Ensure correct answer is one of the options (if options exist)
    if (options.length > 0 && !options.map(o => o.toLowerCase()).includes(correctAnswer.toLowerCase())) {
        if (errorEl) errorEl.textContent = 'The correct answer must match one of the options exactly.';
        return;
    }

    const submitBtn = document.getElementById('btn-add-question');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving...'; }

    try {
        await rtdb.ref('questions').push({
            questionText: text,
            type,
            options,
            correctAnswer,
            createdBy: currentTeacher?.id,
            createdAt: Date.now()
        });

        // Reset today's exam so new question might be included
        const data = DB.get();
        if (data.config) { data.config.currentExamDate = null; data.config.currentExamQuestions = []; DB.save(data); }

        showToast('Question saved.', 'success');
        document.getElementById('add-question-form').reset();
        if (errorEl) errorEl.textContent = '';
    } catch (e) {
        console.error('Save question error:', e);
        showToast('Error saving question.', 'error');
    }

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save question'; }
}

/* ========================================
   View & Delete Questions
   ======================================== */
window.loadQuestionsList = function () {
    const container = document.getElementById('questions-list-container');
    if (!container) return;
    container.innerHTML = '<div class="spinner" style="margin:40px auto;"></div>';

    // managedOn prevents duplicate listeners each time this tab is opened
    managedOn('questions', (snap) => {
        if (!snap.exists()) {
            container.innerHTML = '<p class="text-center text-muted py-40">No questions yet. Add some!</p>';
            return;
        }
        let html = '<div class="questions-list">';
        snap.forEach(child => {
            const q = child.val();
            const qid = child.key;
            html += `
                <div class="question-item">
                    <div class="question-info">
                        <span class="tag type-${q.type}" style="margin-bottom:6px; display:inline-block;">${q.type}</span>
                        <strong style="display:block; margin-bottom:4px;">${escapeHTML(q.questionText)}</strong>
                        <div style="font-size:0.8rem; color:var(--text-dim);">
                            ✅ ${escapeHTML(q.correctAnswer)}
                            ${q.options?.length ? ` | ${q.options.length} options` : ''}
                        </div>
                    </div>
                    <button class="btn-delete" onclick="deleteQuestion('${qid}')" data-en="Delete" data-ar="حذف">Delete</button>
                </div>`;
        });
        container.innerHTML = html + '</div>';
        if (window.ui) ui.translate(container);
    });
};

window.deleteQuestion = async function (qid) {
    const isAr = ui.lang === 'ar';
    const confirmed = await showConfirmDialog({
        title: isAr ? 'حذف السؤال' : 'Delete question',
        message: isAr
            ? 'هل أنت متأكد من حذف هذا السؤال؟ سيتم إزالته أيضاً من امتحان اليوم.'
            : 'Delete this question? It will also be removed from today\'s exam if selected.',
        confirmText: isAr ? 'حذف' : 'Delete',
        cancelText: isAr ? 'إلغاء' : 'Cancel',
        danger: true
    });
    if (!confirmed) return;

    rtdb.ref(`questions/${qid}`).remove();
    showToast(isAr ? 'تم حذف السؤال' : 'Question deleted.', 'success');

    const data = DB.get();
    if (data.config && data.config.currentExamQuestions?.includes(qid)) {
        data.config.currentExamQuestions = data.config.currentExamQuestions.filter(id => id !== qid);
        DB.save(data);
    }
};

/* ========================================
   Students Performance
   ======================================== */
function loadStudentsList() {
    const container = document.getElementById('students-list-container');
    if (!container) return;
    container.innerHTML = '<div class="spinner" style="margin:40px auto;"></div>';

    // managedOn prevents duplicate listeners each time this tab is opened
    managedOn('users/students', async (snap) => {
        if (!snap.exists()) {
            container.innerHTML = '<p class="text-center text-muted py-40">No students registered yet.</p>';
            return;
        }
        const resultsSnap = await rtdb.ref('dailyResults').once('value');
        const results = resultsSnap.val() || {};

        let html = `
            <div class="students-table-wrapper">
                <table class="students-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th data-en="Name" data-ar="الاسم">Name</th>
                            <th data-en="Email" data-ar="البريد">Email</th>
                            <th data-en="Total Score" data-ar="النقاط الكلية">Total Score</th>
                            <th data-en="Last 5 Quizzes" data-ar="آخر 5 اختبارات">Last 5 Quizzes</th>
                        </tr>
                    </thead>
                    <tbody>`;
        let i = 1;
        snap.forEach(child => {
            const s = child.val();
            const sid = child.key;
            const sResults = results[sid] || {};
            const recent = Object.values(sResults)
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, 5)
                .map(r => `<span class="tag" style="font-size:0.7rem;">${r.score}/${r.total || 5}</span>`)
                .join(' ');
            html += `
                <tr>
                    <td style="color:var(--text-dim);">${i++}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="avatar-circle" style="width:34px;height:34px;font-size:0.75rem;">${getInitials(s.name)}</div>
                            ${escapeHTML(s.name)}
                        </div>
                    </td>
                    <td style="color:var(--text-dim); font-size:0.85rem;">${escapeHTML(s.email)}</td>
                    <td><strong style="color:var(--primary);">${s.totalScore || 0}</strong></td>
                    <td>${recent || '<span class="text-muted">No activity</span>'}</td>
                </tr>`;
        });
        container.innerHTML = html + '</tbody></table></div>';
        if (window.ui) ui.translate(container);
    });
}

/* ========================================
   Exam Builder (Admin chooses questions)
   ======================================== */
function loadExamBuilder() {
    const container = document.getElementById('exam-builder-container');
    if (!container) return;

    const data = DB.get();
    const allQuestions = data.questions || {};
    const cfg = data.config || {};
    const today = getTodayString();
    const selectedIds = (cfg.currentExamDate === today && cfg.currentExamQuestions) ? [...cfg.currentExamQuestions] : [];

    let html = `
        <div class="feature-card mb-4">
            <h3 class="mb-3" data-en="Today's exam settings" data-ar="إعدادات امتحان اليوم">Today's exam settings</h3>
            <div class="row g-3 align-items-end mb-4">
                <div class="col-md-4">
                    <label class="form-label" data-en="Questions per quiz" data-ar="عدد الأسئلة في الامتحان">Questions per quiz</label>
                    <input type="number" id="quiz-size-input" class="form-input" min="3" max="20" value="${cfg.quizSize || 5}">
                </div>
                <div class="col-md-4">
                    <button class="btn btn-outline" onclick="saveQuizSize()" style="width:100%;" data-en="Save size" data-ar="حفظ العدد">Save size</button>
                </div>
                <div class="col-md-4">
                    <button class="btn btn-primary" onclick="autoGenerateExam()" style="width:100%;" data-en="Auto-generate" data-ar="توليد تلقائي">Auto-generate</button>
                </div>
            </div>
            <p style="font-size:0.85rem; color:var(--text-dim);" data-en="Or manually pick questions for today's exam below:" data-ar="أو اختر الأسئلة يدوياً لامتحان اليوم:">Or manually pick questions for today's exam below:</p>
        </div>

        <div class="feature-card">
            <div class="flex-between mb-3">
                <h3 class="mb-0" data-en="Select Questions" data-ar="اختر الأسئلة">Select Questions</h3>
                <span id="selected-count" class="tag">${selectedIds.length} selected</span>
            </div>
            <div id="question-picker" style="display:flex; flex-direction:column; gap:10px; max-height:500px; overflow-y:auto; padding-right:4px;">`;

    if (Object.keys(allQuestions).length === 0) {
        html += `<p class="text-muted text-center" data-en="No questions available. Add questions first." data-ar="لا توجد أسئلة. أضف أسئلة أولاً.">No questions available. Add questions first.</p>`;
    } else {
        Object.entries(allQuestions).forEach(([qid, q]) => {
            const checked = selectedIds.includes(qid);
            html += `
                <div class="question-picker-row ${checked ? 'selected' : ''}" data-qid="${qid}" onclick="toggleQuestionPick('${qid}', this)">
                    <input type="checkbox" value="${qid}" ${checked ? 'checked' : ''}
                        onclick="event.stopPropagation()"
                        onchange="onCheckboxChange(this)">
                    <div style="flex:1;">
                        <span class="tag type-${q.type}" style="margin-bottom:4px; display:inline-block;">${q.type}</span>
                        <div style="font-size:0.9rem;">${escapeHTML(q.questionText)}</div>
                    </div>
                </div>`;
        });
    }

    html += `
            </div>
            <div style="margin-top:24px; display:flex; gap:12px; flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="publishManualExam()" data-en="Publish exam" data-ar="نشر الامتحان">Publish exam</button>
                <button class="btn btn-outline" onclick="clearExamSelection()" data-en="✕ Clear Selection" data-ar="✕ مسح الاختيار">✕ Clear Selection</button>
            </div>
        </div>`;

    container.innerHTML = html;
}

/**
 * Called when user clicks the ROW (not the checkbox directly).
 * Toggles the checkbox state and syncs the visual selection.
 */
window.toggleQuestionPick = function (qid, rowEl) {
    const checkbox = rowEl.querySelector('input[type=checkbox]');
    if (!checkbox) return;
    checkbox.checked = !checkbox.checked;
    rowEl.classList.toggle('selected', checkbox.checked);
    updateSelectedCount();
};

/**
 * Called by the checkbox's onchange event (checkbox clicked directly).
 * The browser has already toggled checked — just sync the visual state.
 */
window.onCheckboxChange = function (checkbox) {
    const row = checkbox.closest('.question-picker-row');
    if (row) row.classList.toggle('selected', checkbox.checked);
    updateSelectedCount();
};

function updateSelectedCount() {
    const count = document.querySelectorAll('#question-picker input[type=checkbox]:checked').length;
    const el = document.getElementById('selected-count');
    if (el) el.textContent = `${count} selected`;
}

window.publishManualExam = async function () {
    const checkedIds = Array.from(document.querySelectorAll('#question-picker input:checked')).map(i => i.value);
    if (checkedIds.length === 0) return showToast('Select at least one question!', 'error');

    showLoading();
    await setDailyExam(checkedIds);
    hideLoading();

    loadExamSettings(); // Show ✅ Exam Set in header
    if (currentTab === 'exam-builder') loadExamBuilder();
};

window.clearExamSelection = function () {
    document.querySelectorAll('#question-picker input').forEach(i => {
        i.checked = false;
        i.closest('.question-picker-row')?.classList.remove('selected');
    });
    updateSelectedCount();
};

window.autoGenerateExam = async function () {
    showLoading();
    const data = DB.get();
    const allQsMap = data.questions || {};
    const allIds = Object.keys(allQsMap);

    if (allIds.length === 0) {
        hideLoading();
        return showToast('No questions available!', 'error');
    }

    const size = data.config?.quizSize || 5;
    // Fisher-Yates Shuffle for true randomness
    const shuffled = [...allIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selected = shuffled.slice(0, Math.min(size, allIds.length));

    if (allIds.length < size) {
        showToast(`Only ${allIds.length} questions available (requested ${size}). Using all available.`, 'info');
    }

    await setDailyExam(selected);
    hideLoading();
    loadExamSettings(); // Refresh the pill in header
    if (currentTab === 'exam-builder') loadExamBuilder();
};

window.saveQuizSize = async function () {
    const val = parseInt(document.getElementById('quiz-size-input')?.value);
    if (!val || val < 3 || val > 20) return showToast('Enter a number between 3 and 20.', 'error');

    showLoading();
    await setQuizSize(val);

    // Force regeneration with new size
    const data = DB.get();
    data.config = data.config || {};
    data.config.currentExamDate = null;
    data.config.currentExamQuestions = [];
    await DB.save(data);

    hideLoading();
    showToast('Quiz size updated!', 'success');
    if (currentTab === 'exam-builder') loadExamBuilder();
};

/* ========================================
   Exam Settings Summary
   ======================================== */
function loadExamSettings() {
    const data = DB.get();
    const cfg = data.config || {};
    const el = document.getElementById('exam-settings-summary');
    if (!el) return;
    const today = getTodayString();
    const isToday = cfg.currentExamDate === today;
    el.innerHTML = `
        <span class="tag" style="${isToday ? 'background:rgba(16,185,129,0.15); color:#10b981;' : ''}">
            ${isToday ? 'Exam set' : 'Auto daily'} | ${cfg.quizSize || 5} questions
        </span>`;
}

/* ========================================
   Database Management
   ======================================== */
window.clearAllResults = async function () {
    const isAr = ui.lang === 'ar';
    const confirmed = await showConfirmDialog({
        title: isAr ? 'مسح النتائج' : 'Clear all results',
        message: isAr
            ? 'هل أنت متأكد من مسح جميع نتائج الطلاب؟ لا يمكن التراجع عن هذه الخطوة.'
            : 'Delete ALL student results? This cannot be undone.',
        confirmText: isAr ? 'مسح الكل' : 'Clear all',
        cancelText: isAr ? 'إلغاء' : 'Cancel',
        danger: true
    });
    if (!confirmed) return;

    const data = DB.get();
    data.dailyResults = {};
    DB.save(data);
    showToast(isAr ? 'تم مسح جميع النتائج' : 'All results cleared.', 'success');
};

window.resetTodayExam = async function () {
    const isAr = ui.lang === 'ar';
    const confirmed = await showConfirmDialog({
        title: isAr ? 'إعادة تعيين الامتحان' : 'Reset today\'s exam',
        message: isAr
            ? 'إعادة تعيين امتحان اليوم؟ سيتم توليد امتحان جديد تلقائياً.'
            : 'Reset today\'s exam? Students will see a new auto-generated exam.',
        confirmText: isAr ? 'إعادة التعيين' : 'Reset',
        cancelText: isAr ? 'إلغاء' : 'Cancel',
        danger: true
    });
    if (!confirmed) return;

    const data = DB.get();
    data.config = data.config || {};
    data.config.currentExamDate = null;
    data.config.currentExamQuestions = [];
    DB.save(data);
    showToast(isAr ? 'تمت إعادة تعيين الامتحان.' : 'Today\'s exam reset.', 'success');
};

function escapeHTML(str) {
    if (!str) return '';
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}
