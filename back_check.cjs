const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ colorScheme: 'light', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1500);
  await page.click('[data-testid="smart-row-d1"]');
  await page.waitForTimeout(1500);
  for (const s of ['[data-testid="contact-pill"]','[data-testid="toolbar-identity"]','[data-testid="subject-identity-pill"]']) { const el = await page.$(s); if (el) { try { await el.click(); break; } catch(e){} } }
  await page.waitForTimeout(1400);
  console.log('panel open present:', !!(await page.$('[data-testid="lead-panel-mobile"]')));
  await page.locator('[data-testid="lead-panel-mobile"] [data-testid="lead-panel-close"]').click();
  await page.waitForTimeout(1200);
  const stillThere = await page.$('[data-testid="lead-panel-mobile"]');
  const chrome = await page.evaluate(() => {
    function vis(sel){ const el=document.querySelector(sel); if(!el) return false; const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&parseFloat(cs.opacity)>0.05; }
    return { back: vis('[data-testid="button-back"]'), pill: vis('[data-testid="contact-pill"]') };
  });
  console.log('panel after close present:', !!stillThere);
  console.log('conversation chrome restored:', JSON.stringify(chrome));
  await browser.close();
})();
