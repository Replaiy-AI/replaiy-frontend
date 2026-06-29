const { chromium } = require('playwright');

const POST = 'p-emma-1'; // 312 likes / 47 comments / 18 reposts

async function openProfileMobile(page) {
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="smart-row-d2"]').first().click();
  await page.waitForTimeout(1400);
  await page.locator('[data-testid="contact-pill"]').first().click();
  await page.waitForTimeout(1100);
  await page.locator('[data-testid="lead-panel-mobile"] [data-testid="lead-tab-seg-contact"]').click();
  await page.waitForTimeout(800);
  await page.locator('[data-testid="open-full-profile"]').click();
  await page.waitForTimeout(1100);
}

async function openProfileDesktop(page) {
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="smart-row-d2"]').first().click();
  await page.waitForTimeout(1400);
  const cp = page.locator('[data-testid="contact-pill"]');
  if (await cp.count()) { await cp.first().click(); await page.waitForTimeout(900); }
  const seg = page.locator('[data-testid="lead-panel-desktop"] [data-testid="lead-tab-seg-contact"]');
  if (await seg.count()) { await seg.click(); await page.waitForTimeout(700); }
  else {
    const any = page.locator('[data-testid="lead-tab-seg-contact"]');
    if (await any.count()) { await any.first().click(); await page.waitForTimeout(700); }
  }
  const open = page.locator('[data-testid="open-full-profile"]');
  if (await open.count()) { await open.first().click(); await page.waitForTimeout(1100); }
}

async function scrollToPost(page) {
  await page.evaluate((post) => {
    const el = document.querySelector(`[data-testid="profile-post-${post}"]`);
    if (el) el.scrollIntoView({ block: 'center' });
  }, POST);
  await page.waitForTimeout(500);
}

async function checkTextHygiene(page, label) {
  // Scan the engagers view text for em-dashes and middots.
  const txt = await page.evaluate(() => {
    const v = document.querySelector('[data-testid="linkedin-engagers-view"]');
    return v ? v.innerText : '';
  });
  const emdash = txt.includes('\u2014');
  const middot = txt.includes('\u00b7');
  if (emdash) console.log(`  [${label}] WARN em-dash found`);
  if (middot) console.log(`  [${label}] WARN middot found`);
  return { emdash, middot };
}

