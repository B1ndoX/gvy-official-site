import {spectatorSpan} from './CombatDirector';

export interface CameraPose {x:number;y:number;span:number}

/** One visual handoff on the renderer's existing ticker, independent of battle decisions. */
export class CameraHandoff {
 private flight:{phase:'opening'|'moving'|'cancelled';from:{x:number;y:number};span:number;elapsed:number;duration:number;vx:number;vy:number}|null=null;
 get active(){return this.flight!==null;}
 reset(){this.flight=null;}
 begin(current:CameraPose,next:CameraPose){
  this.reset();
  const distance=Math.hypot(next.x-current.x,next.y-current.y);
  if(distance<=current.span*.65)return;
  this.flight={phase:'opening',from:{x:current.x,y:current.y},span:Math.max(current.span,next.span,distance*1.3),elapsed:0,duration:Math.min(2.6,1.6+Math.log1p(distance/current.span)*.3),vx:0,vy:0};
 }
 step(current:CameraPose,next:CameraPose,seconds:number,alive=true):CameraPose|null{
  const flight=this.flight;if(!flight)return null;
  if(seconds<=0)return current;
  if(!alive)flight.phase='cancelled';
  if(flight.phase==='cancelled'){
   // A dying destination must not make the camera chase another destination
   // mid-flight. Coast to rest until the director's existing death hold ends.
   const decay=Math.exp(-3*seconds),travel=(1-decay)/3;
   const pose={x:current.x+flight.vx*travel,y:current.y+flight.vy*travel,span:current.span};
   flight.vx*=decay;flight.vy*=decay;return pose;
  }
  flight.span=Math.max(flight.span,next.span,Math.hypot(next.x-flight.from.x,next.y-flight.from.y)*1.3);
  const span=spectatorSpan(current.span,flight.span,seconds);
  if(flight.phase==='opening'){
   if(span>=flight.span*.9)flight.phase='moving';
   return {...current,span};
  }
  flight.elapsed+=seconds;
  const t=Math.min(1,flight.elapsed/flight.duration),ease=t*t*(3-2*t);
  const x=flight.from.x+(next.x-flight.from.x)*ease,y=flight.from.y+(next.y-flight.from.y)*ease;
  flight.vx=(x-current.x)/seconds;flight.vy=(y-current.y)/seconds;
  if(t===1)this.reset();
  // The normal bounded zoom supplies the gentle approach after arrival.
  return {x,y,span};
 }
}
