// tests/spam-clicks.spec.js
const { test, expect } = require('@playwright/test');

test.describe('WebSocket Spam & State Tearing Diagnostics', () => {

  test('Survives rapid UI toggling without permanent desync', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const p1 = await context1.newPage();
    const p2 = await context2.newPage();

    const GAME_URL = 'http://127.0.0.1:8080';
    await p1.goto(GAME_URL);
    await p2.goto(GAME_URL);

    // Player 1 sets up camp to watch the counter
    await p1.click('#start-game-btn');
    await expect(p1.locator('#game-screen')).toBeVisible();

    // ---------------------------------------------------------
    // THE SPAM ATTACK
    // ---------------------------------------------------------
    // Player 2 clicks Start and Back rapidly, 4 full cycles!
    for (let i = 0; i < 4; i++) {
        await p2.click('#start-game-btn');
        await expect(p2.locator('#game-screen')).toBeVisible();
        
        await p2.click('#board-return-menu-btn');
        await expect(p2.locator('#home-screen')).toBeVisible();
    }

    // Player 2 finishes by clicking Start one last time to stay active.
    await p2.click('#start-game-btn');
    await expect(p2.locator('#game-screen')).toBeVisible();

    // We give the server 5 seconds to process the massive queue of diffs.
    // If your traffic light queue works, the final state processed will be TRUE.
    await expect(p1.locator('#presence-count')).toHaveText('1 Other Guessing', { timeout: 5000 });
  });
});