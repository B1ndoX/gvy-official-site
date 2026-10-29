import {expect,test} from '@playwright/test';

for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 test(`ship release entry supports three modes and pause/resume at ${viewport.width}px`,async({page},testInfo)=>{
  test.setTimeout(120000);
  await page.setViewportSize(viewport);
  const errors=[],warnings=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());if(message.type()==='warning')warnings.push(message.text());});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page).toHaveTitle(/星远/);
  await page.waitForFunction(()=>window.__gvyCinematicHomepage);
  await page.locator('#fleet-signal').evaluate(el=>window.scrollTo({top:el.offsetTop,behavior:'instant'}));
  await page.locator('.fleet-games-jump').click();
  await expect(page.locator('[data-member-brawl-open]')).toBeInViewport({ratio:1});
  await page.locator('[data-member-brawl-open]').click();
  await page.locator('[data-game-select="ships"]').click();
  const game=page.frameLocator('[data-member-brawl-frame]');
  await expect(game.getByRole('button',{name:'开始战斗',exact:true})).toBeEnabled({timeout:60000});
  for(const mode of ['成员大乱斗','挑战模式','赏金猎人']){
   await game.getByRole('button',{name:'切换战斗模式',exact:true}).click();
   await game.locator('.mode-menu button').filter({hasText:mode}).click();
   await expect(game.getByTestId('mode-name')).toHaveText(mode);
   await expect(game.getByRole('button',{name:'开始战斗',exact:true})).toBeEnabled({timeout:60000});
   await game.getByRole('button',{name:'开始战斗',exact:true}).click();
   await expect(game.getByTestId('phase')).toHaveText('交战中');
   await expect(game.locator('canvas')).toBeVisible();
   await expect.poll(()=>game.getByTestId('time').textContent()).not.toBe('00:00');
   await game.getByRole('button',{name:'暂停',exact:true}).click();
   await expect(game.getByTestId('phase')).toHaveText('已暂停');
   await game.getByRole('button',{name:'继续',exact:true}).click();
   await expect(game.getByTestId('phase')).toHaveText('交战中');
   await game.getByRole('button',{name:'暂停',exact:true}).click();
   expect(await game.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await expect(game.locator('vite-error-overlay')).toHaveCount(0);
  }
  expect(errors).toEqual([]);expect(warnings).toEqual([]);
  await page.screenshot({path:testInfo.outputPath(`ship-entry-${viewport.width}.png`)});
 });
}
