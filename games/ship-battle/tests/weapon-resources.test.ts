import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import catalog from '../src/data/weapon-catalog.json';
import {BattleEngine} from '../src/sim/engine';
import {simulationSeconds} from '../src/sim/pacing';
import {weaponDetails} from '../src/ui/Inspector';
import type {Mount,ShipSpec,WeaponKind} from '../src/sim/types';
const ships=data as ShipSpec[],find=(id:string)=>ships.find(s=>s.id===id)!;
function fixture(guns:Mount[]){
 const source={...structuredClone(find('constellation-taurus')),mounts:structuredClone(guns)},target={...structuredClone(find('arrow')),id:'target',mounts:[],hull:1e9,shield:0,armorPhysicalMultiplier:1,armorEnergyMultiplier:1};
 const e=new BattleEngine();e.reset([{specId:source.id,count:1},{specId:'target',count:1}],[source,target].map(s=>({...s,speed:0,acceleration:0,turnRate:0,shieldRegen:0})),31);e.asteroids=[];e.ships.forEach((s,i)=>{s.x=i*1000;s.y=0;s.heading=0;s.cooldowns.fill(0);s.turretAngles.fill(0);});e.start();return e;
}
const steps=(e:BattleEngine,seconds:number)=>{for(let i=0;i<Math.round(simulationSeconds(seconds)*60);i++)e.step();};
test('source ammunition is installed per barrel, with CF-557 energy distinct from finite kinetic cannon and Idris-M railgun ammo',()=>{
 const taurus=find('constellation-taurus'),cf=taurus.mounts.filter(m=>m.weaponSize===5);expect(cf).toHaveLength(4);expect(cf.every(m=>m.capacitor===75&&m.ammo===undefined)).toBe(true);
 expect(catalog.weapons['s5-cf-557-galdereen-repeater'].ammoCapacity).toBe(75);
 for(const m of find('perseus').mounts.filter(m=>m.weaponSize===8)){expect(m.ammo).toBe(900*2);expect(m.capacitor).toBeUndefined();}
 const rail=find('idris-m').mounts.find(m=>m.kind==='railgun')!;expect(rail.ammo).toBe(1500);expect(rail.capacitor).toBeUndefined();
 for(const s of ships)for(const m of s.mounts)if(!m.interceptsOnly&&!['beam','missile','torpedo'].includes(m.kind)){expect(!!m.ammo!==!!m.capacitor).toBe(true);expect(m.ammo??m.capacitor).toBeGreaterThan(0);}
});
test('Taurus keeps source 750 RPM during a charged burst, then stops and resumes automatically instead of firing forever or stuttering',()=>{
 const e=fixture(find('constellation-taurus').mounts.filter(m=>m.weaponSize===5)),s=e.ships[0];steps(e,1);expect(e.shots).toBe(52);steps(e,5);expect(e.shots).toBe(300);
 expect(s.weaponCycles!.every(c=>c.energyLocked)).toBe(true);const shots=e.shots;steps(e,1);expect(e.shots).toBe(shots);steps(e,1);expect(e.shots).toBeGreaterThan(shots);
 expect(s.spec.mounts.every(m=>m.damage===98.2&&m.cooldown===.106667)).toBe(true);expect(weaponDetails(s).every(r=>!r.text.includes('余弹'))).toBe(true);
});
test('no target and challenge intermission recharge; paused time freezes resources, and resetting restores all ammunition',()=>{
 const e=fixture(find('constellation-taurus').mounts.filter(m=>m.weaponSize===5)),s=e.ships[0];steps(e,6);const before=JSON.stringify(s.weaponCycles);e.pause();steps(e,5);expect(JSON.stringify(s.weaponCycles)).toBe(before);e.pause();e.nextWaveIn=simulationSeconds(10);steps(e,3);expect(s.weaponCycles!.every((c,i)=>c.energyLeft===s.spec.mounts[i].capacitor&&!c.energyLocked)).toBe(true);
 const fresh=fixture(find('constellation-taurus').mounts.filter(m=>m.weaponSize===5));fresh.ships[1].x=100000;steps(fresh,3);expect(fresh.ships[0].weaponCycles!.every((c,i)=>c.energyLeft===fresh.ships[0].spec.mounts[i].capacitor)).toBe(true);
 const m={...find('perseus').mounts.find(m=>m.weaponSize===8)!,ammo:5,barrels:2,x:0,y:0,cooldown:.1},gun=fixture([m]);steps(gun,2);expect(gun.shots).toBe(5);expect(gun.ships[0].weaponCycles![0].ammoLeft).toBe(0);expect(weaponDetails(gun.ships[0])[0].text).toContain('2门 · 余弹0发');
 gun.reset([{specId:gun.ships[0].spec.id,count:1},{specId:'target',count:1}],gun.ships.map(s=>s.spec),31);expect(weaponDetails(gun.ships[0])[0].text).toContain('余弹5发');
});
test.each(['ballistic','railgun'] as WeaponKind[])('%s bypasses 75 percent of shield before armor, without changing the source projectile damage',kind=>{
 const e=fixture([]),target=e.ships[1];target.spec={...target.spec,shield:1000,armorPhysicalMultiplier:.8};target.shield=1000;target.hull=10000;
 e.projectiles=[{id:99,owner:1,target:2,kind,x:target.x,y:target.y,vx:1,vy:0,angle:0,speed:1,damage:100,ttl:1,travel:0,range:10,color:0}];e.step();expect(target.shield).toBe(975);expect(target.hull).toBe(9940);
 target.shield=10;e.projectiles=[{id:100,owner:1,target:2,kind,x:target.x,y:target.y,vx:1,vy:0,angle:0,speed:1,damage:100,ttl:1,travel:0,range:10,color:0}];e.step();expect(target.shield).toBe(0);expect(target.hull).toBe(9868);
});
test.each(['laser','missile','torpedo'] as WeaponKind[])('%s does not inherit kinetic gun shield bypass',kind=>{
 const e=fixture([]),t=e.ships[1];t.spec={...t.spec,shield:1000};t.shield=1000;t.hull=10000;e.projectiles=[{id:99,owner:1,target:2,kind,x:t.x,y:t.y,vx:1,vy:0,angle:0,speed:1,damage:100,ttl:1,travel:0,range:10,color:0}];e.step();expect(t.shield).toBe(900);expect(t.hull).toBe(10000);
});
test('members and bosses use the same kinetic bypass; all-empty PVP draws only after projectiles are resolved',()=>{
 const m={...find('perseus').mounts.find(m=>m.weaponSize===8)!,ammo:1,barrels:1,x:0,y:0,cooldown:100},e=fixture([m]),s=e.ships[0];s.npc='boss';e.ships[1].shield=100000;steps(e,1);expect(e.shots).toBe(1);expect(e.ships[1].hull).toBe(e.ships[1].spec.hull);expect(e.phase).toBe('running');steps(e,2);expect(e.ships[1].hull).toBeLessThan(e.ships[1].spec.hull);expect(e.phase).toBe('finished');expect(e.outcome).toBe('draw');expect(e.snapshot().winner).toBeNull();
});
