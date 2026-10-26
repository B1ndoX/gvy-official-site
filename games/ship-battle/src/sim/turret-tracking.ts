import type {Vec,AimTracking} from './types';
import {clamp,intercept,wrap} from './math';
import {simulationSeconds} from './pacing';
import rules from '../data/aim-tracking-rules.json';

/** A gunner observes intermittently; angular velocity must accelerate and brake.
 * The trigger uses that last observation, so a target changing course can leave
 * the firing solution before the next round. There is no probabilistic miss roll. */
export function trackAim(cycle:AimTracking,current:number,observed:number,target:number,time:number,dt:number,limit:number,random:()=>number,solution?:{origin:Vec;target:Vec&{vx:number;vy:number};speed:number}){
 if(cycle.aimTarget!==target){
  const [minimum,maximum]=rules.acquisitionDelaySeconds,reaction=simulationSeconds(minimum+(maximum-minimum)*random());
  cycle.aimTarget=target;cycle.aimAt=cycle.acquireUntil=time+reaction;
  cycle.observedAt=time;cycle.observedVx=0;cycle.observedVy=0;
 }
 if(time>=(cycle.aimAt??0)){
  if(solution){
   // Estimate velocity from successive observations rather than feeding the
   // gunner the target's perfect live velocity on every frame. A lateral break
   // can escape the old lead; straight flight remains progressively trackable.
   const blend=1-Math.exp(-(time-(cycle.observedAt??time))/simulationSeconds(rules.velocityResponseSeconds));
   cycle.observedVx=(cycle.observedVx??0)+(solution.target.vx-(cycle.observedVx??0))*blend;
   cycle.observedVy=(cycle.observedVy??0)+(solution.target.vy-(cycle.observedVy??0))*blend;
   const point=intercept(solution.origin,{...solution.target,vx:cycle.observedVx,vy:cycle.observedVy},solution.speed);
   observed=Math.atan2(point.y-solution.origin.y,point.x-solution.origin.x);cycle.observedAt=time;
  }
  const [minimum,maximum]=rules.observationIntervalSeconds;
  cycle.aimAngle=observed;cycle.aimAt=time+simulationSeconds(minimum+(maximum-minimum)*random());
 }
 const goal=cycle.aimAngle??current,error=wrap(goal-current),response=simulationSeconds(rules.angleResponseSeconds),acceleration=limit/simulationSeconds(rules.angularAccelerationSeconds);
 const wanted=clamp(error/response,-limit,limit),previous=cycle.angularVelocity??0;
 const velocity=previous+clamp(wanted-previous,-acceleration*dt,acceleration*dt);
 cycle.angularVelocity=velocity;
 return {angle:wrap(current+velocity*dt),goal,ready:time>=(cycle.acquireUntil??0)};
}
export const trackTurret=trackAim;
