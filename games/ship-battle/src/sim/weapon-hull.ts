import type {Ship,Vec} from './types';

export interface HullAsset {center:Vec;noseDegrees:number}
export type HullShip=Pick<Ship,'x'|'y'|'heading'|'spec'>;
export interface WeaponHullProfile {asset:HullAsset;mask:{width:number;height:number;opaque:Uint8Array}}

export function artworkFrame(ship:HullShip,asset:HullAsset){
 const sideways=Math.abs(Math.sin(asset.noseDegrees*Math.PI/180))>.7;
 return {width:sideways?ship.spec.length:ship.spec.beam,height:sideways?ship.spec.beam:ship.spec.length,angle:ship.heading+Math.PI/2-asset.noseDegrees*Math.PI/180};
}
export function worldToArtwork(point:Vec,ship:HullShip,asset:HullAsset):Vec{
 const f=artworkFrame(ship,asset),c=Math.cos(f.angle),s=Math.sin(f.angle),x=point.x-ship.x,y=point.y-ship.y;
 return {x:asset.center.x+(x*c+y*s)/f.width,y:asset.center.y+(-x*s+y*c)/f.height};
}
export function artworkToWorld(point:Vec,ship:HullShip,asset:HullAsset):Vec{
 const f=artworkFrame(ship,asset),c=Math.cos(f.angle),s=Math.sin(f.angle),x=(point.x-asset.center.x)*f.width,y=(point.y-asset.center.y)*f.height;
 return {x:ship.x+x*c-y*s,y:ship.y+x*s+y*c};
}

/** Segment/grid traversal through the same bounded alpha mask as the sprite.
 * The surrounding ellipse is not an impact: transparent corners stay passable.
 * No textures, random choices, timers or movement rules enter the simulation. */
export function weaponHullIntersection(from:Vec,to:Vec,ship:HullShip,{asset,mask}:WeaponHullProfile):number|null{
 const a=worldToArtwork(from,ship,asset),b=worldToArtwork(to,ship,asset),dx=b.x-a.x,dy=b.y-a.y;
 let enter=0,leave=1;
 for(const [origin,delta] of [[a.x,dx],[a.y,dy]]){
  if(Math.abs(delta)<1e-14){if(origin<0||origin>=1)return null;continue;}
  const t0=-origin/delta,t1=(1-origin)/delta;
  enter=Math.max(enter,Math.min(t0,t1));leave=Math.min(leave,Math.max(t0,t1));
  if(enter>leave)return null;
 }
 const start=Math.min(leave,enter+1e-10),w=mask.width,h=mask.height;
 let x=Math.max(0,Math.min(w-1,Math.floor((a.x+dx*start)*w))),y=Math.max(0,Math.min(h-1,Math.floor((a.y+dy*start)*h))),time=enter;
 const sx=Math.sign(dx),sy=Math.sign(dy),stepX=dx?1/(w*Math.abs(dx)):Infinity,stepY=dy?1/(h*Math.abs(dy)):Infinity;
 let nextX=dx?((x+(sx>0?1:0))/w-a.x)/dx:Infinity,nextY=dy?((y+(sy>0?1:0))/h-a.y)/dy:Infinity;
 for(let i=0;i<=w+h+2&&time<=leave+1e-10&&x>=0&&x<w&&y>=0&&y<h;i++){
  if(mask.opaque[y*w+x])return Math.max(0,Math.min(1,time));
  if(nextX<nextY){time=nextX;nextX+=stepX;x+=sx;}
  else if(nextY<nextX){time=nextY;nextY+=stepY;y+=sy;}
  else{time=nextX;nextX+=stepX;nextY+=stepY;x+=sx;y+=sy;}
 }
 return null;
}
