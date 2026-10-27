import type {Ship,Vec} from './types';
import {hullIntersection,mixSeed} from './math';
import {segmentRock,type Asteroid} from './asteroids';

export interface TerrainLane {target:number;rock:number;side:number;waypoint:Vec}
/** Only terrain in front of the target hull blocks a shot, not rocks behind it. */
export function firingObstacle(from:Vec,to:Vec,target:Ship,rocks:Asteroid[],padding=0){
 let first=hullIntersection(from,to,target)??1,block:Asteroid|null=null;
 for(const rock of rocks){const hit=segmentRock(from,to,rock,padding);if(hit!==null&&hit<first-1e-6){first=hit;block=rock;}}
 return block;
}
/** One persistent passing side per obstruction; no per-frame random reversal. */
export function terrainCourse(ship:Ship,target:Ship,from:Vec,rocks:Asteroid[],prior:TerrainLane|undefined,random:()=>number,seed?:number){
 // Navigation needs a clear corridor, not one clear muzzle ray. Hull yaw can
 // expose that ray for a single tick while the ship is still behind the rock.
 const margin=Math.min(60,Math.max(20,ship.spec.beam*.12));
 const blocked=firingObstacle(from,target,target,rocks);
 const corridor=blocked??firingObstacle(from,target,target,rocks,margin);
 const previous=prior?.target===target.id?rocks.find(r=>r.id===prior.rock):undefined;
 const reached=prior&&Math.hypot(prior.waypoint.x-ship.x,prior.waypoint.y-ship.y)<Math.max(35,ship.spec.speed*.6);
 // Finish a chosen bypass before switching to another briefly exposed rock.
 // This is route hysteresis only; actual weapon collision remains unpadded.
 const rock=previous&&!reached&&corridor?previous:corridor;if(!rock)return null;
 const dx=target.x-ship.x,dy=target.y-ship.y,d=Math.max(1,Math.hypot(dx,dy)),nx=dx/d,ny=dy/d;
 let state=prior;
 if(!state||state.target!==target.id||state.rock!==rock.id||reached){
  const lateral=-ny*ship.vx+nx*ship.vy,cross=nx*(rock.y-ship.y)-ny*(rock.x-ship.x);
  const tie=seed===undefined?(random()<.5?-1:1):((mixSeed(seed^rock.id^Math.min(ship.id,target.id)*65537^Math.max(ship.id,target.id)*19349663)&1)?1:-1)*(ship.id<target.id?1:-1);
  const side=seed===undefined?(Math.abs(lateral)>ship.spec.speed*.08?Math.sign(lateral):Math.abs(cross)>rock.radius*.15?-Math.sign(cross):tie):tie;
  const clearance=rock.radius+Math.max(ship.spec.length,ship.spec.beam)*.5+55;
  // A fixed world waypoint cannot rotate around the rock along with the enemy.
  // Reciprocal observers choose the same world side instead of opposite orbits.
  state={target:target.id,rock:rock.id,side,waypoint:{x:rock.x-ny*side*clearance,y:rock.y+nx*side*clearance}};
 }
 const x=state.waypoint.x-ship.x,y=state.waypoint.y-ship.y,length=Math.max(1,Math.hypot(x,y));
 const speed=ship.spec.speed*(ship.spec.length<100?.85:.65);
 return {state,heading:Math.atan2(y,x),velocity:{x:x/length*speed,y:y/length*speed}};
}
