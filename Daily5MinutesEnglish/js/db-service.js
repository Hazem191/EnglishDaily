/* ========================================
   JSON-Based Data Service (v8)
   — SHA-256 Password Hashing
   — API Secret Token on every request
   — 30-second server polling (real-time)
   — MockRef.off() for listener cleanup
   — requireAuth race condition fixed
   ======================================== */

const DB_KEY = 'daily_english_db';
const DB_VERSION = '13';  // sync fix: profile data without passwords
const DB_VER_KEY = 'daily_english_db_version';
const API_SECRET = 'daily-english-secure-2025-key'; // ← Must match api.php
const API_TIMEOUT_MS = 25000;
const API_RETRIES = 3;

let _resolvedApiUrl = null;

function safeStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn('localStorage read blocked:', e);
        return null;
    }
}

function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.error('localStorage write blocked:', e);
        return false;
    }
}

function safeStorageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch (_) { /* ignore */ }
}

async function getApiUrl() {
    if (_resolvedApiUrl) return _resolvedApiUrl;
    const candidates = ['/api/db', 'api.php'];
    for (const url of candidates) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'X-API-Token': API_SECRET },
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timer);
            if (response.ok) {
                _resolvedApiUrl = url;
                return url;
            }
        } catch (_) { /* try next */ }
    }
    _resolvedApiUrl = 'api.php';
    return _resolvedApiUrl;
}

async function fetchWithRetry(url, options = {}, retries = API_RETRIES) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                ...options,
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timer);
            return response;
        } catch (err) {
            clearTimeout(timer);
            lastError = err;
            if (attempt < retries) {
                await new Promise((r) => setTimeout(r, 800 * attempt));
            }
        }
    }
    throw lastError || new Error('Network request failed');
}

