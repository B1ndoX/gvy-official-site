import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const config = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../fixtures/executive-hangar-config.json',import.meta.url))));
const epoch = Date.parse(config.serverStartTimes.initialOpenTime), open = 3900123, closed = 7200227;
const source = 'https://raw.githubusercontent.com/ArkanisCorporation/Exec-Hangar/main/config.json*';
const trigger = '[data-hangar-open]', panel = '[data-hangar-panel]';
async function freeze(page,time) {await page.clock.install({time:time-1000});await page.clock.pauseAt(time);}
async function mock(page, handler) {await page.route(source, handler || (route=>route.fulfill({json:config,headers:{'Access-Control-Allow-Origin':'*'}})));}
async function identity(page) {
  await page.goto('/'); await expect(page).toHaveTitle(/星远/);
  await ready(page);
}
async function ready(page) {
  await page.waitForFunction(()=>window.__gvyCinematicHomepage);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  // The existing navigation enters after the cinematic hero. Exercise that
  // normal scroll path, then restore the exact boundary time under test.
  const at = await page.evaluate(()=>Date.now());
  await page.locator('#fleet-signal').evaluate(e=>window.scrollTo({top:e.offsetTop,behavior:'instant'}));
  await page.clock.runFor(2000);
  await page.clock.setSystemTime(at);
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
}
const value = page => page.locator(trigger+' [data-hangar-countdown]');
async function show(page) {await page.locator(trigger).click(); await expect(page.locator(panel)).toBeVisible();}
async function dialFits(page) {
  // A rectangle can fit the dial's box while still crossing its curved edge.
  // Check the four flip-row corners against the actual SVG inner radius.
  const clearance = await page.locator('.hangar-dial').evaluate(el => {
    const dial=el.getBoundingClientRect(), flip=el.querySelector('[data-hangar-flip]').getBoundingClientRect();
    const radius=dial.width*122/264, cx=dial.x+dial.width/2, cy=dial.y+dial.height/2;
    return Math.min(...[flip.left,flip.right].flatMap(x=>[flip.top,flip.bottom].map(y=>radius-Math.hypot(x-cx,y-cy))));
  });
  expect(clearance).toBeGreaterThan(4);
  await expect(page.locator(panel+' a')).toHaveCount(0);
  await expect(page.locator('.hangar-meta')).toContainText('来源：Arkanis');
}

test('hover details, exact stage changes, throttled sync, keyboard close and fresh reload', async ({page},testInfo) => {
  let requests=0; const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await freeze(page,epoch + 3600000 - 500);
  await mock(page, async route=>{requests++;await route.fulfill({json:config,headers:{'Access-Control-Allow-Origin':'*'}});});
  await identity(page); await expect(value(page)).toHaveText('00:00:01');
  await page.locator(trigger).hover(); await expect(page.locator(panel)).toBeVisible();
  await expect(page.locator('[data-hangar-phase]')).toHaveText('可开启');
  await expect(page.locator('[data-hangar-target]')).toHaveText('距离本阶段结束');
  await expect(page.locator('[data-hangar-calibration]')).toHaveAttribute('datetime',new Date(epoch).toISOString());
  await expect(page.locator('[data-hangar-updated-row]')).toBeVisible();
  const syncedAt=await page.locator('[data-hangar-updated]').getAttribute('datetime');
  expect(Date.parse(syncedAt)).toBeGreaterThan(epoch);
  await expect(page.locator('.hangar-freshness')).toContainText('计时基准');
  await expect(page.locator('.hangar-freshness')).toContainText('配置同步');
  const r=await page.locator(trigger).boundingBox(), g=await page.locator('.fleet-games-jump').boundingBox();
  expect(r.x).toBeGreaterThanOrEqual(g.x+g.width);
  await page.clock.fastForward(1000); await expect(page.locator('[data-hangar-phase]')).toHaveText('重置中');
  await expect(page.locator('[data-hangar-light][data-color="off"]')).toHaveCount(5);
  await page.clock.setSystemTime(epoch+open); await page.clock.fastForward(1000);
  await expect(page.locator('[data-hangar-phase]')).toHaveText('充能中');
  await expect(page.locator('[data-hangar-target]')).toHaveText('距离可开启');
  await expect(page.locator('[data-hangar-light][data-color="red"]')).toHaveCount(5);
  await expect(page.locator('[data-hangar-next]')).toHaveAttribute('datetime',new Date(epoch+open+closed).toISOString());
  await page.keyboard.press('Escape'); await expect(page.locator(panel)).not.toBeVisible();
  const closedTime = await value(page).textContent();
  await page.clock.fastForward(1500); await expect(value(page)).not.toHaveText(closedTime); expect(requests).toBe(1);
  await page.reload(); await ready(page);
  await expect(value(page)).toContainText('01:59:'); expect(requests).toBe(1);
  await show(page); await dialFits(page); await page.screenshot({path:testInfo.outputPath('hangar-desktop.png')});
  expect(errors).toEqual([]);
});

