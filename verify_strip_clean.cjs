const { chromium } = require('playwright');
async function go(page, mobile){
  await page.goto('http://localhost:5000/#/inbox');
  await page.waitForTimeout(1500);
  await page.locator('[data-testid="smart-row-d2"]').first().click();
  await page.waitForTimeout(1400);
  const cp = page.locator('[data-testid="contact-pill"]');
  if (await cp.count()) { await cp.first().click(); await page.waitForTimeout(1000); }
  const sel = mobile ? '[data-testid="lead-panel-mobile"] [data-testid="lead-tab-seg-contact"]' : '[data-testid="lead-panel-desktop"] [data-testid="lead-tab-seg-contact"]';
  let seg = page.locator(sel);
  if (!(await seg.count())) seg = page.locator('[data-testid="lead-tab-seg-contact"]');
  if (await seg.count()) { await seg.first().click(); await page.waitForTimeout(700); }
  await page.locator('[data-testid="open-full-profile"]').first().click();
  await page.waitForTimeout(1100);
  // scroll so the Activity tab strip sits in the MIDDLE of the viewport, clear of top chrome
  await page.evaluate(() => {
    const v = document.querySelector('[data-testid="linkedin-profile-view"] .overflow-y-auto');
    const act = document.querySelector('[data-testid="profile-activity"]');
    if (v && act) v.scrollTop = act.offsetTop - 220;
  });
  await page.waitForTimeout(600);
}
async function run(name, opts){
  const b = await chromium.launch();
  const ctx = await b.newContext({ colorScheme: opts.dark?'dark':'light', viewport: opts.vp, deviceScaleFactor: opts.dpr, isMobile: opts.mobile, hasTouch: opts.mobile });
  const page = await ctx.newPage();
  await go(page, opts.mobile);
  const strip = await page.$('[data-testid="activity-tab"]');
  if (strip) await strip.screenshot({ path: `/home/user/workspace/opusact2_${name}_strip_clean.png` });
  console.log(`${name} clean strip done = ${!!strip}`);
  await b.close();
}
(async()=>{
  await run('desktop_dark', {dark:true, vp:{width:1440,height:900}, dpr:2, mobile:false});
  await run('mobile_light', {dark:false, vp:{width:390,height:844}, dpr:3, mobile:true});
  console.log('DONE');
})();
