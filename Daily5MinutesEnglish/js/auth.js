/* ========================================
   Authentication Module
   Handles login and registration for
   student and teacher roles.
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

    // ── If already logged in, redirect immediately ──
    auth.onAuthStateChanged(async (user) => {
        if (!user) { hideLoading(); return; }
        try {
            // Wait for DB to be fully loaded before reading it (race-condition fix)
            await DB.initPromise;
            const data = DB.get();
            if (data.users?.admins?.[user.uid]) {
                window.location.href = 'teacher.html'; return;
            }
            if (data.users?.students?.[user.uid]) {
                window.location.href = 'student.html'; return;
            }
        } catch (e) { console.error('Auth redirect check:', e); }
        hideLoading();
    });

    // ── Tab Switching ──
    const loginTab = document.getElementById('tab-login');
    const registerTab = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginTab && registerTab) {
        loginTab.addEventListener('click', () => {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm?.classList.remove('hidden');
            registerForm?.classList.add('hidden');
        });
        registerTab.addEventListener('click', () => {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm?.classList.remove('hidden');
            loginForm?.classList.add('hidden');
        });
    }

    // ── Login Form ──
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            errorEl.textContent = '';

            if (!email || !password) {
                errorEl.textContent = 'Please fill in all fields.';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner spinner-sm"></div> Signing in...';

            try {
                await DB.initPromise;

                if (!DB.serverReachable && DB.lastSyncError) {
                    console.warn('Server sync issue:', DB.lastSyncError);
                }

                const credential = await auth.signInWithEmailAndPassword(email, password);
                const uid = credential.user.uid;

                // Check Admin
                const adminSnap = await rtdb.ref(`users/admins/${uid}`).once('value');
                if (adminSnap.exists()) {
                    showToast('Welcome back.', 'success');
                    setTimeout(() => window.location.href = 'teacher.html', 600);
                    return;
                }

                // Check Student
                const studentSnap = await rtdb.ref(`users/students/${uid}`).once('value');
                if (studentSnap.exists()) {
                    const name = studentSnap.val().name || 'Student';
                    await DB.reloadFromServer();
                    showToast(`Welcome back, ${name}.`, 'success');
                    setTimeout(() => window.location.href = 'student.html', 600);
                    return;
                }

                errorEl.textContent = 'Incorrect email or password.';
                auth.signOut();
            } catch (error) {
                console.error('Login error:', error);
                const msgs = {
                    'auth/wrong-password': 'Incorrect email or password.',
                    'auth/invalid-email': 'Invalid email address.',
                    'auth/too-many-requests': 'Too many attempts. Try again later.',
                    'auth/invalid-credential': 'Incorrect email or password.',
                    'auth/user-not-found': 'Incorrect email or password.',
                    'auth/unsupported': window.ui?.lang === 'ar'
                        ? 'افتح الموقع عبر HTTPS (الرابط الرسمي على Vercel).'
                        : 'Open the site via HTTPS (official Vercel link).',
                };
                errorEl.textContent = msgs[error.code] || 'Incorrect email or password.';
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span data-en="Ready to Learn →" data-ar="بدء التعلم ←">Ready to Learn →</span>';
                if (window.ui) ui.translate(submitBtn);
            }
        });
    }

    // ── Register Form ──
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('register-name').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password')?.value;
            const errorEl = document.getElementById('register-error');
            const submitBtn = registerForm.querySelector('button[type="submit"]');

            errorEl.textContent = '';

            // Validate fields
            if (!name || !email || !password) {
                errorEl.textContent = 'Please fill in all fields.';
                return;
            }

            if (password.length < 6) {
                errorEl.textContent = window.ui?.lang === 'ar'
                    ? 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.'
                    : 'Password must be at least 6 characters.';
                return;
            }

            if (confirmPassword !== undefined && password !== confirmPassword) {
                errorEl.textContent = window.ui?.lang === 'ar'
                    ? 'كلمتا المرور غير متطابقتين.'
                    : 'Passwords do not match.';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner spinner-sm"></div> Creating account...';

            try {
                await DB.initPromise;

                const response = await serverAuthRequest({ action: 'register', name, email, password });

                if (response.ok) {
                    const user = await response.json();
                    auth.currentUser = { uid: user.uid, email: user.email };
                    localStorage.setItem('logged_user', JSON.stringify(auth.currentUser));
                    await DB.reloadFromServer();
                    showToast('Account created. Redirecting…', 'success');
                    setTimeout(() => window.location.href = 'student.html', 800);
                    return;
                }

                const errBody = await response.json().catch(() => ({}));
                if (response.status === 409) {
                    throw { code: 'auth/email-already-in-use', message: errBody.error || 'Email already in use.' };
                }
                throw new Error(errBody.error || 'Registration failed');
            } catch (serverErr) {
                if (serverErr?.code === 'auth/email-already-in-use') {
                    errorEl.textContent = serverErr.message;
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span data-en="Create My Account" data-ar="إنشاء حسابي">Create My Account</span>';
                    if (window.ui) ui.translate(submitBtn);
                    return;
                }
                console.warn('Server register failed, trying local fallback:', serverErr?.message || serverErr);
            }

            try {
                const credential = await auth.createUserWithEmailAndPassword(email, password);
                const uid = credential.user.uid;

                const hashedPw = await hashPassword(password);
                await rtdb.ref(`users/students/${uid}`).set({
                    id: uid,
                    name,
                    email,
                    password: hashedPw,
                    role: 'student',
                    totalScore: 0,
                    createdAt: Date.now()
                });

                if (!DB.serverReachable) {
                    errorEl.textContent = window.ui?.lang === 'ar'
                        ? 'تم إنشاء الحساب محلياً لكن فشل الحفظ على السيرفر. تحقق من الإنترنت وأعد المحاولة.'
                        : 'Account created locally but server save failed. Check connection and try again.';
                    auth.signOut();
                    return;
                }

                showToast('Account created. Redirecting…', 'success');
                setTimeout(() => window.location.href = 'student.html', 800);

            } catch (error) {
                console.error('Registration error:', error);
                const msgs = {
                    'auth/email-already-in-use': 'Email already in use.',
                    'auth/invalid-email': 'Invalid email address.',
                    'auth/weak-password': 'Password too weak.',
                };
                errorEl.textContent = msgs[error.code] || error.message;
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span data-en="Create My Account" data-ar="إنشاء حسابي">Create My Account</span>';
                if (window.ui) ui.translate(submitBtn);
            }
        });
    }
});

// ── Password toggle helper ──
window.togglePasswordView = function (inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';

    // Update SVG icon
    if (isHidden) {
        // Now it is TEXT, show EYE-OFF (to hide)
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>`;
    } else {
        // Now it is PASSWORD, show EYE (to show)
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>`;
    }
};
