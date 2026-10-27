import {expect,test} from 'vitest';
import {CameraHandoff,type CameraPose} from '../src/render/CameraHandoff';

test('nearby focus changes use ordinary tracking instead of an unnecessary pullback',()=>{
 const h=new CameraHandoff(),start={x:0,y:0,span:1000},next={x:200,y:100,span:800};
 h.begin(start,next);expect(h.active).toBe(false);expect(h.step(start,next,1/60)).toBeNull();
});
test('a distant close-up opens out before moving, arrives smoothly, and leaves the approach to the normal zoom',()=>{
 const h=new CameraHandoff(),next={x:5000,y:0,span:300};let pose:CameraPose={x:0,y:0,span:300},firstMovingSpan=0,largestScreenStep=0;
 h.begin(pose,next);
 for(let i=0;i<12*60&&h.active;i++){
  const previous=pose;pose=h.step(pose,next,1/60)!;
  if(pose.x>0&&!firstMovingSpan)firstMovingSpan=pose.span;
  largestScreenStep=Math.max(largestScreenStep,Math.hypot(pose.x-previous.x,pose.y-previous.y)/pose.span);
 }
 expect(h.active).toBe(false);expect(firstMovingSpan).toBeGreaterThan(5000);expect(largestScreenStep).toBeLessThan(.02);
 expect(pose.x).toBeCloseTo(next.x);expect(pose.y).toBeCloseTo(next.y);expect(pose.span).toBeGreaterThan(next.span*10);
});
test('a destination dying mid-flight coasts to rest without chasing its wreck or a replacement',()=>{
 const h=new CameraHandoff(),next={x:5000,y:0,span:300};let pose:CameraPose={x:0,y:0,span:300},previous=pose;
 h.begin(pose,next);for(let i=0;i<600&&pose.x<1500;i++){previous=pose;pose=h.step(pose,next,1/60)!;}
 expect(pose.x).toBeGreaterThan(0);const before=pose,step=pose.x-previous.x;
 pose=h.step(pose,next,1/60,false)!;expect(pose.x-before.x).toBeLessThanOrEqual(step);
 const span=pose.span;for(let i=0;i<180;i++){previous=pose;pose=h.step(pose,{x:20000,y:0,span:100},1/60,false)!;}
 expect(pose.x-previous.x).toBeLessThan(.01);expect(pose.x).toBeLessThan(4500);expect(pose.span).toBe(span);
 h.reset();expect(h.active).toBe(false);
});
test('pausing freezes the handoff and reset cancels it',()=>{
 const h=new CameraHandoff(),start={x:0,y:0,span:300},next={x:5000,y:0,span:300};h.begin(start,next);
 expect(h.step(start,next,0)).toEqual(start);expect(h.active).toBe(true);h.reset();expect(h.step(start,next,1)).toBeNull();
});
