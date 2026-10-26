import type {TrailPoint} from './TrailHistory';
import {clamp} from '../sim/math';

/** Fixed-size Catmull–Rom strip: both its soft envelope and core follow one path. */
export function fillTrailRibbon(points:TrailPoint[],head:TrailPoint,age:number,width:number,positions:Float32Array,uvs:Float32Array){
  const count=positions.length/4,last=points.length;
  if(!last)return;
  const point=(i:number)=>i>=last?head:points[Math.max(0,i)];
  let cursor=0;
  for(let i=0;i<count;i++){
    // Sample by age instead of array index: adding/expiring one emission must
    // not reparameterize the whole strip and make the nozzle flicker.
    const at=head.time-age+age*i/(count-1);
    while(cursor<last-1&&points[cursor+1].time<at)cursor++;
    const j=cursor,before=point(j),after=point(j+1),t=clamp((at-before.time)/Math.max(.00001,after.time-before.time),0,1);
    const a=point(j-1),b=point(j),c=point(j+1),d=point(j+2),t2=t*t,t3=t2*t,span=Math.max(.00001,c.time-b.time);
    // Time-scaled Hermite tangents prevent a newly sampled, very short head
    // segment from overshooting and swinging the whole wake like a ribbon.
    const spline=(p:number,q:number,r:number,s:number,derivative=false)=>{
      const delta=r-q,limit=Math.abs(delta)*1.5;
      const first=clamp((r-p)/Math.max(.00001,c.time-a.time)*span,-limit,limit),second=clamp((s-q)/Math.max(.00001,d.time-b.time)*span,-limit,limit);
      const m=first*delta<0?0:first,n=second*delta<0?0:second;
      return derivative?(6*t2-6*t)*q+(3*t2-4*t+1)*m+(-6*t2+6*t)*r+(3*t2-2*t)*n:(2*t3-3*t2+1)*q+(t3-2*t2+t)*m+(-2*t3+3*t2)*r+(t3-t2)*n;
    };
    const x=spline(a.x,b.x,c.x,d.x),y=spline(a.y,b.y,c.y,d.y);
    let dx=spline(a.x,b.x,c.x,d.x,true),dy=spline(a.y,b.y,c.y,d.y,true);
    if(Math.abs(dx)+Math.abs(dy)<.001){dx=c.x-a.x;dy=c.y-a.y;}
    const length=Math.max(.001,Math.hypot(dx,dy));
    const fade=clamp(1-(head.time-(b.time+(c.time-b.time)*t))/age,0,1),half=width*(.08+.92*Math.pow(fade,.75))/2,nx=-dy/length*half,ny=dx/length*half,k=i*4;
    positions[k]=x+nx;positions[k+1]=y+ny;positions[k+2]=x-nx;positions[k+3]=y-ny;
    uvs[k]=uvs[k+2]=fade;uvs[k+1]=0;uvs[k+3]=1;
  }
}
