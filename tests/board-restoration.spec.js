// tests/board-restoration.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Board Restoration & Anti-Rage-Quit', () => {

  test('Persists guesses, traps rage-quitters, and prevents duplicate points', async ({ page }) => {
    
    // We will count how many times the client tells the database the Shark ate a fish
    let sharkMealRpcCount = 0;
    page.on('request', request => {
      if (request.url().includes('/rpc/record_shark_meal') && request.method() === 'POST') {
        sharkMealRpcCount++;
      }
    });

    // 1. Load the game and extract the secret word so we don't accidentally win
    const gameStatePromise = page.waitForResponse(response => 
        response.url().includes('game_state') && response.request().method() === 'GET'
    );

    const GAME_URL = 'http://127.0.0.1:8080';
    await page.goto(GAME_URL);
    
    const gameStateResponse = await gameStatePromise;
    const gameStateData = await gameStateResponse.json();
    const secretWord = gameStateData.secret_word;

    // A list of safe valid words to guess. We filter out the secret word just in case!
    const validWords = ['APPLE', 'TRAIN', 'MOUSE', 'GHOST', 'BLAME', 'CRANE', 'PLANT']
        .filter(w => w !== secretWord);

    // Enter as a guest
    await page.click('#start-game-btn');
    await expect(page.locator('#game-screen')).toBeVisible();

    // =========================================================
    // PHASE 1: MID-GAME PERSISTENCE
    // =========================================================
    
    // Make 2 guesses
    await typeWord(page, validWords[0]);
    await typeWord(page, validWords[1]);

    // Verify counter is on guess 3
    await expect(page.locator('#guess-counter')).toHaveText('Guess 3/6');

    // Player tries to wipe their board by clicking "Back to Menu" and returning
    await page.click('#board-return-menu-btn');
    await expect(page.locator('#home-screen')).toBeVisible();
    await page.click('#start-game-btn');

    // 🛡️ VERIFY: The board restored their state!
    await expect(page.locator('#guess-counter')).toHaveText('Guess 3/6');
    const firstRowFirstTile = page.locator('.board-row').nth(0).locator('.tile').nth(0);
    await expect(firstRowFirstTile).toHaveText(validWords[0][0]); // Should match the 'A' in APPLE

    // =========================================================
    // PHASE 2: THE RAGE-QUIT TRAP & DOUBLE-POINT PREVENTION
    // =========================================================

    // Player burns through their remaining 4 guesses and loses
    await typeWord(page, validWords[2]);
    await typeWord(page, validWords[3]);
    await typeWord(page, validWords[4]);
    await typeWord(page, validWords[5]);

    // Wait for the loss modal to pop up
    const loseModal = page.locator('#lose-modal');
    await expect(loseModal).toBeVisible();

    // Give network requests a brief moment to fire
    await page.waitForTimeout(500);

    // 🛡️ VERIFY: The Shark got exactly ONE point
    expect(sharkMealRpcCount).toBe(1);

    // 💥 The Rage Quit! Player aggressively refreshes their browser window
    await page.reload();

    // They land on the home screen and think they got away with it. They click start.
    await page.click('#start-game-btn');

    // 🛡️ VERIFY: The Lose Modal instantly smacks them in the face again!
    await expect(loseModal).toBeVisible();

    // Give network requests a brief moment to fire again
    await page.waitForTimeout(500);

    // 🛡️ VERIFY: The Shark did NOT get a duplicate point!
    expect(sharkMealRpcCount).toBe(1);

    // =========================================================
    // PHASE 3: HONORABLE RESET
    // =========================================================

    // Player accepts their fate and clicks "Try Again"
    await page.click('#try-again-btn');

    // 🛡️ VERIFY: The board is now completely wiped clean for a fresh game
    await expect(page.locator('#guess-counter')).toHaveText('Guess 1/6');
    
    const freshFirstTile = page.locator('.board-row').nth(0).locator('.tile').nth(0);
    await expect(freshFirstTile).toHaveText(''); // Empty string
  });
});

/**
 * Helper function to type a word, press enter, and wait for animations
 */
async function typeWord(page, word) {
    await page.keyboard.type(word);
    await page.keyboard.press('Enter');
    // Wait for the UI row animation to finish
    await page.waitForTimeout(600); 
}