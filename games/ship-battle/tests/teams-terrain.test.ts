import fs from 'node:fs';
import crypto from 'node:crypto';
import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import {battleRoster} from '../src/sim/members';
import type {ShipSpec} from '../src/sim/types';
const specs=data as ShipSpec[];
test('teams deploy on opposite sides and settle only after the enemy team is eliminated',()=>{
 const e=new BattleEngine();e.reset(battleRoster([{specId:'gladius',count:1},{specId:'arrow',count:1},{specId:'f8c-lightning',count:1},{specId:'sabre',count:1}],'teams',21),specs,21,'teams');
 expect(e.ships.filter(s=>s.team==='red').every(s=>s.x<0)).toBe(true);expect(e.ships.filter(s=>s.team==='blue').every(s=>s.x>0)).toBe(true);e.start();
 for(let i=0;i<1200*60&&e.phase==='running';i++)e.step();expect(e.phase).toBe('finished');expect(['red','blue']).toContain(e.outcome);expect(new Set(e.living.map(s=>s.team)).size).toBe(1);expect(e.snapshot().winner).toBeNull();
 for(const k of e.killLog){if(!k.killerId||k.friendly)continue;expect(e.ships.find(s=>s.id===k.killerId)?.team).not.toBe(e.ships.find(s=>s.id===k.victimId)?.team);}
},30000);
test('terrain contains clearly different sizes, is seeded and starts clear of ships',()=>{
 const e=new BattleEngine(),rows=[{specId:'gladius',count:10}];e.reset(rows,specs,21);const first=JSON.stringify(e.asteroids);expect(e.asteroids.some(r=>r.radius>100)).toBe(true);expect(e.asteroids.some(r=>r.radius<35)).toBe(true);for(const r of e.asteroids)for(const s of e.ships)expect(Math.hypot(r.x-s.x,r.y-s.y)).toBeGreaterThan(r.radius+s.radius+100);e.reset(rows,specs,21);expect(JSON.stringify(e.asteroids)).toBe(first);
});
test('a fast small ship explodes on impact while a slowly moving capital takes limited damage',()=>{
 for(const [id,speed,fatal] of [['arrow',400,true],['javelin',20,false]] as const){const e=new BattleEngine();e.reset([{specId:id,count:1},{specId:'gladius',count:1}],specs,21);const s=e.ships[0];e.ships[1].x=5000;e.ships[1].y=5000;e.asteroids=[{id:1,x:0,y:0,radius:60,rotation:0}];s.x=-(60+s.spec.length*.48)+1;s.y=0;s.heading=0;s.vx=speed;s.vy=0;e.start();const hp=s.hull+s.shield;e.step();expect(s.alive).toBe(!fatal);if(fatal)expect(s.hull+s.shield).toBeLessThan(hp);else expect(s.hull+s.shield).toBe(hp);if(fatal){expect(e.collisionDeaths).toBe(1);expect(e.snapshot().recentKills[0].killerName).toBe('陨石撞击');expect(e.snapshot().recentKills[0].cause).toBe('asteroid');expect(e.ships.reduce((n,s)=>n+s.kills,0)).toBe(0);}else expect(s.hull+s.shield).toBeGreaterThan(hp*.9);}
});

test('the environment uses the verified single transparent asteroid PNG rather than a composite field',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../public/assets/environment/manifest.json',import.meta.url),'utf8'));
 const a=manifest.assets[0],raw=fs.readFileSync(new URL('../public/assets/environment/'+a.file,import.meta.url));expect(crypto.createHash('sha256').update(raw).digest('hex')).toBe(a.sha256);expect(raw.readUInt32BE(16)).toBe(a.width);expect(raw.readUInt32BE(20)).toBe(a.height);expect(raw[25]).toBe(6);expect(a.id).toBe('asteroid');
});

test('rock intersections stop a crossing projectile while open space still permits a real hull hit',()=>{
 const e=new BattleEngine();e.reset([{specId:'gladius',count:2}],specs,21);const [a,b]=e.ships;e.ships.forEach((s,i)=>{s.x=i?300:-300;s.y=0;s.heading=i?Math.PI:0;s.cooldowns=s.cooldowns.map(()=>1000);});e.asteroids=[{id:1,x:0,y:0,radius:100,rotation:0}];e.start();
 const shot={id:999,owner:a.id,target:b.id,kind:'laser' as const,x:-120,y:0,vx:1250,vy:0,angle:0,speed:1250,damage:100,ttl:1,travel:0,range:1000,color:0xffffff};const before=b.shield;e.projectiles=[{...shot}];e.step();expect(e.projectiles).toHaveLength(0);expect(b.shield).toBe(before);
 e.asteroids=[];e.projectiles=[{...shot,x:280}];e.step();expect(b.shield).toBeLessThan(before);expect(e.hits).toBeGreaterThan(0);
});

test('20 rocks spread over the expanded field with fewer central rocks and larger clear gaps',()=>{
 for(const count of[2,10,32,100])for(const seed of[1,21,42,77]){
  const e=new BattleEngine();e.reset([{specId:'gladius',count}],specs,seed);const rocks=e.asteroids;expect(rocks.length,`${count} ships / seed ${seed}`).toBe(20);
  const bands=[0,0,0],quadrants=new Set<number>();
  for(const r of rocks){const radius=Math.hypot(r.x,r.y)/e.arena;bands[radius<.55?0:radius<.95?1:2]++;quadrants.add((r.x<0?1:0)+(r.y<0?2:0));expect(radius).toBeLessThan(1.36);for(const s of e.ships)expect(Math.hypot(r.x-s.x,r.y-s.y)).toBeGreaterThan(s.radius+r.radius+149);}
  expect(bands).toEqual([4,8,8]);expect(quadrants.size).toBe(4);
  for(let i=0;i<rocks.length;i++)for(let j=i+1;j<rocks.length;j++)expect(Math.hypot(rocks[i].x-rocks[j].x,rocks[i].y-rocks[j].y)).toBeGreaterThan(rocks[i].radius+rocks[j].radius+Math.max(210,e.arena*.055)-1);
 }
});
