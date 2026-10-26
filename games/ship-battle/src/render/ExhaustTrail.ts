import type {TrailPoint} from './TrailHistory';
import type {Vec} from '../sim/types';
import {clamp} from '../sim/math';

interface Emission extends TrailPoint {vx:number;vy:number;dx:number;dy:number;jet:number}
/** Small hysteresis avoids reignition flicker near rest or a lateral heading. */
export function mainExhaustActive(vx:number,vy:number,heading:number,topSpeed:number,wasActive:boolean){
  const speed=Math.hypot(vx,vy),forward=vx*Math.cos(heading)+vy*Math.sin(heading);
  return wasActive?speed>Math.max(1,topSpeed*.012)&&forward>=-Math.max(2,speed*.06):speed>Math.max(3,topSpeed*.025)&&forward>=-Math.max(.1,speed*.002);
}
/** A slow ship has a steady aft jet, not an advected strip of nearly coincident points. */
export function exhaustRibbonBlend(power:number){const t=clamp((power-.18)/.2,0,1);return t*t*(3-2*t);}
/** Render-only exhaust advection: initially aft, then progressively left behind. */
export class ExhaustTrail {
  private emissions:Emission[]=[];
  readonly points:TrailPoint[]=[];
  private last=-1;
  update(origin:Vec,velocity:Vec,heading:number,jet:number,time:number,life:number,maxJump:number){
    const old=this.emissions.at(-1);
    if(time<this.last||old&&Math.hypot(origin.x-old.x,origin.y-old.y)>maxJump)this.emissions.length=0;
    this.last=time;
    while(this.emissions.length&&time-this.emissions[0].time>1.4)this.emissions.shift();
    const recent=this.emissions.at(-1);
    if(!recent||time-recent.time>=.075){
      const sample=this.emissions.length===20?this.emissions.shift()!:{} as Emission;
      // The nozzle also moves when a long hull rotates. Inherit that motion,
      // rather than folding the first segment back across the ship's stern.
      const dt=recent?time-recent.time:0,vx=recent&&dt>0?(origin.x-recent.x)/dt:velocity.x,vy=recent&&dt>0?(origin.y-recent.y)/dt:velocity.y;
      Object.assign(sample,{x:origin.x,y:origin.y,time,vx,vy,dx:Math.cos(heading),dy:Math.sin(heading),jet});this.emissions.push(sample);
    }
    let used=0;
    for(const e of this.emissions){
      // Keep interpolation neighbours beyond the invisible end. Dropping the
      // last visible endpoint itself causes a periodic whole-segment jump.
      const age=time-e.time;if(age>life+.25)continue;
      // Velocity inheritance starts at 100%, so a lateral move cannot pull the
      // root sideways. Older gas gradually lags, bending the same plume aft.
      const inherited=age*(1-.42*age/life),p=this.points[used]??{x:0,y:0,time:0};
      p.x=e.x+e.vx*inherited-e.dx*e.jet*age;p.y=e.y+e.vy*inherited-e.dy*e.jet*age;p.time=e.time;this.points[used++]=p;
    }
    this.points.length=used;
  }
}
