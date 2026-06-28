const { chromium } = require('playwright');

async function run(scheme) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1300);
  await page.click('[data-testid="smart-row-d1"]');
  await page.waitForTimeout(1200);
  await page.click('[data-testid="inline-reply-bar-collapsed"]');
  await page.waitForTimeout(900);
  await page.click('[data-testid="reply-fmt-toggle"]');
  await page.waitForTimeout(1000);

  const pill = await page.locator('[data-testid="reply-fmt-toggle"]').boundingBox();
  const photo = await page.locator('[data-testid="reply-fmt-photo"]').boundingBox();
  const video = await page.locator('[data-testid="reply-fmt-video"]').boundingBox();
  const attach = await page.locator('[data-testid="reply-fmt-attach"]').boundingBox();
  // The + is the first slot span; grab the lucide Plus svg's parent span
  const plus = await page.evaluate(() => {
    const toggle = document.querySelector('[data-testid="reply-fmt-toggle"]');
    const content = toggle.querySelector('[data-glass-content]');
    const firstSlot = content.children[0];
    const r = firstSlot.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  // center of each icon
  const c = (b) => b.x + b.width / 2;
  const pillLeft = pill.x, pillRight = pill.x + pill.width;
  const centers = { plus: c(plus), photo: c(photo), video: c(video), attach: c(attach) };
  const leftMargin = centers.plus - pillLeft;            // from pill edge to + center
  const rightMargin = pillRight - centers.attach;         // from attach center to pill edge
  const gap1 = centers.photo - centers.plus;
  const gap2 = centers.video - centers.photo;
  const gap3 = centers.attach - centers.video;

  console.log(`\n=== ${scheme.toUpperCase()} ===`);
  console.log('pill width:', pill.width.toFixed(2), 'x:', pill.x.toFixed(2));
  console.log('centers:', JSON.stringify(Object.fromEntries(Object.entries(centers).map(([k,v])=>[k,+v.toFixed(2)]))));
  console.log('leftMargin (pillEdge->+center):', leftMargin.toFixed(2));
  console.log('rightMargin (attachCenter->pillEdge):', rightMargin.toFixed(2));
  console.log('gaps (center-to-center): ', gap1.toFixed(2), gap2.toFixed(2), gap3.toFixed(2));
  console.log('SYMMETRY diff (L vs R margin):', (leftMargin - rightMargin).toFixed(2));

  await page.screenshot({ path: `/home/user/workspace/opus_pill_open_${scheme}.png`, clip: { x: pill.x - 14, y: pill.y - 14, width: 300, height: pill.height + 28 } });
  await browser.close();
}

(async () => {
  await run('light');
  await run('dark');
})();
