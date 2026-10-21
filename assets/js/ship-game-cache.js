// A scoped service worker stores only game 2 resources. The homepage and its
// media remain outside its fetch handling; opening the game hub starts work.
export function createShipGameCache({view=globalThis.window,onProgress=()=>{}}={}){
  const serviceWorkers=view?.navigator?.serviceWorker;
  let promise=null,activation=null,finish=null,worker=null,requestId='',serial=0,firstLoad=false;
  const onMessage=event=>{
    const data=event.data;
    if(event.source!==worker||data?.source!=='gvy.ship-cache'||data.requestId!==requestId)return;
    onProgress({...data,firstLoad});
    if(data.type==='complete')firstLoad=false;
    if(data.type==='complete'||data.type==='error'){finish?.(data.type==='complete');finish=null;}
  };
  serviceWorkers?.addEventListener('message',onMessage);
  const stop=()=>{
    worker?.postMessage({source:'gvy.ship-cache',type:'stop',requestId});
    requestId='';finish?.(false);finish=null;promise=null;activation=null;
  };
  const prepare=()=>{
    if(promise)return promise;
    if(!serviceWorkers)return Promise.resolve(false);
    const token=`${Date.now()}-${++serial}`;requestId=token;
    onProgress({type:'progress',loaded:0,total:0});
    promise=new Promise(resolve=>{finish=resolve;});
    activation=(async()=>{
      try{
        const existing=view.caches&&await view.caches.has('gvy-ship-battle-resources-v1')?await(await view.caches.open('gvy-ship-battle-resources-v1')).keys():[];
        firstLoad=existing.length===0;
        if(requestId!==token)return;
        onProgress({type:'progress',loaded:0,total:0,firstLoad});
        const registration=await serviceWorkers.register('/games/ship-battle/cache-worker.js',{scope:'/games/ship-battle/',updateViaCache:'none'});
        if(registration.active)await registration.update();
        const current=registration.installing||registration.waiting||registration.active;
        if(!current)throw new Error('游戏缓存尚未就绪');
        if(current.state!=='activated')await new Promise((resolve,reject)=>{
          const changed=()=>{if(current.state==='activated'||current.state==='redundant'){current.removeEventListener('statechange',changed);current.state==='activated'?resolve():reject(new Error('缓存启动失败'));}};
          current.addEventListener('statechange',changed);changed();
        });
        if(requestId!==token)return;
        worker=current;
        // Best effort only: a storage permission never blocks play.
        const persistence=view.navigator.storage?.persist?.();persistence?.catch(()=>{});
        worker.postMessage({source:'gvy.ship-cache',type:'prepare',requestId});
      }catch{
        if(requestId!==token)return;
        onProgress({type:'error',loaded:0,total:0,message:'持久缓存暂不可用，可直接进入游戏。'});
        finish?.(false);finish=null;
      }
    })();
    return promise;
  };
  return {prepare,isFirstLoad(){return firstLoad;},ready(){prepare();return activation||Promise.resolve();},hold(){worker?.postMessage({source:'gvy.ship-cache',type:'hold',requestId});},resume(){worker?.postMessage({source:'gvy.ship-cache',type:'resume',requestId});},stop,cleanup(){stop();serviceWorkers?.removeEventListener('message',onMessage);}};
}
