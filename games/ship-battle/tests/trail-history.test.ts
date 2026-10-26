import {test,expect} from 'vitest';
import {TrailHistory,vfxNoise} from '../src/render/TrailHistory';

test('turns retain the sampled world path instead of rotating old exhaust',()=>{
  const t=new TrailHistory();t.sample(0,0,0,.5,100);t.sample(5,0,.1,.5,100);t.sample(8,3,.2,.5,100);t.sample(8,8,.3,.5,100);
  expect(t.points.map(p=>[p.x,p.y])).toEqual([[0,0],[5,0],[8,3],[8,8]]);
  const frozen=JSON.stringify(t.points);for(let i=0;i<100;i++)t.sample(8,8,.3,2,100);
  expect(JSON.stringify(t.points)).toBe(frozen);
});
test('sample density, point count and age stay bounded on long and accelerated sessions',()=>{
  const t=new TrailHistory(12);
  for(let i=0;i<10000;i++){const now=i/60;t.sample(Math.cos(now)*50,Math.sin(now)*50,now,.8,100);expect(t.points.length).toBeLessThanOrEqual(12);expect(t.points.every(p=>now-p.time<=.8)).toBe(true);}
  expect(t.points.length).toBeGreaterThan(5);
  t.sample(30,30,200,.8,100);expect(t.points).toHaveLength(1);
});
test('reset time and discontinuous jumps do not draw a line across the arena',()=>{
  const t=new TrailHistory();t.sample(0,0,10,2,100);t.sample(10,0,10.1,2,100);t.sample(3000,0,10.2,2,100);expect(t.points).toEqual([{x:3000,y:0,time:10.2}]);
  t.sample(0,0,0,2,100);expect(t.points).toEqual([{x:0,y:0,time:0}]);
});
test('cosmetic randomness is repeatable without invoking a global random source',()=>{
  const values=Array.from({length:100},(_,i)=>vfxNoise(i));expect(values).toEqual(Array.from({length:100},(_,i)=>vfxNoise(i)));expect(values.every(n=>n>=0&&n<1)).toBe(true);expect(new Set(values).size).toBe(100);
});
