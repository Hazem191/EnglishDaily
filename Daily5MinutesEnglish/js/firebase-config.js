/* ========================================
   Firebase Configuration (Cleaned Up)
   All mock services, auth functions, and DB 
   utilities have been moved to db-service.js.
   ======================================== */

/**
 * Setup navbar with user info
 * This handles the UI for the top navigation bar.
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
    if (navAvatar) navAvatar.textContent = typeof getInitials === 'function' ? getInitials(userData.name) : '?';

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
