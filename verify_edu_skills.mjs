import { chromium } from 'playwright';

const OUT = '/home/user/workspace';

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    const root = document.documentElement;
    if (t === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    try { localStorage.setItem('theme', t); } catch {}
  }, theme);
  await page.waitForTimeout(400);
}

async function openProfileMobile(page) {
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1400);
  await page.click('[data-testid="smart-row-d2"]');
  await page.waitForTimeout(1300);
  await page.click('[data-testid="contact-pill"]');
  await page.waitForTimeout(1000);
  await page.click('[data-testid="lead-panel-mobile"] [data-testid="lead-tab-seg-contact"]');
  await page.waitForTimeout(800);
  await page.click('[data-testid="lead-panel-mobile"] [data-testid="open-full-profile"]');
  await page.waitForTimeout(900);
}

async function openProfileDesktop(page) {
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1400);
  await page.click('[data-testid="smart-row-d2"]');
  await page.waitForTimeout(1300);
  // The desktop lead panel needs its Contact tab selected first.
  const seg = page.locator('[data-testid="lead-tab-seg-contact"]');
  if (await seg.count()) { await seg.first().click(); await page.waitForTimeout(800); }
  await page.click('[data-testid="open-full-profile"]');
  await page.waitForTimeout(900);
}

async function scrollAndShoot(page, prefix) {
  const scroller = '[data-testid="linkedin-profile-view"] .overflow-y-auto';
  // progressively scroll to bottom
  for (let i = 0; i < 8; i++) {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollTop += 500;
    }, scroller);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
  // scroll so Education is visible: find the education item
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="profile-education-item"]');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${prefix}_edu.png` });
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="profile-skills"]');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${prefix}_skills.png` });

  // report data
  const info = await page.evaluate(() => {
    const edu = [...document.querySelectorAll('[data-testid="profile-education-item"]')].length;
    const skillsWrap = document.querySelector('[data-testid="profile-skills"]');
    const skills = skillsWrap ? [...skillsWrap.querySelectorAll('span')].map(s => s.textContent) : [];
    const bodyText = document.querySelector('[data-testid="linkedin-profile-view"]')?.innerText || '';
    const hasEm = bodyText.includes('\u2014');
    const hasEn = bodyText.includes('\u2013');
    const hasMid = bodyText.includes('\u00b7');
    return { edu, skills, hasEm, hasEn, hasMid };
  });
  return info;
}

const browser = await chromium.launch();

// MOBILE
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const mpage = await mctx.newContext ? null : await mctx.newPage();
{
  const page = mpage;
  await openProfileMobile(page);
  await setTheme(page, 'light');
  const lr = await scrollAndShoot(page, 'opusedu_mobile_light');
  console.log('MOBILE LIGHT', JSON.stringify(lr));
  await setTheme(page, 'dark');
  const dr = await scrollAndShoot(page, 'opusedu_mobile_dark');
  console.log('MOBILE DARK', JSON.stringify(dr));
}
await mctx.close();

// DESKTOP
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
{
  const page = await dctx.newPage();
  await openProfileDesktop(page);
  await setTheme(page, 'light');
  const lr = await scrollAndShoot(page, 'opusedu_desktop_light');
  console.log('DESKTOP LIGHT', JSON.stringify(lr));
  await setTheme(page, 'dark');
  const dr = await scrollAndShoot(page, 'opusedu_desktop_dark');
  console.log('DESKTOP DARK', JSON.stringify(dr));
}
await dctx.close();

await browser.close();
console.log('DONE');
