/* ========================================
   Simplified JSON-Based Data Service
   Mocking Firebase Realtime DB API
   ======================================== */

const DB_KEY = 'daily_english_db';
const DB_VERSION = '7';   // ← bump this to force a fresh load from db.json
const DB_VER_KEY = 'daily_english_db_version';

// Initial structure if empty
const defaultData = {
    users: {
        admins: {
            "admin-main": { id: "admin-main", name: "Admin", email: "Admin@test.com", password: "123456@Ha", role: "teacher" }
        },
        students: {}
    },
    questions: {
        "sample-1": { questionText: "Choose the correct verb: They ____ to school every day.", type: "grammar", options: ["go", "goes", "going", "gone"], correctAnswer: "go", createdAt: Date.now() },
        "sample-2": { questionText: "What is the synonym of 'Happy'?", type: "vocabulary", options: ["Sad", "Glad", "Angry", "Bored"], correctAnswer: "Glad", createdAt: Date.now() },
        "sample-3": { questionText: "I have been living here ___ five years.", type: "grammar", options: ["since", "for", "at", "during"], correctAnswer: "for", createdAt: Date.now() },
        "sample-4": { questionText: "Reorder: [is / She / beautiful]", type: "sentence-ordering", options: ["She is beautiful", "Beautiful is she", "Is she beautiful", "She beautiful is"], correctAnswer: "She is beautiful", createdAt: Date.now() },
        "sample-5": { questionText: "Which sentence is correct?", type: "error-correction", options: ["She don't like it", "She doesn't like it", "She not like it", "She no like it"], correctAnswer: "She doesn't like it", createdAt: Date.now() }
    },
    dailyResults: {},
    config: {
        quizSize: 5,
        currentExamDate: null,
        currentExamQuestions: []
    }
};

/** High-level DB Controller */
const DB = {
    listeners: [],
    initPromise: null,

    async init() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            const storedVersion = localStorage.getItem(DB_VER_KEY);
            if (storedVersion !== DB_VERSION) {
                console.warn(`⚠️ DB version changed (${storedVersion} → ${DB_VERSION}). Refreshing...`);
                localStorage.removeItem(DB_KEY);
                localStorage.removeItem('logged_user');
            }

            const localData = localStorage.getItem(DB_KEY);
            let remoteData = null;

            try {
                // 1. Try API (PHP/Node)
                let response = await fetch('api.php');
                if (response.ok) {
                    const text = await response.text();
                    try {
                        remoteData = JSON.parse(text);
                        console.log("📂 Synced with server (api.php)");
                    } catch (e) {
                        console.warn("api.php returned non-JSON content. Likely plain PHP file.");
                    }
                }

                // 2. Try direct db.json if API failed or returned nothing
                if (!remoteData || remoteData.error) {
                    let directRes = await fetch('db.json');
                    if (directRes.ok) {
                        remoteData = await directRes.json();
                        console.log("📂 Loaded from db.json directly");
                    }
                }
            } catch (e) {
                console.warn("Server sync unavailable. Checking local cache...");
            }

            let finalData;
            // PRESERVE local data during merge
            const currentLocal = localData ? JSON.parse(localData) : null;

            if (remoteData && !remoteData.error) {
                // Merge server with defaults
                finalData = _deepMergeDefaults(remoteData, defaultData);
                // ALSO merge with current local to avoid losing pending syncs
                if (currentLocal) {
                    finalData = _deepMergeDefaults(currentLocal, finalData);
                }
            } else if (currentLocal) {
                finalData = _deepMergeDefaults(currentLocal, defaultData);
            } else {
                finalData = JSON.parse(JSON.stringify(defaultData));
            }

            _ensureSeedAccounts(finalData);
            localStorage.setItem(DB_KEY, JSON.stringify(finalData));
            localStorage.setItem(DB_VER_KEY, DB_VERSION);
            this.notify();
        })();

        return this.initPromise;
    },

    get() {
        return JSON.parse(localStorage.getItem(DB_KEY)) || defaultData;
    },

    async save(data) {
        localStorage.setItem(DB_KEY, JSON.stringify(data));
        this.notify();
        await this.syncWithServer(data);
    },

    async syncWithServer(data) {
        try {
            await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) { }
    },

    notify() {
        this.listeners.forEach(l => l.callback(this.snap(l.path)));
    },

    listenToStorage() {
        window.addEventListener('storage', (e) => {
            if (e.key === DB_KEY) this.notify();
        });
    },

    resolvePath(data, path) {
        if (!path || path === '/') return data;
        const parts = path.split('/').filter(p => p);
        let cur = data;
        for (const p of parts) {
            if (cur === null || typeof cur !== 'object' || !(p in cur)) return null;
            cur = cur[p];
        }
        return cur;
    },

    setPath(data, path, value) {
        const parts = path.split('/').filter(p => p);
        let cur = data;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]]) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
    },

    snap(path) {
        const fullData = this.get();
        const val = this.resolvePath(fullData, path);
        return {
            val: () => val,
            exists: () => val !== null && val !== undefined,
            numChildren: () => (typeof val === 'object' && val !== null) ? Object.keys(val).length : 0,
            key: path ? path.split('/').pop() : '',
            forEach: (cb) => {
                if (typeof val === 'object' && val !== null) {
                    Object.entries(val).forEach(([k, v]) => {
                        cb({ key: k, val: () => v, exists: () => true });
                    });
                }
            }
        };
    }
};

