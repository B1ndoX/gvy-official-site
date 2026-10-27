import {expect,test} from 'vitest';
import {createHullMask,HullImpactAnchors,hullSurface,artworkToWorld,worldToArtwork} from '../src/render/HullImpact';
import {CombatVfx} from '../src/render/CombatVfx';
import {drawWeaponEffects} from '../src/render/WeaponEffects';
import type {BattleEvent,Ship,ShipSpec,Mount} from '../src/sim/types';
import type {BattleEngine} from '../src/sim/engine';
import type {Graphics} from 'pixi.js';
import {mountWorld} from '../src/sim/math';
import {BattleEngine as Engine} from '../src/sim/engine';
import ships from '../src/data/ships.json';

const asset={center:{x:.45,y:.55},noseDegrees:0};
const ship=(length=1000,beam=200)=>({x:100,y:-50,heading:.3,spec:{length,beam},id:7} as Ship);
function mask(width=20,height=20){
 const rgba=new Uint8Array(width*height*4);
 for(let y=2;y<height-2;y++)for(let x=6;x<width-6;x++)rgba[(y*width+x)*4+3]=255;
 return createHullMask(width,height,rgba)!;
}
function event(localImpact={x:-.48,y:-.2}){return {id:1,kind:'shield',time:1,x:-9999,y:9999,localImpact,ship:7,by:8,label:'target',radius:500} as BattleEvent;}

test('the bounded mask preserves thin opaque struts and rejects transparent artwork',()=>{
 const rgba=new Uint8Array(1024*64*4);rgba[(25*1024+510)*4+3]=255;
 const m=createHullMask(1024,64,rgba)!;expect(m.width).toBe(256);expect(m.height).toBe(16);expect(m.edge).toHaveLength(1);
 expect(createHullMask(3,3,new Uint8Array(36))).toBeNull();
});

test('all image orientations and off-centre calibrations use the actual sprite transform',()=>{
 for(const heading of [0,.7,Math.PI,-1.2])for(const noseDegrees of [0,90,180,-90]){
  const s=ship();s.heading=heading;const a={...asset,noseDegrees};
  for(const uv of [{x:.1,y:.15},{x:.8,y:.9},a.center]){
   const p=artworkToWorld(uv,s,a),actual=worldToArtwork(p,s,a);expect(actual.x).toBeCloseTo(uv.x,10);expect(actual.y).toBeCloseTo(uv.y,10);
  }
 }
});

test('transparent ellipse corners project to opaque ship pixels, using world distance for non-square hulls',()=>{
 const m=mask(),point={x:.05,y:.1},p=hullSurface(m,point,200,1000);
 expect(p.x).toBeCloseTo(.325);expect(p.y).toBeCloseTo(.125);expect(m.opaque[Math.floor(p.y*m.height)*m.width+Math.floor(p.x*m.width)]).toBe(1);
 const inside={x:.5,y:.5};expect(hullSurface(m,inside,200,1000)).toBe(inside);
});

test('impact contact follows translation, rotation and hull size without changing its local opaque anchor',()=>{
 const anchors=new HullImpactAnchors(),m=mask(),s=ship(),ev=event(),before=JSON.stringify(ev);
 const first=worldToArtwork(anchors.event(ev,s,asset,m),s,asset);
 s.x+=420;s.y-=320;s.heading+=1.4;s.spec={...s.spec,length:2000,beam:400};
 const second=worldToArtwork(anchors.event(ev,s,asset,m),s,asset);
 expect(second.x).toBeCloseTo(first.x,12);expect(second.y).toBeCloseTo(first.y,12);expect(JSON.stringify(ev)).toBe(before);
 const p=anchors.event(ev,s,asset,m);expect(anchors.event(ev,s,asset,m)).toEqual(p);
});

test('exact local metadata handles several simulation steps before the first rendered frame',()=>{
 const s=ship(),m=mask(),ev=event({x:.1,y:.12}),anchors=new HullImpactAnchors();
 const old=mountWorld(s,ev.localImpact!);ev.x=old.x;ev.y=old.y;
 s.x+=850;s.y+=360;s.heading+=2.1;
 const actual=worldToArtwork(anchors.event(ev,s,asset,m),s,asset),expected=worldToArtwork(mountWorld(s,ev.localImpact!),s,asset);
 expect(actual.x).toBeCloseTo(expected.x);expect(actual.y).toBeCloseTo(expected.y);
 const distinct={...ev,localImpact:{x:-.1,y:-.12}};anchors.reset();expect(anchors.event(distinct,s,asset,m)).not.toEqual(anchors.event(ev,s,asset,m));
});

