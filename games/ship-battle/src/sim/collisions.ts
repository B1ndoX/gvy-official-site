import type {Ship} from './types';

export const SHIP_IMPACT_LIMIT=.05,SHIP_IMPACT_PER_SECOND=.08;
const SHIP_IMPACT_GAIN=1.38;
export const shipMass=(s:Ship)=>Math.max(1,s.spec.mass??s.spec.length*s.spec.beam*s.spec.beam);

/** Distance to the hull along a world bearing; long hulls do not repel everything in their bounding circle. */
export const hullRadiusAt=(ship:Pick<Ship,'heading'|'spec'>,bearing:number)=>1/Math.hypot(Math.cos(bearing-ship.heading)/(ship.spec.length*.48+3),Math.sin(bearing-ship.heading)/(ship.spec.beam*.48+3));

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
