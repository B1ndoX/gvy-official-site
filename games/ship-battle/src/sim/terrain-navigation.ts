import type {Ship,Vec} from './types';
import {hullIntersection} from './math';
import {hullRadiusAt} from './collisions';
import {segmentRock,type Asteroid} from './asteroids';

export interface TerrainLane {target:number;rock:number;side:number}
/** Only terrain in front of the target hull blocks a shot, not rocks behind it. */
export function firingObstacle(from:Vec,to:Vec,target:Ship,rocks:Asteroid[]){
 let first=hullIntersection(from,to,target)??1,block:Asteroid|null=null;
 for(const rock of rocks){const hit=segmentRock(from,to,rock);if(hit!==null&&hit<first-1e-6){first=hit;block=rock;}}
 return block;
}
/** One persistent passing side per obstruction; no per-frame random reversal. */
export function terrainCourse(ship:Ship,target:Ship,from:Vec,rocks:Asteroid[],prior:TerrainLane|undefined,random:()=>number){
 const rock=firingObstacle(from,target,target,rocks);if(!rock)return null;
 const dx=target.x-ship.x,dy=target.y-ship.y,d=Math.max(1,Math.hypot(dx,dy)),nx=dx/d,ny=dy/d;
 let state=prior;
 if(!state||state.target!==target.id||state.rock!==rock.id){
  const lateral=-ny*ship.vx+nx*ship.vy,cross=nx*(rock.y-ship.y)-ny*(rock.x-ship.x);
  const side=Math.abs(lateral)>ship.spec.speed*.08?Math.sign(lateral):Math.abs(cross)>rock.radius*.15?-Math.sign(cross):random()<.5?-1:1;
  state={target:target.id,rock:rock.id,side};
 }
 const clearance=rock.radius+hullRadiusAt(ship,Math.atan2(ny,nx)+Math.PI/2)+90;
 const x=rock.x-ny*state.side*clearance-ship.x,y=rock.y+nx*state.side*clearance-ship.y,length=Math.max(1,Math.hypot(x,y));
 const speed=ship.spec.speed*(ship.spec.length<100?.85:.65);
 return {state,heading:Math.atan2(y,x),velocity:{x:x/length*speed,y:y/length*speed}};
}
