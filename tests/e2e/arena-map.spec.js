import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {decodeRoster} from '../../scripts/lib/rsi-members.mjs';
const published=decodeRoster(readFileSync(new URL('../../assets/js/fleet-members.js',import.meta.url),'utf8'));
const state=p=>p.evaluate(()=>window.__gvyArena.snapshot());
async function begin(page,{seed=.25,mode='teams',terrain='random',captureTerrain=false}={}) {
  await page.addInitScript(seed=>{Math.random=()=>seed;},seed);
  await page.route(/\/assets\/js\/fleet-members\.js(?:\?|$)/,r=>r.fulfill({contentType:'text/javascript',body:`window.__gvyFleetRoster=${JSON.stringify({...published,total:mode==='classic'?1:2,members:published.members.slice(0,mode==='classic'?1:2)})};`}));
  await page.goto('/member-brawl.html');
  await page.locator('[data-brawl-start]').waitFor();
  if(captureTerrain)await page.evaluate(()=>{
    window.__terrainBodies=[];
    const original=Matter.Bodies.fromVertices;
    Matter.Bodies.fromVertices=function(...args) {
      const input=args[2][0].map(({x,y})=>({x,y}));
      const body=original.apply(this,args);
      window.__terrainBodies.push({input,bounds:body.bounds,convex:Matter.Vertices.isConvex(input)});
      return body;
    };
  });
  await page.clock.install();
  for(const [key,value] of Object.entries({mode,terrain,loadout:'unarmed'}))await page.locator(`[data-arena-${key}]`).selectOption(value);
  await page.locator('[data-brawl-start]').click();
  await expect.poll(async()=>(await state(page)).simTime).toBeGreaterThan(0);
  // Keep both teams alive, with real bodies/physics, while exercising scene time.
  await page.evaluate(()=>{
    const field=document.querySelector('[data-member-brawl-field]');
    [...document.querySelectorAll('.member-fighter')].forEach((node,i)=>{
      const f=node.physicsItem;Matter.Body.setStatic(f.body,true);
      Matter.Body.setPosition(f.body,{x:field.clientWidth*(i?.86:.14),y:100});
      f.attack=null;f.nextAttack=Infinity;f.nextMovement=Infinity;
    });
  });
}
async function advanceTo(page,time) {await page.clock.runFor(Math.max(0,time-(await state(page)).simTime));}

test('team map starts with real boxes and a full floor, then scene clocks pause and reveal terrain',async({page})=>{
  await begin(page);
  expect((await state(page)).map).toMatchObject({boxes:9,terrainVisible:false});
  expect((await state(page)).map.terrainDue).toBe(14000);
  await expect(page.locator('.arena-crate')).toHaveCount(9);
  const floor=await page.locator('.arena-platform').first().boundingBox();
  const field=await page.locator('[data-member-brawl-field]').boundingBox();
  expect(floor.width).toBeCloseTo(field.width,0);
  await advanceTo(page,13000);
  expect((await state(page)).map.events).toBe(1);
  await page.locator('[data-arena-pause]').click();const held=await state(page);
  const transforms=await page.locator('.arena-crate').evaluateAll(es=>es.map(e=>e.style.transform));
  await page.clock.runFor(3000);expect(await state(page)).toEqual(held);
  expect(await page.locator('.arena-crate').evaluateAll(es=>es.map(e=>e.style.transform))).toEqual(transforms);
  await page.locator('[data-arena-pause]').click();await advanceTo(page,14500);
  expect((await state(page)).map.terrainVisible).toBe(true);
  await expect(page.locator('[data-member-brawl-field] .arena-terrain polyline')).toHaveCount(1);
  expect((await state(page)).map.terrainPoints).toBeGreaterThan(20);
});

