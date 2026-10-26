import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import catalog from '../src/data/weapon-catalog.json';
import loadouts from '../src/data/fleet-weapon-loadouts.json';
import {BattleEngine} from '../src/sim/engine';
import {weaponDps} from '../src/sim/weapons';
import {weaponDetails} from '../src/ui/Inspector';
import type {ShipSpec,Projectile} from '../src/sim/types';
const specs=data as ShipSpec[];
function fixture(){
 const defender=structuredClone(specs.find(s=>s.id==='polaris')!),enemy=structuredClone(specs.find(s=>s.id==='hammerhead')!);
 defender.mounts=defender.mounts.filter(m=>m.interceptsOnly).map(m=>({...m,x:0,y:0,facing:0}));enemy.mounts=[];
 for(const s of [defender,enemy]){s.speed=s.acceleration=s.turnRate=s.shieldRegen=0;}
 const e=new BattleEngine();e.reset([{specId:defender.id,count:1,team:'blue'},{specId:enemy.id,count:1,team:'red'}],[defender,enemy],11,'teams');e.asteroids=[];
 e.ships.forEach((s,i)=>{s.x=i*1500;s.y=0;s.heading=0;s.cooldowns.fill(0);s.turretAngles.fill(0);});e.start();return e;
}
function missile(e:BattleEngine,patch:Partial<Projectile>={}){
 const p:Projectile={id:10001,owner:e.ships[1].id,target:e.ships[0].id,kind:'missile',x:400,y:0,vx:-260,vy:0,angle:Math.PI,speed:260,damage:1000,ttl:10,travel:0,range:2600,color:0xffcc88,...patch};e.projectiles.push(p);return p;
}
const step=(e:BattleEngine,n:number)=>{for(let i=0;i<n;i++)e.step();};
test('actual M2C defense banks deal no ship damage, contribute no DPS and stay out of the offensive panel',()=>{
 const e=fixture(),hull=e.ships[1].hull,shield=e.ships[1].shield;step(e,300);
 expect(e.ships[0].spec.mounts.length).toBeLessThanOrEqual(2);expect(e.ships[0].spec.mounts.reduce((n,m)=>n+weaponDps(m),0)).toBe(0);
 expect(e.shots).toBe(0);expect(e.hits).toBe(0);expect(e.ships[1].hull).toBe(hull);expect(e.ships[1].shield).toBe(shield);
 expect(weaponDetails(e.ships[0])).toHaveLength(0);
});
test('point defense geometrically intercepts hostile incoming missiles without ship hit or kill credit',()=>{
 const e=fixture(),before=e.ships[0].hull+e.ships[0].shield;missile(e);step(e,120);
 expect(e.interceptions).toBe(1);expect(e.defenseShots).toBeGreaterThan(0);expect(e.shots).toBe(0);expect(e.hits).toBe(0);expect(e.killLog).toHaveLength(0);expect(e.ships[0].hull+e.ships[0].shield).toBe(before);expect(e.events.some(ev=>ev.kind==='intercept')).toBe(true);
});
test('defense must rotate onto a target and ignores allied missiles and ordinary cannon shells',()=>{
 const e=fixture();missile(e,{x:0,y:400,vx:0,vy:-260,angle:-Math.PI/2});e.step();expect(e.defenseShots).toBe(0);step(e,100);expect(e.interceptions).toBe(1);
 const friendly=fixture();missile(friendly,{owner:friendly.ships[0].id});step(friendly,40);expect(friendly.defenseShots).toBe(0);
 const shell=fixture();missile(shell,{kind:'ballistic'});step(shell,40);expect(shell.defenseShots).toBe(0);
});
test('heavy torpedoes require multiple aligned interception hits; pause and reset freeze or clear defense state',()=>{
 const e=fixture(),p=missile(e,{kind:'torpedo',impact:'heavy-torpedo',speed:270,vx:-270});e.step();
 expect(e.interceptions).toBe(0);expect(p.integrity).toBeGreaterThan(0);expect(p.integrity).toBeLessThan(6);
 e.pause();const before=JSON.stringify({time:e.time,cycles:e.ships[0].weaponCycles,projectiles:e.projectiles,defense:e.defenseShots});step(e,60);expect(JSON.stringify({time:e.time,cycles:e.ships[0].weaponCycles,projectiles:e.projectiles,defense:e.defenseShots})).toBe(before);
 e.reset([{specId:'polaris',count:1},{specId:'hammerhead',count:1}],specs);expect(e.defenseShots).toBe(0);expect(e.interceptions).toBe(0);expect(e.projectiles).toHaveLength(0);
});
test('Hammerhead batteries remain real offensive guns and the import contains weapon-card rows only',()=>{
 const ship=specs.find(s=>s.id==='hammerhead')!;expect(ship.mounts.filter(m=>m.kind==='turret')).toHaveLength(6);expect(ship.mounts.some(m=>m.interceptsOnly)).toBe(false);expect(ship.mounts.reduce((n,m)=>n+weaponDps(m),0)).toBeGreaterThan(1000);
 expect(Object.values(catalog.weapons).every(w=>!['地面导弹','炸弹'].includes(w.type))).toBe(true);
 expect(Object.values(loadouts.ships).every(s=>!('unsupported' in s)&&!('body' in s)&&!('specs' in s))).toBe(true);
});
