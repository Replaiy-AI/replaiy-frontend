import { chromium } from 'playwright';

const OUT = '/home/user/workspace';

async function navMobile(page) {
  await page.goto('http://localhost:5000/#/inbox', { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.click('[data-testid="smart-row-d2"]');
  await page.waitForTimeout(1300);
  await page.click('[data-testid="contact-pill"]');
  await page.waitForTimeout(1000);
}

async function navDesktop(page) {
  await page.goto('http://localhost:5000/#/inbox', { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.click('[data-testid="smart-row-d2"]');
  await page.waitForTimeout(1300);
  // Desktop: lead panel shows alongside. Switch to Contact tab if present.
  const seg = page.locator('[data-testid="lead-panel-desktop"] [data-testid="lead-tab-seg-contact"]');
  if (await seg.count()) { await seg.click(); await page.waitForTimeout(700); }
}

async function runMobile(theme) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await navMobile(page);
  await page.click('[data-testid="lead-panel-mobile"] [data-testid="lead-tab-seg-contact"]');
  await page.waitForTimeout(800);
  await page.click('[data-testid="lead-panel-mobile"] [data-testid="open-full-profile"]');
  await page.waitForTimeout(900);

  const scroller = page.locator('[data-testid="linkedin-profile-view"] .overflow-y-auto').first();
  // Scroll to Activity
  await page.locator('[data-testid="profile-activity"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/opusposts_mobile_${theme}_activity1.png` });

  // count posts
  const postCount = await page.locator('[data-testid^="profile-post-p-emma-"]').count();
  console.log(`MOBILE ${theme} post count:`, postCount);

  // test see more on first post
  const toggle = page.locator('[data-testid="profile-post-toggle-p-emma-1"]');
  const hasToggle = await toggle.count();
  if (hasToggle) {
    const before = await page.locator('[data-testid="profile-post-p-emma-1"]').boundingBox();
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await page.waitForTimeout(400);
    const after = await page.locator('[data-testid="profile-post-p-emma-1"]').boundingBox();
    console.log(`MOBILE ${theme} see-more expand: before=${before?.height?.toFixed(0)} after=${after?.height?.toFixed(0)}`);
    await page.screenshot({ path: `${OUT}/opusposts_mobile_${theme}_seemore.png` });
  }

  // scroll to image post (p-emma-2)
  await page.locator('[data-testid="profile-post-p-emma-2"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/opusposts_mobile_${theme}_imagepost.png` });

  // scroll to last post
  await page.locator('[data-testid="profile-post-p-emma-8"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/opusposts_mobile_${theme}_lastpost.png` });

  await browser.close();
}

async function runDesktop(theme) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await navDesktop(page);
  await page.click('[data-testid="lead-panel-desktop"] [data-testid="open-full-profile"]');
  await page.waitForTimeout(900);
  await page.locator('[data-testid="profile-activity"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const postCount = await page.locator('[data-testid^="profile-post-p-emma-"]').count();
  console.log(`DESKTOP ${theme} post count:`, postCount);
  await page.screenshot({ path: `${OUT}/opusposts_desktop_${theme}_activity.png` });
  // image post in narrow column
  await page.locator('[data-testid="profile-post-p-emma-2"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/opusposts_desktop_${theme}_imagepost.png` });
  await browser.close();
}

await runMobile('light');
await runMobile('dark');
await runDesktop('light');
await runDesktop('dark');
console.log('DONE');
