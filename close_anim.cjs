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

  // OPEN
  await page.click('[data-testid="reply-fmt-toggle"]');
  await page.waitForTimeout(1000);
  const box = await page.locator('[data-testid="reply-fmt-toggle"]').boundingBox();
  const clip = { x: box.x - 14, y: box.y - 14, width: 300, height: box.height + 28 };

  // CLOSE by clicking the X (left slot); pill center sits over a media icon
  // that stops propagation. Grab frames every ~55ms.
  await page.mouse.click(box.x + 18, box.y + box.height / 2);
  for (let i = 0; i < 8; i++) {
    await page.screenshot({ path: `/home/user/workspace/opus_pill_close_f${i}.png`, clip });
    const b = await page.locator('[data-testid="reply-fmt-toggle"]').boundingBox();
    console.log(`close frame ${i}: width=${b.width.toFixed(1)}`);
    await page.waitForTimeout(55);
  }
  await page.waitForTimeout(500);
  const fin = await page.locator('[data-testid="reply-fmt-toggle"]').boundingBox();
  console.log('final closed width:', fin.width.toFixed(1));

  // OPEN frames for the mirror-image comparison.
  await page.click('[data-testid="reply-fmt-toggle"]');
  for (let i = 0; i < 8; i++) {
    await page.screenshot({ path: `/home/user/workspace/opus_pill_open_f${i}.png`, clip });
    const b = await page.locator('[data-testid="reply-fmt-toggle"]').boundingBox();
    console.log(`open frame ${i}: width=${b.width.toFixed(1)}`);
    await page.waitForTimeout(55);
  }
  await browser.close();
})();
