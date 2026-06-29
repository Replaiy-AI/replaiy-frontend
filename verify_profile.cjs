const { chromium } = require('playwright');

const OUT = '/home/user/workspace';

async function mobileFlow(browser, scheme) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    colorScheme: scheme,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1400);
  // open conversation
  let row = page.locator('[data-testid="smart-row-d2"]');
  if (await row.count() === 0) row = page.locator('[data-testid="smart-row-d1"]');
  await row.first().click();
  await page.waitForTimeout(1300);
  // open lead panel
  await page.locator('[data-testid="contact-pill"]').first().click();
  await page.waitForTimeout(1000);
  // switch to Contact tab
  await page.locator('[data-testid="lead-panel-mobile"] [data-testid="lead-tab-seg-contact"]').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/opusprofile_mobile_${scheme}_contact.png` });
  // open full profile
  await page.locator('[data-testid="open-full-profile"]').click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/opusprofile_mobile_${scheme}_top.png` });
  // scroll to experience
  await page.evaluate(() => {
    const v = document.querySelector('[data-testid="linkedin-profile-view"] .overflow-y-auto');
    if (v) v.scrollTop = 600;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/opusprofile_mobile_${scheme}_scrolled.png` });
  // verify presence + no em-dash in view text
  const viewText = await page.locator('[data-testid="linkedin-profile-view"]').innerText().catch(() => '');
  const hasEmDash = viewText.includes('\u2014');
  const hasBack = await page.locator('[data-testid="profile-back"]').count();
  // check chrome title says LinkedIn profile
  const titleText = await page.locator('text=LinkedIn profile').count();
  // tap back, confirm chrome hands back
  await page.locator('[data-testid="profile-back"]').first().click();
  await page.waitForTimeout(800);
  const stillOpen = await page.locator('[data-testid="linkedin-profile-view"]').count();
  const contactBtn = await page.locator('[data-testid="open-full-profile"]').count();
  await page.screenshot({ path: `${OUT}/opusprofile_mobile_${scheme}_afterback.png` });
  console.log(`MOBILE ${scheme}: emDash=${hasEmDash} backBtn=${hasBack} titleCount=${titleText} afterBack_viewCount=${stillOpen} contactBtnVisible=${contactBtn} errors=${errors.length}`);
  if (errors.length) console.log('  console errors:', errors.slice(0, 5));
  await ctx.close();
}

async function desktopFlow(browser, scheme) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: scheme,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1400);
  let row = page.locator('[data-testid="smart-row-d2"]');
  if (await row.count() === 0) row = page.locator('[data-testid="smart-row-d1"]');
  await row.first().click();
  await page.waitForTimeout(1300);
  // desktop lead panel may need a trigger; check if lead-panel-desktop visible
  const deskPanel = await page.locator('[data-testid="lead-panel-desktop"]').count();
  if (deskPanel === 0) {
    // try clicking contact-pill / identity to open
    const cp = page.locator('[data-testid="contact-pill"]');
    if (await cp.count()) { await cp.first().click(); await page.waitForTimeout(800); }
  }
  await page.screenshot({ path: `${OUT}/opusprofile_desktop_${scheme}_panel.png` });
  // switch to contact tab in desktop panel
  const contactSeg = page.locator('[data-testid="lead-panel-desktop"] [data-testid="lead-tab-seg-contact"]');
  if (await contactSeg.count()) { await contactSeg.click(); await page.waitForTimeout(600); }
  else {
    const anyContact = page.locator('[data-testid="lead-tab-seg-contact"]');
    if (await anyContact.count()) { await anyContact.first().click(); await page.waitForTimeout(600); }
  }
  await page.screenshot({ path: `${OUT}/opusprofile_desktop_${scheme}_contact.png` });
  const openBtn = page.locator('[data-testid="open-full-profile"]');
  console.log(`DESKTOP ${scheme}: deskPanel=${deskPanel} openBtnCount=${await openBtn.count()}`);
  if (await openBtn.count()) {
    await openBtn.first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/opusprofile_desktop_${scheme}_profile.png` });
    await page.evaluate(() => {
      const v = document.querySelector('[data-testid="linkedin-profile-view"] .overflow-y-auto');
      if (v) v.scrollTop = 500;
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/opusprofile_desktop_${scheme}_scrolled.png` });
    const viewText = await page.locator('[data-testid="linkedin-profile-view"]').innerText().catch(() => '');
    const hasEmDash = viewText.includes('\u2014');
    // desktop back = the SAME shared ActionPill (testid profile-back),
    // floated top-left (hidden md:block). No separate desktop testid.
    const backD = page.locator('[data-testid="linkedin-profile-view"] [data-testid="profile-back"]');
    const backDcount = await backD.count();
    if (backDcount) { await backD.first().click({ force: false }); await page.waitForTimeout(800); }
    const stillOpen = await page.locator('[data-testid="linkedin-profile-view"]').count();
    const contactBtn = await page.locator('[data-testid="open-full-profile"]').count();
    await page.screenshot({ path: `${OUT}/opusprofile_desktop_${scheme}_afterback.png` });
    console.log(`  profile: emDash=${hasEmDash} backPill=${backDcount} afterBack_viewCount=${stillOpen} contactBtnVisible=${contactBtn} errors=${errors.length}`);
  }
  if (errors.length) console.log('  console errors:', errors.slice(0, 5));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  await mobileFlow(browser, 'light');
  await mobileFlow(browser, 'dark');
  await desktopFlow(browser, 'light');
  await desktopFlow(browser, 'dark');
  await browser.close();
  console.log('DONE');
})();
