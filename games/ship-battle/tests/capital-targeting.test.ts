import {test,expect} from 'vitest';
import ships from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import type {ShipSpec} from '../src/sim/types';
function scenario(){
 const boss=structuredClone(ships.find(s=>s.id==='idris-p')!) as ShipSpec;
 boss.mounts=boss.mounts.filter(m=>m.kind==='beam').map(m=>({...m,charge:0,damage:1}));
 const arrow=structuredClone(ships.find(s=>s.id==='arrow')!) as ShipSpec;
 const targets=['front','rear'].map(id=>({...arrow,id,mounts:[],hull:1e8,shield:0}));
 const e=new BattleEngine();e.reset([{specId:boss.id,count:1,npc:'boss',team:'enemy'},...targets.map(s=>({specId:s.id,count:1,team:'members'}))],[boss,...targets].map(s=>({...s,speed:0,acceleration:0,shieldRegen:0})),42);
 e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i===0?0:i===1?1700:-600;s.y=0;s.heading=0;s.cooldowns.fill(0);});e.start();return e;
}
test('slow hull commits to a reachable forward target and immediately reacquires after its death',()=>{
 const e=scenario(),[boss,front,rear]=e.ships;e.step();expect(boss.targetId).toBe(front.id);
 rear.x=-200;for(let i=0;i<240;i++)e.step();expect(boss.targetId).toBe(front.id);
 front.alive=false;front.hull=0;e.step();expect(boss.targetId).toBe(rear.id);
});
test('a stalled capital finishes aiming instead of permanently steering 37 degrees off its target',()=>{
 const e=scenario(),boss=e.ships[0];e.time=15;boss.lastDealt=-100;boss.cooldowns[0]=.7;
 for(let i=0;i<120;i++)e.step();expect(e.shots).toBeGreaterThan(0);expect(Math.abs(boss.heading)).toBeLessThan(.03);
});
test('the fixed primary shares hull focus while a defensive turret remains independent',()=>{
 const e=scenario(),[boss,front,rear]=e.ships;boss.spec={...boss.spec,mounts:[...boss.spec.mounts,{...boss.spec.mounts[0],id:'defense',kind:'turret',fireControl:'manned',role:'point-defense',arc:360,turnRate:10}]};boss.cooldowns.push(0);boss.turretAngles.push(0);boss.turretTargets.push(null);
 e.step();expect(boss.turretTargets[0]).toBe(front.id);expect(boss.turretTargets[1]).toBe(rear.id);
});
