import {expect,test} from 'vitest';
import type {Graphics} from 'pixi.js';
import type {BattleEngine} from '../src/sim/engine';
import type {Projectile} from '../src/sim/types';
import type {CombatVfx} from '../src/render/CombatVfx';
import {drawWeaponEffects,ordnanceVisualLength} from '../src/render/WeaponEffects';
import artwork from '../src/data/ordnance-visuals.json';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ordnanceArtworkID} from '../src/render/ordnance-artwork';
import ships from '../src/data/ships.json';

test('every current guided weapon has model art or shares exactly its own size without changing projectile data',()=>{
 for(const ship of ships)for(const m of ship.mounts)if(m.kind==='missile'||m.kind==='torpedo'){
  const p={weaponId:m.weaponId,weaponSize:m.weaponSize,kind:m.kind} as Projectile,before=JSON.stringify(p),id=ordnanceArtworkID(p);
  expect(artwork.assets.some(a=>a.weaponId===id)).toBe(true);expect(JSON.stringify(p)).toBe(before);
  if(id!==m.weaponId)expect(Number(id?.match(/^s(\d+)/)?.[1])).toBe(m.weaponSize);
 }
 expect(ordnanceArtworkID({weaponId:'reference-s9-torpedo',kind:'torpedo',weaponSize:9})).toBe('s9-seeker-ix-torpedo');
});

test('verified artwork is one bounded transparent atlas with traceable original sources',()=>{
 const bytes=fs.readFileSync(new URL('../public/'+artwork.file,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(artwork.sha256);
 expect(bytes.length).toBeLessThan(40000);expect(artwork.width).toBe(256);expect(artwork.height).toBeLessThanOrEqual(512);
 expect(new Set(artwork.assets.map(a=>a.weaponId)).size).toBe(artwork.assets.length);
 for(const a of artwork.assets){const[x,y,w,h]=a.frame;expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);expect(x+w).toBeLessThanOrEqual(256);expect(y+h).toBeLessThanOrEqual(512);expect(a.originalSHA256).toMatch(/^[a-f0-9]{64}$/);expect(a.source).toMatch(/^https:\/\//);}
});
test('a verified torpedo uses its raster casing while preserving projectile state and the existing propulsion effect',()=>{
 const p={id:1,kind:'torpedo',weaponId:'s10-vt-t10-veritas-torpedo',weaponSize:10,x:0,y:0,angle:0,speed:100,damage:650000,color:0xffffff} as Projectile,original=JSON.stringify(p),calls:string[]=[];
 const engine={ships:[],beams:[],projectiles:[p],events:[],time:1} as unknown as BattleEngine,plumes:number[][]=[],body:number[]=[];
 drawWeaponEffects(engine,{} as Graphics,1,{ordnance(_p:Projectile,length:number){calls.push('body');body.push(length);return true;},wake(){calls.push('wake');},plume(...args:number[]){calls.push('plume');plumes.push(args);},glow(){}} as unknown as CombatVfx);
 expect(calls).toEqual(['wake','body','plume','plume']);expect(JSON.stringify(p)).toBe(original);
 expect(plumes[0][3]).toBeGreaterThan(body[0]);
 expect(plumes[0][6]).toBeGreaterThanOrEqual(.9);expect(plumes[1][6]).toBe(1);
});

test('S2/S5/S9/S10 torpedoes retain their size hierarchy while their casings become easier to see',()=>{
 const sizes=[2,5,9,10].map(weaponSize=>ordnanceVisualLength({weaponSize,kind:'torpedo'}));
 expect(sizes).toEqual([.8,2.4,8,10].map(n=>n*4));expect(sizes[3]/181).toBeLessThan(.25);
 expect([2,5,9,10].map(weaponSize=>ordnanceVisualLength({weaponSize,kind:'missile'}))).toEqual([.8,2.4,8,10]);
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
 expect(spans[0]).toBeCloseTo(spans[1]);expect(spans[1]).toBeCloseTo(spans[2]);expect(spans[0]).toBeLessThan(45);
});
