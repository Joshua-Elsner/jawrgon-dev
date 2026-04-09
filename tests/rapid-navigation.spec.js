// tests/rapid-navigation.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Rapid UI Navigation & State Collision', () => {

  test('Player remains visible after quickly toggling the game screen', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const p1 = await context1.newPage();
    const p2 = await context2.newPage();

    const GAME_URL = 'http://127.0.0.1:8080';
    await p1.goto(GAME_URL);
    await p2.goto(GAME_URL);

    // Player 1 joins and watches the counter
    await p1.click('#start-game-btn');
    await expect(p1.locator('#game-screen')).toBeVisible();

    // ---------------------------------------------------------
    // THE BUG SEQUENCE (Start -> Back -> Start)
    // ---------------------------------------------------------
    
    // Player 2 clicks Start
    await p2.click('#start-game-btn');
    await expect(p2.locator('#game-screen')).toBeVisible();
    await expect(p1.locator('#presence-count')).toHaveText('1 Other Guessing');

    // Player 2 clicks Back
    await p2.click('#board-return-menu-btn');
    await expect(p2.locator('#home-screen')).toBeVisible();
    await expect(p1.locator('#presence-count')).toHaveText('0 Others Guessing');

    // Player 2 immediately clicks Start again!
    await p2.click('#start-game-btn');
    await expect(p2.locator('#game-screen')).toBeVisible();

    // If the Double-Fire bug exists, Player 1's screen will be stuck on "0".
    // If we fixed it, Player 1 will correctly see Player 2 return to "1".
    await expect(p1.locator('#presence-count')).toHaveText('1 Other Guessing');
  });
});