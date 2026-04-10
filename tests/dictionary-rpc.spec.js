// tests/dictionary-rpc.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Server-Side Dictionary & Suggestions', () => {

  test('Client only receives 2 words via RPC and never downloads the used_words table', async ({ page }) => {
    
    // We will flip this to true if the browser tries to download the old used_words table
    let requestedUsedWords = false;

    // 1. Monitor ALL outgoing network requests
    page.on('request', request => {
      const url = request.url();
      // If the client tries to do a GET request to the used_words table, catch them!
      if (url.includes('/rest/v1/used_words') && request.method() === 'GET') {
        requestedUsedWords = true;
      }
    });

    // 2. Set up a trap to catch the EXACT network response from our new RPC function
    const suggestionsPromise = page.waitForResponse(response => 
      response.url().includes('/rpc/get_word_suggestions') && response.request().method() === 'POST'
    );

    // 3. Set up a trap to catch the initial game load so we can cheat and see the secret word
    const gameStatePromise = page.waitForResponse(response => 
        response.url().includes('game_state') && response.request().method() === 'GET'
    );

    // Navigate to the game
    const GAME_URL = 'http://127.0.0.1:8080';
    await page.goto(GAME_URL);

    // Extract the secret word directly from the database response
    const gameStateResponse = await gameStatePromise;
    const gameStateData = await gameStateResponse.json();
    const secretWord = gameStateData.secret_word;

    // 4. Setup a player
    const uniqueId = Date.now().toString().slice(-4);
    await page.click('#open-player-modal-btn');
    await page.fill('#new-player-input', `Test${uniqueId}`);
    await page.click('#create-player-btn');
    
    await page.waitForTimeout(500);
    await page.click('#start-game-btn');
    await expect(page.locator('#game-screen')).toBeVisible();

    // 5. Instantly win the game by typing the secret word
    await page.keyboard.type(secretWord);
    await page.keyboard.press('Enter');

    // Wait for the Win Modal and the UI Suggestions to become visible
    await expect(page.locator('#win-modal')).toBeVisible();
    await expect(page.locator('#suggestion-1')).toBeVisible();

    // 6. ANALYZE THE NETWORK TRAFFIC!
    // Grab the actual raw JSON data Supabase sent back to the browser
    const rpcResponse = await suggestionsPromise;
    const rpcData = await rpcResponse.json();

    // PROOF #1: The RPC returned exactly an array of 2 objects: [{ word: 'APPLE' }, { word: 'TRAIN' }]
    expect(Array.isArray(rpcData)).toBeTruthy();
    expect(rpcData.length).toBe(2);
    expect(rpcData[0]).toHaveProperty('word');
    expect(rpcData[1]).toHaveProperty('word');

    // PROOF #2: The browser NEVER made a network request to the used_words table!
    expect(requestedUsedWords).toBe(false);
  });
});