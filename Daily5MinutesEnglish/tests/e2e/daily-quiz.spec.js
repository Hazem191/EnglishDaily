// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Daily English P1 smoke', () => {
  test('landing page loads and links to login', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page).toHaveTitle(/Daily English/i);
    await page.getByRole('link', { name: /Create student account|إنشاء حساب طالب/i }).click();
    await expect(page).toHaveURL(/login\.html/);
  });

  test('student can register and reach dashboard', async ({ page }) => {
    const email = `test-${Date.now()}@example.com`;
    await page.goto('/login.html');
    await page.getByText(/Register|تسجيل/i).click();
    await page.fill('#register-name', 'Playwright Student');
    await page.fill('#register-email', email);
    await page.fill('#register-password', 'test1234');
    await page.fill('#register-confirm-password', 'test1234');
    await page.locator('#register-form button[type="submit"]').click();
    await expect(page).toHaveURL(/student\.html/, { timeout: 15000 });
  });

  test('leaderboard page renders', async ({ page }) => {
    await page.goto('/leaderboard.html');
    await expect(page.locator('#leaderboard-container, #podium-container').first()).toBeVisible();
  });
});
