import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {decodeRoster} from '../../scripts/lib/rsi-members.mjs';
const published=decodeRoster(readFileSync(new URL('../../assets/js/fleet-members.js',import.meta.url),'utf8'));
const state=page=>page.evaluate(()=>window.__gvyArena.snapshot());
async function setup(page,{count=2,seed=.8,mode='teams',terrain='flat',loadout='same'}={}) {
  await page.addInitScript(seed=>{Math.random=()=>seed;},seed);
  const members=Array.from({length:count},(_,i)=>({...published.members[i%published.members.length],handle:'WeaponFixture_'+i,name:'成员'+i}));
  await page.route(/\/assets\/js\/fleet-members\.js(?:\?|$)/,r=>r.fulfill({contentType:'text/javascript',body:`window.__gvyFleetRoster=${JSON.stringify({...published,members,total:count})};`}));
  await page.goto('/member-brawl.html');await page.locator('[data-brawl-start]').waitFor();
  await page.clock.install();
  for(const [key,value]of Object.entries({mode,terrain,loadout}))await page.locator(`[data-arena-${key}]`).selectOption(value);
  await page.locator('[data-brawl-start]').click();
  await expect.poll(async()=>(await state(page)).simTime).toBeGreaterThan(0);
}
async function isolate(page,distance=3){await page.evaluate(distance=>{
  const list=[...document.querySelectorAll('.member-fighter')].map(e=>e.physicsItem),unit=window.__gvyArena.snapshot().map.unit;
  for(const [i,f]of list.entries()){
    Matter.Body.setStatic(f.body,true);Matter.Body.setPosition(f.body,{x:100+i*distance*unit,y:150});
    f.rig?.reset({...f.body.position,aim:i?Math.PI:0});f.aim=f.desiredAim=i?Math.PI:0;
    for(const other of document.querySelectorAll(".member-fighter")){const r=other.physicsItem.rig; if(r)for(const b of r.bodies)f.damageSources.set(b,Infinity);} f.damageSources.set(null,Infinity);f.nextMovement=Infinity;if(i)f.nextAttack=Infinity;
  }
},distance);}

test('native sword, bow and thrower timers start concurrently with their real animations',async({browser,baseURL})=>{
  for(const sample of [{seed:.8,id:'sword',delay:2.332},{seed:.2,id:'bow',delay:1.425},{seed:.35,id:'fire',delay:2.625}]){
    const page=await browser.newPage({baseURL});
    try{
      await setup(page,{seed:sample.seed});await isolate(page);
      const first=await page.locator('.member-fighter').first().evaluate(e=>({id:e.physicsItem.weaponId,due:e.physicsItem.nextAttack}));
      expect(first.id).toBe(sample.id);expect(first.due).toBe(1000);
      await page.evaluate(()=>{
        const f=document.querySelector('.member-fighter').physicsItem;
        let value=f.nextAttack;window.__actualAttackTimers=[];
        Object.defineProperty(f,'nextAttack',{get:()=>value,set:next=>{value=next;window.__actualAttackTimers.push({now:window.__gvyArena.snapshot().simTime,next});}});
      });
      await page.clock.runFor(1300);
      const records=await page.evaluate(()=>window.__actualAttackTimers);
      expect(records.length).toBeGreaterThan(0);
      expect(records[0].now).toBe(1000);
      expect(records[0].next-records[0].now).toBeCloseTo(sample.delay*1000,3);
    }finally{await page.close();}
  }
});

test('native obstacle count retains both bodies, retries a held sword and lets unarmed punches proceed',async({browser,baseURL})=>{
  for(const loadout of ['same','unarmed']){
    const page=await browser.newPage({baseURL});
    try{
      await setup(page,{seed:.2,mode:'teams',terrain:'random',loadout});await isolate(page,2);
      await page.locator('[data-arena-pause]').click();
      const now=await page.evaluate(()=>{
        const f=document.querySelector('.member-fighter').physicsItem,s=window.__gvyArena.snapshot(),u=s.map.unit;
        const crates=[...document.querySelectorAll('.arena-crate')].map(e=>e.physicsItem);
        crates.forEach((c,i)=>{Matter.Body.setStatic(c.body,true);Matter.Body.setPosition(c.body,{x:i?900:100+u,y:i?500:150});});
        f.nextAttack=s.simTime;f.attack=null;return s.simTime;
      });
      await page.locator('[data-arena-pause]').click();await page.clock.runFor(120);
      const result=await page.locator('.member-fighter').first().evaluate(e=>({due:e.physicsItem.nextAttack,attack:e.physicsItem.attack?.start}));
      if(loadout==='same'){expect(result.attack).toBeUndefined();expect(result.due).toBeGreaterThanOrEqual(now+300);}
      else expect(result.attack).toBeGreaterThan(now);
    }finally{await page.close();}
  }
});

