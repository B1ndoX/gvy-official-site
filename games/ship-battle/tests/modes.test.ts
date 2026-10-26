import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import people from '../src/data/members.json';
import {BattleEngine} from '../src/sim/engine';
import {battleRoster,BOSS_IDS} from '../src/sim/members';
import type {ShipSpec,Ship,RosterEntry,BattleMode} from '../src/sim/types';
const specs=data as ShipSpec[],rows:RosterEntry[]=people.members.slice(0,10).map(member=>({specId:'gladius',count:1,member}));
function setup(mode:BattleMode){const e=new BattleEngine();e.reset(battleRoster(rows,mode,21),specs,21,mode);return e;}
function lethal(e:BattleEngine,victim:Ship,owner:number,weaken=true){if(weaken){victim.hull=1;victim.shield=0;}e.projectiles.push({id:99999,owner,target:victim.id,kind:'laser',x:victim.x,y:victim.y,vx:1250,vy:0,angle:0,speed:1250,damage:10000000,ttl:1,travel:0,range:1000,color:0xffffff});e.step();}
test('enemies wait until start, enter inward from independent random perimeter positions at original size',()=>{
  const quadrants=new Set<number>();
  for(let seed=1;seed<=24;seed++){
    const e=new BattleEngine();e.reset(battleRoster(rows,'bounty',seed),specs,seed,'bounty');
    expect(e.ships).toHaveLength(10);expect(e.snapshot().boss).toBeNull();
    const cx=e.ships.reduce((n,s)=>n+s.x,0)/10,cy=e.ships.reduce((n,s)=>n+s.y,0)/10,field=Math.max(600,...e.ships.map(s=>Math.hypot(s.x-cx,s.y-cy)+s.radius));
    e.start();const boss=e.snapshot().boss!,distance=Math.hypot(boss.x-cx,boss.y-cy);
    expect(distance).toBeGreaterThan(field+boss.radius);expect(boss.vx*(cx-boss.x)+boss.vy*(cy-boss.y)).toBeGreaterThan(0);expect(boss.spec.length).toBe(specs.find(s=>s.id===boss.spec.id)!.length);expect(e.snapshot().escortsAlive).toBe(0);
    quadrants.add((boss.x>cx?1:0)+(boss.y>cy?2:0));
    if(seed===1){for(let i=0;i<550;i++)e.step();const escorts=e.ships.filter(s=>s.npc==='escort');expect(escorts).toHaveLength(20);expect(new Set(escorts.map(s=>(s.x>cx?1:0)+(s.y>cy?2:0))).size).toBeGreaterThan(1);expect(escorts.every(s=>Number.isFinite(s.x+s.y))).toBe(true);}
  }expect(quadrants.size).toBe(4);
});
test('bounty members never target or damage one another; boss kill wins immediately even with live escorts',()=>{const e=setup('bounty');e.start();for(let i=0;i<240;i++)e.step();const members=e.ships.filter(s=>!s.npc);for(const s of members){if(s.targetId)expect(e.ships.find(o=>o.id===s.targetId)?.npc).toBeTruthy();}const a=members[0],b=members[1],hull=b.hull,shield=b.shield;lethal(e,b,a.id,false);expect(b.hull).toBe(hull);expect(b.shield).toBe(shield);const boss=e.snapshot().boss!;lethal(e,boss,a.id);expect(e.phase).toBe('finished');expect(e.outcome).toBe('players');expect(e.snapshot().escortsAlive).toBeGreaterThan(0);expect(e.snapshot().winner).toBeNull();});
test('challenge fights all five bosses in ascending base length, no escorts, carries member damage and wins on last boss',()=>{const e=setup('challenge');e.asteroids=[];e.start();const observed=[];const member=e.ships[0];member.hull=1234;for(let wave=0;wave<5;wave++){const boss=e.snapshot().boss!;observed.push(boss.spec.id);expect(e.ships.some(s=>s.npc==='escort')).toBe(false);expect(e.wave).toBe(wave+1);const previous=member.hull;lethal(e,boss,member.id);expect(member.hull).toBe(previous);if(wave<4){expect(e.phase).toBe('running');expect(e.nextWaveIn).toBeGreaterThan(0);e.pause();const before=e.nextWaveIn;e.step();expect(e.nextWaveIn).toBe(before);e.pause();for(let i=0;i<361;i++)e.step();expect(member.hull).toBeGreaterThan(previous);}else{expect(e.phase).toBe('finished');expect(e.outcome).toBe('players');}}expect(observed).toEqual([...BOSS_IDS]);expect(observed.map(id=>specs.find(s=>s.id===id)!.length)).toEqual([...observed.map(id=>specs.find(s=>s.id===id)!.length)].sort((a,b)=>a-b));});
test('brawl has no enemies and remains a true last-member-standing fight',()=>{const e=setup('brawl');e.start();expect(e.ships.some(s=>s.npc)).toBe(false);expect(e.ships.every(s=>!s.team)).toBe(true);for(let i=0;i<1800*60&&e.phase==='running';i++)e.step();expect(e.phase).toBe('finished');expect(e.outcome).toBe('member');expect(e.living).toHaveLength(1);expect(e.snapshot().winner?.member).toBeTruthy();},30000);
test('cooperative modes lose when the last member is eliminated',()=>{for(const mode of ['bounty','challenge'] as BattleMode[]){const e=setup(mode);e.start();e.ships.filter(s=>!s.npc).forEach(s=>s.alive=false);e.step();expect(e.phase).toBe('finished');expect(e.outcome).toBe('boss');}});
