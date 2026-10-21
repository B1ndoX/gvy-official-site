import {expect,test} from '@playwright/test';

for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
  test(`${viewport.width}px fleet window docks on scroll, retains one battle and ends only from the dock`,async({page})=>{
    await page.setViewportSize(viewport);
    const errors=[],documents=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.isNavigationRequest()&&/\/member-brawl\.html(?:\?|$)/.test(r.url()))documents.push(r.url());});
    await page.goto('/',{waitUntil:'domcontentloaded'});
    const dialog=page.locator('[data-member-brawl-dialog]'), iframe=page.locator('[data-member-brawl-frame]');
    await expect(iframe).not.toHaveAttribute('src',/.+/);expect(documents).toHaveLength(0);
    await page.locator('[data-member-brawl-open]').evaluate(e=>e.click());await page.locator('[data-game-select="members"]').click();
    await expect(dialog).toHaveAttribute('data-window-state','expanded');
    expect(await dialog.evaluate(e=>e.matches(':modal'))).toBe(true);
    const expanded=await dialog.boundingBox();
    expect(expanded.x).toBeGreaterThan(8);expect(expanded.y).toBeGreaterThan(12);
    if(viewport.width>1000){expect(expanded.width).toBeLessThan(viewport.width*.75);expect(expanded.height).toBeLessThanOrEqual(620);}
    const arena=page.frameLocator('[data-member-brawl-frame]');
    await arena.locator('[data-arena-mode]').selectOption('classic');
    await arena.locator('[data-brawl-start]').click();
    const frame=page.frames().find(f=>f.url().includes('member-brawl.html'));
    await expect.poll(()=>frame.evaluate(()=>window.__gvyArena.snapshot().simTime)).toBeGreaterThan(200);
    const hud=await frame.evaluate(()=>{
      const stage=document.querySelector('.arena-stage').getBoundingClientRect();
      const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height};};
      const controls=[...document.querySelectorAll('.arena-action,.arena-scores summary')].map(rect);
      const stats=rect(document.querySelector('.arena-match-state'));
      return {fieldFraction:stage.height/innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,controls,stats};
    });
    expect(hud.fieldFraction).toBeGreaterThan(viewport.width>1000?.87:.8);
    expect(hud.overflow).toBe(false);
    expect(hud.controls.every(r=>r.height>=44)).toBe(true);
    expect(hud.stats.right).toBeLessThanOrEqual(hud.controls[0].left);
    expect(hud.controls.every((r,i)=>!i||r.left>=hud.controls[i-1].right)).toBe(true);
    const stageBefore=await arena.locator('.arena-stage').boundingBox();
    await arena.locator('.arena-scores summary').click();
    const compact=await frame.evaluate(()=>{
      const panel=document.querySelector('.arena-scores-panel'),stage=document.querySelector('.arena-stage');
      const p=panel.getBoundingClientRect(),s=stage.getBoundingClientRect(),style=getComputedStyle(panel);
      const visible=e=>getComputedStyle(e).display!=='none';
      return{left:p.left-s.left,top:p.top-s.top,width:p.width,height:p.height,
        background:style.backgroundColor,shadow:style.boxShadow,events:style.pointerEvents,
        rows:[...panel.querySelectorAll('[data-arena-leaderboard] li')].filter(visible).length,
        career:getComputedStyle(document.querySelector('[data-arena-career]').closest('section')).display,
        hitIsPanel:panel.contains(document.elementFromPoint(p.left+20,p.top+30))};
    });
    expect(compact.left).toBeGreaterThanOrEqual(0);expect(compact.left).toBeLessThan(18);
    expect(compact.top).toBeGreaterThanOrEqual(0);expect(compact.top).toBeLessThan(18);
    expect(compact.width).toBeLessThanOrEqual(216);expect(compact.height).toBeLessThan(150);
    expect(compact).toMatchObject({background:'rgba(0, 0, 0, 0)',shadow:'none',events:'none',rows:5,career:'none',hitIsPanel:false});
    expect(await arena.locator('.arena-stage').boundingBox()).toEqual(stageBefore);
    // Its full-width positioning wrapper must never intercept the other HUD
    // controls; the transparent board itself also passes pointer hits through.
    await arena.locator('[data-arena-pause]').click();
    expect((await frame.evaluate(()=>window.__gvyArena.snapshot())).paused).toBe(true);
    await arena.locator('[data-arena-pause]').click();
    await arena.locator('.arena-scores summary').click();
    await expect(arena.locator('.arena-scores')).not.toHaveAttribute('open','');
    const before=await frame.evaluate(()=>{window.__windowIdentity='retained';return{width:innerWidth,height:innerHeight,state:window.__gvyArena.snapshot()};});
    await page.locator('[data-member-brawl-close]').click();
    await expect(dialog).toHaveAttribute('data-window-state','docked');
    expect(await dialog.evaluate(e=>e.matches(':modal'))).toBe(false);
    expect(await page.locator('body').evaluate(e=>e.style.overflow)).not.toBe('hidden');
    const dock=await dialog.boundingBox();expect(dock.width).toBeLessThanOrEqual(342);expect(dock.height).toBeLessThan(270);
    expect(viewport.width-dock.x-dock.width).toBeGreaterThanOrEqual(14);
    expect(viewport.height-dock.y-dock.height).toBeGreaterThanOrEqual(14);
    const after=await frame.evaluate(()=>({width:innerWidth,height:innerHeight,identity:window.__windowIdentity}));
    expect(after).toEqual({width:before.width,height:before.height,identity:'retained'});
    await expect.poll(()=>frame.evaluate(()=>window.__gvyArena.snapshot().simTime)).toBeGreaterThan(before.state.simTime+350);
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight/2));
    await expect.poll(async()=>Math.round((await dialog.boundingBox()).y)).toBe(Math.round(dock.y));
    expect(documents).toHaveLength(1);
    await page.locator('.member-brawl-dock-preview').click({position:{x:30,y:30}});
    await expect(dialog).toHaveAttribute('data-window-state','expanded');
    expect(await frame.evaluate(()=>window.__windowIdentity)).toBe('retained');
    await expect(iframe).toHaveCSS('transform','none');
    await page.locator('[data-member-brawl-minimize]').click();
    await expect(dialog).toHaveAttribute('data-window-state','docked');
    await page.locator('[data-member-brawl-end]').click();
    await expect(dialog).not.toHaveAttribute('open','');
    await expect(iframe).not.toHaveAttribute('src',/.+/);
    await expect.poll(()=>iframe.evaluate(e=>e.contentWindow.location.href)).toBe('about:blank');
    await page.locator('[data-member-brawl-open]').evaluate(e=>e.click());await page.locator('[data-game-select="members"]').click();
    await expect(arena.locator('[data-brawl-start]')).toBeVisible();
    const next=page.frames().find(f=>f.url().includes('member-brawl.html'));
    expect(await next.evaluate(()=>window.__windowIdentity)).toBeUndefined();
    expect(await next.evaluate(()=>window.__gvyArena.snapshot().phase)).toBe('setup');
    expect(documents).toHaveLength(2);
    await page.locator('[data-member-brawl-minimize]').click();await page.locator('[data-member-brawl-end]').click();
    expect(errors).toEqual([]);
  });
}