test('a real whole-weapon throw and fist pickup preserve the same solid body and clear its old projectile owner',async({page})=>{
  await setup(page);await isolate(page,9);await page.locator('[data-arena-pause]').click();
  const id=await page.locator('.member-fighter').first().evaluate(e=>{
    const f=e.physicsItem;f.attacks=4;f.throwAfter=0;f.nextAttack=window.__gvyArena.snapshot().simTime;return f.rig.weaponBody.id;
  });
  await page.locator('[data-arena-pause]').click();await page.clock.runFor(1500);
  const thrown=await page.locator('.arena-projectile').evaluateAll(nodes=>nodes.map(e=>e.physicsItem).filter(p=>p.kind==='weapon').map(p=>({id:p.body.id,weapon:p.weaponId,mass:p.body.mass,unitArea:p.body.area/window.__gvyArena.snapshot().map.unit**2})));
  expect(thrown).toHaveLength(1);expect(thrown[0]).toMatchObject({id,weapon:'sword',mass:3});
  await page.locator('[data-arena-pause]').click();
  await page.setViewportSize({width:900,height:600});
  await expect.poll(async()=>(await state(page)).map.width).toBeLessThan(900);
  await page.evaluate(()=>{
    const f=document.querySelector('.member-fighter').physicsItem,p=[...document.querySelectorAll('.arena-projectile')].map(e=>e.physicsItem).find(p=>p.kind==='weapon');
    const now=window.__gvyArena.snapshot().simTime,u=window.__gvyArena.snapshot().map.unit;
    Matter.Body.setPosition(p.body,{x:220,y:150});Matter.Body.setVelocity(p.body,{x:0,y:0});
    Matter.Body.setPosition(f.body,{x:220-.4*u,y:150});f.rig.reset({...f.body.position,aim:0});
    const animation=f.weapon.animations[0],timeline=GVYArenaActions.compile(animation,GVYArenaMotion);
    f.attack={start:now-400,aim:0,inverse:false,hit:new Set(),fired:false,animation,timeline,duration:timeline.duration,target:{x:600,y:150}};
    f.nextAttack=Infinity;
  });
  await page.locator('[data-arena-pause]').click();await page.clock.runFor(100);
  const picked=await page.locator('.member-fighter').first().evaluate(e=>({id:e.physicsItem.rig.weaponBody?.id,weapon:e.physicsItem.weaponId,stale:e.physicsItem.rig.weaponBody?.parts.some(p=>!!p.plugin.arenaProjectile),unitArea:e.physicsItem.rig.weaponBody?.area/window.__gvyArena.snapshot().map.unit**2}));
  expect(picked).toMatchObject({id,weapon:'sword',stale:false});
  expect(picked.unitArea).toBeCloseTo(thrown[0].unitArea,6);
});

test('crowd camera shrinks the whole actor and weapon together and does not zoom after an elimination',async({browser,baseURL})=>{
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:2560,height:1080}]){
    const diameters=[];
    for(const count of [4,32,64]){
      const page=await browser.newPage({baseURL,viewport});
      try{
        await setup(page,{count,mode:'classic',seed:.7,terrain:count===32?'terrain01':'flat'});await page.locator('[data-arena-pause]').click();
        const before=await state(page);diameters.push(before.map.actorDiameter);
        const ratio=await page.locator('.member-fighter').first().evaluate(e=>({body:parseFloat(getComputedStyle(e).width),weapon:parseFloat(e.querySelector('.arena-weapon').style.height),font:getComputedStyle(e.querySelector('.fighter-name')).fontSize}));
        expect(Math.abs(ratio.body-before.map.actorDiameter)).toBeLessThan(.02);
        expect(ratio.weapon/before.map.actorDiameter).toBeCloseTo(2.844444/1.12,4);expect(ratio.font).toBe('11px');
        expect(before.map.actorDiameter/before.map.height).toBeLessThan(.12);
        if(viewport.width===390)expect(before.map.actorDiameter).toBeGreaterThan(15);
        await page.evaluate(()=>{const f=document.querySelector('.member-fighter').physicsItem;f.alive=false;f.rig.dispose();f.rig=null;});
        await page.locator('[data-arena-pause]').click();await page.clock.runFor(100);
        expect((await state(page)).map.actorDiameter).toBe(before.map.actorDiameter);
      }finally{await page.close();}
    }
    expect(diameters[0]).toBeGreaterThan(diameters[1]);expect(diameters[1]).toBeGreaterThan(diameters[2]);
  }
});

