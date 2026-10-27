import type { BattleEvent, Ship, Vec } from '../sim/types';
import { mountWorld } from '../sim/math';
import {artworkFrame as frame,worldToArtwork,artworkToWorld,type HullAsset} from '../sim/weapon-hull';
export {worldToArtwork,artworkToWorld} from '../sim/weapon-hull';

/** A bounded CPU mask shared by actual weapon contact and impact feedback. */
export interface HullMask { width:number; height:number; opaque:Uint8Array; edge:Vec[] }

export function createHullMask(width:number,height:number,rgba:ArrayLike<number>,limit=256):HullMask|null {
  const scale=Math.min(1,limit/Math.max(width,height)),w=Math.max(1,Math.ceil(width*scale)),h=Math.max(1,Math.ceil(height*scale));
  const opaque=new Uint8Array(w*h),edge:Vec[]=[];
  // Max-pool alpha so thin antennae and wings survive the bounded mask.
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]>=32)opaque[Math.min(h-1,Math.floor(y*h/height))*w+Math.min(w-1,Math.floor(x*w/width))]=1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(opaque[y*w+x]&&(x===0||y===0||x===w-1||y===h-1||!opaque[y*w+x-1]||!opaque[y*w+x+1]||!opaque[(y-1)*w+x]||!opaque[(y+1)*w+x]))edge.push({x:(x+.5)/w,y:(y+.5)/h});
  return edge.length?{width:w,height:h,opaque,edge}:null;
}

const solid=(mask:HullMask,p:Vec)=>p.x>=0&&p.y>=0&&p.x<1&&p.y<1&&mask.opaque[Math.floor(p.y*mask.height)*mask.width+Math.floor(p.x*mask.width)]!==0;

/** Keep a true opaque contact, otherwise choose its nearest visible hull edge. */
export function hullSurface(mask:HullMask,point:Vec,width:number,height:number):Vec {
  if(solid(mask,point))return point;
  let best=mask.edge[0],distance=Infinity;
  for(const p of mask.edge){const d=((p.x-point.x)*width)**2+((p.y-point.y)*height)**2;if(d<distance){distance=d;best=p;}}
  return best;
}

export class HullImpactAnchors {
  private anchors=new WeakMap<BattleEvent,Vec>();
  reset(){this.anchors=new WeakMap();}
  event(ev:BattleEvent,ship:Ship,asset:HullAsset,mask:HullMask):Vec {
    let anchor=this.anchors.get(ev);
    if(!anchor){
      // New events carry the exact simulation-step local impact, so multiple
      // steps per rendered frame cannot move/rotate the contact off the hull.
      const point=ev.localImpact?mountWorld(ship,ev.localImpact):ev,f=frame(ship,asset);
      anchor=hullSurface(mask,worldToArtwork(point,ship,asset),f.width,f.height);this.anchors.set(ev,anchor);
    }
    return artworkToWorld(anchor,ship,asset);
  }
  beam(from:Vec,to:Vec,ship:Ship,asset:HullAsset,mask:HullMask):Vec {
    const a=worldToArtwork(from,ship,asset),b=worldToArtwork(to,ship,asset),f=frame(ship,asset),dx=b.x-a.x,dy=b.y-a.y;
    const steps=Math.max(Math.abs(dx)*mask.width,Math.abs(dy)*mask.height);
    if(steps>1e-8){
      const sx=dx/steps,sy=dy/steps;
      // Start at the existing physical intersection and extend the same ray
      // through transparent margins. At most two mask diagonals are sampled.
      for(let i=0;i<=Math.hypot(mask.width,mask.height)*2;i++){
        const point={x:b.x+sx*i,y:b.y+sy*i};
        if(solid(mask,point))return artworkToWorld(point,ship,asset);
      }
    }
    return artworkToWorld(hullSurface(mask,b,f.width,f.height),ship,asset);
  }
}
