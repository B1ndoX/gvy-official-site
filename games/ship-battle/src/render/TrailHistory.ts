import type { Vec } from '../sim/types';

export interface TrailPoint extends Vec { time:number }
/** Render-only world positions. Reading a frozen frame never advances a trail. */
export class TrailHistory {
  readonly points:TrailPoint[]=[];
  constructor(readonly capacity=8){}
  sample(x:number,y:number,time:number,maxAge:number,maxJump:number){
    const points=this.points,last=points.at(-1);
    if(last&&(time<last.time||Math.hypot(x-last.x,y-last.y)>maxJump))points.length=0;
    while(points.length&&time-points[0].time>maxAge)points.shift();
    const recent=points.at(-1);
    if(recent&&time===recent.time)return;
    if(recent&&time-recent.time<Math.max(.065,maxAge/(this.capacity-1)))return;
    if(points.length===this.capacity){const reuse=points.shift()!;reuse.x=x;reuse.y=y;reuse.time=time;points.push(reuse);}
    else points.push({x,y,time});
  }
}

/** Cosmetic deterministic noise: never consumes the combat PRNG. */
export function vfxNoise(seed:number){const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n);}
