import {expect,test} from 'vitest';
import ships from '../src/data/ships.json';
import data from '../src/data/fleet-weapon-loadouts.json';
import weapons from '../src/data/weapon-catalog.json';
import gameValues from '../src/data/weapon-game-values.json';
import {BattleEngine} from '../src/sim/engine';
import {isMemberShip} from '../src/sim/members';
import {weaponDps} from '../src/sim/weapons';
import {validateAsset,type ShipAsset} from '../src/assets/library';
import manifest from '../public/assets/ships/manifest.json';
import type {ShipSpec,Mount} from '../src/sim/types';
import {WeaponCollisionGrid} from '../src/sim/weapon-collision-grid';
import {hullIntersection,randomGenerator} from '../src/sim/math';
const specs=ships as ShipSpec[],loadouts=data.ships as Record<string,{status:string;systems:{weaponId:string;count:number}[];variantOf?:string}>;

test('every ship has an explicit matching-version weapon source or declared fallback',()=>{
 expect(data.gameVersion).toBe(weapons.gameVersion);expect(Object.keys(loadouts)).toHaveLength(224);
 expect(Object.values(loadouts).filter(s=>s.status==='snapshot')).toHaveLength(189);
 expect(Object.values(loadouts).filter(s=>s.status==='reference')).toHaveLength(25);
 expect(Object.values(loadouts).filter(s=>s.status==='fallback')).toHaveLength(4);
 expect(Object.values(loadouts).filter(s=>s.status==='unarmed')).toHaveLength(6);
});
test('all snapshot guns and finite ordnance match exact source quantities, not the number of launchers',()=>{
 for(const s of specs){
  const loadout=loadouts[s.id];if(!['snapshot','reference'].includes(loadout.status))continue;
  for(const system of loadout.systems){
   const mounts=s.mounts.filter(m=>m.weaponId===system.weaponId),weapon=(weapons.weapons as Record<string,{category:string}>)[system.weaponId];
   expect(mounts.length,`${s.id} ${system.weaponId}`).toBeGreaterThan(0);
   expect(mounts.reduce((n,m)=>n+(weapon.category==='ordnance'?(m.ammo??0):(m.weaponCount??m.barrels??1)),0),`${s.id} ${system.weaponId}`).toBe(s.id==='perseus'&&system.weaponId==='s3-mantis-gt-220-gatling'?2:system.count);
  }
 }
});
test('known unarmed ships stay in the original library and are excluded from combat draws',()=>{
 const unarmed=specs.filter(s=>loadouts[s.id].status==='unarmed');expect(unarmed).toHaveLength(6);
 for(const s of unarmed){expect(s.mounts).toHaveLength(0);expect(isMemberShip(s)).toBe(false);const a=manifest.assets.find(a=>a.shipId===s.id) as ShipAsset;expect(()=>validateAsset(a,new Set(specs.map(s=>s.id)))).not.toThrow();}
 expect(specs.filter(isMemberShip)).toHaveLength(210);
});
test('every installed ordinary barrel uses the shared model damage and cadence without ship-DPS normalisation or count compression',()=>{
 const values=gameValues.weapons as Record<string,{combat:{damage?:number;cooldown:number}}>;
 for(const s of specs){
  if(!['snapshot','reference'].includes(loadouts[s.id].status))continue;
  const protectedIds=new Set(s.id==='eclipse'?[]:s.mounts.filter(m=>m.kind==='beam'||m.kind==='railgun'||m.impact==='heavy-cannon'||m.id==='sf7b-gatling').map(m=>m.id));
  const guns=s.mounts.filter(m=>!['missile','torpedo'].includes(m.kind)&&!m.interceptsOnly&&!m.estimatedFrom&&!protectedIds.has(m.id));
  for(const m of guns){expect(m.damage,`${s.id} ${m.weaponId}`).toBeCloseTo(values[m.weaponId!].combat.damage!,5);expect(m.cooldown).toBeCloseTo(values[m.weaponId!].combat.cooldown,5);expect(m.barrels??1).toBe(m.weaponCount??1);expect(weaponDps({...m,weaponCount:200})).toBe(weaponDps(m));}
 }
});
test('paint variants share weapon identities and quantities, while Hammerhead has six turrets firing 24 individual S4 rounds',()=>{
 for(const record of Object.values(loadouts))if(record.variantOf)expect(record.systems).toEqual(loadouts[record.variantOf].systems);
 const guns=specs.find(s=>s.id==='hammerhead')!.mounts.filter(m=>m.kind==='turret');expect(guns).toHaveLength(6);expect(guns.every(m=>m.barrels===4)).toBe(true);expect(guns.reduce((n,m)=>n+(m.weaponCount??m.barrels??1),0)).toBe(24);
});
test('forward pilot guns remain distinct from Hurricane and Scorpius turret batteries',()=>{
 for(const [id,forward,turret] of [['hurricane',2,4],['scorpius',4,4],['constellation-andromeda',4,4]] as const){
  const mounts=specs.find(s=>s.id===id)!.mounts.filter(m=>m.kind!=='missile'&&m.kind!=='torpedo');
  expect(mounts.filter(m=>m.kind!=='turret').reduce((n,m)=>n+(m.weaponCount??m.barrels??1),0),id).toBe(forward);
  expect(mounts.filter(m=>m.kind==='turret').reduce((n,m)=>n+(m.weaponCount??m.barrels??1),0),id).toBe(turret);
 }
});
function gunFixture(mount:Mount,shield=0){
 const attacker={...structuredClone(specs.find(s=>s.id==='arrow')!),mounts:[mount],speed:0,acceleration:0,turnRate:0,shieldRegen:0};
 const target={...structuredClone(attacker),id:'target',mounts:[],hull:1e7,shield,shieldRegen:0,armorPhysicalMultiplier:1,armorEnergyMultiplier:1};
 const e=new BattleEngine();e.reset([{specId:attacker.id,count:1},{specId:'target',count:1}],[attacker,target],10);e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i*600;s.y=0;s.heading=0;s.cooldowns.fill(0);s.turretAngles.fill(0);});e.start();return e;
}
test('scatter pellets have separate angles but share one trigger damage budget',()=>{
 const original=specs.flatMap(s=>s.mounts).find(m=>m.pellets===3)!;expect(original).toBeDefined();
 const m={...original,kind:'laser' as const,x:0,y:0,barrels:1,cooldown:100,damage:900};const e=gunFixture(m);e.step();
 expect(e.projectiles).toHaveLength(3);expect(new Set(e.projectiles.map(p=>p.angle)).size).toBe(3);expect(e.projectiles.reduce((n,p)=>n+p.damage,0)).toBe(900);expect(weaponDps(m)).toBe(9);
});
test('distortion weapons strip shields without inventing hull damage in reference mode',()=>{
 const original=specs.flatMap(s=>s.mounts).find(m=>m.damageType==='distortion')!;const m={...original,kind:'laser' as const,x:0,y:0,facing:0,barrels:1,cooldown:100,damage:1000};
 const bare=gunFixture(m),shielded=gunFixture(m,10000);for(let i=0;i<100;i++){bare.step();shielded.step();}
 expect(bare.hits).toBe(1);expect(1e7-bare.ships[1].hull).toBe(0);expect(shielded.ships[1].hull).toBe(1e7);expect(10000-shielded.ships[1].shield).toBeCloseTo(1000);
});
test('the projectile broad phase retains the same closest hull impact as a full scan',()=>{
 const e=new BattleEngine();e.reset(specs.slice(0,40).map(s=>({specId:s.id,count:1})),specs,109);const random=randomGenerator(991),dt=1/60;
 e.ships.forEach(s=>{s.vx=(random()-.5)*800;s.vy=(random()-.5)*800;});const grid=new WeaponCollisionGrid(e.ships,dt);
 for(const ship of e.ships){
  const from={x:ship.x-400,y:ship.y-20},to={x:ship.x+400,y:ship.y+20};
  const nearest=(candidates:Iterable<typeof ship>)=>{let id=0,impact=Infinity;for(const s of candidates){const hit=hullIntersection({x:from.x+s.vx*dt,y:from.y+s.vy*dt},to,s);if(hit!==null&&(hit<impact||hit===impact&&s.id<id)){id=s.id;impact=hit;}}return {id,impact};};
  expect(nearest(grid.query(from,to))).toEqual(nearest(e.ships));
 }
});
test('missile-only Fury MX has replenishable magazines and cannot become permanently unarmed',()=>{
 const source=specs.find(s=>s.id==='fury-mx')!;expect(source.mounts.every(m=>m.ammoReload!==undefined)).toBe(true);
 const m={...source.mounts[0],x:0,y:0,facing:0,charge:0,ammo:2,ammoReload:.1,cooldown:.05};const e=gunFixture(m);
 for(let n=0;n<150;n++)e.step();expect(e.shots).toBeGreaterThan(2);expect(e.ships[0].weaponCycles![0].ammoLeft).toBeGreaterThanOrEqual(0);
 e.pause();const before=JSON.stringify(e.ships[0].weaponCycles);for(let n=0;n<60;n++)e.step();expect(JSON.stringify(e.ships[0].weaponCycles)).toBe(before);
});
