const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ colorScheme: 'light', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1300);
  await page.click('[data-testid="smart-row-d1"]');
  await page.waitForTimeout(1200);
  await page.click('[data-testid="inline-reply-bar-collapsed"]');
  await page.waitForTimeout(900);

  const state = async () => page.evaluate(() => {
    const el = document.querySelector('[data-testid="reply-fmt-toggle"]');
    const cs = getComputedStyle(el);
    return { pressed: el.getAttribute('aria-pressed'), width: cs.width, radius: cs.borderTopLeftRadius };
  });

  console.log('before open:', JSON.stringify(await state()));
  await page.click('[data-testid="reply-fmt-toggle"]');
  await page.waitForTimeout(1000);
  console.log('after open:', JSON.stringify(await state()));

  // CLOSE — click the X (left slot); center of pill is over a media icon
  // whose stopPropagation would swallow the toggle click.
  const b = await page.locator('[data-testid="reply-fmt-toggle"]').boundingBox();
  await page.mouse.click(b.x + 18, b.y + b.height / 2);
  for (let i = 0; i < 8; i++) {
    console.log(`close f${i}:`, JSON.stringify(await state()));
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(600);
  console.log('settled:', JSON.stringify(await state()));
  await browser.close();
})();