test('large teams keep reserves outside physics and release a bounded batch only after the native wait',async({page})=>{
  await setup(page,{count:64,seed:.5,mode:'teams',loadout:'unarmed'});
  await page.evaluate(()=>{
    const list=[...document.querySelectorAll('.member-fighter')].map(e=>e.physicsItem);let removed=0;
    for(const f of list){if(!f.alive)continue;f.nextAttack=Infinity;f.nextMovement=Infinity;for(const other of document.querySelectorAll(".member-fighter")){const r=other.physicsItem.rig; if(r)for(const b of r.bodies)f.damageSources.set(b,Infinity);} f.damageSources.set(null,Infinity);
      if(f.team===0&&removed++<4){f.alive=false;f.rig.dispose();f.rig=null;Matter.Body.setStatic(f.body,true);}
      else{Matter.Body.setStatic(f.body,true);f.rig.reset({...f.body.position,aim:0});}
    }
  });
  const initial=await state(page);expect(initial.map.reserveCount).toBe(48);
  await page.clock.runFor(29000-initial.simTime);expect((await state(page)).map.reserveCount).toBe(48);
  await page.clock.runFor(650);expect((await state(page)).map.reserveCount).toBe(43);
  await expect(page.locator('[data-arena-reserve-count]')).toHaveText('预备 43 人');
  const live=await page.locator('.member-fighter').evaluateAll(nodes=>nodes.filter(e=>e.physicsItem.reserve).every(e=>e.hidden&&!e.physicsItem.rig));expect(live).toBe(true);
});

test('manual infinite Classic keeps running past sixty seconds and never awards a timed winner',async({page})=>{
  // Long fixed-step replays are correctness checks, not wall-time benchmarks.
  test.slow();
  await setup(page,{count:1,mode:'classic',loadout:'unarmed'});
  await isolate(page);
  await page.clock.runFor(66000);
  const s=await state(page);expect(s.phase).toBe('running');expect(s.round).toBe(1);
  expect(s.roundLimit).toBeNull();expect(s.roundRemaining).toBeNull();
  await expect(page.locator('[data-arena-result]')).toBeHidden();
  const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('gvy-arena-stats-v1')).records);
  expect(records.every(r=>r.wins===0)).toBe(true);
});

test('a released fireball detonates on an allied body and the ownerless blast damages teammates',async({page})=>{
  await setup(page,{count:4,seed:.35,mode:'teams'});await page.locator('[data-arena-pause]').click();
  await page.evaluate(()=>{
    const list=[...document.querySelectorAll('.member-fighter')].map(e=>e.physicsItem),s=window.__gvyArena.snapshot(),u=s.map.unit;
    list.forEach((f,i)=>{Matter.Body.setStatic(f.body,true);Matter.Body.setPosition(f.body,{x:i===2?100+4*u:i===3?800:100,y:i===1||i===3?400:150});
      f.rig.reset({...f.body.position,aim:0});f.damageSources.clear();f.attack=null;f.nextAttack=i?Infinity:s.simTime;f.nextMovement=Infinity;f.aim=f.desiredAim=0;});
  });
  await page.locator('[data-arena-pause]').click();
  await expect.poll(()=>page.locator('.member-fighter').first().evaluate(e=>!!e.physicsItem.staged)).toBe(true);
  await page.locator('[data-arena-pause]').click();
  await page.evaluate(()=>{
    const list=[...document.querySelectorAll('.member-fighter')].map(e=>e.physicsItem),f=list[0],s=window.__gvyArena.snapshot(),u=s.map.unit,p=f.staged;
    Matter.Body.setPosition(list[1].body,{x:100+2*u,y:150});list[1].rig.reset({...list[1].body.position,aim:0});
    Matter.Body.setPosition(p.body,{x:list[1].body.position.x-u,y:150});Matter.Body.setVelocity(p.body,{x:u*30/60,y:0});
    f.attack.start=s.simTime-520;
  });
  await page.locator('[data-arena-pause]').click();await page.clock.runFor(160);
  const s=await state(page);expect(s.projectiles).toBe(0);expect(s.particles).toBeGreaterThan(0);
  expect(s.fighters[0].hp).toBeLessThan(100);expect(s.fighters[1].hp).toBeLessThan(100);
});


