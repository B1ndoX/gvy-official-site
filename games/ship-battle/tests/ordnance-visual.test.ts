import {expect,test} from 'vitest';
import type {Graphics} from 'pixi.js';
import type {BattleEngine} from '../src/sim/engine';
import type {Projectile} from '../src/sim/types';
import type {CombatVfx} from '../src/render/CombatVfx';
import {drawWeaponEffects,ordnanceVisualLength} from '../src/render/WeaponEffects';

test('S2/S5/S9/S10 silhouettes use distinct world lengths; even S10 stays much smaller than its Polaris launcher',()=>{
 const sizes=[2,5,9,10].map(weaponSize=>ordnanceVisualLength({weaponSize,kind:'torpedo'}));
 expect(sizes).toEqual([.8,2.4,8,10]);expect(sizes[3]/181).toBeLessThan(.06);
});
test('zoom changes the screen projection of a torpedo, never its size relative to a ship',()=>{
 const spans=[];
 for(const px of [.01,1,10]){
  const polygons:number[][]=[],g={poly:(p:number[])=>{polygons.push(p);return g;},fill:()=>g,stroke:()=>g,moveTo:()=>g,lineTo:()=>g};
  const projectile={id:1,kind:'torpedo',weaponSize:10,x:0,y:0,angle:0,speed:100,color:0xffffff} as Projectile;
  const engine={ships:[],beams:[],projectiles:[projectile],events:[],time:1} as unknown as BattleEngine;
  drawWeaponEffects(engine,g as unknown as Graphics,px,{wake(){},plume(){},glow(){}} as unknown as CombatVfx);
  const x=polygons.flatMap(p=>p.filter((_,i)=>i%2===0));spans.push(Math.max(...x)-Math.min(...x));
 }
 expect(spans[0]).toBeCloseTo(spans[1]);expect(spans[1]).toBeCloseTo(spans[2]);expect(spans[0]).toBeLessThan(12);
});
