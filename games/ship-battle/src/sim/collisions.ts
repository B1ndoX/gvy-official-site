import type {Ship} from './types';

export const SHIP_IMPACT_LIMIT=.05,SHIP_IMPACT_PER_SECOND=.08;
export const shipMass=(s:Ship)=>Math.max(1,s.spec.length*s.spec.beam*s.spec.beam);

/** Distance to the hull along a world bearing; long hulls do not repel everything in their bounding circle. */
export const hullRadiusAt=(ship:Ship,bearing:number)=>1/Math.hypot(Math.cos(bearing-ship.heading)/(ship.spec.length*.48+3),Math.sin(bearing-ship.heading)/(ship.spec.beam*.48+3));

/** Narrow-phase hull approximation, using oriented ellipse projections rather than bounding circles. */
export function shipContact(a:Ship,b:Ship,padding=0){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),al=a.spec.length*.48+3,aw=a.spec.beam*.48+3,bl=b.spec.length*.48+3,bw=b.spec.beam*.48+3;
  if(d>=Math.max(al,aw)+Math.max(bl,bw)+padding*2)return null;
  const ac=Math.cos(a.heading),as=Math.sin(a.heading),bc=Math.cos(b.heading),bs=Math.sin(b.heading);
  const axes=[[ac,as],[-as,ac],[bc,bs],[-bs,bc],d>.0001?[dx/d,dy/d]:[1,0]];
  let depth=Infinity,nx=1,ny=0;
  for(const [x,y]of axes){
    const ar=Math.hypot(al*(x*ac+y*as),aw*(-x*as+y*ac)),br=Math.hypot(bl*(x*bc+y*bs),bw*(-x*bs+y*bc)),along=dx*x+dy*y,overlap=ar+br+padding*2-Math.abs(along);
    if(overlap<=0)return null;
    if(overlap<depth){depth=overlap;const sign=along<0?-1:1;nx=x*sign;ny=y*sign;}
  }
  return{nx,ny,depth};
}

export function shipImpact(a:Ship,b:Ship,closing:number,nx:number,ny:number){
  const intensity=.035*(Math.max(0,closing-80)/200)**2,am=shipMass(a),bm=shipMass(b);
  const fatal=(ship:Ship,otherMass:number,ownMass:number,toward:number)=>ship.spec.length<35&&otherMass/ownMass>=25&&closing>=Math.max(340,ship.spec.speed*1.4)&&toward>=Math.max(280,ship.spec.speed*1.25)&&toward/Math.max(1,Math.hypot(ship.vx,ship.vy))>=.85;
  const fatalA=fatal(a,bm,am,a.vx*nx+a.vy*ny),fatalB=fatal(b,am,bm,-b.vx*nx-b.vy*ny);
  const amount=(ship:Ship,share:number)=>ship.spec.hull*Math.min(SHIP_IMPACT_LIMIT,intensity*share);
  return{fatalA,fatalB,a:fatalA?a.hull:amount(a,2*bm/(am+bm)),b:fatalB?b.hull:amount(b,2*am/(am+bm))};
}
