import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import manifest from '../public/assets/ships/manifest.json';
import values from '../src/data/weapon-game-values.json';
import {BattleEngine,STEP} from '../src/sim/engine';
import {mountWorld,wrap} from '../src/sim/math';
import {fixedWeapon,turretControlled} from '../src/sim/weapons';
import {BATTLE_DURATION,simulationSeconds} from '../src/sim/pacing';
import {upgradeCombat,type ShipAsset} from '../src/assets/library';
import type {ShipSpec} from '../src/sim/types';

const mauler=data.find(s=>s.id==='mauler')! as ShipSpec;
function scene(port?:string){
 const owner={...structuredClone(mauler),mounts:mauler.mounts.filter(m=>m.kind==='beam'&&(!port||m.id===port)).map(m=>({...m,charge:0})),speed:0,acceleration:0,turnRate:0};
 const target={...structuredClone(mauler),id:'target',bossOnly:false,mounts:[],hull:1e9,shield:0,shieldRegen:0,armorEnergyMultiplier:1,speed:0,acceleration:0,turnRate:0};
 const e=new BattleEngine();e.reset([{specId:'mauler',count:1},{specId:'target',count:1}],[owner,target],42);e.asteroids=[];
 e.ships.forEach((s,i)=>{s.x=i*1300;s.y=0;s.heading=0;s.cooldowns.fill(0);});e.start();return e;
}
test('Mauler separates the marked nose and dorsal emitters while retaining one original beam power budget',()=>{
 const beams=mauler.mounts.filter(m=>m.kind==='beam');expect(beams).toHaveLength(2);
 const [nose,dorsal]=beams;expect(fixedWeapon(nose)).toBe(true);expect(turretControlled(dorsal)).toBe(true);
 expect(nose.y).toBeLessThan(-.4);expect(Math.abs(dorsal.y)).toBeLessThan(.1);expect(dorsal.arc).toBe(360);
 expect(dorsal.turnRate/BATTLE_DURATION*180/Math.PI).toBeLessThanOrEqual(10);
 expect(beams.every(m=>!m.emitters||m.emitters.length===1)).toBe(true);
 expect(beams.reduce((sum,m)=>sum+m.damage,0)).toBeCloseTo(values.weapons['reference-s10-beam'].combat.damage,6);
});
test.each([false,true])('dorsal beam acquires sideways targets and keeps traversing while firing, without hull yaw or live snapping (boss=%s)',boss=>{
 const e=scene('dorsal-beam'),[owner,target]=e.ships;if(boss)owner.npc='boss';target.x=0;target.y=1000;
 let active=false,previous=0;
 const acquireSteps=Math.ceil((Math.PI/2/owner.spec.mounts[0].turnRate+simulationSeconds(3))/STEP);
 for(let i=0;i<acquireSteps&&!active;i++){e.step();active=e.beams.length>0;}
 expect(active).toBe(true);expect(owner.heading).toBe(0);
 const beam=e.beams[0];expect(beam.segments).toHaveLength(1);expect(beam.segments[0].from).toEqual(mountWorld(owner,owner.spec.mounts[0]));
 previous=owner.turretAngles[0];target.x=-400;const initial=previous;let change=0;
 for(let i=0;i<90;i++){e.step();const angle=owner.turretAngles[0];expect(Math.abs(wrap(angle-previous))).toBeLessThanOrEqual(owner.spec.mounts[0].turnRate*STEP+1e-8);change+=Math.abs(wrap(angle-previous));previous=angle;}
 expect(change).toBeGreaterThan(.05);expect(Math.abs(wrap(previous-initial))).toBeGreaterThan(.05);expect(owner.heading).toBe(0);
 const segment=e.beams[0].segments[0];expect(wrap(Math.atan2(segment.to.y-segment.from.y,segment.to.x-segment.from.x)-previous)).toBeCloseTo(0,8);
});
test('nose beam cannot fire sideways, and pause/reset freeze and clear dorsal traversal',()=>{
 const nose=scene('spinal-beam');nose.ships[1].x=0;nose.ships[1].y=1000;for(let i=0;i<300;i++)nose.step();expect(nose.shots).toBe(0);
 const e=scene('dorsal-beam');for(let i=0;i<120;i++)e.step();expect(e.beams).toHaveLength(1);e.pause();const before=JSON.stringify([e.beams,e.ships[0].turretAngles,e.ships[0].weaponCycles]);for(let i=0;i<60;i++)e.step();expect(JSON.stringify([e.beams,e.ships[0].turretAngles,e.ships[0].weaponCycles])).toBe(before);
 e.reset([],data as ShipSpec[]);expect(e.beams).toHaveLength(0);
});
test('cached stock merged beams migrate once; explicit calibration and imported art keep their coordinates',()=>{
 const base=manifest.assets.find(a=>a.shipId==='mauler') as ShipAsset;
 const legacy={...structuredClone(base),combatVersion:17,turretLayoutVersion:4,mounts:base.mounts.filter(m=>m.id!=='dorsal-beam').map(m=>m.id==='spinal-beam'?{...m,x:.09,y:-.49,emitters:[-.09,.09]}:m)};
 const next=upgradeCombat(legacy,base);expect(next.mounts).toEqual(base.mounts);expect(upgradeCombat(next,base)).toBe(next);
 for(const custom of [{...legacy,calibrated:true},{...legacy,url:'assets/ships/custom.png'}])expect(upgradeCombat(custom,base).mounts.find(m=>m.id==='spinal-beam')!.x).toBe(.09);
});