test('beam stops at the first opaque pixel along its original ray instead of the enclosing ellipse',()=>{
 const s=ship(),m=mask(),a={center:{x:.5,y:.5},noseDegrees:0},anchors=new HullImpactAnchors();
 const from=artworkToWorld({x:-1,y:.5},s,a),to=artworkToWorld({x:.05,y:.5},s,a),before=JSON.stringify({from,to,s});
 const result=worldToArtwork(anchors.beam(from,to,s,a,m),s,a);
 expect(result.x).toBeGreaterThanOrEqual(.3);expect(result.x).toBeLessThan(.351);expect(result.y).toBeCloseTo(.5);
 expect(JSON.stringify({from,to,s})).toBe(before);
 const grazing=anchors.beam(artworkToWorld({x:-1,y:.025},s,a),artworkToWorld({x:.05,y:.025},s,a),s,a,m),uv=worldToArtwork(grazing,s,a);
 expect(m.opaque[Math.floor(uv.y*m.height)*m.width+Math.floor(uv.x*m.width)]).toBe(1);
});

test('hit and shield feedback use the hull anchor, while destruction stays in world space',()=>{
 const positions:number[][]=[],vfx={px:1,reserve:0,glow:(x:number,y:number)=>positions.push([x,y]),sprite:(_tile:string,x:number,y:number)=>positions.push([x,y]),streak(){},explosion:(ev:BattleEvent)=>positions.push([ev.x,ev.y])};
 const hit={...event(),kind:'hit' as const},shield=event(),destroy={...event(),kind:'destroy' as const};
 CombatVfx.prototype.events.call(vfx as unknown as CombatVfx,{time:1,events:[hit,shield,destroy]} as BattleEngine,()=>({x:20,y:30}));
 expect(positions).toEqual([[20,30],[20,30],[20,30],[destroy.x,destroy.y]]);
});

test('continuous beam and its hit glow share the projected hull contact without mutating physical segments',()=>{
 const calls:number[][]=[],s=ship();s.alive=true;s.spec={...s.spec,mounts:[structuredClone(ships.find(s=>s.id==='idris-p')!.mounts.find(m=>m.kind==='beam')!) as Mount]};
 const engine={ships:[s],beams:[{owner:s.id,mount:0,elapsed:1,remaining:1,segments:[{from:{x:0,y:0},to:{x:10,y:0},ship:8,hit:true}]}],projectiles:[],events:[],time:1} as unknown as BattleEngine;
 const before=JSON.stringify(engine),vfx={streak:(...n:number[])=>calls.push(n),glow:(...n:number[])=>calls.push(n)} as unknown as CombatVfx;
 drawWeaponEffects(engine,{} as Graphics,1,vfx,(_id,from,to)=>{expect(_id).toBe(8);expect(from.x).toBe(0);expect(to.x).toBe(10);return {x:14,y:2};});
 expect(calls[0].slice(0,4)).toEqual([0,0,14,2]);expect(calls[1].slice(0,4)).toEqual([0,0,14,2]);expect(calls[3].slice(0,2)).toEqual([14,2]);expect(JSON.stringify(engine)).toBe(before);
});

test('real narrow and broad beam metadata names the physical victim and retains the original damage budget',()=>{
 for(const id of ['idris-p','odin']){
  const source=structuredClone(ships.find(s=>s.id===id)!) as ShipSpec,target=structuredClone(ships.find(s=>s.id==='hammerhead')!) as ShipSpec;
  source.mounts=source.mounts.filter(m=>m.kind==='beam').map(m=>({...m,charge:0}));target.mounts=[];
  const e=new Engine(true);e.reset([{specId:id,count:1},{specId:target.id,count:1}],[source,target].map(s=>({...s,speed:0,acceleration:0,turnRate:0,shieldRegen:0,armorPhysicalMultiplier:1,armorEnergyMultiplier:1})),42);
  e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i*1300;s.y=0;s.heading=i?Math.PI:0;s.cooldowns.fill(0);});
  const victim=e.ships[1],m=e.ships[0].spec.mounts[0];victim.spec={...victim.spec,hull:1e8,shield:0,beam:1000};victim.hull=1e8;victim.shield=0;e.start();
  for(let i=0;i<40;i++)e.step();expect(e.beams[0].segments[0].ship).toBe(victim.id);
  for(const ev of e.events.filter(ev=>ev.kind==='hit'||ev.kind==='shield')){const p=mountWorld(victim,ev.localImpact!);expect(p.x).toBeCloseTo(ev.x,8);expect(p.y).toBeCloseTo(ev.y,8);}
  while(e.time<m.duration!+2/60)e.step();expect(1e8-victim.hull).toBeCloseTo(m.damage*m.duration!,3);expect(e.shots).toBe(1);
 }
});
