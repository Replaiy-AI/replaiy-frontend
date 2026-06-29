const { chromium } = require('playwright');

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

async function scrollToActivity(page) {
  await page.evaluate(() => {
    const act = document.querySelector('[data-testid="profile-activity"]');
    if (act) act.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(600);
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

  const act = await page.$('[data-testid="profile-activity"]');
  console.log(`${name}: activity found=${!!act} errors=${errors.length}`);
  if (!act) { if (errors.length) console.log(errors.slice(0,3)); await browser.close(); return; }

  await scrollToActivity(page);

  const strip = await page.$('[data-testid="activity-tab"]');
  if (strip) await strip.screenshot({ path: `/home/user/workspace/opusact2_${name}_tabstrip.png` });

  // ALL feed
  await act.screenshot({ path: `/home/user/workspace/opusact2_${name}_all.png` });

  // capture repost items in All
  for (const id of ['p-emma-rp1', 'p-emma-rp2']) {
    const el = await page.$(`[data-testid="activity-item-${id}"]`);
    if (el) { await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(250); await el.screenshot({ path: `/home/user/workspace/opusact2_${name}_${id}.png` }); }
    else console.log(`${name}: MISSING ${id} in All`);
  }

  // Posts tab — verify reposts present + strip + indicator
  await page.locator('[data-testid="activity-tab-seg-posts"]').click();
  await page.waitForTimeout(700);
  await scrollToActivity(page);
  const s2 = await page.$('[data-testid="activity-tab"]');
  if (s2) await s2.screenshot({ path: `/home/user/workspace/opusact2_${name}_strip_posts.png` });
  const a2 = await page.$('[data-testid="profile-activity"]');
  if (a2) await a2.screenshot({ path: `/home/user/workspace/opusact2_${name}_poststab.png` });
  const rpInPosts = await page.$('[data-testid="activity-item-p-emma-rp1"]');
  console.log(`${name}: repost in Posts tab = ${!!rpInPosts}`);

  // Comments tab strip
  await page.locator('[data-testid="activity-tab-seg-comments"]').click();
  await page.waitForTimeout(700); await scrollToActivity(page);
  const s3 = await page.$('[data-testid="activity-tab"]');
  if (s3) await s3.screenshot({ path: `/home/user/workspace/opusact2_${name}_strip_comments.png` });

  // Reactions tab strip
  await page.locator('[data-testid="activity-tab-seg-reactions"]').click();
  await page.waitForTimeout(700); await scrollToActivity(page);
  const s4 = await page.$('[data-testid="activity-tab"]');
  if (s4) await s4.screenshot({ path: `/home/user/workspace/opusact2_${name}_strip_reactions.png` });

  // back to All
  await page.locator('[data-testid="activity-tab-seg-all"]').click();
  await page.waitForTimeout(600);

  // em-dash / middot scan of activity text
  const txt = await page.locator('[data-testid="profile-activity"]').innerText().catch(()=> '');
  console.log(`${name}: emDash=${txt.includes('\u2014')} middot=${txt.includes('\u00b7')}`);

  await browser.close();
}

(async () => {
  await run('mobile_light', { dark:false, viewport:{width:390,height:844}, dpr:3, isMobile:true });
  await run('mobile_dark',  { dark:true,  viewport:{width:390,height:844}, dpr:3, isMobile:true });
  await run('desktop_light',{ dark:false, viewport:{width:1440,height:900}, dpr:2, isMobile:false });
  await run('desktop_dark', { dark:true,  viewport:{width:1440,height:900}, dpr:2, isMobile:false });
  console.log('DONE');
})();
