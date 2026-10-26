import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import catalog from '../src/data/weapon-catalog.json';
import facts from '../src/data/ship-reference-facts.json';
import stations from '../src/data/weapon-stations.json';
import {BattleEngine} from '../src/sim/engine';
import {wrap} from '../src/sim/math';
import {upgradeCombat,type ShipAsset} from '../src/assets/library';
import manifest from '../public/assets/ships/manifest.json';
import type {ShipSpec,Mount} from '../src/sim/types';
const ships=data as ShipSpec[],find=(id:string)=>ships.find(s=>s.id===id)!;
const count=(id:string,control:string)=>find(id).mounts.filter(m=>!m.interceptsOnly&&m.fireControl===control).reduce((n,m)=>n+(m.barrels??1),0);
test('installation records split real pilot, manned and remote stations without a ship-length heuristic',()=>{
 expect(count('vanguard-warden','pilot')).toBe(5);expect(count('vanguard-warden','manned')).toBe(2);
 expect(count('eclipse','pilot')).toBe(2);expect(count('eclipse','manned')).toBe(0);
 expect(count('scorpius','pilot')).toBe(4);expect(count('scorpius','remote')).toBe(4);
 expect(count('f8c-lightning','pilot')).toBe(8);expect(count('f8c-lightning','manned')).toBe(0);
 for(const ship of ships)for(const m of ship.mounts)if(m.fireControl==='pilot'){expect(m.kind).not.toBe('turret');expect(m.facing).toBe(0);}
 for(const ship of ships)for(const m of ship.mounts)if(m.kind==='turret'&&!m.interceptsOnly){expect(m.turnRate).toBeLessThanOrEqual(.65);expect(m.turnRate).toBeGreaterThan(0);}
});
test('Perseus final fitting activates only two forward pilot S3 and two independent twin-S8 turrets',()=>{
 const s=find('perseus'),s3=s.mounts.filter(m=>m.weaponSize===3),s8=s.mounts.filter(m=>m.weaponSize===8);
 expect(s3.reduce((n,m)=>n+(m.barrels??1),0)).toBe(2);expect(s3.every(m=>m.fireControl==='pilot'&&m.kind==='ballistic'&&m.facing===0&&m.y<0)).toBe(true);
 expect(s8.reduce((n,m)=>n+(m.barrels??1),0)).toBe(4);
 expect(s8).toHaveLength(2);expect(s8.every(m=>m.fireControl==='manned'&&m.barrels===2)).toBe(true);
 expect(stations.ships.perseus.systems['s3-mantis-gt-220-gatling'].stations.reduce((n,s)=>n+s.count,0)).toBe(8);
});
test('Perseus pilot S3 cannot shoot behind or sideways; cached four-S3 fittings upgrade to two forward guns',()=>{
 const m=find('perseus').mounts.find(m=>m.weaponSize===3)!,e=fixture(m);
 e.ships[1].x=0;e.ships[1].y=600;for(let i=0;i<120;i++)e.step();expect(e.shots).toBe(0);
 e.ships[1].x=-600;e.ships[1].y=0;for(let i=0;i<60;i++)e.step();expect(e.shots).toBe(0);
 e.ships[1].x=600;e.step();expect(e.shots).toBeGreaterThan(0);expect(e.projectiles.every(p=>p.vx>0&&Math.abs(p.angle)<.1)).toBe(true);
 const builtin=manifest.assets.find(s=>s.shipId==='perseus') as ShipAsset;
 expect(builtin.combatVersion).toBe(18);
 const old={...structuredClone(builtin),combatVersion:17,mounts:[...builtin.mounts,{...m,id:'obsolete-s3',fireControl:'remote' as const,kind:'turret' as const}]};
 const next=upgradeCombat(old,builtin);expect(next.mounts.filter(m=>m.weaponSize===3).reduce((n,m)=>n+(m.barrels??1),0)).toBe(2);expect(next.mounts.filter(m=>m.weaponSize===3).every(m=>m.fireControl==='pilot')).toBe(true);
});
test('known hulls, SCM and weapon damage/RPM are source values, including heavy primaries and bosses',()=>{
 const records=facts.ships as Record<string,{facts:Record<string,number>}>;
 const weapons=catalog.weapons as Record<string,{damage:number|null;rpm?:number|null;speed:number;dps?:number|null;referenceOnly?:boolean}>;
 for(const ship of ships){const f=records[ship.id].facts;if(f.hullTotal)expect(ship.hull).toBe(Math.round(f.hullTotal));if(f.scm)expect(ship.speed/.75).toBeCloseTo(f.scm,4);
  for(const m of ship.mounts){const w=weapons[m.weaponId??''];if(!w||w.referenceOnly||m.interceptsOnly)continue;
   if(w.damage)expect(m.damage).toBe(w.damage);
   if(w.rpm&&m.kind!=='beam')expect((m.cooldown+(m.charge??0))*.75).toBeCloseTo(60/w.rpm,5);
   if(m.kind==='beam'&&w.dps)expect(m.damage/.75).toBe(w.dps);
  }
 }
});
function fixture(m:Mount){
 const a={...structuredClone(find('vanguard-warden')),mounts:[{...m,x:0,y:0,barrels:1}],speed:0,turnRate:0,acceleration:0,shieldRegen:0};
 const b={...a,id:'target',mounts:[],hull:1e9,shield:0,armorPhysicalMultiplier:1,armorEnergyMultiplier:1};
 const e=new BattleEngine();e.reset([{specId:a.id,count:1},{specId:b.id,count:1}],[a,b],31);e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i*600;s.y=0;s.heading=0;s.cooldowns.fill(0);s.turretAngles.fill(0);});e.start();return e;
}
test('pilot guns cannot fire behind their hull and launched cannon shells never home after passing a target',()=>{
 const m=find('vanguard-warden').mounts.find(m=>m.fireControl==='pilot')!,e=fixture(m);e.ships[1].x=-600;
 for(let i=0;i<120;i++)e.step();expect(e.shots).toBe(0);
 e.ships[1].x=600;e.step();expect(e.shots).toBeGreaterThan(0);const p=e.projectiles[0],angle=p.angle;e.ships[1].y=200;e.step();expect(p.angle).toBe(angle);expect(p.vx).toBeCloseTo(Math.cos(angle)*p.speed);
});
test('turret world traverse stays bounded when the hull rotates beneath it',()=>{
 const m=find('scorpius').mounts.find(m=>m.fireControl==='remote')!,e=fixture(m),a=e.ships[0];
 a.spec.turnRate=2;a.heading=-Math.PI/2;e.ships[1].y=300;
 let previous=wrap(a.heading+a.turretAngles[0]);
 for(let i=0;i<120;i++){e.step();const next=wrap(a.heading+a.turretAngles[0]);expect(Math.abs(wrap(next-previous))).toBeLessThanOrEqual(m.turnRate/60+1e-8);previous=next;}
 expect(Math.abs(wrap(a.heading+a.turretAngles[0]-Math.atan2(300,600)))).toBeGreaterThan(.05);
});
test('750 RPM is preserved within a charged burst across fractional fixed-step intervals',()=>{
 const m=find('scorpius').mounts.find(m=>m.fireControl==='pilot')!,e=fixture(m);
 for(let i=0;i<320;i++)e.step();expect(Math.abs(e.shots-50)).toBeLessThanOrEqual(1); // Four real seconds before capacitor depletion, source CF-337 is 750 RPM.
});
test('NPC encounters apply no extra health or weapon multiplier in reference mode',()=>{
 for(const count of [2,32,64]){const e=new BattleEngine();e.reset([{specId:'gladius',count},{specId:'mauler',count:1,npc:'boss'}],ships,31,'challenge');e.start();const boss=e.snapshot().boss!;
 expect(boss.spec.hull).toBe(find('mauler').hull);expect(boss.spec.shield).toBe(find('mauler').shield);expect(boss.spec.mounts).toEqual(find('mauler').mounts);}
});
test('old cached all-direction mounts upgrade to forward fire while manual coordinates remain intact',()=>{
 const builtin=manifest.assets.find(s=>s.shipId==='vanguard-warden') as ShipAsset,old={...structuredClone(builtin),combatVersion:14,calibrated:true,mounts:builtin.mounts.map(m=>({...m,x:.1,facing:90,arc:360}))};
 const next=upgradeCombat(old,builtin);expect(next.mounts.every(m=>m.x===.1)).toBe(true);for(const m of next.mounts)if(m.fireControl==='pilot')expect(m.facing).toBe(0);
});
