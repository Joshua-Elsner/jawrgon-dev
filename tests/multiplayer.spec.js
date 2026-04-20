const { test, expect } = require('@playwright/test');

test('Yoink mechanics sync across clients', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const gameUrl = 'http://127.0.0.1:8080';

  // --- THE SECRET WORD FIX ---
  // Tell Playwright to watch Player B's network traffic and catch the Supabase game_state fetch
  const gameStatePromise = pageB.waitForResponse(response => 
    response.url().includes('game_state') && response.request().method() === 'GET'
  );

  await pageA.goto(gameUrl);
  await pageB.goto(gameUrl);

  // Extract the current secret word directly from the intercepted database response!
  const gameStateResponse = await gameStatePromise;
  const gameStateData = await gameStateResponse.json();
  const currentSecretWord = gameStateData.secret_word;

  // Generate unique names so we never clash with old leaderboard data
  const uniqueId = Date.now().toString().slice(-4); 
  const victimName = `Fish${uniqueId}`;
  const sharkName = `Shark${uniqueId}`;

  // 1. Player A (The Victim) Setup
  await pageA.click('#open-player-modal-btn');
  await pageA.fill('#new-player-input', victimName);
  await pageA.click('#create-player-btn');
  
  await pageA.waitForTimeout(500); 
  await pageA.click('#start-game-btn');

  // --- THE VICTIM TYPING FIX ---
  // Wait to make sure the game screen is actually fully loaded and visible
  await expect(pageA.locator('#game-screen')).toBeVisible();
  
  // Click the physical on-screen 'A' button to guarantee the game registers it
  await pageA.click('#key-a');

  // 2. Player B (The Yoinker) Setup
  await pageB.click('#open-player-modal-btn');
  await pageB.fill('#new-player-input', sharkName);
  await pageB.click('#create-player-btn');
  
  await pageB.waitForTimeout(500);
  await pageB.click('#start-game-btn');

  // 3. THE YOINK TEST
  // Player B types whatever the secret word actually is right now, dynamically!
  await pageB.keyboard.type(currentSecretWord);
  await pageB.keyboard.press('Enter');

  await expect(pageB.locator('#win-modal')).toBeVisible();

  // Player B sets the NEXT word to a random string so the cycle continues
  // NEW CODE:
  // Wait for the suggestion buttons to appear, then click the first one
  const suggestionBtn = pageB.locator('#suggestion-1');
  await expect(suggestionBtn).toBeVisible();
  await suggestionBtn.click();
  
  // Click the confirm button
  await pageB.click('#submit-new-word');

  // 4. THE IMPACT
  // Filter the locators to only find the toast that contains the Yoink text
  const toast = pageA.locator('.toast').filter({ hasText: /YOINK!!!/ }); 
  
  await expect(toast).toBeVisible();
  
  // Now we can safely assert that this specific toast also contains the Shark's name
  await expect(toast).toContainText(new RegExp(sharkName));
  
});