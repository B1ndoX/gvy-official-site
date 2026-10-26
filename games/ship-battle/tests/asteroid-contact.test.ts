import {expect,test} from 'vitest';
import data from '../src/data/ships.json';
import {BattleEngine} from '../src/sim/engine';
import {asteroidContact} from '../src/sim/asteroids';
import type {ShipSpec} from '../src/sim/types';
function setup(id='javelin'){
 const specs=(data as ShipSpec[]).map(s=>({...s,mounts:[],speed:0,turnRate:0,acceleration:0,shieldRegen:0}));
 const e=new BattleEngine();e.reset([{specId:id,count:1},{specId:'arrow',count:1}],specs,21);
 e.ships.forEach((s,i)=>{s.x=i*10000;s.y=0;s.heading=0;s.vx=s.vy=0;});e.asteroids=[];e.start();return e;
}
test('a rock inside a capital bounding circle but outside its real hull does not collide',()=>{
 const e=setup(),s=e.ships[0],rock={id:1,x:0,y:s.spec.beam*.48+45,radius:30,rotation:0};
 expect(Math.hypot(rock.x,rock.y)).toBeLessThan(s.radius+rock.radius);expect(asteroidContact(s,rock)).toBeNull();
 e.asteroids=[rock];const hp=s.hull+s.shield;for(let i=0;i<300;i++)e.step();expect(s.hull+s.shield).toBe(hp);expect(s.x).toBe(0);expect(s.y).toBe(0);
});
test('a Javelin squeezed between two rocks cannot be ground to death by separation correction',()=>{
 const e=setup(),s=e.ships[0],gap=s.spec.beam*.48+30;
 e.asteroids=[{id:1,x:0,y:gap,radius:45,rotation:0},{id:2,x:0,y:-gap,radius:45,rotation:0}];
 const hp=s.hull+s.shield;for(let i=0;i<1200;i++)e.step();
 expect(s.alive).toBe(true);expect(s.hull+s.shield).toBe(hp);expect(e.hits).toBe(0);
});
test('one continuing rock contact damages once, but separating and making a new fast impact damages again',()=>{
 const e=setup(),s=e.ships[0],rock={id:1,x:0,y:0,radius:60,rotation:0};e.asteroids=[rock];
 const press=()=>{s.x=-(s.spec.length*.48+60)+1;s.y=0;s.vx=240;s.vy=0;};
 press();e.step();const hp=s.hull+s.shield;expect(hp).toBeLessThan(s.spec.hull+s.spec.shield);
 for(let i=0;i<120;i++){press();e.step();}expect(s.hull+s.shield).toBe(hp);
 s.x=-1000;s.vx=0;e.step();for(let i=0;i<80;i++)e.step();press();e.step();expect(s.hull+s.shield).toBeLessThan(hp);
});
test('a high-speed small ship can still die on a genuine frontal asteroid impact',()=>{
 const e=setup('arrow'),s=e.ships[0];e.asteroids=[{id:1,x:0,y:0,radius:60,rotation:0}];
 s.x=-(s.spec.length*.48+60)+1;s.vx=400;e.step();expect(s.alive).toBe(false);expect(e.killLog[0].cause).toBe('asteroid');expect(e.collisionDeaths).toBe(1);
});