/* ── Password Hashing (SHA-256 via built-in Web Crypto API) ── */
async function hashPassword(password) {
    if (!window.isSecureContext || !window.crypto?.subtle) {
        throw {
            code: 'auth/unsupported',
            message: 'Open the site with HTTPS (not http) to sign in on mobile.'
        };
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/** Check whether a string looks like a hex SHA-256 hash */
function isHashed(str) {
    return typeof str === 'string' && str.length === 64 && /^[0-9a-f]+$/i.test(str);
}

/* ── Default / Seed Data ── */
const defaultData = {
    users: {
        admins: {
            "admin-main": {
                id: "admin-main", name: "Admin",
                email: "Shrouk@Admin.com",
                password: "",   // set in db.json; auto-hashed at init via _upgradePlaintextPasswords
                role: "teacher"
            }
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
    config: { quizSize: 5, currentExamDate: null, currentExamQuestions: [] }
};

/* ── High-level DB Controller ── */
const DB = {
    listeners: [],
    initPromise: null,
    _pollInterval: null,
    serverReachable: false,
    lastSyncError: null,

    async init() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            const storedVersion = safeStorageGet(DB_VER_KEY);
            if (storedVersion !== DB_VERSION) {
                console.warn(`⚠️ DB version changed (${storedVersion} → ${DB_VERSION}). Refreshing cache...`);
                safeStorageRemove(DB_KEY);
            }

            const localData = safeStorageGet(DB_KEY);
            let remoteData = null;

            try {
                const apiUrl = await getApiUrl();
                const response = await fetchWithRetry(apiUrl, {
                    headers: { 'X-API-Token': API_SECRET }
                });
                if (response.ok) {
                    const text = await response.text();
                    try {
                        remoteData = JSON.parse(text);
                        this.serverReachable = true;
                        this.lastSyncError = null;
                        console.log('📂 Synced with server (' + apiUrl + ')');
                    } catch (e) {
                        console.warn('API returned non-JSON content.');
                        this.lastSyncError = 'invalid-json';
                    }
                } else {
                    this.lastSyncError = `HTTP ${response.status}`;
                    console.warn('API GET failed:', response.status);
                    if (response.status === 404) {
                        this.serverReachable = true;
                    }
                }
            } catch (e) {
                this.serverReachable = false;
                this.lastSyncError = e?.name === 'AbortError' ? 'timeout' : 'network';
                console.warn('Server sync unavailable:', e?.message || e);
            }

            let finalData;
            const currentLocal = localData ? JSON.parse(localData) : null;

            if (remoteData && !remoteData.error) {
                // Server is the source of truth when reachable (fixes phone/laptop drift)
                finalData = _applyRemoteData(remoteData, currentLocal);
            } else if (currentLocal) {
                finalData = _deepMergeDefaults(currentLocal, defaultData);
            } else {
                finalData = JSON.parse(JSON.stringify(defaultData));
            }

            if (!remoteData && this.lastSyncError === 'HTTP 404') {
                try {
                    const seeded = await this.syncWithServer(finalData);
                    if (seeded && await this.reloadFromServer()) {
                        finalData = this.get();
                    }
                } catch (e) {
                    console.warn('Could not seed empty server:', e);
                }
            }

            _ensureSeedAccounts(finalData);
            const upgraded = await _upgradePlaintextPasswords(finalData);
            if (!safeStorageSet(DB_KEY, JSON.stringify(finalData))) {
                showToast(
                    window.ui?.lang === 'ar'
                        ? 'تعذر حفظ البيانات محلياً. أغلق وضع التصفح الخاص أو اسمح بالتخزين.'
                        : 'Could not save data locally. Disable private browsing or allow storage.',
                    'error'
                );
            }
            safeStorageSet(DB_VER_KEY, DB_VERSION);
            if (upgraded) {
                try { await DB.save(finalData, { silent: true }); } catch (e) { console.warn('Password upgrade sync failed:', e); }
            }
            this.notify();
        })();

        return this.initPromise;
    },

    get() {
        const raw = safeStorageGet(DB_KEY);
        return raw ? JSON.parse(raw) : defaultData;
    },

    async save(data, options = {}) {
        if (!safeStorageSet(DB_KEY, JSON.stringify(data))) {
            throw new Error('localStorage blocked');
        }
        this.notify();
        const synced = await this.syncWithServer(data);
        if (!synced && !options.silent) {
            const isAr = window.ui?.lang === 'ar';
            showToast(
                isAr
                    ? 'تعذر الحفظ على السيرفر. تحقق من الإنترنت وحاول مرة أخرى.'
                    : 'Could not save to server. Check your connection and try again.',
                'error'
            );
        }
        return synced;
    },

    /** Pull latest data from server into localStorage (use after login or manual refresh). */
    async reloadFromServer() {
        try {
            const apiUrl = await getApiUrl();
            const response = await fetchWithRetry(apiUrl, {
                headers: { 'X-API-Token': API_SECRET }
            });
            if (!response.ok) {
                this.serverReachable = false;
                this.lastSyncError = `HTTP ${response.status}`;
                return false;
            }
            const remoteData = JSON.parse(await response.text());
            if (!remoteData || remoteData.error) return false;

            const currentLocal = this.get();
            const finalData = _applyRemoteData(remoteData, currentLocal);
            safeStorageSet(DB_KEY, JSON.stringify(finalData));
            safeStorageSet(DB_VER_KEY, DB_VERSION);
            this.serverReachable = true;
            this.lastSyncError = null;
            this.notify();
            return true;
        } catch (e) {
            this.serverReachable = false;
            this.lastSyncError = e?.name === 'AbortError' ? 'timeout' : 'network';
            return false;
        }
    },

    async syncWithServer(data) {
        try {
            const apiUrl = await getApiUrl();
            const headers = {
                'Content-Type': 'application/json',
                'X-API-Token': API_SECRET
            };
            try {
                const loggedUser = JSON.parse(safeStorageGet('logged_user') || 'null');
                if (loggedUser?.uid && data?.users?.admins?.[loggedUser.uid]) {
                    headers['X-Requesting-Admin'] = loggedUser.uid;
                }
            } catch (_) { /* ignore */ }

            const response = await fetchWithRetry(apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(_prepareSyncPayload(data))
            });

            if (!response.ok) {
                this.serverReachable = false;
                this.lastSyncError = `HTTP ${response.status}`;
                return false;
            }

            this.serverReachable = true;
            this.lastSyncError = null;
            return true;
        } catch (e) {
            this.serverReachable = false;
            this.lastSyncError = e?.name === 'AbortError' ? 'timeout' : 'network';
            console.warn('Sync failed:', e?.message || e);
            return false;
        }
    },

    notify() {
        this.listeners.forEach(l => l.callback(this.snap(l.path)));
    },

    listenToStorage() {
        window.addEventListener('storage', (e) => {
            if (e.key === DB_KEY) this.notify();
        });
    },

    /**
     * Start polling the server every `intervalMs` ms.
     * Only triggers notify() when dailyResults or students actually changed.
     * This gives real-time-like behaviour for multi-user shared hosting.
     */
    startPolling(intervalMs = 8000) {
        if (this._pollInterval) clearInterval(this._pollInterval);
        this._pollInterval = setInterval(async () => {
            try {
                const apiUrl = await getApiUrl();
                const response = await fetchWithRetry(apiUrl, {
                    headers: { 'X-API-Token': API_SECRET }
                }, 1);
                if (!response.ok) return;
                const remoteData = JSON.parse(await response.text());
                if (!remoteData || remoteData.error) return;

                const currentLocal = this.get();
                const snapshot = (d) => JSON.stringify({
                    students: d.users?.students,
                    dailyResults: d.dailyResults,
                    questions: d.questions,
                    config: d.config
                });
                const remoteSnap = snapshot(remoteData);
                const localSnap = snapshot(currentLocal);

                if (remoteSnap !== localSnap) {
                    const merged = _applyRemoteData(remoteData, currentLocal);
                    safeStorageSet(DB_KEY, JSON.stringify(merged));
                    this.serverReachable = true;
                    this.notify();
                    console.log('🔄 Synced from server');
                }
            } catch (e) { /* silent — server unreachable */ }
        }, intervalMs);
    },

    stopPolling() {
        if (this._pollInterval) { clearInterval(this._pollInterval); this._pollInterval = null; }
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

function _prepareSyncPayload(data) {
    const payload = JSON.parse(JSON.stringify(data));
    if (!payload.users) return payload;

    // Send student/admin profiles (scores, names) but never passwords
    for (const role of ['admins', 'students']) {
        const bucket = payload.users[role];
        if (!bucket) continue;
        for (const id of Object.keys(bucket)) {
            if (bucket[id]) delete bucket[id].password;
        }
    }

    return payload;
}

function _mergeDailyResults(remote, local) {
    const result = JSON.parse(JSON.stringify(remote || {}));
    if (!local || typeof local !== 'object') return result;
    for (const [uid, dates] of Object.entries(local)) {
        if (!dates || typeof dates !== 'object') continue;
        if (!result[uid]) result[uid] = {};
        for (const [date, res] of Object.entries(dates)) {
            const existing = result[uid][date];
            const localTs = res?.timestamp || 0;
            const remoteTs = existing?.timestamp || 0;
            if (!existing || localTs >= remoteTs) {
                result[uid][date] = res;
            }
        }
    }
    return result;
}

function _applyRemoteData(remoteData, localData = null) {
    const finalData = _deepMergeDefaults(remoteData, defaultData);
    if (localData?.dailyResults) {
        finalData.dailyResults = _mergeDailyResults(finalData.dailyResults, localData.dailyResults);
    }
    return finalData;
}

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

/** Keep local user accounts when merging with server (important on mobile) */
function _deepMergeUsers(local, remote) {
    const result = _deepMergeDefaults(remote, defaultData);
    if (local.users?.students) {
        result.users = result.users || {};
        result.users.students = { ...(result.users.students || {}), ...local.users.students };
    }
    if (local.users?.admins) {
        result.users = result.users || {};
        result.users.admins = { ...(result.users.admins || {}), ...local.users.admins };
    }
    if (local.dailyResults) {
        result.dailyResults = { ...(result.dailyResults || {}), ...local.dailyResults };
    }
    return result;
}

function _ensureSeedAccounts(data) {
    if (!data.users) data.users = {};
    if (!data.users.admins) data.users.admins = {};
    if (!data.users.students) data.users.students = {};
    if (!data.config) data.config = { quizSize: 5, currentExamDate: null, currentExamQuestions: [] };
    if (!data.dailyResults) data.dailyResults = {};
}

/** Hash any legacy plain-text passwords in user records at load time */
async function _upgradePlaintextPasswords(data) {
    if (!data.users) return false;
    let upgraded = false;
    const upgradeUser = async (user) => {
        if (user?.password && !isHashed(user.password)) {
            user.password = await hashPassword(user.password);
            upgraded = true;
        }
    };
    for (const u of Object.values(data.users.admins || {})) await upgradeUser(u);
    for (const u of Object.values(data.users.students || {})) await upgradeUser(u);
    return upgraded;
}

window.resetDB = async function () {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(DB_VER_KEY);
    localStorage.removeItem('logged_user');
    DB.initPromise = null;
    await DB.init();
    showToast('Database reset successfully!', 'success');
};

/* ── Mock Realtime Database Reference ── */
class MockRef {
    constructor(path = '') { this.path = path; }

    ref(subPath) { return new MockRef(this.path ? `${this.path}/${subPath}` : subPath); }

    async once(type) {
        if (type !== 'value') return null;
        await DB.initPromise;
        return DB.snap(this.path);
    }

    /**
     * Subscribe to value changes. Returns the callback reference so it can
     * be passed to off() later (matching real Firebase behaviour).
     */
    on(type, callback) {
        if (type !== 'value') return callback;
        // Deduplicate: remove any previous subscription for the exact same path+callback
        DB.listeners = DB.listeners.filter(l => !(l.path === this.path && l.callback === callback));
        DB.listeners.push({ path: this.path, callback });
        callback(DB.snap(this.path)); // immediate first call
        return callback; // return ref for off()
    }

    /**
     * Unsubscribe from value changes.
     * off('value', callback) removes that specific callback.
     * off()  or  off('value') removes ALL callbacks for this path.
     */
    off(type, callback) {
        if (!callback) {
            DB.listeners = DB.listeners.filter(l => l.path !== this.path);
        } else {
            DB.listeners = DB.listeners.filter(l => !(l.path === this.path && l.callback === callback));
        }
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

/* ── Mock Auth Module ── */
function readLoggedUser() {
    try {
        return JSON.parse(safeStorageGet('logged_user') || 'null');
    } catch {
        return null;
    }
}

const MockAuth = {
    get currentUser() {
        return readLoggedUser();
    },
    set currentUser(value) {
        if (value) safeStorageSet('logged_user', JSON.stringify(value));
        else safeStorageRemove('logged_user');
    },

    onAuthStateChanged(callback) {
        setTimeout(() => callback(readLoggedUser()), 50);
    },

    async signInWithEmailAndPassword(email, password) {
        await DB.initPromise;

        try {
            const response = await serverAuthRequest({ action: 'login', email, password });

            if (response.ok) {
                const user = await response.json();
                this.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    role: user.role,
                    name: user.name || ''
                };
                safeStorageSet('logged_user', JSON.stringify(this.currentUser));
                await DB.reloadFromServer();
                DB.serverReachable = true;
                DB.lastSyncError = null;
                return { user: this.currentUser, role: user.role };
            }

            const errBody = await response.json().catch(() => ({}));

            if (response.status === 401) {
                throw { code: 'auth/wrong-password', message: 'Incorrect email or password.' };
            }

            throw {
                code: 'auth/server-error',
                message: errBody.error || `Login failed (HTTP ${response.status}).`
            };
        } catch (e) {
            if (e?.code) throw e;
            console.warn('Server auth unavailable:', e?.message || e);

            const isLocalDev = ['localhost', '127.0.0.1'].includes(location.hostname);
            if (isLocalDev && !DB.serverReachable) {
                return this._localSignIn(email, password);
            }

            throw {
                code: 'auth/network',
                message: 'Cannot reach server. Check your internet connection.'
            };
        }
    },

    async _localSignIn(email, password) {
        const fullData = DB.get();
        const allUsers = {
            ...(fullData.users?.admins || {}),
            ...(fullData.users?.students || {})
        };

        // Find by email (case-insensitive)
        const entry = Object.entries(allUsers).find(([, u]) =>
            u.email?.toLowerCase().trim() === email.toLowerCase().trim()
        );
        if (!entry) throw { code: 'auth/user-not-found', message: 'No account found with this email.' };

        const [uid, user] = entry;
        const storedPw = user.password || '';
        const hashedInput = await hashPassword(password);

        // Support both hashed (64-char hex) and legacy plain-text passwords
        const isLegacyPlain = !isHashed(storedPw);
        const passwordMatch = isLegacyPlain ? storedPw === password : storedPw === hashedInput;

        if (!passwordMatch) throw { code: 'auth/wrong-password', message: 'Incorrect email or password.' };

        // Auto-upgrade legacy plain-text password to SHA-256 hash
        if (isLegacyPlain && storedPw.length > 0) {
            try {
                const upgradeData = DB.get();
                if (upgradeData.users?.admins?.[uid]) {
                    upgradeData.users.admins[uid].password = hashedInput;
                } else if (upgradeData.users?.students?.[uid]) {
                    upgradeData.users.students[uid].password = hashedInput;
                }
                await DB.save(upgradeData);
                console.log('🔒 Password auto-upgraded to hash for:', email);
            } catch (e) {
                console.warn('Password upgrade failed (non-critical):', e);
            }
        }

        this.currentUser = { uid, email: user.email };
        safeStorageSet('logged_user', JSON.stringify(this.currentUser));
        return { user: this.currentUser };
    },

    async createUserWithEmailAndPassword(email, password) {
        await DB.initPromise;
        const fullData = DB.get();
        const allUsers = {
            ...(fullData.users?.admins || {}),
            ...(fullData.users?.students || {})
        };
        if (Object.values(allUsers).find(u => u.email?.toLowerCase() === email.toLowerCase())) {
            throw { code: 'auth/email-already-in-use', message: 'Email already registered.' };
        }
        const uid = 'u-' + Math.random().toString(36).substr(2, 9);
        this.currentUser = { uid, email };
        safeStorageSet('logged_user', JSON.stringify(this.currentUser));
        return { user: this.currentUser };
    },

    async signOut() {
        this.currentUser = null;
        safeStorageRemove('logged_user');
        window.location.href = 'login.html';
    },

    Persistence: { LOCAL: 'local' },
    setPersistence: () => Promise.resolve()
};

/* ── Global Exports ── */
DB.initPromise = DB.init();
DB.listenToStorage();

// Start polling once init is done (8s interval → cross-device sync)
DB.initPromise.then(() => {
    DB.startPolling(8000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || window.__quizActive) return;
        DB.reloadFromServer().then((ok) => { if (ok) DB.notify(); });
    });
});

window.firebase = { initializeApp: () => { }, auth: () => MockAuth, database: () => new MockRef() };
window.auth = MockAuth;
window.rtdb = new MockRef();
window.hashPassword = hashPassword; // expose for auth.js

window.serverAuthRequest = (body) => fetchWithRetry('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});

window.getTodayString = () => new Date().toISOString().split('T')[0];

window.showToast = (message, type = 'info') => {
    let c = document.getElementById('toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toast-container';
        c.className = 'toast-container';
        document.body.appendChild(c);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    t.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('exit'); setTimeout(() => t.remove(), 300); }, 3500);
};

window.showConfirmDialog = ({
    title = 'Confirm',
    message = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false
} = {}) => new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
        <div class="confirm-dialog" role="dialog" aria-modal="true">
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(message)}</p>
            <div class="confirm-actions">
                <button type="button" class="btn btn-outline" data-action="cancel">${escapeHTML(cancelText)}</button>
                <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${escapeHTML(confirmText)}</button>
            </div>
        </div>`;

    const close = (result) => {
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown);
        resolve(result);
    };

    const onKeyDown = (e) => {
        if (e.key === 'Escape') close(false);
    };

    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-action="confirm"]').focus();
});

function escapeHTML(str) {
    if (!str) return '';
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

window.showLoading = () => {
    let o = document.getElementById('loading-overlay');
    if (!o) {
        o = document.createElement('div');
        o.id = 'loading-overlay';
        o.className = 'spinner-overlay';
        o.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(o);
    }
    o.style.display = 'flex';
};

window.hideLoading = () => {
    const o = document.getElementById('loading-overlay');
    if (o) o.style.display = 'none';
};

window.getInitials = (n) => !n ? '?' : n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

/** Merge session login data with stored DB profile (server may only have scores). */
window.mergeUserProfile = function mergeUserProfile(session, stored) {
    const s = stored && typeof stored === 'object' ? stored : {};
    const id = session.id || session.uid || s.id;
    return {
        ...session,
        ...s,
        id,
        name: s.name || session.name || '',
        email: s.email || session.email || '',
        role: session.role || s.role || 'student'
    };
};

/** Write missing name/email from session back into local DB + server. */
window.repairStudentProfile = async function repairStudentProfile(user) {
    if (!user?.id) return;
    const data = DB.get();
    const student = data.users?.students?.[user.id];
    if (!student) return;

    let changed = false;
    if (!student.name && user.name) {
        student.name = user.name;
        changed = true;
    }
    if (!student.email && user.email) {
        student.email = user.email;
        changed = true;
    }
    if (changed) await DB.save(data, { silent: true });
};

/**
 * requireAuth — Fixed race condition:
 * Always awaits DB.initPromise before reading user data so the DB is
 * guaranteed to be populated before role checks run.
 */
window.requireAuth = (role, cb) => {
    showLoading();
    auth.onAuthStateChanged(async (u) => {
        if (!u) { window.location.href = 'login.html'; return; }

        await DB.initPromise;

        let d = DB.get();
        let isAdmin = !!d.users?.admins?.[u.uid];
        let isStudent = !!d.users?.students?.[u.uid];

        if (!isAdmin && !isStudent) {
            await DB.reloadFromServer();
            d = DB.get();
            isAdmin = !!d.users?.admins?.[u.uid];
            isStudent = !!d.users?.students?.[u.uid];
        }

        const sessionRole =
            u.role === 'teacher' ? 'teacher' :
            u.role === 'student' ? 'student' : null;
        const actualRole = isAdmin ? 'teacher' : (isStudent ? 'student' : sessionRole);

        if (!actualRole) {
            auth.currentUser = null;
            window.location.href = 'login.html';
            return;
        }

        if (role && actualRole !== role) {
            window.location.href = actualRole === 'teacher' ? 'teacher.html' : 'student.html';
            return;
        }

        const dbUser = actualRole === 'teacher' ? d.users?.admins?.[u.uid] : d.users?.students?.[u.uid];
        const userData = mergeUserProfile(
            { id: u.uid, email: u.email || '', name: u.name || '', role: actualRole },
            dbUser
        );

        hideLoading();
        cb(userData);
    });
};

window.exportDB = () => {
    const d = DB.get();
    const blob = new Blob([JSON.stringify(d, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'db.json'; a.click();
    URL.revokeObjectURL(url);
};

window.getOrGenerateDailyExam = async () => {
    await DB.initPromise;
    const d = DB.get();
    const today = getTodayString();
    const cfg = d.config || {};
    const allQsMap = d.questions || {};

    if (cfg.currentExamDate === today && cfg.currentExamQuestions?.length > 0) {
        const valid = cfg.currentExamQuestions
            .map(id => allQsMap[id] ? { id, ...allQsMap[id] } : null)
            .filter(q => q);
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
    await DB.save(d, { silent: true });
    return selected.map(id => ({ id, ...allQsMap[id] }));
};

function _seededShuffle(array, seed) {
    const copy = [...array];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i) | 0;
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
    showToast('Exam published.', 'success');
};

window.setQuizSize = async (n) => {
    const d = DB.get();
    d.config = d.config || {};
    d.config.quizSize = parseInt(n) || 5;
    await DB.save(d);
};

console.log('🚀 DB Service v13 — Cross-device sync | Server polling 8s');