test('terrain crossing the floor has convex colliders aligned with its visible surface',async({browser,baseURL})=>{
  for(const terrain of ['terrain01','terrain02','canyon','slope','smallhill','default','pit']) {
    const page=await browser.newPage({viewport:{width:1000,height:800},baseURL});
    const warnings=[];
    page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text());});
    try {
      // Test options come from the real setup; all seven shipped profiles must
      // exercise the original Matter implementation rather than a physics mock.
      await begin(page,{terrain,captureTerrain:true});
      const {map,bodies}=await page.evaluate(()=>({map:window.__gvyArena.snapshot().map,bodies:window.__terrainBodies}));
      expect(bodies.length).toBeGreaterThan(0);
      for(const {input,bounds,convex} of bodies) {
        expect(convex,terrain).toBe(true);
        expect(Math.max(...input.map(p=>p.y))).toBeLessThanOrEqual(map.height-18+.001);
        for(const [axis,values] of [['x',input.map(p=>p.x)],['y',input.map(p=>p.y)]]) {
          expect(bounds.min[axis],terrain).toBeCloseTo(Math.min(...values),4);
          expect(bounds.max[axis],terrain).toBeCloseTo(Math.max(...values),4);
        }
      }
      if(terrain==='terrain01') {
        // Source slopes (-4,-.5)→(-3,1) and its mirror meet Y=0 at ±11/3.
        const triangles=bodies.filter(b=>b.input.length===3);
        expect(triangles).toHaveLength(2);
        expect((triangles[0].bounds.min.x-map.width/2)/map.unit).toBeCloseTo(-11/3,4);
        expect((triangles[1].bounds.max.x-map.width/2)/map.unit).toBeCloseTo(11/3,4);
      }
      expect(warnings).toEqual([]);
    } finally {await page.close();}
  }
});

test('a real swept weapon strike breaks a crate without awarding a member elimination',async({page})=>{
  await begin(page);await page.locator('[data-arena-pause]').click();
  await page.evaluate(()=>{
    const f=document.querySelector('.member-fighter').physicsItem;
    const crate=document.querySelector('.arena-crate').physicsItem;
    Matter.Body.setPosition(f.body,{x:100,y:100});
    Matter.Body.setStatic(crate.body,true);Matter.Body.setPosition(crate.body,{x:144,y:100});crate.hp=1;
    const now=window.__gvyArena.snapshot().simTime;
    f.rig.reset({x:100,y:100,aim:0});f.damageSources.clear();
    const unit=window.__gvyArena.snapshot().map.unit;
    Matter.Body.setPosition(crate.body,{x:100+unit,y:100});
    const animation=f.weapon.animations[0],timeline=GVYArenaActions.compile(animation,GVYArenaMotion);
    f.aim=0;f.attack={start:now-400,aim:0,inverse:false,hit:new Set(),fired:false,animation,timeline,duration:timeline.duration,target:{...crate.body.position}};
    Matter.Body.setVelocity(f.rig.fistBody,{x:unit*20/60,y:0});
  });
  await page.locator('[data-arena-pause]').click();await page.clock.runFor(150);
  expect((await state(page)).map.boxes).toBe(8);
  expect((await state(page)).fighters.every(f=>f.kills===0&&f.deaths===0)).toBe(true);
});

test('jump zones launch on contact, freeze with pause and expire after their thirty-second batch',async({page})=>{
  // This replays over 50s of physics; shared CI CPUs can exceed the default 45s wall-clock budget.
  test.setTimeout(90000);
  await begin(page,{seed:.8});expect((await state(page)).map.boxes).toBe(0);
  await advanceTo(page,23000);expect((await state(page)).map.terrainVisible).toBe(false);
  const zone=(await state(page)).map.zones.find(z=>z.type==='jump');expect(zone).toBeTruthy();
  await page.evaluate(zone=>{
    const f=document.querySelector('.member-fighter').physicsItem;
    Matter.Body.setStatic(f.body,false);Matter.Body.setPosition(f.body,{x:zone.x,y:zone.y-10});
    Matter.Body.setVelocity(f.body,{x:0,y:0});
  },zone);
  await page.clock.runFor(60);
  expect(await page.locator('.member-fighter').first().evaluate(e=>e.physicsItem.body.velocity.y)).toBeLessThan(-5);
  await page.evaluate(()=>Matter.Body.setStatic(document.querySelector('.member-fighter').physicsItem.body,true));
  await page.locator('[data-arena-pause]').click();const held=await state(page);
  await page.clock.runFor(3000);expect(await state(page)).toEqual(held);
  await page.locator('[data-arena-pause]').click();await advanceTo(page,zone.expires+100);
  expect((await state(page)).map.zones.some(z=>z.type==='jump')).toBe(false);
  expect((await state(page)).map.boxes).toBeLessThanOrEqual(36);
});

test('the rare moving gravity event uses the same bounded pausable scene clock',async({page})=>{
  await begin(page,{seed:.999});await advanceTo(page,26500);
  const zone=(await state(page)).map.zones.find(z=>z.type==='gravity');expect(zone).toBeTruthy();
  await page.clock.runFor(400);
  const moved=(await state(page)).map.zones.find(z=>z.type==='gravity');
  expect(Math.hypot(moved.x-zone.x,moved.y-zone.y)).toBeGreaterThan(0);
  await page.locator('[data-arena-pause]').click();const held=await state(page);
  await page.clock.runFor(2000);expect(await state(page)).toEqual(held);
  expect(held.map.zones.length).toBeLessThanOrEqual(8);
});

