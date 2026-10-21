import {expect,test,vi} from 'vitest';
import {listenHost,sendHost,PROTOCOL} from '../src/bridge';
test('host commands require same-origin parent, protocol and supported values; listener is removable',()=>{
 const callbacks=new Set<(event:MessageEvent)=>void>(),parent={postMessage:vi.fn()};
 vi.stubGlobal('window',{parent,location:{origin:'https://fleet.test'},addEventListener:(_name:string,fn:(event:MessageEvent)=>void)=>callbacks.add(fn),removeEventListener:(_name:string,fn:(event:MessageEvent)=>void)=>callbacks.delete(fn)});
 try{const on=vi.fn(),stop=listenHost(on),message={source:PROTOCOL,version:1,type:'command',command:'set-mode',value:'teams'};
 const emit=(patch:Record<string,unknown>={})=>callbacks.forEach(fn=>fn({origin:'https://fleet.test',source:parent,data:message,...patch} as unknown as MessageEvent));
 emit({origin:'https://elsewhere.test'});emit({source:{}});emit({data:{...message,version:2}});emit({data:{...message,value:'invalid'}});emit({data:{...message,command:'set-speed',value:8}});expect(on).not.toHaveBeenCalled();
 emit();expect(on).toHaveBeenLastCalledWith('set-mode','teams');emit({data:{...message,command:'pause'}});expect(on).toHaveBeenLastCalledWith('pause');stop();emit();expect(on).toHaveBeenCalledTimes(2);
 sendHost('ready',{modes:['teams']});expect(parent.postMessage).toHaveBeenCalledWith({source:PROTOCOL,version:1,type:'ready',payload:{modes:['teams']}},'https://fleet.test');
 }finally{vi.unstubAllGlobals();}
});
