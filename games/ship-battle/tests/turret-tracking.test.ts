import {expect,test} from 'vitest';
import {trackTurret} from '../src/sim/turret-tracking';
import {simulationSeconds} from '../src/sim/pacing';
import type {WeaponCycle} from '../src/sim/types';
const cycle=():WeaponCycle=>({chargeLeft:-1,burstLeft:0});
test('turret rotation accelerates gradually and must brake before reversing',()=>{
 const c=cycle(),dt=1/60,limit=.375,acceleration=limit/simulationSeconds(.6);let angle=0,time=0;
 for(let i=0;i<60;i++){const previous=c.angularVelocity??0,timeBefore=time;time+=dt;const next=trackTurret(c,angle,Math.PI/2,2,time,dt,limit,()=>.5);expect(Math.abs((c.angularVelocity??0)-previous)).toBeLessThanOrEqual(acceleration*dt+1e-10);expect(Math.abs(next.angle-angle)).toBeLessThanOrEqual(limit*dt+1e-10);angle=next.angle;expect(time).toBeGreaterThan(timeBefore);}
 const velocity=c.angularVelocity!;expect(velocity).toBeGreaterThan(0);
 c.aimAt=time;time+=dt;const reversed=trackTurret(c,angle,-Math.PI/2,2,time,dt,limit,()=>.5);
 expect(reversed.angle).toBeGreaterThan(angle);expect(c.angularVelocity).toBeGreaterThan(0);expect(c.angularVelocity!).toBeLessThan(velocity);
});
test('a course change is not sampled every frame, and changing targets incurs a real acquisition delay',()=>{
 const c=cycle();expect(trackTurret(c,0,0,1,1,1/60,.375,()=>.5).ready).toBe(false);
 trackTurret(c,0,0,1,1.5,1/60,.375,()=>.5);
 const stale=trackTurret(c,0,1,1,1.52,1/60,.375,()=>.5);expect(stale.goal).toBe(0);
 const switched=trackTurret(c,0,-1,2,1.53,1/60,.375,()=>.5);expect(switched.ready).toBe(false);expect(switched.goal).toBe(0);
 const acquired=trackTurret(c,0,-1,2,2.1,1/60,.375,()=>.5);expect(acquired.ready).toBe(true);expect(acquired.goal).toBe(-1);expect(Math.abs(acquired.angle)).toBeLessThan(.01);
});

test('turret lead learns motion over observations and does not instantly adopt a lateral reversal',()=>{
 const c=cycle(),origin={x:0,y:0},target={x:1000,y:0,vx:0,vy:200},solution={origin,target,speed:1000};
 trackTurret(c,0,0,1,0,1/60,.375,()=>.5,solution);
 const first=trackTurret(c,0,0,1,simulationSeconds(.31),1/60,.375,()=>.5,solution);expect(c.observedVy).toBeGreaterThan(0);expect(c.observedVy).toBeLessThan(200);expect(first.goal).toBeGreaterThan(0);
 for(let i=1;i<=8;i++)trackTurret(c,0,0,1,simulationSeconds(.31+i*.4),1/60,.375,()=>.5,solution);
 expect(c.observedVy).toBeGreaterThan(195);
 target.vy=-200;const reversed=trackTurret(c,0,0,1,simulationSeconds(3.91),1/60,.375,()=>.5,solution);
 expect(c.observedVy).toBeGreaterThan(-200);expect(reversed.goal).toBeGreaterThan(-.2);
 for(let i=1;i<=8;i++)trackTurret(c,0,0,1,simulationSeconds(3.91+i*.4),1/60,.375,()=>.5,solution);
 expect(c.observedVy).toBeLessThan(-195);expect(c.aimAngle).toBeLessThan(0);
 trackTurret(c,0,0,2,simulationSeconds(8),1/60,.375,()=>.5,solution);expect(c.observedVy).toBe(0);
});
