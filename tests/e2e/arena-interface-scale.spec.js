import {expect,test} from '@playwright/test';
const game=page=>page.frames().find(f=>f.url().includes('member-brawl.html'));
async function open(page,viewport){
 await page.setViewportSize(viewport);await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-member-brawl-open]').evaluate(e=>e.click());await page.locator('[data-game-select="members"]').click();const arena=page.frameLocator('[data-member-brawl-frame]');
 await arena.locator('[data-arena-mode]').selectOption('score');await arena.locator('[data-arena-terrain]').selectOption('flat');
 await arena.locator('[data-brawl-start]').click();await game(page).waitForFunction(()=>window.__gvyArena.snapshot().simTime>200);await arena.locator('[data-arena-pause]').click();return arena;
}
async function metrics(page){return game(page).evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 const font=s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
 const panel=document.querySelector('.arena-scores-panel'),style=getComputedStyle(panel),state=window.__gvyArena.snapshot();
 return{viewport:{width:innerWidth,height:innerHeight},name:font('.fighter-name'),badge:font('.fighter-kill-badge'),icon:rect(document.querySelector('.fighter-kill-badge img')).width,feed:font('.arena-feed li'),event:font('.arena-event-label'),score:font('.arena-score-name'),clock:font('[data-arena-clock]'),canvasFont:parseFloat(document.querySelector('.arena-feedback').getContext('2d').font.split(' ')[1]),
 header:rect(document.querySelector('.arena-header')),stage:rect(document.querySelector('.arena-stage')),stats:rect(document.querySelector('.arena-match-state')),controls:[...document.querySelectorAll('.arena-action')].map(rect),panel:{...rect(panel),background:style.backgroundColor,pointerEvents:style.pointerEvents},overflow:document.documentElement.scrollWidth>innerWidth,
 state:{round:state.round,simTime:state.simTime,fighters:state.fighters.map(({id,life,hp,kills,deaths})=>({id,life,hp,kills,deaths}))},diameter:state.map.actorDiameter,unit:state.map.unit};
});}
async function labels(page){await game(page).evaluate(()=>{
 // Representative visible labels only; real damage/kill behavior is tested separately.
 const f=document.querySelector('.member-fighter').physicsItem;f.lifeBadge.hidden=false;f.lifeBadge.querySelector('b').textContent='12';
 const li=document.createElement('li');li.textContent='chenfeng12344 淘汰 SupremeLeaderNA · 6 连胜';document.querySelector('[data-arena-feed]').replaceChildren(li);
 const label=document.createElement('span');label.className='arena-event-label';label.textContent='跃升区域';document.querySelector('[data-member-brawl-field]').append(label);
});}
for(const viewport of [{width:2560,height:1440},{width:3840,height:2160}])test(`${viewport.width}px arena text, badges and controls grow together without obscuring the field`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const arena=await open(page,viewport);await arena.locator('.arena-scores summary').click();await labels(page);
 const m=await metrics(page),scale=m.name/11;
 expect(m.name).toBeGreaterThan(viewport.width===2560?19:27);expect(m.name).toBeLessThan(34);
 for(const [actual,base]of [[m.badge,10],[m.icon,9],[m.feed,10],[m.event,10],[m.score,11],[m.clock,13]])expect(actual/base).toBeCloseTo(scale,2);
 expect(m.canvasFont).toBeGreaterThan(12*scale*.95);expect(m.canvasFont).toBeLessThan(12*scale*1.05);
 expect(m.overflow).toBe(false);expect(m.stage.height/m.viewport.height).toBeGreaterThan(.84);
 expect(m.stats.right).toBeLessThanOrEqual(m.controls[0].x);expect(m.controls.every(r=>r.height>=44&&r.right<=m.viewport.width)).toBe(true);
 expect(m.panel.background).toBe('rgba(0, 0, 0, 0)');expect(m.panel.pointerEvents).toBe('none');expect(m.panel.width/m.stage.width).toBeLessThan(.25);
 expect(m.diameter/m.unit).toBeCloseTo(1.12,5);
 const dialog=page.locator('[data-member-brawl-dialog]'),frame=game(page);await frame.evaluate(()=>window.__scaleIdentity='same');const size=await frame.evaluate(()=>({w:innerWidth,h:innerHeight}));
 await page.locator('[data-member-brawl-minimize]').click();expect(await dialog.getAttribute('data-window-state')).toBe('docked');
 expect(await frame.evaluate(()=>({w:innerWidth,h:innerHeight}))).toEqual(size);expect((await dialog.boundingBox()).width).toBeLessThanOrEqual(342);
 await page.locator('.member-brawl-dock-preview').click({position:{x:30,y:30}});expect(await frame.evaluate(()=>window.__scaleIdentity)).toBe('same');
 expect((await metrics(page)).state).toEqual(m.state);await page.locator('[data-member-brawl-minimize]').click();await page.locator('[data-member-brawl-end]').click();expect(errors).toEqual([]);
});
test('paused 4K battle keeps one match while its interface fits 2K, desktop and phone sizes',async({page})=>{
 const arena=await open(page,{width:3840,height:2160});await arena.locator('.arena-scores summary').click();await labels(page);const initial=(await metrics(page)).state;
 for(const viewport of [{width:2560,height:1440},{width:1440,height:900},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);
  await expect.poll(()=>game(page).evaluate(()=>Math.abs(document.querySelector('[data-member-brawl-field]').clientWidth-window.__gvyArena.snapshot().map.width))).toBeLessThan(1);
  const m=await metrics(page);expect(m.state).toEqual(initial);expect(m.overflow).toBe(false);expect(m.controls.every(r=>r.height>=(m.viewport.width>=700&&m.viewport.height>=441?36:44)&&r.x>=0&&r.right<=m.viewport.width)).toBe(true);
  if(viewport.width<=1440)expect(m.name).toBe(11);
 }
});
