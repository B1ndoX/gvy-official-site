import {expect,test} from 'vitest';
import {ExhaustTrail,mainExhaustActive,exhaustRibbonBlend} from '../src/render/ExhaustTrail';
import {fillTrailRibbon} from '../src/render/TrailRibbon';

test('low-speed noise stays in the stable aft jet and blends smoothly into the unchanged fast wake',()=>{
 for(const power of [.02,.05,.09,.1,.11,.15,.18])expect(exhaustRibbonBlend(power)).toBe(0);
 for(const power of [.38,.6,1])expect(exhaustRibbonBlend(power)).toBe(1);
 let previous=0;for(let i=0;i<=100;i++){const next=exhaustRibbonBlend(.18+i*.002);expect(next).toBeGreaterThanOrEqual(previous);expect(next-previous).toBeLessThan(.02);previous=next;}
});

test('main exhaust is off at rest and in reverse, while lateral flight and steady motion stay lit',()=>{
 expect(mainExhaustActive(0,0,0,200,true)).toBe(false);expect(mainExhaustActive(-120,0,0,200,true)).toBe(false);
 expect(mainExhaustActive(120,0,0,200,false)).toBe(true);expect(mainExhaustActive(0,120,0,200,false)).toBe(true);
 expect(mainExhaustActive(-120,0,Math.PI/2,200,false)).toBe(true);
 let active=true;for(const speed of [4,3,4,3,4]){active=mainExhaustActive(speed,0,0,200,active);expect(active).toBe(true);}
 expect(mainExhaustActive(1,0,0,200,true)).toBe(false);expect(mainExhaustActive(4,0,0,200,false)).toBe(false);
});

test('lateral movement exits aft first and bends progressively instead of stretching diagonally from the nozzle',()=>{
  const trail=new ExhaustTrail();
  for(let i=0;i<=125;i++){const t=i/100;trail.update({x:0,y:t*100},{x:0,y:100},0,80,t,1,500);}
  const head={x:0,y:125,time:1.25},recent=trail.points.filter(p=>head.time-p.time>0).at(-1)!,old=trail.points[0];
  expect(recent.x).toBeLessThan(0);expect(Math.abs(recent.y-head.y)).toBeLessThan(Math.abs(recent.x)*.2);
  expect(Math.abs(old.y-head.y)/Math.abs(old.x)).toBeGreaterThan(.4);
});
test('frame-to-frame sampling does not reparameterize the entire plume or create a flashing root',()=>{
  const trail=new ExhaustTrail();let previous:Float32Array|null=null,maxJump=0,worst={i:0,j:0,uv:0};
  for(let i=0;i<500;i++){
    const time=i/240,head={x:0,y:time*100,time},p=new Float32Array(80),uv=new Float32Array(80);
    trail.update(head,{x:0,y:100},0,80,time,1,500);fillTrailRibbon(trail.points,head,1,16,p,uv);
    if(previous&&time>1.2)for(let j=0;j<p.length;j+=4){const jump=Math.hypot((p[j]+p[j+2]-previous[j]-previous[j+2])/2,(p[j+1]+p[j+3]-previous[j+1]-previous[j+3])/2);if(jump>maxJump){maxJump=jump;worst={i,j,uv:uv[j]};}}
    previous=p;
  }
  expect(maxJump,JSON.stringify(worst)).toBeLessThan(2);
});
test('exhaust remains bounded and frozen on pause, clears on reset, and grows with actual speed',()=>{
  const lengths=[];
  for(const speed of [20,100]){
    const trail=new ExhaustTrail();for(let i=0;i<1000;i++){const t=i/100;trail.update({x:t*speed,y:0},{x:speed,y:0},0,8+speed*.65,t,1,500);expect(trail.points.length).toBeLessThanOrEqual(20);}
    const last=9.99,before=JSON.stringify(trail.points);trail.update({x:last*speed,y:0},{x:speed,y:0},0,8+speed*.65,last,1,500);expect(JSON.stringify(trail.points)).toBe(before);
    lengths.push(last*speed-trail.points[0].x);trail.update({x:0,y:0},{x:0,y:0},0,8,0,1,500);expect(trail.points).toHaveLength(1);
  }
  expect(lengths[1]).toBeGreaterThan(lengths[0]*2);
});
