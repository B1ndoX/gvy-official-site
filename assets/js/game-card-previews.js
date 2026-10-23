/** Short recordings only: previews never create game iframes or simulations. */
export function initGameCardPreviews({root,view=globalThis}={}){
  const cards=Array.from(root?.querySelectorAll?.('[data-game-card]')||[]);
  let active=null,timer=0,frame=0,keyboardIntent=false;
  const listeners=[];
  const bind=(node,name,fn)=>{node?.addEventListener?.(name,fn);listeners.push(()=>node?.removeEventListener?.(name,fn));};
  const stop=(unload=false)=>{
    if(timer)view.clearTimeout(timer);timer=0;if(frame)view.cancelAnimationFrame(frame);frame=0;active=null;
    for(const card of cards){const video=card.querySelector('video');video?.pause();if(video?.readyState)video.currentTime=0;if(unload&&video?.hasAttribute('src')){video.removeAttribute('src');video.load();}card.classList.remove('is-previewing');card.style.removeProperty('--card-rx');card.style.removeProperty('--card-ry');}
  };
  const play=async(card)=>{
    const rx=card.style.getPropertyValue('--card-rx'),ry=card.style.getPropertyValue('--card-ry');stop();if(rx)card.style.setProperty('--card-rx',rx);if(ry)card.style.setProperty('--card-ry',ry);active=card;const video=card.querySelector('video');if(!video)return;
    video.muted=true;if(!video.getAttribute('src'))video.src=video.dataset.src;
    try{await video.play();if(active!==card){video.pause();return;}card.classList.add('is-previewing');}catch{/* Leave the still image and launch button usable if autoplay is unavailable. */}
  };
  const automatic=()=>view.matchMedia?.('(hover:hover) and (pointer:fine)').matches&&!view.matchMedia?.('(prefers-reduced-motion:reduce)').matches&&!view.navigator?.connection?.saveData;
  bind(root?.ownerDocument,'keydown',event=>{if(event.key==='Tab')keyboardIntent=true;});
  bind(root?.ownerDocument,'pointerdown',()=>{keyboardIntent=false;});
  for(const card of cards){
    const enter=()=>{if(!automatic())return;stop();timer=view.setTimeout(()=>{timer=0;void play(card);},220);};
    bind(card,'pointerenter',enter);
    bind(card,'pointerleave',()=>{if(automatic())stop();});
    bind(card,'pointermove',event=>{if(!automatic()||frame)return;const x=event.clientX,y=event.clientY;frame=view.requestAnimationFrame(()=>{frame=0;const r=card.getBoundingClientRect();const unit=25*Math.max(1,r.width/480),angle=value=>Math.max(-10,Math.min(10,value/unit));card.style.setProperty('--card-rx',`${angle(y-r.top-r.height/2)}deg`);card.style.setProperty('--card-ry',`${angle(x-r.left-r.width/2)}deg`);});});
    bind(card,'focusin',event=>{if(keyboardIntent&&event.target.matches?.(':focus-visible'))enter();});
    bind(card,'focusout',event=>{if(!card.contains(event.relatedTarget))stop();});
  }
  bind(root?.ownerDocument,'visibilitychange',()=>{if(root.ownerDocument.hidden)stop(true);});
  return {stop,cleanup(){stop(true);listeners.forEach(remove=>remove());}};
}
