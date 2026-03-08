/* ========================================
   Global UI Sync (Theme & Language)
   Fully covers all pages & dynamic content
   ======================================== */

const UI = {
    theme: localStorage.getItem('theme') || 'dark',
    lang: localStorage.getItem('lang') || 'en',

    init() {
        this.applyTheme(this.theme);
        this.applyLang(this.lang);

        // React to storage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'theme') this.applyTheme(e.newValue);
            if (e.key === 'lang') this.applyLang(e.newValue);
        });

        // Wire up buttons once DOM is ready
        const onReady = () => {
            const themeBtn = document.getElementById('theme-toggle');
            const langBtn = document.getElementById('lang-toggle');
            if (themeBtn) themeBtn.onclick = () => this.toggleTheme();
            if (langBtn) langBtn.onclick = () => this.toggleLang();

            // Smart Home/Brand Navigation
            this.setupSmartHomeLinks();
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', onReady);
        } else {
            onReady();
        }
    },

    setupSmartHomeLinks() {
        const user = JSON.parse(localStorage.getItem('logged_user'));
        if (!user) return;

        // Find all links to index.html or with .brand class or .nav-link saying Home
        const links = document.querySelectorAll('a[href="index.html"], a.brand, a.nav-link');
        links.forEach(a => {
            const txt = a.textContent.toLowerCase().trim();
            const isHome = (txt === 'home' || txt === 'الرئيسية' || a.classList.contains('brand')) && !a.hasAttribute('data-force-index');
            const path = window.location.pathname;

            if (isHome && !path.includes('login.html')) {
                // Determine dashboard based on role from DB
                const data = JSON.parse(localStorage.getItem('daily_english_db') || '{}');
                const isAdmin = data.users?.admins?.[user.uid];
                const target = isAdmin ? 'teacher.html' : 'student.html';

                a.href = target;
                if (a.classList.contains('nav-link') && !a.classList.contains('brand')) {
                    a.setAttribute('data-en', 'Dashboard');
                    a.setAttribute('data-ar', 'لوحة التحكم');
                    this.translate(a);
                }
            }
        });
    },

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(this.theme);
        localStorage.setItem('theme', this.theme);
    },

    toggleLang() {
        this.lang = this.lang === 'en' ? 'ar' : 'en';
        this.applyLang(this.lang);
        localStorage.setItem('lang', this.lang);
    },

    applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.innerHTML = t === 'dark' ? '🌙' : '☀️';
    },

    applyLang(l) {
        this.lang = l;
        document.documentElement.setAttribute('lang', l);
        document.body.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
        document.body.classList.toggle('lang-ar', l === 'ar');

        const langBtn = document.getElementById('lang-toggle');
        if (langBtn) langBtn.textContent = l === 'ar' ? 'EN' : 'AR';

        // 1. Translate static content
        this.translate(document.body);

        // 2. Notify dynamic modules
        if (window.renderQuestion) window.renderQuestion();
        if (window.initPage) window.initPage();
    },

    translate(root = document.body) {
        const l = this.lang;
        root.querySelectorAll('[data-en]').forEach(el => {
            const val = el.getAttribute(`data-${l}`);
            if (!val) return;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = val;
            else if (el.tagName === 'OPTION' || el.tagName === 'IMG') { if (el.tagName === 'IMG') el.alt = val; else el.textContent = val; }
            else el.textContent = val;

            const title = el.getAttribute(`data-${l}-title`);
            if (title) el.title = title;
        });
    }
};

UI.init();
window.ui = UI;