test('hover previews close on leave, while clicking pins until outside, toggle, close or Escape', async ({page}) => {
  await freeze(page,epoch+900000);await mock(page);await identity(page);
  const button=page.locator(trigger), details=page.locator(panel);
  await button.hover();await expect(details).toBeVisible();
  await page.mouse.move(1100,600);await page.clock.fastForward(300);await expect(details).not.toBeVisible();
  await button.hover();await button.click();await page.mouse.move(1100,600);
  await page.clock.fastForward(2000);await expect(details).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded','true');
  await page.mouse.click(1100,600);await expect(details).not.toBeVisible();
  await show(page);await button.click();await expect(details).not.toBeVisible();
  await show(page);await page.locator('[data-hangar-close]').click();await expect(details).not.toBeVisible();
  await show(page);await page.keyboard.press('Escape');await expect(details).not.toBeVisible();
  // Closing must reset the pin so the next hover can dismiss normally again.
  await page.mouse.move(1100,600);await button.hover();await expect(details).toBeVisible();
  await page.mouse.move(1100,600);await page.clock.fastForward(300);await expect(details).not.toBeVisible();
  await button.focus();await page.keyboard.press('Enter');await expect(details).toBeVisible();
  await page.mouse.move(1100,600);await page.clock.fastForward(2000);await expect(details).toBeVisible();
  await page.keyboard.press('Escape');await expect(details).not.toBeVisible();
});

test('the countdown arc drains, and availability, charging and reset have distinct phase colors', async ({page},testInfo) => {
  // Also exercise the reduced-motion presentation at exact state boundaries.
  await page.emulateMedia({reducedMotion:'reduce'});
  await freeze(page,epoch+900000);await mock(page);await identity(page);
  const idleBorder=await page.locator(trigger).evaluate(el=>getComputedStyle(el).borderTopColor);
  await show(page);
  const ring=page.locator('[data-hangar-progress]'), colors=[];
  expect(await ring.evaluate(el=>parseFloat(getComputedStyle(el).strokeDashoffset))).toBeCloseTo(25,1);
  for (const [at,phase,label] of [[epoch+1800000,'available','可开启'],[epoch+3600000+150061,'resetting','重置中'],[epoch+open+closed/2,'charging','充能中']]) {
    await page.clock.setSystemTime(Math.floor(at));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.locator('[data-hangar-phase]')).toHaveText(label);
    await page.clock.fastForward(400);
    expect(await ring.evaluate(el=>parseFloat(getComputedStyle(el).strokeDashoffset))).toBeCloseTo(50,0);
    const color=await ring.evaluate(el=>getComputedStyle(el).stroke);
    // Interaction highlights follow the phase; the resting edge stays neutral.
    await expect(page.locator(trigger)).toHaveCSS('border-top-color',color);
    colors.push(color);
    await page.locator(panel).screenshot({path:testInfo.outputPath('hangar-'+phase+'.png')});
  }
  expect(new Set(colors).size).toBe(3);
  await page.keyboard.press('Escape');await page.mouse.move(1100,600);
  await page.locator(trigger).blur();
  await expect(page.locator(trigger)).toHaveCSS('border-top-color',idleBorder);
});

test('returning after a suspended tab recomputes from the epoch and synchronizes only when due', async ({page}) => {
  let requests=0;await freeze(page,epoch);
  await mock(page, async route=>{requests++;await route.fulfill({json:config,headers:{'Access-Control-Allow-Origin':'*'}});});
  await identity(page);await expect(value(page)).toHaveText('01:00:00');
  await page.clock.setSystemTime(epoch+open+closed-1250);
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await expect(value(page)).toHaveText('00:00:02'); await expect.poll(()=>requests).toBe(2);
  await page.clock.fastForward(2000);await expect(value(page)).toHaveText('01:00:00');
  await page.clock.fastForward(5000);expect(requests).toBe(2);
});

