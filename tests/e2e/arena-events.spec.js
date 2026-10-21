import{test,expect}from'@playwright/test';import{readFileSync}from'node:fs';import{decodeRoster}from'../../scripts/lib/rsi-members.mjs';
const roster=decodeRoster(readFileSync(new URL('../../assets/js/fleet-members.js',import.meta.url),'utf8'));
const state=p=>p.evaluate(()=>window.__gvyArena.snapshot());
async function begin(page,seed){
 await page.addInitScript(seed=>{Math.random=()=>seed},seed);await page.route(/\/assets\/js\/fleet-members\.js(?:\?|$)/,r=>r.fulfill({contentType:'text/javascript',body:`window.__gvyFleetRoster=${JSON.stringify({...roster,total:2,members:roster.members.slice(0,2)})}`}));
 await page.goto('/member-brawl.html');await page.locator('[data-brawl-start]').waitFor();await page.clock.install();
 await page.locator('[data-arena-mode]').selectOption('teams');await page.locator('[data-arena-loadout]').selectOption('unarmed');await page.locator('[data-brawl-start]').click();
 await page.evaluate(()=>{for(const [i,e]of [...document.querySelectorAll('.member-fighter')].entries()){const f=e.physicsItem;Matter.Body.setStatic(f.body,true);Matter.Body.setPosition(f.body,{x:100+i*600,y:100});f.nextAttack=f.nextMovement=Infinity;}});
}
test('a genuine gravity event has a readable core, bounded accretion disk and pausable visuals',async({page})=>{
 await begin(page,.999);await page.clock.runFor(26800);expect((await state(page)).map.zones.some(z=>z.type==='gravity')).toBe(true);
 const core=page.locator('.arena-singularity');await expect(core).toBeVisible();const box=await core.boundingBox();expect(box.width).toBeGreaterThanOrEqual(30);expect(box.width).toBeLessThanOrEqual(76);
 await expect(page.locator('.arena-event-gravity')).toHaveCSS('pointer-events','none');
 const before=await page.locator('.arena-accretion-disk').evaluate(e=>getComputedStyle(e).transform);
 await page.clock.runFor(200);expect(await page.locator('.arena-accretion-disk').evaluate(e=>getComputedStyle(e).transform)).not.toBe(before);
 await page.locator('[data-arena-pause]').click();const held=await page.locator('.arena-accretion-disk').evaluate(e=>getComputedStyle(e).transform),snap=await state(page);
 await page.clock.runFor(2000);expect(await state(page)).toEqual(snap);expect(await page.locator('.arena-accretion-disk').evaluate(e=>getComputedStyle(e).transform)).toBe(held);
});
test('medical supply visibly becomes a marked healing area without extra clocks or altered pickup geometry',async({page})=>{
 await begin(page,.6);await page.clock.runFor(19000);await expect(page.locator('.arena-medical-cross').first()).toBeVisible();
 await page.clock.runFor(3000);await expect(page.locator('.arena-heal-zone').first()).toBeVisible();await expect(page.locator('.arena-heal-zone .arena-event-label').first()).toHaveText('治疗区域');
 await expect(page.locator('.arena-heal-zone').first()).toHaveCSS('pointer-events','none');
 expect((await state(page)).map.zones.length).toBeLessThanOrEqual(8);
});
