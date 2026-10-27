import type {Ship,Vec} from './types';
import {clamp} from './math';
import {hullRadiusAt} from './collisions';

/** Predict close passes before contact. Stable reciprocal lanes prevent two
 * ships from choosing the same world-side or alternating left/right each tick. */
export function trafficVelocity(ship:Ship,ships:Ship[],wanted:Vec):Vec{
 const speed=Math.hypot(ship.vx,ship.vy),horizon=clamp(.9+speed/Math.max(1,ship.spec.acceleration)*.5,1.2,3.2);
 let x=0,y=0,brake=0;
 for(const other of ships){
  if(other===ship||!other.alive)continue;
  const dx=other.x-ship.x,dy=other.y-ship.y,d2=dx*dx+dy*dy,bound=ship.radius+other.radius+28;
  const reach=bound+(speed+Math.abs(other.vx)+Math.abs(other.vy)+ship.spec.speed)*horizon;
  if(Math.abs(dx)>reach||Math.abs(dy)>reach||d2>reach*reach||d2<1e-6)continue;
  const vx=other.vx-(ship.vx*.65+wanted.x*.35),vy=other.vy-(ship.vy*.65+wanted.y*.35),v2=vx*vx+vy*vy;
  const dot=dx*vx+dy*vy;if(dot>=0&&d2>bound*bound)continue;
  const t=v2>1?clamp(-dot/v2,0,horizon):0,mx=dx+vx*t,my=dy+vy*t,miss2=mx*mx+my*my;
  if(miss2>bound*bound*1.8225)continue;
  // Only a plausible collision needs oriented hull radii/trigonometry.
  const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,safe=hullRadiusAt(ship,Math.atan2(dy,dx))+hullRadiusAt(other,Math.atan2(-dy,-dx))+28;
  const closing=-dot/d,miss=Math.sqrt(miss2);
  if(closing<=0&&d>safe||miss>safe*1.35)continue;
  const urgency=clamp((safe*1.35-miss)/(safe*.65),0,1)*clamp(1-t/(horizon*1.25),.15,1);
  const cross=nx*(ship.vy-other.vy)-ny*(ship.vx-other.vx);
  // Existing clear lateral motion wins; exact head-on ties share a pair seed.
  const pair=((Math.min(ship.id,other.id)*73856093)^(Math.max(ship.id,other.id)*19349663))>>>0;
  const side=Math.abs(cross)>ship.spec.speed*.12?Math.sign(cross):pair%2?1:-1;
  const mobility=clamp(other.spec.length/Math.max(1,ship.spec.length),.25,1);
  x+=-ny*side*ship.spec.speed*urgency*mobility*.85;
  y+=nx*side*ship.spec.speed*urgency*mobility*.85;
  const inward=wanted.x*nx+wanted.y*ny;
  if(inward>0){const amount=clamp(1-(d-safe)/Math.max(1,closing*horizon),0,1)*urgency; x-=nx*inward*amount;y-=ny*inward*amount;brake=Math.max(brake,amount);}
 }
 const strength=Math.hypot(x,y),limit=ship.spec.speed*(brake>.5?1:.85),scale=strength>limit?limit/strength:1;
 return {x:wanted.x+x*scale,y:wanted.y+y*scale};
}