test('45-second kill race settles visible score ties consistently and records each win once',async({page})=>{
  // Long fixed-step replays are correctness checks, not wall-time benchmarks.
  test.slow();
  await setup(page,{count:4,mode:'score',loadout:'unarmed'});
  for(const tied of [false,true]){
    if(tied)await page.locator('[data-arena-restart]').click();
    await page.evaluate(tied=>{
      for(const [i,e]of [...document.querySelectorAll('.member-fighter')].entries()){
        const f=e.physicsItem;Matter.Body.setStatic(f.body,true);Matter.Body.setPosition(f.body,{x:50+i*180,y:100});
        f.rig.reset({...f.body.position,aim:0});f.nextAttack=f.nextMovement=Infinity;f.attack=null;f.bodyMovement=null;
        f.kills=i<2?7:0;f.deaths=i===0?2:i===1?(tied?2:3):0;
      }
    },tied);
    await page.clock.runFor(45200);
    expect((await state(page)).phase).toBe('result');expect((await state(page)).roundRemaining).toBe(0);
    await expect(page.locator('[data-arena-clock]')).toHaveText('00:00');
    await expect(page.locator('[data-arena-result-title]')).toHaveText(tied?'成员0、成员1 并列获胜':'成员0 获胜');
    const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('gvy-arena-stats-v1')).records);
    expect(records.find(r=>r.handle==='WeaponFixture_0').wins).toBe(tied?2:1);
    expect(records.find(r=>r.handle==='WeaponFixture_1').wins).toBe(tied?1:0);
    expect(records.every(r=>r.matches===(tied?2:1))).toBe(true);
  }
});

test('a moving target drives hand path and weapon look direction from the same live angle without flipping inverse mid-stroke',async({page})=>{
 await setup(page,{mode:'teams',seed:.8});await isolate(page);await page.locator('[data-arena-pause]').click();
 await page.evaluate(()=>{
   const [a,b]=[...document.querySelectorAll('.member-fighter')].map(e=>e.physicsItem),now=window.__gvyArena.snapshot().simTime;
   Matter.Body.setPosition(a.body,{x:100,y:150});Matter.Body.setPosition(b.body,{x:20,y:50});
   a.rig.reset({...a.body.position,aim:0});b.rig.reset({...b.body.position,aim:0});
   const animation=a.weapon.animations[0],timeline=GVYArenaActions.compile(animation,GVYArenaMotion);
   a.attack={start:now-400,aim:0,inverse:false,animation,timeline,duration:timeline.duration,fired:false,targetId:b.id,target:{x:500,y:150}};
   a.nextAttack=Infinity;
   const command=a.rig.command.bind(a.rig);window.__rotationCommands=[];
   a.rig={...a.rig,command:next=>{window.__rotationCommands.push({...next});return command(next);}};
 });
 await page.locator('[data-arena-pause]').click();await page.clock.runFor(60);await page.locator('[data-arena-pause]').click();
 const commands=await page.evaluate(()=>window.__rotationCommands);expect(commands.length).toBeGreaterThan(0);
 for(const c of commands){expect(c.aim).toBeCloseTo(Math.atan2(-100,-80),8);expect(c.inverse).toBe(false);expect(c.lookTarget).toEqual({x:20,y:50});}
});

test('an actual arrow from a previous life credits the member without healing or extending the new life',async({page})=>{
 await setup(page,{mode:'score',seed:.2});await isolate(page,10);await page.clock.runFor(1500);await page.locator('[data-arena-pause]').click();
 const initial=await page.evaluate(()=>{
   const [a,b]=[...document.querySelectorAll('.member-fighter')].map(e=>e.physicsItem);
   const p=[...document.querySelectorAll('.arena-projectile')].map(e=>e.physicsItem).find(p=>p.kind==='arrow');
   if(!p)throw new Error('Expected a real released arrow before arranging its arrival');
   const oldLife=p.ownerLife;a.life++;a.hp=35;a.streak=0;a.healDivider=0;a.attack=null;a.nextAttack=Infinity;
   b.hp=1;const unit=window.__gvyArena.snapshot().map.unit;
   Matter.Body.setPosition(p.body,{x:b.body.position.x-unit,y:b.body.position.y});Matter.Body.setVelocity(p.body,{x:unit*30/60,y:0});
   return{oldLife,newLife:a.life,kills:a.kills,deaths:b.deaths};
 });
 await page.locator('[data-arena-pause]').click();await page.clock.runFor(100);await page.locator('[data-arena-pause]').click();
 const result=await state(page);expect(result.fighters[0].life).toBe(initial.newLife);expect(initial.newLife).toBe(initial.oldLife+1);
 expect(result.fighters[0].kills).toBe(initial.kills+1);expect(result.fighters[0].hp).toBe(35);expect(result.fighters[0].streak).toBe(0);
 expect(result.fighters[1].deaths).toBe(initial.deaths+1);
});
