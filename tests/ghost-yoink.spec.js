const { test, expect } = require('@playwright/test');

test.describe('Ghost Yoink Reproduction (Clock Drift)', () => {

  test('Reproduces bug where slow device clocks make players invisible', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const p1 = await context1.newPage();
    const p2 = await context2.newPage();

    // 🚨 THE EDGE CASE INJECTION 🚨
    // We mock Player 2's computer clock to be exactly 30 seconds in the past.
    await p2.addInitScript(() => {
        const originalDateNow = Date.now;
        Date.now = () => originalDateNow() - 30000; 
    });

    const GAME_URL = 'http://127.0.0.1:8080';
    await p1.goto(GAME_URL);
    await p2.goto(GAME_URL);

    // Player 1 joins normally
    await p1.click('#start-game-btn');
    await expect(p1.locator('#game-screen')).toBeVisible();

    // Player 2 (with the slow clock) joins
    await p2.click('#start-game-btn');
    await expect(p2.locator('#game-screen')).toBeVisible();

    // If the bug exists, Player 1 will subtract the timestamps, think Player 2 
    // timed out 5 seconds ago, and hide them! 
    // (This assertion will pass right now, proving the bug exists)
    await expect(p1.locator('#presence-count')).toHaveText('0 Others Guessing');

    // Player 2 is clearly still playing! A Ghost Yoink is imminent!
    await expect(p2.locator('#guess-counter')).toBeVisible();
  });
});