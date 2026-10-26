import {expect,test} from 'vitest';
import {fillTrailRibbon} from '../src/render/TrailRibbon';

test('one continuous wide ribbon follows a turn, preserving both width and immutable history',()=>{
  const points=[{x:0,y:0,time:0},{x:20,y:0,time:.2},{x:38,y:12,time:.4},{x:45,y:32,time:.6}],head={x:45,y:55,time:.8};
  const before=JSON.stringify(points),positions=new Float32Array(80),uvs=new Float32Array(80);
  fillTrailRibbon(points,head,1,20,positions,uvs);
  expect(JSON.stringify(points)).toBe(before);expect([...positions,...uvs].every(Number.isFinite)).toBe(true);
  expect((positions[76]+positions[78])/2).toBeCloseTo(head.x);expect((positions[77]+positions[79])/2).toBeCloseTo(head.y);
  expect(Math.hypot(positions[76]-positions[78],positions[77]-positions[79])).toBeCloseTo(20);
  expect(uvs[76]).toBe(1);expect(uvs[0]).toBeCloseTo(.2);
  expect((positions[40]+positions[42])/2).toBeGreaterThan(20);expect((positions[41]+positions[43])/2).toBeLessThan(20);
});
test('sampling an exact head position keeps the nozzle full width without a pinch',()=>{
  const head={x:20,y:0,time:.2},positions=new Float32Array(80),uvs=new Float32Array(80);
  fillTrailRibbon([{x:0,y:0,time:0},head],head,1,16,positions,uvs);
  expect(Math.abs(positions[77]-positions[79])).toBeCloseTo(16);expect([...positions,...uvs].every(Number.isFinite)).toBe(true);
});
test('a faster actual path produces a longer ribbon, while a stationary path stays finite',()=>{
  for(const speed of [0,20,100]){
    const positions=new Float32Array(80),uvs=new Float32Array(80);
    fillTrailRibbon([{x:0,y:0,time:0},{x:speed*.5,y:0,time:.5}],{x:speed,y:0,time:1},1,16,positions,uvs);
    expect((positions[76]+positions[78])/2-(positions[0]+positions[2])/2).toBeCloseTo(speed);
    expect([...positions,...uvs].every(Number.isFinite)).toBe(true);
  }
});
test('a sharp turn with a short new head segment cannot overshoot into a swinging loop',()=>{
 const points=[{x:0,y:0,time:0},{x:50,y:0,time:.1},{x:51,y:45,time:.2}],head={x:51.1,y:45.1,time:.201},p=new Float32Array(80),uv=new Float32Array(80);
 fillTrailRibbon(points,head,.25,12,p,uv);
 for(let i=0;i<p.length;i+=4){const x=(p[i]+p[i+2])/2,y=(p[i+1]+p[i+3])/2;expect(x).toBeGreaterThanOrEqual(-.0001);expect(x).toBeLessThanOrEqual(51.101);expect(y).toBeGreaterThanOrEqual(-.0001);expect(y).toBeLessThanOrEqual(45.101);}
});
