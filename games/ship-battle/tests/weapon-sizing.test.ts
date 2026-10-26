import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import parameters from '../src/data/weapon-game-values.json';
import loads from '../src/data/fleet-weapon-loadouts.json';
import {BattleEngine} from '../src/sim/engine';
import {weaponDps} from '../src/sim/weapons';
import type {ShipSpec,Mount} from '../src/sim/types';
const ships=data as ShipSpec[];
test('unknown-model size bands remain finite estimates without forcing monotonicity over known real models',()=>{
 for(const band of Object.values(parameters.sizeBands))for(const value of Object.values(band)){expect(value.damage).toBeGreaterThan(0);expect(value.cooldown).toBeGreaterThan(0);expect(Number.isFinite(value.damage+value.cooldown)).toBe(true);}
});
test('fast and slow real models of the same size keep their distinct single-shot and cadence characteristics',()=>{
 const table=parameters.weapons as Record<string,{size:number;combat:{damage?:number;cooldown:number}}>;
 const quick=table['s3-cf-337-panther-repeater'],slow=table['s3-omnisky-ix-cannon'];
 expect(quick).toBeDefined();expect(slow).toBeDefined();expect(quick.size).toBe(slow.size);expect(quick.combat.cooldown).toBeLessThan(slow.combat.cooldown);expect(quick.combat.damage!).toBeLessThan(slow.combat.damage!);
});
function firing(barrels:number){
 const source=structuredClone(ships.find(s=>s.id==='hammerhead')!),gun={...source.mounts.find(m=>m.kind==='turret')!,x:0,y:0,facing:0,arc:360,barrels,weaponCount:barrels,charge:0};
 source.mounts=[gun];const target={...structuredClone(ships.find(s=>s.id==='arrow')!),id:'target',mounts:[],hull:1e7,shield:1e7};
 const e=new BattleEngine();e.reset([{specId:source.id,count:1},{specId:target.id,count:1}],[source,target].map(s=>({...s,speed:0,acceleration:0,turnRate:0,shieldRegen:0})),42);e.asteroids=[];
 e.ships.forEach((s,i)=>{s.x=i*900;s.y=0;s.heading=0;s.cooldowns.fill(0);s.turretAngles.fill(0);});e.start();for(let i=0;i<60&&!e.shots;i++)e.step();return {engine:e,gun};
}
test('a quad turret launches four real projectiles of unchanged single-barrel damage, rather than a merged or compressed hit',()=>{
 const one=firing(1),four=firing(4);expect(one.engine.projectiles).toHaveLength(1);expect(four.engine.projectiles).toHaveLength(4);expect(four.engine.shots).toBe(4);
 expect(four.engine.projectiles.every(p=>p.damage===one.engine.projectiles[0].damage)).toBe(true);expect(four.engine.projectiles.reduce((n,p)=>n+p.damage,0)).toBeCloseTo(4*one.gun.damage);expect(weaponDps(four.gun)).toBeCloseTo(4*weaponDps(one.gun));
});
test('Odin and Mauler include sourced boss weapon sizes and quantities, including separate interception-only PDC',()=>{
 const odin=ships.find(s=>s.id==='odin')!,mauler=ships.find(s=>s.id==='mauler')!;
 const count=(s:ShipSpec,size:number)=>s.mounts.filter(m=>m.weaponSize===size&&!m.interceptsOnly&&!['missile','torpedo','beam'].includes(m.kind)).reduce((n,m)=>n+(m.barrels??1),0);
 expect(count(odin,8)).toBe(24);expect(count(odin,12)).toBe(6);expect(count(odin,10)).toBe(11);expect(odin.mounts.find(m=>m.kind==='beam')!.weaponSize).toBe(12);expect(odin.mounts.find(m=>m.kind==='torpedo')!.ammo).toBe(20);
 expect(odin.mounts.filter(m=>m.interceptsOnly).reduce((n,m)=>n+(m.weaponCount??1),0)).toBe(42);expect(odin.mounts.filter(m=>m.interceptsOnly).reduce((n,m)=>n+weaponDps(m),0)).toBe(0);
 expect(count(mauler,6)).toBe(10);expect(count(mauler,8)).toBe(6);expect(mauler.mounts.find(m=>m.kind==='beam')!.weaponSize).toBe(10);
});
test('unpublished boss inventories remain explicitly unverified, rather than fabricated as real fittings',()=>{
 for(const id of ['pegasus','bengal','retribution'])expect((loads.ships as Record<string,{status:string}>)[id].status).toBe('fallback');
});
