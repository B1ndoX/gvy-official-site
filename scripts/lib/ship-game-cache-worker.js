/* Generated resource revisions are prepended by the production builder. */
const CACHE_NAME='gvy-ship-battle-resources-v1';
const resources=new Map(RESOURCES.map(resource=>[resource.url,resource]));
const subscribers=new Map();
const pending=new Map();
let job=null;
const key=resource=>new URL(resource.url+'?revision='+resource.revision,self.location.origin).href;

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

async function storedResponse(resource,signal){
  const cache=await caches.open(CACHE_NAME),url=key(resource),cached=await cache.match(url);
  if(cached)return cached;
  if(pending.has(url)){try{return (await pending.get(url)).clone();}catch(error){if(signal?.aborted)throw error;return storedResponse(resource,signal);}}
  const task=(async()=>{
    const response=await fetch(url,{cache:'force-cache',priority:signal?'low':'high',signal});
    if(!response.ok)throw new Error('Resource HTTP '+response.status);
    await cache.put(url,response.clone());
    return response;
  })();
  pending.set(url,task);
  try{return (await task).clone();}finally{pending.delete(url);}
}
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  const path=url.pathname==='/games/ship-battle/'?'/games/ship-battle/index.html':url.pathname;
  const resource=resources.get(path)||(path.startsWith('/assets/member-avatars/')?resources.get('/games/ship-battle'+path):undefined);
  if(resource)event.respondWith(storedResponse(resource).catch(()=>fetch(event.request)));
});

function announce(state,type='progress',message=''){
  for(const [id,subscriber]of subscribers){
    try{subscriber.client.postMessage({source:'gvy.ship-cache',requestId:subscriber.requestId,type,loaded:state.loaded,total:RESOURCES.length,message});}
    catch{subscribers.delete(id);}
  }
}
async function warm(){
  if(job){if(job.state.controller.signal.aborted){await job.promise;return warm();}return job.promise;}
  if(![...subscribers.values()].some(subscriber=>!subscriber.held))return;
  const state={loaded:0,controller:new AbortController()};
  const promise=(async()=>{
    try{
      const cache=await caches.open(CACHE_NAME),queue=[];
      for(const resource of RESOURCES){
        if(state.controller.signal.aborted)return;
        if(await cache.match(key(resource)))state.loaded++;else queue.push(resource);
      }
      announce(state);
      const work=async()=>{
        while(queue.length&&!state.controller.signal.aborted){
          await storedResponse(queue.shift(),state.controller.signal);
          state.loaded++;announce(state);
        }
      };
      await Promise.all([work(),work()]);
      if(!state.controller.signal.aborted){announce(state,'complete');subscribers.clear();}
    }catch(error){
      if(!state.controller.signal.aborted){announce(state,'error',error.name==='QuotaExceededError'?'缓存空间不足，可直接进入游戏。':'部分资源尚未缓存，可重试或直接进入游戏。');subscribers.clear();}
      state.controller.abort();
    }finally{if(job?.state===state)job=null;}
  })();
  job={state,promise};return promise;
}
self.addEventListener('message',event=>{
  if(event.data?.source!=='gvy.ship-cache'||!event.source?.id)return;
  const id=event.source.id;
  if(event.data.type==='prepare'){
    subscribers.set(id,{client:event.source,requestId:event.data.requestId,held:false});
    event.waitUntil(warm());
  }else if(event.data.type==='hold'||event.data.type==='resume'){
    const subscriber=subscribers.get(id);
    if(!subscriber||subscriber.requestId!==event.data.requestId)return;
    subscriber.held=event.data.type==='hold';
    if(![...subscribers.values()].some(value=>!value.held))job?.state.controller.abort();
    else event.waitUntil(warm());
  }else if(event.data.type==='stop'){
    if(subscribers.get(id)?.requestId!==event.data.requestId)return;
    subscribers.delete(id);
    if(!subscribers.size)job?.state.controller.abort();
  }
});