function _deepMergeDefaults(target, defaults) {
    const result = { ...target };
    for (const key of Object.keys(defaults)) {
        if (!(key in result)) {
            result[key] = defaults[key];
        } else if (
            typeof defaults[key] === 'object' && defaults[key] !== null &&
            !Array.isArray(defaults[key]) &&
            typeof result[key] === 'object' && result[key] !== null &&
            !Array.isArray(result[key])
        ) {
            result[key] = _deepMergeDefaults(result[key], defaults[key]);
        }
    }
    return result;
}

function _ensureSeedAccounts(data) {
    if (!data.users) data.users = {};
    if (!data.users.admins) data.users.admins = {};
    if (!data.users.students) data.users.students = {};

    if (!data.users.admins['admin-main']) {
        data.users.admins['admin-main'] = {
            id: 'admin-main',
            name: 'Admin',
            email: 'Admin@test.com',
            password: '123456@Ha',
            role: 'teacher'
        };
    }
    if (!data.config) data.config = { quizSize: 5, currentExamDate: null, currentExamQuestions: [] };
    if (!data.dailyResults) data.dailyResults = {};
}

window.resetDB = async function () {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(DB_VER_KEY);
    localStorage.removeItem('logged_user');
    await DB.init();
    showToast('Database reset successfully!', 'success');
};

/** Mock Realtime Database Reference */
class MockRef {
    constructor(path = '') { this.path = path; }
    ref(subPath) { return new MockRef(this.path ? `${this.path}/${subPath}` : subPath); }
    async once(type) { if (type !== 'value') return null; await DB.initPromise; return DB.snap(this.path); }
    on(type, callback) {
        if (type !== 'value') return;
        DB.listeners.push({ path: this.path, callback });
        callback(DB.snap(this.path));
    }
    async set(value) {
        const data = DB.get();
        DB.setPath(data, this.path, value);
        await DB.save(data);
    }
    async update(updates) {
        const data = DB.get();
        let target = DB.resolvePath(data, this.path);
        if (!target) { DB.setPath(data, this.path, {}); target = DB.resolvePath(data, this.path); }
        Object.assign(target, updates);
        await DB.save(data);
    }
    async push(value) {
        const id = 'ID_' + Math.random().toString(36).substr(2, 9);
        const data = DB.get();
        let list = DB.resolvePath(data, this.path);
        if (!list || typeof list !== 'object') { DB.setPath(data, this.path, {}); list = DB.resolvePath(data, this.path); }
        list[id] = value;
        await DB.save(data);
        return { key: id };
    }
    async remove() {
        const data = DB.get();
        const parts = this.path.split('/').filter(p => p);
        if (parts.length === 0) return;
        const parentPath = parts.slice(0, -1).join('/');
        const key = parts[parts.length - 1];
        const parent = DB.resolvePath(data, parentPath);
        if (parent && parent[key] !== undefined) {
            delete parent[key];
            await DB.save(data);
        }
    }
}

/** Mock Auth Module */
const MockAuth = {
    currentUser: JSON.parse(localStorage.getItem('logged_user')) || null,
    onAuthStateChanged(callback) { setTimeout(() => callback(this.currentUser), 50); },
    async signInWithEmailAndPassword(email, password) {
        await DB.initPromise;
        const fullData = DB.get();
        const admins = fullData.users?.admins || {};
        const students = fullData.users?.students || {};
        const entry = Object.entries({ ...admins, ...students }).find(([, u]) =>
            u.email?.toLowerCase().trim() === email.toLowerCase().trim() && u.password === password
        );
        if (!entry) throw { code: 'auth/wrong-password', message: 'Incorrect email or password.' };
        const [uid, user] = entry;
        this.currentUser = { uid, email: user.email };
        localStorage.setItem('logged_user', JSON.stringify(this.currentUser));
        return { user: this.currentUser };
    },
    async createUserWithEmailAndPassword(email, password) {
        await DB.initPromise;
        const fullData = DB.get();
        if (!fullData.users) fullData.users = { admins: {}, students: {} };
        const allUsers = { ...(fullData.users.admins || {}), ...(fullData.users.students || {}) };
        if (Object.values(allUsers).find(u => u.email?.toLowerCase() === email.toLowerCase())) {
            throw { code: 'auth/email-already-in-use', message: 'Email already registered.' };
        }
        const uid = 'u-' + Math.random().toString(36).substr(2, 9);
        this.currentUser = { uid, email };
        localStorage.setItem('logged_user', JSON.stringify(this.currentUser));
        return { user: this.currentUser };
    },
    async signOut() {
        this.currentUser = null;
        localStorage.removeItem('logged_user');
        window.location.href = 'login.html';
    },
    Persistence: { LOCAL: 'local' },
    setPersistence: () => Promise.resolve()
};

