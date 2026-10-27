import type {Ship} from './types';

export const SHIP_IMPACT_LIMIT=.05,SHIP_IMPACT_PER_SECOND=.08;
const SHIP_IMPACT_GAIN=1.38;
export const shipMass=(s:Ship)=>Math.max(1,s.spec.mass??s.spec.length*s.spec.beam*s.spec.beam);

/** Distance to the hull along a world bearing; long hulls do not repel everything in their bounding circle. */
export const hullRadiusAt=(ship:Pick<Ship,'heading'|'spec'>,bearing:number)=>1/Math.hypot(Math.cos(bearing-ship.heading)/(ship.spec.length*.48+3),Math.sin(bearing-ship.heading)/(ship.spec.beam*.48+3));

/** Oriented projections reject distant pairs; support points resolve the curved
 * hulls. Five projection axes alone can report deep contact across empty space. */
export function shipContact(a:Ship,b:Ship,padding=0){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),al=a.spec.length*.48+3,aw=a.spec.beam*.48+3,bl=b.spec.length*.48+3,bw=b.spec.beam*.48+3;
  if(d>=Math.max(al,aw)+Math.max(bl,bw)+padding*2)return null;
  const ac=Math.cos(a.heading),as=Math.sin(a.heading),bc=Math.cos(b.heading),bs=Math.sin(b.heading);
  const axes=[[ac,as],[-as,ac],[bc,bs],[-bs,bc],d>.0001?[dx/d,dy/d]:[1,0]];
  for(const [x,y]of axes){
    const ar=Math.hypot(al*(x*ac+y*as),aw*(-x*as+y*ac)),br=Math.hypot(bl*(x*bc+y*bs),bw*(-x*bs+y*bc)),along=dx*x+dy*y,overlap=ar+br+padding*2-Math.abs(along);
    if(overlap<=0)return null;
  }
  return ellipseContact(dx,dy,al,aw,ac,as,bl,bw,bc,bs,padding);
}

interface Point {x:number;y:number}
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
const minus=(a:Point,b:Point):Point=>({x:a.x-b.x,y:a.y-b.y});
const triple=(a:Point,b:Point,c:Point):Point=>({x:b.x*dot(a,c)-a.x*dot(b,c),y:b.y*dot(a,c)-a.y*dot(b,c)});
/** GJK intersection and EPA minimum translation, both bounded and stateless. */
function ellipseContact(dx:number,dy:number,al:number,aw:number,ac:number,as:number,bl:number,bw:number,bc:number,bs:number,padding:number){
 const support=(direction:Point):Point=>{
  const n=Math.hypot(direction.x,direction.y),x=direction.x/n,y=direction.y/n;
  const au=x*ac+y*as,av=-x*as+y*ac,bu=x*bc+y*bs,bv=-x*bs+y*bc;
  const ah=Math.hypot(al*au,aw*av),bh=Math.hypot(bl*bu,bw*bv);
  const ax=al*al*au/ah,ay=aw*aw*av/ah,bx=bl*bl*bu/bh,by=bw*bw*bv/bh;
  return{x:ax*ac-ay*as+bx*bc-by*bs-dx+x*padding*2,y:ax*as+ay*ac+bx*bs+by*bc-dy+y*padding*2};
 };
 let direction:Point=dx||dy?{x:dx,y:dy}:{x:1,y:0};
 const simplex=[support(direction)];direction={x:-simplex[0].x,y:-simplex[0].y};
 for(let iteration=0;iteration<24;iteration++){
  if(Math.hypot(direction.x,direction.y)<1e-12)direction={x:1,y:0};
  const a=support(direction);if(dot(a,direction)<=0)return null;
  simplex.push(a);const ao={x:-a.x,y:-a.y},b=simplex[simplex.length-2],ab=minus(b,a);
  if(simplex.length===2){
   if(dot(ab,ao)<=0){simplex.splice(0,1);direction=ao;continue;}
   direction=triple(ab,ao,ab);
   if(Math.hypot(direction.x,direction.y)<1e-12)direction={x:-ab.y,y:ab.x};
   continue;
  }
  const c=simplex[0],across=minus(c,a),outsideAB=triple(across,ab,ab),outsideAC=triple(ab,across,across);
  if(dot(outsideAB,ao)>0){simplex.splice(0,1);direction=outsideAB;continue;}
  if(dot(outsideAC,ao)>0){simplex.splice(1,1);direction=outsideAC;continue;}
  if((b.x-c.x)*(a.y-c.y)-(b.y-c.y)*(a.x-c.x)<0)simplex.reverse();
  let best={nx:1,ny:0,depth:0};
  for(let expansion=0;expansion<32;expansion++){
   let edge=0,depth=Infinity,nx=1,ny=0;
   for(let i=0;i<simplex.length;i++){
    const p=simplex[i],q=simplex[(i+1)%simplex.length],ex=q.x-p.x,ey=q.y-p.y,length=Math.hypot(ex,ey);
    if(length<1e-12)continue;
    const x=ey/length,y=-ex/length,d=x*p.x+y*p.y;
    if(d<depth){depth=d;nx=x;ny=y;edge=i;}
   }
   best={nx,ny,depth};const p=support({x:nx,y:ny});
   if(dot(p,{x:nx,y:ny})-depth<.002)return depth>1e-7?best:null;
   simplex.splice(edge+1,0,p);
  }
  return best.depth>1e-7?best:null;
 }
 return null;
}

export function shipImpact(a:Ship,b:Ship,closing:number){
  const cruise=Math.max(40,a.spec.speed+b.spec.speed),safe=Math.min(80,cruise*.25);
  const intensity=.035*SHIP_IMPACT_GAIN*(Math.max(0,closing-safe)/200)**2;
  // Full opposing flight speed is dangerous even for slow, massive hulls.
  // Normal closing speed (not tangential speed) and reduced-mass share make
  // grazing/low-speed contacts safe and small-to-large asymmetry continuous.
  const severe=.8*SHIP_IMPACT_GAIN*(Math.max(0,closing-cruise*.5)/(cruise*.5))**2,am=shipMass(a),bm=shipMass(b);
  const amount=(ship:Ship,share:number)=>{
    const gain=share*(ship.spec.collisionDamageMultiplier??1);
    const ordinary=ship.spec.hull*Math.min(SHIP_IMPACT_LIMIT,intensity*gain),energy=ship.spec.hull*severe*gain;
    return {ordinary,energy,total:ordinary+energy};
  };
  const first=amount(a,2*bm/(am+bm)),second=amount(b,2*am/(am+bm));
  return{fatalA:first.total>=a.hull&&a.hull>0,fatalB:second.total>=b.hull&&b.hull>0,a:first.total,b:second.total,ordinaryA:first.ordinary,ordinaryB:second.ordinary,severeA:first.energy,severeB:second.energy};
}
