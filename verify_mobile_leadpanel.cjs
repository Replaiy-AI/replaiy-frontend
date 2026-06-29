const { chromium } = require('playwright');

const OUT = '/home/user/workspace';

async function openPanel(page) {
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1500);
  await page.click('[data-testid="smart-row-d1"]');
  await page.waitForTimeout(1500);
  // tap the contact identity pill to open the lead panel
  const candidates = ['[data-testid="contact-pill"]', '[data-testid="toolbar-identity"]', '[data-testid="subject-identity-pill"]'];
  let opened = false;
  for (const sel of candidates) {
    const el = await page.$(sel);
    if (el) {
      try { await el.click(); opened = true; break; } catch (e) {}
    }
  }
  await page.waitForTimeout(1400);
  const panel = await page.$('[data-testid="lead-panel-mobile"]');
  return { opened, hasPanel: !!panel };
}

async function run(colorScheme, suffix) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    colorScheme,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const res = await openPanel(page);
  console.log(`[${colorScheme}] open result:`, JSON.stringify(res));

  // Check the conversation chrome is NOT visible (button-back / contact-pill from chrome)
  // The mobile top chrome shell uses data-testid button-back (left slot) + contact-pill + Done.
  const chromeVisible = await page.evaluate(() => {
    const back = document.querySelector('[data-testid="button-back"]');
    const pill = document.querySelector('[data-testid="contact-pill"]');
    function vis(el) {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05;
    }
    return { backVisible: vis(back), pillVisible: vis(pill) };
  });
  console.log(`[${colorScheme}] conversation chrome visibility:`, JSON.stringify(chromeVisible));

  // Header screenshot (overview by default)
  await page.screenshot({ path: `${OUT}/opus_mob_header${suffix}.png` });

  // Measure the tab pill width vs viewport (scoped INSIDE the mobile panel,
  // since the hidden desktop panel also has a lead-tab in the DOM).
  const tabInfo = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="lead-panel-mobile"]');
    const seg = panel && panel.querySelector('[data-testid="lead-tab"]');
    if (!seg) return null;
    const wrap = seg.parentElement; // outer div with width
    const r = wrap.getBoundingClientRect();
    return { pillWidth: Math.round(r.width), pillLeft: Math.round(r.left), pillRight: Math.round(r.right), vw: window.innerWidth };
  });
  console.log(`[${colorScheme}] tab pill:`, JSON.stringify(tabInfo));
  await page.screenshot({ path: `${OUT}/opus_mob_tabs${suffix}.png` });

  // Switch to Contact tab (scope to the mobile panel)
  await page.locator('[data-testid="lead-panel-mobile"] [data-testid="lead-tab-seg-contact"]').click();
  await page.waitForTimeout(900);

  // Reveal email + phone so copy icons render (scoped to mobile panel)
  const ae = await page.$('[data-testid="lead-panel-mobile"] [data-testid="access-email"]');
  if (ae) { await ae.click(); }
  const ap = await page.$('[data-testid="lead-panel-mobile"] [data-testid="access-phone"]');
  if (ap) { await ap.click(); }
  await page.waitForTimeout(1800);

  // Measure a copy glyph hit area (inside the mobile panel)
  const glyph = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="lead-panel-mobile"]');
    if (!panel) return null;
    const c = panel.querySelector('[data-testid="copy-linkedin"]') || panel.querySelector('[data-testid="copy-company"]') || panel.querySelector('[data-testid="open-linkedin"]');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log(`[${colorScheme}] copy/open glyph hit area:`, JSON.stringify(glyph));

  if (colorScheme === 'dark') {
    await page.screenshot({ path: `${OUT}/opus_mob_dark.png` });
  } else {
    await page.screenshot({ path: `${OUT}/opus_mob_contact${suffix}.png` });
  }

  await browser.close();
}

(async () => {
  await run('light', '');
  await run('dark', '_dark');
  console.log('DONE');
})();
