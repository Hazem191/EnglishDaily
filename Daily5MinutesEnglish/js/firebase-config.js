/* ========================================
   Firebase Configuration
   ======================================== */

// Import Firebase SDK (using compat mode for simplicity)
// These are loaded via CDN in the HTML files

// ⚠️ REPLACE with your own Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBeQwyuTGmgE0j4tDJKqV8ESqwijzR2v9U",
  authDomain: "daily-5-minutes-english.firebaseapp.com",
  projectId: "daily-5-minutes-english",
  storageBucket: "daily-5-minutes-english.firebasestorage.app",
  messagingSenderId: "29579181913",
  appId: "1:29579181913:web:1f13e01a2217ea2839d648",
  measurementId: "G-TKQ1ESMM4S"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase services
const auth = firebase.auth();
const rtdb = firebase.database(); // Use Realtime Database for JSON-centric approach

// Set persistence to LOCAL
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

/* ========================================
   Utility Functions
   ======================================== */

/**
 * Get today's date string in YYYY-MM-DD format
 */
function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Show loading spinner overlay
 */
function showLoading() {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'spinner-overlay';
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

/**
 * Hide loading spinner overlay
 */
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * Get user initials from name
 */
function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Check if user is authenticated and redirect accordingly
 */
function requireAuth(requiredRole, callback) {
  showLoading();
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.log('No user detected, redirecting to login...');
      window.location.href = 'login.html';
      return;
    }

    console.log('User detected:', user.email);

    try {
      // Check in Realtime Database under 'users/role/uid'
      // We'll structure users as: /users/students/{uid} and /users/admins/{uid}

      let userData = null;

      // Try searching in students branch
      const studentRef = rtdb.ref(`users/students/${user.uid}`);
      const studentSnap = await studentRef.once('value');

      if (studentSnap.exists()) {
        userData = { id: user.uid, ...studentSnap.val(), role: 'student' };
      } else {
        // Try searching in admins branch
        const adminRef = rtdb.ref(`users/admins/${user.uid}`);
        const adminSnap = await adminRef.once('value');
        if (adminSnap.exists()) {
          userData = { id: user.uid, ...adminSnap.val(), role: 'teacher' };
        }
      }

      if (!userData) {
        console.error('User data not found in JSON tree for:', user.uid);
        showToast('Account data not found. Please register again.', 'error');
        auth.signOut();
        window.location.href = 'login.html';
        return;
      }

      console.log('User data loaded:', userData.role);

      if (requiredRole && userData.role !== requiredRole) {
        window.location.href = userData.role === 'teacher' ? 'teacher.html' : 'student.html';
        return;
      }

      hideLoading();
      if (callback) callback(userData);
    } catch (error) {
      console.error('Critical Auth Error:', error);
      hideLoading();
      showToast('Session error. Please login again.', 'error');
      auth.signOut();
      window.location.href = 'login.html';
    }
  });
}

/**
 * Setup navbar with user info
 */
function setupNavbar(userData) {
  const navUserName = document.getElementById('nav-user-name');
  const navUserRole = document.getElementById('nav-user-role');
  const navAvatar = document.getElementById('nav-avatar');
  const logoutBtn = document.getElementById('btn-logout');
  const hamburger = document.getElementById('hamburger');
  const navbarNav = document.getElementById('navbar-nav');

  if (navUserName) navUserName.textContent = userData.name || 'User';
  if (navUserRole) navUserRole.textContent = userData.role === 'teacher' ? 'Teacher' : 'Student';
  if (navAvatar) navAvatar.textContent = getInitials(userData.name);

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      auth.signOut().then(() => {
        window.location.href = 'login.html';
      });
    });
  }

  // Mobile hamburger toggle
  if (hamburger && navbarNav) {
    hamburger.addEventListener('click', () => {
      navbarNav.classList.toggle('open');
    });

    // Close nav when clicking a link
    navbarNav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navbarNav.classList.remove('open');
      });
    });
  }
}
