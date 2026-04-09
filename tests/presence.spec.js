// tests/presence.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Elaborate Presence & Lifecycle Diagnostics', () => {

  test('Tracks 3 players through joining, leaving, backgrounding, and network drops', async ({ browser }) => {
    // We are testing a 25-second timeout mechanism at the end, so we must extend the 
    // default 30-second Playwright test limit to 60 seconds to prevent early failure.
    test.setTimeout(60000);

    // ---------------------------------------------------------
    // STEP 1: SETUP 3 INDEPENDENT PLAYERS
    // ---------------------------------------------------------
    // We use separate contexts so they don't share Session IDs.
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    const p1 = await context1.newPage();
    const p2 = await context2.newPage();
    const p3 = await context3.newPage();

    const GAME_URL = 'http://127.0.0.1:8080';

    // Load the game simultaneously for all 3 players
    await Promise.all([
      p1.goto(GAME_URL),
      p2.goto(GAME_URL),
      p3.goto(GAME_URL)
    ]);

    // Ensure the baseline is correct for everyone
    await expect(p1.locator('#presence-count')).toHaveText('0 Others Guessing');
    await expect(p2.locator('#presence-count')).toHaveText('0 Others Guessing');
    await expect(p3.locator('#presence-count')).toHaveText('0 Others Guessing');

    // ---------------------------------------------------------
    // STEP 2: STAGGERED JOINING (Tests Pluralization & Scaling)
    // ---------------------------------------------------------
    
    // Player 1 joins (Guest mode is fastest for testing)
    await p1.click('#start-game-btn');
    await expect(p1.locator('#game-screen')).toBeVisible();
    
    // P2 and P3 are still on the home screen, but should see P1 guessing
    await expect(p2.locator('#presence-count')).toHaveText('1 Other Guessing');
    await expect(p3.locator('#presence-count')).toHaveText('1 Other Guessing');

    // Player 2 joins
    await p2.click('#start-game-btn');
    await expect(p2.locator('#game-screen')).toBeVisible();

    // P1 and P2 should see each other (1), P3 should see both of them (2)
    await expect(p1.locator('#presence-count')).toHaveText('1 Other Guessing');
    await expect(p2.locator('#presence-count')).toHaveText('1 Other Guessing');
    await expect(p3.locator('#presence-count')).toHaveText('2 Others Guessing');

    // Player 3 joins
    await p3.click('#start-game-btn');
    await expect(p3.locator('#game-screen')).toBeVisible();

    // Everyone is now guessing. Everyone should see exactly 2 others.
    await expect(p1.locator('#presence-count')).toHaveText('2 Others Guessing');
    await expect(p2.locator('#presence-count')).toHaveText('2 Others Guessing');
    await expect(p3.locator('#presence-count')).toHaveText('2 Others Guessing');


    // ---------------------------------------------------------
    // STEP 3: GRACEFUL EXIT (Using the UI)
    // ---------------------------------------------------------
    
    // Player 2 clicks the back button to return to the menu
    await p2.click('#board-return-menu-btn');
    await expect(p2.locator('#home-screen')).toBeVisible();

    // P1 and P3 should dynamically drop back down to 1
    // (Playwright's auto-retrying 'expect' perfectly handles your 3-second evaluation interval)
    await expect(p1.locator('#presence-count')).toHaveText('1 Other Guessing');
    await expect(p3.locator('#presence-count')).toHaveText('1 Other Guessing');


    // ---------------------------------------------------------
    // STEP 4: MOBILE LIFECYCLE (Minimizing / Backgrounding App)
    // ---------------------------------------------------------
    
    // We simulate Player 3 swiping the app to the background (Home Screen).
    // We override the visibilityState property and dispatch the event manually.
    await p3.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Player 1 should instantly see Player 3 vanish from the count
    await expect(p1.locator('#presence-count')).toHaveText('0 Others Guessing');

    // Player 3 opens the app back up
    await p3.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Player 1 should see Player 3 return
    await expect(p1.locator('#presence-count')).toHaveText('1 Other Guessing');


    // ---------------------------------------------------------
    // STEP 5: NETWORK INSTABILITY (Losing Wi-Fi)
    // ---------------------------------------------------------
    
    // We simulate Player 1 walking into a tunnel and losing Wi-Fi.
    // Note: We dispatch the JS event directly so Supabase can send the "isGuessing: false" 
    // payload right before the connection fully terminates.
    await p1.evaluate(() => window.dispatchEvent(new Event('offline')));

    // Player 3 should see Player 1 drop out
    await expect(p3.locator('#presence-count')).toHaveText('0 Others Guessing');

    // Player 1 walks out of the tunnel and reconnects
    await p1.evaluate(() => window.dispatchEvent(new Event('online')));

    // Player 3 sees Player 1 pop back in, using the 'amIGuessing' system memory restoration!
    await expect(p3.locator('#presence-count')).toHaveText('1 Other Guessing');


    // ---------------------------------------------------------
    // STEP 6: THE RED DOT UI & HARD DISCONNECT (Testing the 25s Failsafe)
    // ---------------------------------------------------------
    
    // Finally, let's verify the visual UI dot reflects the state properly for Player 3
    await expect(p3.locator('#presence-dot')).toHaveClass(/active/);
    
    // Kill Player 1's tab entirely (Hard disconnect, acts like a crashed browser/force quit)
    await p1.close();

    // After ~25 seconds, the server heartbeat failsafe will kick in and purge Player 1.
    // We give Playwright a 30-second timeout here to wait for that purge logic to fire.
    await expect(p3.locator('#presence-dot')).toHaveClass(/inactive/, { timeout: 30000 });
    await expect(p3.locator('#presence-count')).toHaveText('0 Others Guessing', { timeout: 30000 });

  });
});