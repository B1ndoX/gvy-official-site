import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {decodeRoster} from '../../scripts/lib/rsi-members.mjs';
const roster=decodeRoster(readFileSync(new URL('../../assets/js/fleet-members.js',import.meta.url),'utf8'));
const poll={intervals:[10,25,50]};
async function open(page,reduced=false,loadout='unarmed'){
  if(reduced)await page.emulateMedia({reducedMotion:'reduce'});
  await page.route(/\/assets\/js\/fleet-members\.js(?:\?|$)/,r=>r.fulfill({contentType:'text/javascript',body:`window.__gvyFleetRoster=${JSON.stringify({...roster,members:roster.members.slice(0,4),total:4})}`}));
  await page.goto('/member-brawl.html');await page.locator('[data-arena-mode]').selectOption('teams');
  await page.locator('[data-arena-terrain]').selectOption('flat');await page.locator('[data-arena-loadout]').selectOption(loadout);
  await page.locator('[data-brawl-start]').click();
  await expect.poll(()=>page.evaluate(()=>window.__gvyArena.snapshot().simTime),poll).toBeGreaterThan(0);
}
async function contact(page,hp=100){
  await page.evaluate(hp=>{
    const fs=[...document.querySelectorAll('.member-fighter')].map(e=>e.physicsItem),unit=window.__gvyArena.snapshot().map.unit;
    const now=window.__gvyArena.snapshot().simTime;
    for(const [i,f] of fs.entries()){
      Matter.Body.setStatic(f.body,true);Matter.Body.setPosition(f.body,{x:400+i*80,y:180});
      Matter.Body.setVelocity(f.body,{x:0,y:0});f.nextAttack=f.nextMovement=Infinity;f.attack=null;f.damageSources.clear();
      f.rig.reset({...f.body.position,aim:0});f.damageSources.clear();
    }
    const a=fs[0],b=fs[2];Matter.Body.setPosition(a.body,{x:100,y:150});Matter.Body.setPosition(b.body,{x:100+unit,y:150});
    a.rig.reset({x:100,y:150,aim:0});b.rig.reset({...b.body.position,aim:0});b.hp=hp;
    const animation=a.weapon.animations[0],timeline=GVYArenaActions.compile(animation,GVYArenaMotion);
    a.attack={start:now-400,aim:0,inverse:false,hit:new Set(),fired:false,animation,timeline,duration:timeline.duration,target:{...b.body.position}};
    Matter.Body.setVelocity(a.rig.fistBody,{x:unit*20/60,y:0});
  },hp);
}
test('real contact starts avatar-only feedback and a pausable two-layer health sequence',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await contact(page);
  await expect.poll(()=>page.evaluate(()=>document.querySelectorAll('.member-fighter')[2].physicsItem.hp),poll).toBeLessThan(100);
  await page.locator('[data-arena-pause]').click();
  const first=await page.evaluate(()=>{
    const f=document.querySelectorAll('.member-fighter')[2].physicsItem;
    return{hp:f.hp,health:{...f.healthVisual},shake:f.hitShake,canvas:document.querySelectorAll('.arena-feedback').length,
      avatar:getComputedStyle(f.avatar).transform,hand:getComputedStyle(f.hand).transform,stats:window.__gvyArena.snapshot().feedback};
  });
  expect(first.shake.duration).toBeGreaterThan(0);expect(first.stats.pieces).toBeGreaterThan(0);expect(first.canvas).toBe(1);
  expect(first.health.back).toBeGreaterThan(first.hp/100);
  await page.waitForTimeout(350);
  const frozen=await page.evaluate(()=>{const f=document.querySelectorAll('.member-fighter')[2].physicsItem;return{health:{...f.healthVisual},avatar:getComputedStyle(f.avatar).transform,hand:getComputedStyle(f.hand).transform}});
  expect(frozen.health).toEqual(first.health);expect(frozen.avatar).toBe(first.avatar);expect(frozen.hand).toBe(first.hand);
  // Move the attack away; resuming should finish the original visual sequence.
  await page.evaluate(()=>{const f=document.querySelector('.member-fighter').physicsItem;f.attack=null;Matter.Body.setPosition(f.body,{x:700,y:120});f.rig.reset({...f.body.position,aim:0});});
  await page.locator('[data-arena-pause]').click();
  await expect.poll(()=>page.evaluate(()=>{const f=document.querySelectorAll('.member-fighter')[2].physicsItem;return Math.abs(f.healthVisual.back-f.hp/100)}),{timeout:4000}).toBeLessThan(.001);
  expect(errors).toEqual([]);
});
test('short trails follow actual active weapons and the one surface is replaced on restart and removed on settings',async({page})=>{
  await page.addInitScript(()=>{Math.random=()=>.8;});
  await open(page,false,'same');
  await page.evaluate(()=>{
    const fs=[...document.querySelectorAll('.member-fighter')].map(e=>e.physicsItem),unit=window.__gvyArena.snapshot().map.unit;
    for(const [i,f] of fs.entries()){
      Matter.Body.setStatic(f.body,true);Matter.Body.setPosition(f.body,{x:i===0||i===2?100+(i/2)*unit*2.5:800+i*80,y:150});
      f.rig.reset({...f.body.position,aim:i?Math.PI:0});f.aim=f.desiredAim=i?Math.PI:0;
      for(const other of document.querySelectorAll(".member-fighter")){const r=other.physicsItem.rig; if(r)for(const b of r.bodies)f.damageSources.set(b,Infinity);} f.damageSources.set(null,Infinity);f.nextMovement=Infinity;if(i)f.nextAttack=Infinity;
    }
  });
  await expect.poll(()=>page.evaluate(()=>window.__gvyArena.snapshot().feedback.peakSegments),{timeout:6000}).toBeGreaterThan(0);
  expect(await page.locator('.arena-feedback').count()).toBe(1);
  await page.locator('[data-arena-restart]').click();expect(await page.locator('.arena-feedback').count()).toBe(1);
  await page.locator('[data-arena-settings]').click();expect(await page.locator('.arena-feedback').count()).toBe(0);
  await page.locator('[data-brawl-start]').click();expect(await page.locator('.arena-feedback').count()).toBe(1);
});
test('reduced-motion keeps immediate health without allocating effect canvas or shake',async({page})=>{
  await open(page,true);await contact(page);
  await expect.poll(()=>page.evaluate(()=>document.querySelectorAll('.member-fighter')[2].physicsItem.hp),poll).toBeLessThan(100);
  await page.locator('[data-arena-pause]').click();
  const s=await page.evaluate(()=>{const f=document.querySelectorAll('.member-fighter')[2].physicsItem;return{hp:f.hp,front:f.healthVisual.front,back:f.healthVisual.back,shake:f.hitShake,canvas:document.querySelectorAll('.arena-feedback').length}});
  expect(s.canvas).toBe(0);expect(s.shake).toBeNull();expect(s.front).toBeCloseTo(s.hp/100,4);expect(s.back).toBeCloseTo(s.hp/100,4);
});