test('directional edge highlights respond on both surfaces and disappear from the resting header', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});await freeze(page,epoch+900000);await mock(page);await identity(page);
  const button=page.locator(trigger), edge=button.locator('.hangar-edge-glow');
  await expect(edge).toHaveCSS('opacity','0');
  await button.hover({position:{x:4,y:20}});await expect(edge).toHaveCSS('opacity','1');
  const first=await edge.evaluate(el=>el.style.getPropertyValue('--hangar-edge-angle'));
  await button.hover({position:{x:120,y:20}});
  await expect.poll(()=>edge.evaluate(el=>el.style.getPropertyValue('--hangar-edge-angle'))).not.toBe(first);
  const details=page.locator(panel), detailEdge=details.locator('.hangar-edge-glow');
  await details.hover({position:{x:15,y:180}});await expect(detailEdge).toHaveCSS('opacity','1');
  const left=await detailEdge.evaluate(el=>el.style.getPropertyValue('--hangar-edge-angle'));
  await details.hover({position:{x:365,y:180}});
  await expect.poll(()=>detailEdge.evaluate(el=>el.style.getPropertyValue('--hangar-edge-angle'))).not.toBe(left);
  await page.keyboard.press('Escape');await button.blur();await page.mouse.move(1100,600);
  await expect(edge).toHaveCSS('opacity','0');
});

test('failed and invalid fetches retain the last valid config across a reload', async ({page}) => {
  let bad=false;await freeze(page,epoch+open+60000);
  await mock(page, route=>route.fulfill(bad?{status:503,body:'unavailable',headers:{'Access-Control-Allow-Origin':'*'}}:{json:config,headers:{'Access-Control-Allow-Origin':'*'}}));
  await identity(page);await expect(value(page)).toContainText('01:59:');await show(page);
  const updated=await page.locator('[data-hangar-updated]').textContent();bad=true;
  await page.clock.fastForward(900000);
  await expect(page.locator('[data-hangar-sync]')).toHaveText('同步失败 · 保留上次有效配置');
  await expect(page.locator('[data-hangar-updated]')).toHaveText(updated);
  await page.unroute(source);await mock(page,route=>route.fulfill({json:{serverStartTimes:{openDurationMs:1}},headers:{'Access-Control-Allow-Origin':'*'}}));
  await page.clock.fastForward(900000);await expect(page.locator('[data-hangar-sync]')).toHaveText('同步失败 · 保留上次有效配置');
  await page.reload();await ready(page);await show(page);await expect(page.locator('[data-hangar-version]')).toHaveText('4.10.2-LIVE');
  await expect(value(page)).not.toContainText('––');
});

test('no valid data stays unavailable, and automatic sync recovers without a public refresh button', async ({page},testInfo) => {
  let valid=false;await freeze(page,epoch);
  await mock(page,route=>route.fulfill(valid?{json:config,headers:{'Access-Control-Allow-Origin':'*'}}:{status:503,body:'offline',headers:{'Access-Control-Allow-Origin':'*'}}));
  await identity(page);await show(page);
  await expect(page.locator('[data-hangar-phase]')).toHaveText('暂不可用');
  await expect(page.locator('[data-hangar-countdown]').last()).toHaveText('暂不可用');
  await expect(page.locator('[data-hangar-next]')).toHaveText('—');
  await page.screenshot({path:testInfo.outputPath('hangar-unavailable.png')});
  await expect(page.locator('[data-hangar-refresh]')).toHaveCount(0);
  valid=true;await page.clock.fastForward(900000);
  await expect(page.locator('[data-hangar-phase]')).toHaveText('可开启');
});

for (const width of [390,320]) test('touch disclosure fits the '+width+'px header and details', async ({browser},testInfo) => {
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();const messages=[];page.on('pageerror',e=>messages.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push(m.text());});
  await freeze(page,epoch+open+2000000);await mock(page);await identity(page);
  await expect(value(page)).toContainText('01:');await page.locator(trigger).tap();
  await expect(page.locator(panel)).toBeVisible();await page.clock.fastForward(1000);await expect(page.locator(panel)).toBeVisible();
  const bounds=await page.locator('.fleet-brand,.fleet-games-jump,'+trigger).evaluateAll(els=>els.map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})));
  expect(bounds.every(b=>b.left>=0&&b.right<=width)).toBe(true);expect(bounds[0].right).toBeLessThanOrEqual(bounds[1].left);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator(panel).evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await expect(page.locator('[data-hangar-phase]')).toHaveText('充能中');
  await dialFits(page);
  await page.screenshot({path:testInfo.outputPath('hangar-phone-'+width+'.png')});
  await page.locator('[data-hangar-close]').tap();await expect(page.locator(panel)).not.toBeVisible();
  expect(messages).toEqual([]);await context.close();
});
