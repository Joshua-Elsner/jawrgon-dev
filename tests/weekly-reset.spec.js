// tests/weekly-reset.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Weekly Shark of the Week Reset (E2E Legitimate Play)', () => {

  test('Accumulates real time via UI and successfully resets using suggested words', async ({ browser, request }) => {
    test.setTimeout(60000);

    const SUPABASE_URL = 'http://127.0.0.1:54321'; 
    const PUBLIC_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'; 
    
    const headers = {
        'apikey': PUBLIC_KEY,
        'Authorization': `Bearer ${PUBLIC_KEY}`,
        'Content-Type': 'application/json'
    };

    // 1. CLEAR THE BOARD FIRST (Wipe any past data so the test is clean)
    await request.post(`${SUPABASE_URL}/rest/v1/rpc/process_weekly_shark_reset`, { headers });

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const p1 = await context1.newPage();
    const p2 = await context2.newPage();

    const uniqueId = Date.now().toString().slice(-4);
    const loserName = `Loser${uniqueId}`;
    const winnerName = `winShark${uniqueId}`;

    await p1.goto('http://127.0.0.1:8080');
    await p2.goto('http://127.0.0.1:8080');
    await p1.waitForTimeout(1000);

    // ==========================================
    // PLAYER 1 (Loser) JOINS AND GUESSES 'SHARK'
    // ==========================================
    await p1.click('#open-player-modal-btn');
    await p1.waitForTimeout(1000);
    
    await p1.fill('#new-player-input', loserName);
    await p1.waitForTimeout(1000);
    
    await p1.click('#create-player-btn');
    await p1.waitForTimeout(1000);
    
    await p1.click('#start-game-btn');
    await p1.waitForTimeout(1000);
    
    await p1.keyboard.type('SHARK');
    await p1.waitForTimeout(1000);
    
    await p1.keyboard.press('Enter');
    await p1.waitForTimeout(1000);
    
    // Player 1 waits for the win modal and clicks the first suggestion
    await p1.waitForSelector('#win-modal:not(.hidden)');
    const suggestionBtn1 = p1.locator('#suggestion-1');
    await expect(suggestionBtn1).toBeVisible();
    await suggestionBtn1.click();
    await p1.waitForTimeout(1000);
    
    // 🔥 CRITICAL STEP: Extract the random word so Player 2 knows what to guess!
    const dynamicSecretWord = await p1.locator('#new-word-input').inputValue();
    
    await p1.click('#submit-new-word');

    // Wait 2 seconds so Loser gets at least 2 seconds on the clock
    await p1.waitForTimeout(2000);

    // ==========================================
    // PLAYER 2 (winShark) JOINS AND YOINKS THE DYNAMIC WORD
    // ==========================================
    await p2.click('#open-player-modal-btn');
    await p2.waitForTimeout(1000);
    
    await p2.fill('#new-player-input', winnerName);
    await p2.waitForTimeout(1000);
    
    await p2.click('#create-player-btn');
    await p2.waitForTimeout(1000);
    
    await p2.click('#start-game-btn');
    await p2.waitForTimeout(1000);

    // Player 2 uses the dynamic word we extracted from Player 1!
    await p2.keyboard.type(dynamicSecretWord);
    await p2.waitForTimeout(1000);
    
    await p2.keyboard.press('Enter');
    await p2.waitForTimeout(1000);

    // ... [Previous code is identical until Player 2 submits the word]

    // Player 2 also uses a suggestion to set the next word
    await p2.waitForSelector('#win-modal:not(.hidden)');
    const suggestionBtn2 = p2.locator('#suggestion-1');
    await expect(suggestionBtn2).toBeVisible();
    await suggestionBtn2.click();
    await p2.waitForTimeout(1000);
    
    await p2.click('#submit-new-word');

    // 🔥 THE FIX: Wait 15 seconds! 
    // This guarantees winShark outlasts the 8 seconds Loser racked up while we were clicking buttons.
    await p2.waitForTimeout(15000);

    // ==========================================
    // FIRE THE WEEKLY RESET! (With strict error checking)
    // ==========================================
    const resetRes = await request.post(`${SUPABASE_URL}/rest/v1/rpc/process_weekly_shark_reset`, { headers });
    
    if (!resetRes.ok()) {
        console.error("❌ Reset RPC failed:", await resetRes.text());
        throw new Error("The API rejected the weekly reset command.");
    }
    
    await p2.waitForTimeout(1000);

    // ==========================================
    // VERIFY THE LEADERBOARD
    // ==========================================
    await p2.click('#board-return-menu-btn'); 
    await p2.waitForTimeout(1000);
    
    await p2.click('#leaderboard-btn');
    await p2.waitForTimeout(1000);
    
    await expect(p2.locator('#leaderboard-screen')).toBeVisible();

    // Verify winShark got the crown and time reset
    const winnerRow = p2.locator('tr', { hasText: winnerName });
    await expect(winnerRow.locator('td').last()).toHaveText('1');
    await expect(winnerRow).toContainText('0:00:00:00'); // <--- Removed a zero here

    // Verify Loser got nothing and time reset
    const loserRow = p2.locator('tr', { hasText: loserName });
    await expect(loserRow.locator('td').last()).toHaveText('0');
    await expect(loserRow).toContainText('0:00:00:00'); // <--- Removed a zero here
  });
});