test('real critical hits and kill healing produce truthful bounded cues which freeze with pause',async({page})=>{
 await page.addInitScript(()=>{Math.random=()=>.005;});await open(page);await contact(page);
 await expect.poll(()=>page.evaluate(()=>window.__gvyArena.snapshot().feedback.lastCue?.kind),poll).toBe('critical');
 await page.locator('[data-arena-pause]').click();const first=await page.evaluate(()=>window.__gvyArena.snapshot());
 expect(first.feedback.cues).toBeGreaterThan(0);expect(first.feedback.cues).toBeLessThanOrEqual(16);
 await page.waitForTimeout(250);expect(await page.evaluate(()=>window.__gvyArena.snapshot())).toEqual(first);
 await page.locator('[data-arena-restart]').click();await page.locator('[data-arena-pause]').click();await contact(page);
 await page.evaluate(()=>{const fs=[...document.querySelectorAll('.member-fighter')].map(e=>e.physicsItem);fs[0].hp=40;fs[2].hp=1;});
 await page.locator('[data-arena-pause]').click();
 await expect.poll(()=>page.evaluate(()=>window.__gvyArena.snapshot().feedback.lastCue?.kind),poll).toBe('heal');
 await page.locator('[data-arena-pause]').click();const healed=await page.evaluate(()=>window.__gvyArena.snapshot());
 expect(healed.fighters[0].hp).toBe(100);expect(healed.feedback.lastCue.text).toBe('+60');
 expect(healed.feedback.peakCues).toBeLessThanOrEqual(16);
});

test('a real elimination announcement fades with match time, freezes while paused and clears on settings',async({page})=>{
 // Arm the fatal hit and target HP atomically: a RAF can run between evaluations.
 await open(page);await page.clock.install();await contact(page,1);
 const entry=page.locator('[data-arena-feed] li').filter({hasText:'淘汰'}).first();
 await expect(entry).toBeVisible();await page.locator('[data-arena-pause]').click();
 const text=await entry.textContent(),read=()=>page.locator('[data-arena-feed] li').filter({hasText:text}).evaluate(e=>Number(getComputedStyle(e).opacity));
 expect(await read()).toBe(1);const frozen=await page.evaluate(()=>window.__gvyArena.snapshot().simTime);
 await page.clock.runFor(6000);expect(await read()).toBe(1);expect(await page.evaluate(()=>window.__gvyArena.snapshot().simTime)).toBe(frozen);
 await page.locator('[data-arena-pause]').click();await page.clock.runFor(3800);await page.locator('[data-arena-pause]').click();
 const faded=await read();expect(faded).toBeGreaterThan(0);expect(faded).toBeLessThan(1);
 await page.clock.runFor(2000);expect(await read()).toBe(faded);
 await page.locator('[data-arena-pause]').click();await page.clock.runFor(1600);
 await expect(page.locator('[data-arena-feed] li').filter({hasText:text})).toHaveCount(0);
 await page.locator('[data-arena-settings]').click();await expect(page.locator('[data-arena-feed] li')).toHaveCount(0);
});
