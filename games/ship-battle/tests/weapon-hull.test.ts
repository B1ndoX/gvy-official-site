import {test,expect} from 'vitest';
import {weaponHullIntersection,artworkToWorld,type WeaponHullProfile} from '../src/sim/weapon-hull';
import {createHullMask} from '../src/render/HullImpact';
import {BattleEngine} from '../src/sim/engine';
import ships from '../src/data/ships.json';
import type {ShipSpec,Ship} from '../src/sim/types';
function profile():WeaponHullProfile{
 const rgba=new Uint8Array(20*20*4);
 for(let y=3;y<17;y++)for(let x=7;x<13;x++)rgba[(y*20+x)*4+3]=255;
 return {asset:{center:{x:.45,y:.55},noseDegrees:0},mask:createHullMask(20,20,rgba)!};
}
test('all sizes, rotations and sprite orientations stop at the first opaque cell along the unchanged ray',()=>{
 for(const length of [20,100,243,1000,2789])for(const heading of [0,.7,2.4])for(const noseDegrees of [0,90,-90,180]){
  const hull=profile();hull.asset.noseDegrees=noseDegrees;
  const s={x:80,y:-100,heading,spec:{length,beam:length*.4}} as Ship;
  const from=artworkToWorld({x:-.3,y:.5},s,hull.asset),to=artworkToWorld({x:1.3,y:.5},s,hull.asset);
  expect(weaponHullIntersection(from,to,s,hull)).toBeCloseTo((.35+.3)/1.6,8);
  const cornerFrom=artworkToWorld({x:-.3,y:.05},s,hull.asset),cornerTo=artworkToWorld({x:1.3,y:.05},s,hull.asset);
  expect(weaponHullIntersection(cornerFrom,cornerTo,s,hull)).toBeNull();
 }
});
test.each([0,20])('a projectile passes the transparent envelope and hits the moving hull once (vx=%s)',vx=>{
 const source=structuredClone(ships.find(s=>s.id==='gladius')!) as ShipSpec;
 const target=structuredClone(ships.find(s=>s.id==='idris-p')!) as ShipSpec;
 const specs=[source,target].map(s=>({...s,mounts:[],speed:0,acceleration:0,turnRate:0,shieldRegen:0,shield:0,armorEnergyMultiplier:1}));
 const e=new BattleEngine();e.reset([{specId:source.id,count:1},{specId:target.id,count:1}],specs,31);e.asteroids=[];
 const [owner,victim]=e.ships;Object.assign(owner,{x:-2000,y:-2000});Object.assign(victim,{x:0,y:0,heading:-Math.PI/2,vx});
 const hull=profile();hull.asset.center={x:.5,y:.5};e.weaponHulls=new Map([[target.id,hull]]);e.start();
 const a=artworkToWorld({x:.1,y:.5},victim,hull.asset),b=artworkToWorld({x:.9,y:.5},victim,hull.asset),angle=Math.atan2(b.y-a.y,b.x-a.x);
 e.projectiles.push({id:999,owner:owner.id,target:victim.id,kind:'laser',...a,vx:Math.cos(angle)*60,vy:Math.sin(angle)*60,angle,speed:60,damage:100,ttl:10,travel:0,range:1000,color:0xffffff});
 const before=victim.hull;e.step();expect(e.projectiles).toHaveLength(1);expect(victim.hull).toBe(before);
 for(let i=0;i<100&&e.projectiles.length;i++)e.step();
 expect(e.projectiles).toHaveLength(0);expect(e.hits).toBe(1);expect(victim.hull).toBeLessThan(before);
 const hit=e.events.find(ev=>ev.kind==='hit')!;expect(hit.x).toBeCloseTo(artworkToWorld({x:.35,y:.5},victim,hull.asset).x,7);
});
test('transparent cutouts do not become impacts, and rays starting inside a solid cell hit immediately',()=>{
 const hull=profile(),s={x:0,y:0,heading:0,spec:{length:100,beam:40}} as Ship;
 const point=artworkToWorld({x:.5,y:.5},s,hull.asset);
 expect(weaponHullIntersection(point,point,s,hull)).toBe(0);
 const empty=artworkToWorld({x:.1,y:.1},s,hull.asset);expect(weaponHullIntersection(empty,empty,s,hull)).toBeNull();
});