// --- GLOBAL EXPORTS ---
DB.initPromise = DB.init();
DB.listenToStorage();

window.firebase = { initializeApp: () => { }, auth: () => MockAuth, database: () => new MockRef() };
window.auth = MockAuth;
window.rtdb = new MockRef();

window.getTodayString = () => new Date().toISOString().split('T')[0];

window.showToast = (message, type = 'info') => {
    let c = document.getElementById('toast-container') || document.createElement('div');
    if (!c.id) { c.id = 'toast-container'; c.className = 'toast-container'; document.body.appendChild(c); }
    const t = document.createElement('div'); t.className = `toast ${type}`;
    const i = { success: '✓', error: '✕', info: 'ℹ' };
    t.innerHTML = `<span>${i[type] || 'ℹ'}</span><span>${message}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('exit'); setTimeout(() => t.remove(), 300); }, 3500);
};

window.showLoading = () => {
    let o = document.getElementById('loading-overlay') || document.createElement('div');
    if (!o.id) { o.id = 'loading-overlay'; o.className = 'spinner-overlay'; o.innerHTML = '<div class="spinner"></div>'; document.body.appendChild(o); }
    o.style.display = 'flex';
};
window.hideLoading = () => { const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none'; };

window.getInitials = (n) => !n ? '?' : n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

window.requireAuth = (role, cb) => {
    showLoading();
    auth.onAuthStateChanged(async (u) => {
        if (!u) { window.location.href = 'login.html'; return; }
        const d = DB.get();
        const userData = (role === 'teacher') ? d.users?.admins?.[u.uid] : d.users?.students?.[u.uid];
        if (!userData) {
            // Check cross-role (maybe student trying to enter admin panel)
            const other = (role === 'teacher') ? d.users?.students?.[u.uid] : d.users?.admins?.[u.uid];
            if (other) { window.location.href = (role === 'teacher') ? 'student.html' : 'teacher.html'; return; }
            auth.signOut(); return;
        }
        hideLoading(); cb({ id: u.uid, ...userData });
    });
};

window.exportDB = () => {
    const d = DB.get();
    const blob = new Blob([JSON.stringify(d, null, 4)], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = u; a.download = 'db.json'; a.click();
};

window.getOrGenerateDailyExam = async () => {
    await DB.initPromise;
    const d = DB.get();
    const today = getTodayString();
    const cfg = d.config || {};
    const allQsMap = d.questions || {};

    if (cfg.currentExamDate === today && cfg.currentExamQuestions?.length > 0) {
        const valid = cfg.currentExamQuestions.map(id => allQsMap[id] ? { id, ...allQsMap[id] } : null).filter(q => q);
        if (valid.length > 0) return valid;
    }

    const allIds = Object.keys(allQsMap);
    if (allIds.length === 0) return [];
    const size = cfg.quizSize || 5;
    const shuffled = _seededShuffle(allIds, today);
    const selected = shuffled.slice(0, Math.min(size, allIds.length));

    cfg.currentExamDate = today;
    cfg.currentExamQuestions = selected;
    d.config = cfg;
    DB.save(d);
    return selected.map(id => ({ id, ...allQsMap[id] }));
};

function _seededShuffle(array, seed) {
    const copy = [...array];
    let h = 0; for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i) | 0;
    const rand = () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

window.setDailyExam = async (ids) => {
    const d = DB.get();
    d.config = d.config || {};
    d.config.currentExamDate = getTodayString();
    d.config.currentExamQuestions = ids;
    await DB.save(d);
    showToast('Exam Published Successfully! 🚀', 'success');
};

window.setQuizSize = async (n) => {
    const d = DB.get();
    d.config = d.config || {};
    d.config.quizSize = parseInt(n) || 5;
    await DB.save(d);
};

console.log("🚀 Premium DB Service Loaded");
