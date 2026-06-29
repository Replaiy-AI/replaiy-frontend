const { chromium } = require('playwright');
const OUT = '/home/user/workspace';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ colorScheme: 'light', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1500);
  await page.click('[data-testid="smart-row-d1"]');
  await page.waitForTimeout(1500);

  // The desktop lead column. It may already be open (default leadPanelOpen=true).
  // Ensure the desktop panel is present.
  let panel = await page.$('[data-testid="lead-panel-desktop"]');
  if (!panel) {
    // try clicking the identity to open it
    const cands = ['[data-testid="contact-pill"]', '[data-testid="toolbar-identity"]', '[data-testid="subject-identity-pill"]'];
    for (const s of cands) { const el = await page.$(s); if (el) { try { await el.click(); break; } catch (e) {} } }
    await page.waitForTimeout(1000);
    panel = await page.$('[data-testid="lead-panel-desktop"]');
  }

  const info = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="lead-panel-desktop"]');
    if (!panel) return { found: false };
    const r = panel.getBoundingClientRect();
    const seg = panel.querySelector('[data-testid="lead-tab"]');
    const wrap = seg ? seg.parentElement : null;
    const tr = wrap ? wrap.getBoundingClientRect() : null;
    return {
      found: true,
      panelWidth: Math.round(r.width),
      tabPillWidth: tr ? Math.round(tr.width) : null,
    };
  });
  console.log('desktop:', JSON.stringify(info));

  // Screenshot Overview state of just the panel region
  await page.screenshot({ path: `${OUT}/opus_desktop_regression.png` });

  // Switch to Contact and measure a glyph hit area (should be 24px desktop)
  await page.locator('[data-testid="lead-panel-desktop"] [data-testid="lead-tab-seg-contact"]').click();
  await page.waitForTimeout(900);
  const glyph = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="lead-panel-desktop"]');
    const c = panel && (panel.querySelector('[data-testid="copy-company"]') || panel.querySelector('[data-testid="copy-linkedin"]'));
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log('desktop contact glyph hit area:', JSON.stringify(glyph));

  await browser.close();
})();