async function run(name, opts) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    colorScheme: opts.dark ? 'dark' : 'light',
    viewport: opts.viewport,
    deviceScaleFactor: opts.dpr,
    isMobile: opts.isMobile,
    hasTouch: opts.isMobile,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  if (opts.isMobile) await openProfileMobile(page);
  else await openProfileDesktop(page);

  const prof = await page.$('[data-testid="linkedin-profile-view"]');
  console.log(`\n=== ${name} === profile=${!!prof} errors=${errors.length}`);
  if (!prof) { if (errors.length) console.log(errors.slice(0,4)); await browser.close(); return; }

  // ---- REACTIONS (likes) ----
  await scrollToPost(page);
  const likesBtn = page.locator(`[data-testid="post-${POST}-open-reactions"]`);
  console.log(`reactions button count=${await likesBtn.count()}, text="${(await likesBtn.first().innerText()).trim()}"`);
  await likesBtn.first().click();
  await page.waitForTimeout(700);
  let ev = await page.$('[data-testid="linkedin-engagers-view"]');
  console.log(`reactions: engagers view open=${!!ev}`);
  // covers the profile? engagers z-80 over profile z-70
  await page.screenshot({ path: `/home/user/workspace/opuseng_${name}_reactions.png` });
  // reaction filter present
  const filter = await page.$('[data-testid="engagers-reaction-filter"]');
  console.log(`reactions: filter present=${!!filter}`);
  await checkTextHygiene(page, name + ' reactions');
  // count rows in All
  const allRows = await page.$$eval('[data-testid^="engager-"]', els => els.length);
  console.log(`reactions: rows(all)=${allRows}`);
  // tap a reaction-type tab (the 2nd segment) and confirm filtering
  if (filter) {
    const segs = await page.$$('[data-testid="engagers-reaction-filter"] [data-testid^="engagers-reaction-filter-seg-"]');
    console.log(`reactions: filter segments=${segs.length}`);
    if (segs.length > 1) {
      await segs[1].click();
      await page.waitForTimeout(600);
      const filtRows = await page.$$eval('[data-testid^="engager-"]', els => els.length);
      console.log(`reactions: rows(after filter)=${filtRows} (was ${allRows})`);
      await page.screenshot({ path: `/home/user/workspace/opuseng_${name}_reactions_filtered.png` });
    }
  }
  // overflow check in 340px column (desktop)
  const overflow = await page.evaluate(() => {
    const v = document.querySelector('[data-testid="linkedin-engagers-view"]');
    if (!v) return null;
    return { sw: v.scrollWidth, cw: v.clientWidth };
  });
  console.log(`reactions: view scrollW=${overflow && overflow.sw} clientW=${overflow && overflow.cw} overflow=${overflow && overflow.sw > overflow.cw + 1}`);

  // ---- BACK -> profile, title returns ----
  const backSel = opts.isMobile ? '[data-testid="engagers-back"]' : '[data-testid="linkedin-engagers-view"] [data-testid="engagers-back"]';
  await page.locator(backSel).first().click();
  await page.waitForTimeout(700);
  ev = await page.$('[data-testid="linkedin-engagers-view"]');
  const profTitle = await page.evaluate(() => {
    // desktop title within profile view
    const t = document.querySelector('[data-testid="linkedin-profile-view"] span.text-center');
    return t ? t.innerText.trim() : null;
  });
  console.log(`back: engagers closed=${!ev} profileVisible=${!!await page.$('[data-testid="linkedin-profile-view"]')} desktopTitle="${profTitle}"`);

  // ---- COMMENTS ----
  await scrollToPost(page);
  await page.locator(`[data-testid="post-${POST}-open-comments"]`).first().click();
  await page.waitForTimeout(700);
  ev = await page.$('[data-testid="linkedin-engagers-view"]');
  const hasComment = await page.evaluate(() => {
    const v = document.querySelector('[data-testid="linkedin-engagers-view"]');
    return v ? /[a-z]{6,}/i.test(v.innerText) : false;
  });
  const cFilter = await page.$('[data-testid="engagers-reaction-filter"]');
  console.log(`comments: open=${!!ev} filterShown(should be false)=${!!cFilter} hasCommentText=${hasComment}`);
  await checkTextHygiene(page, name + ' comments');
  await page.screenshot({ path: `/home/user/workspace/opuseng_${name}_comments.png` });
  await page.locator(backSel).first().click();
  await page.waitForTimeout(700);

  // ---- REPOSTS ----
  await scrollToPost(page);
  await page.locator(`[data-testid="post-${POST}-open-reposts"]`).first().click();
  await page.waitForTimeout(700);
  ev = await page.$('[data-testid="linkedin-engagers-view"]');
  const rFilter = await page.$('[data-testid="engagers-reaction-filter"]');
  const rRows = await page.$$eval('[data-testid^="engager-"]', els => els.length);
  console.log(`reposts: open=${!!ev} filterShown(should be false)=${!!rFilter} rows=${rRows}`);
  await checkTextHygiene(page, name + ' reposts');
  await page.screenshot({ path: `/home/user/workspace/opuseng_${name}_reposts.png` });

  // ---- FROST ON SCROLL ---- scroll content and snapshot top
  await page.evaluate(() => {
    const sc = document.querySelector('[data-testid="linkedin-engagers-view"] .overflow-y-auto');
    if (sc) sc.scrollTop = 120;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/home/user/workspace/opuseng_${name}_reposts_scrolled.png` });

  await page.locator(backSel).first().click();
  await page.waitForTimeout(600);

  console.log(`${name}: final console errors=${errors.length}`);
  if (errors.length) console.log(errors.slice(0,4));
  await browser.close();
}

(async () => {
  await run('mobile_light', { isMobile: true, viewport: { width: 390, height: 844 }, dpr: 3, dark: false });
  await run('mobile_dark', { isMobile: true, viewport: { width: 390, height: 844 }, dpr: 3, dark: true });
  await run('desktop_light', { isMobile: false, viewport: { width: 1440, height: 900 }, dpr: 2, dark: false });
  await run('desktop_dark', { isMobile: false, viewport: { width: 1440, height: 900 }, dpr: 2, dark: true });
})();
