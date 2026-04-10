// tests/presence.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Elaborate Presence, Lifecycle & Clock Drift Diagnostics', () => {

  test('Tracks players through joining, backgrounding, network drops, and time drift', async ({ browser }) => {
    test.setTimeout(60000); // 60 seconds allowed for heartbeat culling

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    const p1 = await context1.newPage();
    const p2 = await context2.newPage();
    const p3 = await context3.newPage();

    // 🚨 CLOCK DRIFT INJECTION 🚨
    // We hack Player 2's browser so every message they send tells Supabase 
    // it was sent "60 seconds ago". (Simulating a terribly inaccurate phone clock).
    await p2.addInitScript(() => {
        const originalDateNow = Date.now;
        Date.now = () => originalDateNow() - 60000; 
    });

    const GAME_URL = 'http://127.0.0.1:8080';

    await Promise.all([
      p1.goto(GAME_URL),
      p2.goto(GAME_URL),
      p3.goto(GAME_URL)
    ]);

    // ---------------------------------------------------------
    // STEP 1: JOINING & CLOCK DRIFT TEST
    // ---------------------------------------------------------
    await p1.click('#start-game-btn');
    await expect(p1.locator('#game-screen')).toBeVisible();

    await p2.click('#start-game-btn');
    await expect(p2.locator('#game-screen')).toBeVisible();

    // If your Clock Drift fix failed, Player 1 will see "0 Others Guessing" 
    // because Player 2's timestamp is 60 seconds old. 
    // If the fix works, Player 1 correctly trusts their local clock and sees "1".
    await expect(p1.locator('#presence-count')).toHaveText('1 Other Guessing');

    await p3.click('#start-game-btn');
    await expect(p3.locator('#game-screen')).toBeVisible();

    await expect(p1.locator('#presence-count')).toHaveText('2 Others Guessing');

    // ---------------------------------------------------------
    // STEP 2: GRACEFUL EXIT 
    // ---------------------------------------------------------
    await p2.click('#board-return-menu-btn');
    await expect(p2.locator('#home-screen')).toBeVisible();

    await expect(p1.locator('#presence-count')).toHaveText('1 Other Guessing');
    await expect(p3.locator('#presence-count')).toHaveText('1 Other Guessing');

    // ---------------------------------------------------------
    // STEP 3: MOBILE LIFECYCLE (Backgrounding App)
    // ---------------------------------------------------------
    await p3.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(p1.locator('#presence-count')).toHaveText('0 Others Guessing');

    await p3.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(p1.locator('#presence-count')).toHaveText('1 Other Guessing');

    // ---------------------------------------------------------
    // STEP 4: NETWORK INSTABILITY (Losing Wi-Fi)
    // ---------------------------------------------------------
    await p1.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(p3.locator('#presence-count')).toHaveText('0 Others Guessing');

    await p1.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(p3.locator('#presence-count')).toHaveText('1 Other Guessing');

    // ---------------------------------------------------------
    // STEP 5: THE 25-SECOND HEARTBEAT FAILSAFE
    // ---------------------------------------------------------
    await expect(p3.locator('#presence-dot')).toHaveClass(/active/);
    
    // Kill Player 1 entirely (Browser crash simulation)
    await p1.close();

    // Wait for the 25-second server purge
    await expect(p3.locator('#presence-dot')).toHaveClass(/inactive/, { timeout: 30000 });
    await expect(p3.locator('#presence-count')).toHaveText('0 Others Guessing', { timeout: 30000 });

  });
});