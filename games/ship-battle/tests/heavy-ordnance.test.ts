import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import manifest from '../public/assets/ships/manifest.json';
import reference from '../src/data/ordnance-reference.json';
import {BattleEngine} from '../src/sim/engine';
import {weaponDps} from '../src/sim/weapons';
import {upgradeCombat,validateAsset,type ShipAsset} from '../src/assets/library';
import type {ShipSpec} from '../src/sim/types';
function duel(id:string,targetId='idris-m'){
 const a=structuredClone(data.find(s=>s.id===id)!) as ShipSpec,b=structuredClone(data.find(s=>s.id===targetId)!) as ShipSpec;
 a.mounts=a.mounts.filter(m=>m.impact);b.mounts=[];
 for(const s of [a,b]){s.speed=s.acceleration=s.turnRate=s.shieldRegen=0;}
 const e=new BattleEngine();e.reset([{specId:id,count:1},{specId:targetId,count:1}],[a,b],42);e.asteroids=[];
 e.ships.forEach((s,i)=>{s.x=i*1200;s.y=0;s.heading=0;s.cooldowns.fill(0);s.turretAngles.fill(0);});e.start();return e;
}
const step=(e:BattleEngine,n:number)=>{for(let i=0;i<n;i++)e.step();};
const acquire=(e:BattleEngine)=>{for(let i=0;i<60&&e.shots<4;i++)e.step();};
test('Perseus has two independently aimed twin S8 turrets with four distinct shell origins',()=>{
 const e=duel('perseus');acquire(e);const guns=e.ships[0].spec.mounts;
 expect(guns).toHaveLength(2);expect(guns.reduce((n,m)=>n+(m.barrels??1),0)).toBe(4);
 expect(guns.every(m=>m.kind==='turret'&&m.weaponSize===8)).toBe(true);
 expect(e.projectiles).toHaveLength(4);expect(e.shots).toBe(4);
 expect(new Set(e.projectiles.map(p=>`${p.x.toFixed(4)}:${p.y.toFixed(4)}`)).size).toBe(4);
 expect(e.projectiles.every(p=>p.kind==='ballistic'&&p.turnRate===guns[0].turnRate)).toBe(true);
 expect(e.projectiles.map(p=>p.damage)).toEqual(guns.flatMap(m=>[m.damage,m.damage]));
 expect(guns.reduce((n,m)=>n+weaponDps(m),0)).toBeCloseTo(4*5400/1.6);
});
test('heavy cannon shells remain unguided and can miss a fighter that changes direction',()=>{
 const e=duel('perseus','arrow'),target=e.ships[1];e.ships[0].spec.mounts.forEach(m=>m.cooldown=100);acquire(e);const shells=[...e.projectiles],angles=shells.map(p=>p.angle);expect(shells).toHaveLength(4);
 target.vy=500;step(e,120);expect(shells.map(p=>p.angle)).toEqual(angles);expect(e.hits).toBe(0);expect(target.alive).toBe(true);
});
test('Perseus heavy guns traverse slowly, launch slow shells and use the sourced 50 RPM between volleys',()=>{
 const e=duel('perseus'),ship=e.ships[0],target=e.ships[1];ship.spec.mounts.forEach(m=>m.cooldownJitter=0);target.hull=1e9;target.spec={...target.spec,hull:1e9};
 const clocks:number[][]=[[],[]];let shots=0;
 for(let n=0;n<600;n++){const previous=[...ship.cooldowns];e.step();for(let i=0;i<2;i++)if(ship.cooldowns[i]>previous[i]+.5)clocks[i].push(e.time);if(e.projectiles.length){expect(e.projectiles.every(p=>p.speed===1016*.75)).toBe(true);shots=e.shots;}}
 expect(shots).toBeGreaterThan(8);for(const clock of clocks){expect(clock.length).toBeGreaterThan(3);for(let i=1;i<clock.length;i++)expect(Math.abs(clock[i]-clock[i-1]-1.6)).toBeLessThanOrEqual(1/60+1e-8);}
 const aim=duel('perseus');aim.ships[1].y=800;aim.step();expect(aim.shots).toBe(0);
 expect(aim.ships[0].turretAngles.every(angle=>Math.abs(angle)<=aim.ships[0].spec.mounts[0].turnRate/60+1e-9)).toBe(true);
});
test('the two Perseus turrets keep independent reload clocks rather than locking into simultaneous volleys',()=>{
 const e=duel('perseus'),ship=e.ships[0],target=e.ships[1];target.hull=1e9;target.spec={...target.spec,hull:1e9};ship.cooldowns[0]=.3;ship.cooldowns[1]=.9;
 expect(ship.cooldowns[0]).not.toBe(ship.cooldowns[1]);
 const fired:number[]=[];for(let n=0;n<900;n++){const shots=e.shots;e.step();if(e.shots>shots)fired.push(e.shots-shots);}
 expect(fired.length).toBeGreaterThan(3);expect(fired.some(count=>count===2)).toBe(true);
});
test.each(['cutlass-black','constellation-andromeda'])('one actual Polaris S10 impact can destroy an ordinary %s',id=>{
 const e=duel('polaris',id);step(e,400);expect(e.shots).toBe(1);expect(e.hits).toBe(1);expect(e.ships[1].alive).toBe(false);expect(e.ships[0].kills).toBe(1);expect(e.killLog).toHaveLength(1);
});
test('the same S10 impact hurts rather than automatically killing a larger ship',()=>{
 const e=duel('polaris');step(e,400);const target=e.ships[1];expect(target.alive).toBe(true);expect(e.hits).toBe(1);expect(target.spec.hull+target.spec.shield-target.hull-target.shield).toBeCloseTo(Math.min(target.spec.shield,650000)+Math.max(0,650000-target.spec.shield)*(target.spec.armorPhysicalMultiplier??1),5);
});
test.each(['perseus','polaris'])('%s raw impacts are identical against members and NPC bosses',id=>{
 const e=duel(id),target=e.ships[1];target.npc='boss';e.mode='challenge';const total=target.hull+target.shield;step(e,400);
 expect(target.alive).toBe(true);expect(total-target.hull-target.shield).toBeGreaterThan(0);const member=duel(id);step(member,400);expect(target.hull).toBeCloseTo(member.ships[1].hull);expect(target.shield).toBeCloseTo(member.ships[1].shield);
});
test('four Polaris ports alternate while using one finite shared stock; reset refills it',()=>{
 const e=duel('polaris'),ship=e.ships[0],m=ship.spec.mounts[0],target=e.ships[1];m.charge=0;m.cooldown=.05;target.spec={...target.spec,hull:1e9,shield:0};target.hull=1e9;target.shield=0;
 const ports=new Set<number>();for(let n=0;n<600;n++){e.step();for(const p of e.projectiles)ports.add(Number(p.y.toFixed(4)));}
 expect(e.shots).toBe(28);expect(ship.weaponCycles![0].ammoLeft).toBe(0);expect(ports.size).toBeGreaterThanOrEqual(4);
 const shots=e.shots;step(e,600);expect(e.shots).toBe(shots);
 e.reset([{specId:ship.spec.id,count:1},{specId:target.spec.id,count:1}],[ship.spec,target.spec],42);e.asteroids=[];e.start();expect(e.ships[0].weaponCycles).toBeUndefined();
});
test('stock cached geometry upgrades bow and belly positions while custom calibration stays intact',()=>{
 const base=manifest.assets.find(a=>a.shipId==='perseus') as ShipAsset,old={...base,combatVersion:5,turretLayoutVersion:1,mounts:base.mounts.map(m=>({...m,x:.27,y:.19,barrels:undefined,impact:undefined}))};
 const upgraded=upgradeCombat(old,base);expect(upgraded.mounts.filter(m=>m.kind==='turret')).toEqual(base.mounts.filter(m=>m.kind==='turret'));expect(upgraded.mounts.find(m=>m.kind!=='turret')!.x).toBe(base.mounts.find(m=>m.kind!=='turret')!.x);
 const custom=upgradeCombat({...old,calibrated:true},base);expect(custom.mounts.every(m=>m.x===.27&&m.y===.19)).toBe(true);
 expect(upgradeCombat(upgradeCombat(old,base),base)).toEqual(upgradeCombat(old,base));
});
test('the weapon-only reference is pinned to one matching version and invalid barrel/ammo groups are rejected',()=>{
 expect(reference.gameVersion).toBe('4.10.2-LIVE.12913470');const base=manifest.assets.find(a=>a.shipId==='polaris') as ShipAsset,ids=new Set(data.map(s=>s.id));
 for(const patch of [{ammo:-1},{ammo:1.5},{launcherCount:0},{barrels:100},{impact:'unknown'},{barrelSpacing:Infinity},{cooldownJitter:1}])expect(()=>validateAsset({...base,mounts:[{...base.mounts[0],...patch}]},ids)).toThrow();
});
