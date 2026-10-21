import {expect,test} from '@playwright/test';

test('one fleet window selects either game, supplies the current roster and unloads on switching',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-member-brawl-open]').evaluate(e=>e.click());
 const frame=page.locator('[data-member-brawl-frame]');
 await expect(frame).not.toHaveAttribute('src',/.+/);
 await expect(page.locator('[data-game-select]')).toHaveCount(2);
 await expect.poll(()=>page.locator('[data-game-preview]').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
 await page.locator('[data-game-select="members"]').click();
 await expect(page.frameLocator('[data-member-brawl-frame]').locator('[data-brawl-start]')).toBeVisible();
 await page.locator('[data-game-back]').click();
 await expect(frame).not.toHaveAttribute('src',/.+/);
 await page.evaluate(()=>{window.__shipMessages=[];addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.source==='gvy.ship-battle')window.__shipMessages.push(e.data);});});
 await page.locator('[data-game-select="ships"]').click();
 const ship=page.frameLocator('[data-member-brawl-frame]');
 await expect.poll(()=>page.evaluate(()=>{const count=window.__shipMessages.find(m=>m.type==='members-accepted')?.payload.count;return count>=2&&count===window.__gvyFleetRoster?.members.length;})).toBe(true);
 await expect(ship.getByRole('button',{name:'开始战斗',exact:true})).toBeEnabled();
 await ship.getByRole('button',{name:'开始战斗',exact:true}).click();
 await expect(ship.getByTestId('phase')).toHaveText('交战中');
 await page.locator('[data-game-back]').click();
 await expect(frame).not.toHaveAttribute('src',/.+/);
 await expect(page.locator('[data-game-hub]')).toBeVisible();
 expect(errors).toEqual([]);
});

test('persistent ship resource cache permits offline redraws after closing and reopening the game',async({page,context})=>{
 test.setTimeout(90000);
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-member-brawl-open]').evaluate(e=>e.click());
 await expect(page.locator('[data-ship-cache]')).toBeVisible();
 await expect.poll(()=>page.locator('[data-ship-cache-label]').textContent(),{timeout:60000}).toContain('已缓存');
 const count=await page.evaluate(async()=>{const cache=await caches.open('gvy-ship-battle-resources-v1');return(await cache.keys()).length;});expect(count).toBeGreaterThan(250);
 await page.locator('[data-game-select="ships"]').click();
 const ship=page.frameLocator('[data-member-brawl-frame]');
 await expect(ship.getByRole('button',{name:'开始战斗',exact:true})).toBeEnabled();
 await page.locator('[data-member-brawl-close]').click();await page.locator('[data-member-brawl-end]').click();
 await page.locator('[data-member-brawl-open]').evaluate(e=>e.click());await page.locator('[data-game-select="ships"]').click();
 await expect(ship.getByRole('button',{name:'开始战斗',exact:true})).toBeEnabled();
 await context.setOffline(true);
 for(let i=0;i<2;i++){
  await ship.getByRole('button',{name:'重新抽签',exact:true}).click();
  await expect(ship.getByRole('button',{name:'开始战斗',exact:true})).toBeEnabled();
 }
 await expect(ship.locator('.ship-loading-note')).toHaveCount(0);
});