test('an unlimited classic scene begins flat, reveals its source terrain and returns to its floor',async({page})=>{
  // Replay 145s of fixed-step physics; shared CI CPUs need more wall time.
  // Keep every terrain timing assertion rather than skipping simulated frames.
  test.setTimeout(180000);
  await begin(page,{mode:'classic'});
  expect((await state(page)).map.terrainVisible).toBe(false);
  await advanceTo(page,104000);expect((await state(page)).map.terrainVisible).toBe(true);
  await advanceTo(page,145000);expect((await state(page)).map.terrainVisible).toBe(false);
  expect((await state(page)).phase).toBe('running');
  expect((await state(page)).roundLimit).toBeNull();
  expect(await page.locator('.arena-platform').first().evaluate(e=>e.clientWidth)).toBeGreaterThan(1000);
});

test('resizing a grounded member follows the new terrain surface without embedding or restarting',async({page})=>{
  await page.setViewportSize({width:1000,height:800});await begin(page,{terrain:'terrain01'});
  const place=()=>{
    const node=document.querySelector('.member-fighter'),f=node.physicsItem;
    const points=[...document.querySelector('.arena-terrain polyline').points].map(p=>({x:p.x,y:p.y}));
    const top=Math.min(...points.map(p=>p.y));
    Matter.Body.setPosition(f.body,{x:document.querySelector('[data-member-brawl-field]').clientWidth/2,y:top-f.body.circleRadius});
    return{top,hp:f.hp,round:window.__gvyArena.snapshot().round};
  };
  const before=await page.evaluate(place);await page.locator('[data-arena-pause]').click();
  const held=await state(page);
  await page.setViewportSize({width:760,height:430});
  await expect.poll(()=>page.evaluate(()=>Math.abs(window.__gvyArena.snapshot().map.width-document.querySelector('[data-member-brawl-field]').getBoundingClientRect().width))).toBeLessThan(.5);
  const resized=await state(page);
  expect(resized.paused).toBe(true);expect(resized.simTime).toBe(held.simTime);
  expect(resized.roundElapsed).toBe(held.roundElapsed);
  expect(await page.locator('svg.arena-terrain').evaluate(e=>e.viewBox.baseVal.width)).toBeCloseTo(resized.map.width,3);
  const floor=await page.locator('.arena-platform').first().boundingBox();
  expect(floor.width).toBeCloseTo(resized.map.width,3);
  await page.locator('[data-arena-pause]').click();await page.clock.runFor(100);
  const after=await page.evaluate(()=>{
    const f=document.querySelector('.member-fighter').physicsItem;
    return{gap:Math.min(...[...document.querySelector('.arena-terrain polyline').points].map(p=>p.y))-f.body.position.y-f.body.circleRadius,hp:f.hp,round:window.__gvyArena.snapshot().round};
  });
  expect(Math.abs(after.gap)).toBeLessThan(2);expect(after.hp).toBe(before.hp);expect(after.round).toBe(before.round);
});

test('map boxes retain their source proportions on desktop, wide, 4K and portrait viewports',async({browser,baseURL})=>{
  for(const viewport of [{width:1440,height:900},{width:2560,height:1080},{width:3840,height:2160},{width:3440,height:1440},{width:390,height:844}]) {
    const page=await browser.newPage({viewport,baseURL});
    try {
      await begin(page);
      const geometry=await page.evaluate(()=>{
        const map=window.__gvyArena.snapshot().map;
        const crates=[...document.querySelectorAll('.arena-crate')].map(e=>{
          const c=e.physicsItem;return{size:c.size,x:c.body.position.x,y:c.body.position.y,area:c.body.area};
        });
        return{map,crates,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      expect(geometry.overflow).toBe(false);expect(geometry.crates).toHaveLength(9);
      for(const c of geometry.crates) {
        expect(c.size/geometry.map.unit).toBeCloseTo(.888,5);
        expect(c.area/(c.size*c.size)).toBeCloseTo(1,4);
        expect(c.x-c.size/2).toBeGreaterThan(0);
        expect(c.x+c.size/2).toBeLessThan(geometry.map.width);
        expect(c.y-c.size/2).toBeGreaterThan(0);
        expect(c.y+c.size/2).toBeLessThan(geometry.map.height);
      }
      const floor=await page.locator('.arena-platform').first().boundingBox();
      expect(floor.width).toBeCloseTo(geometry.map.width,0);
    } finally {await page.close();}
  }
});
