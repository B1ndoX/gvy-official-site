import test from 'node:test';
import assert from 'node:assert/strict';
import {githubQuery} from '../lib/github-query.mjs';

test('an interrupted PR lookup recovers without repeating a publish write',async()=>{
  const calls=[],waits=[];const response={stdout:'[{"url":"https://github.com/example/site/pull/7"}]'};
  const result=await githubQuery(['pr','list','--head','gallery-publisher/batch','--json','url'],{
    cwd:'/isolated/gallery',wait:async ms=>waits.push(ms),run:async(command,args,options)=>{
      calls.push({command,args,options});
      if(calls.length<3)throw Error('Post "https://api.github.com/graphql": EOF');
      return response;
    },
  });
  assert.equal(result,response);assert.equal(calls.length,3);assert.deepEqual(waits,[1000,3000]);
  assert(calls.every(c=>c.command==='gh'&&c.args[1]==='list'&&c.options.cwd==='/isolated/gallery'));
});

test('a persistent network failure is bounded and retains its original error',async()=>{
  let attempts=0;const error=Error('Get "https://api.github.com/graphql": EOF');
  await assert.rejects(githubQuery(['pr','view','https://github.com/example/site/pull/7'],{
    cwd:'/isolated/gallery',wait:async()=>{},run:async()=>{attempts++;throw error;},
  }),e=>e===error);
  assert.equal(attempts,3);
});

test('authentication, invalid input and check failures return immediately',async()=>{
  for(const message of ['HTTP 401: Bad credentials','unknown flag: --bad','相册PR检查失败']){
    let attempts=0;await assert.rejects(githubQuery(['pr','view','7'],{
      wait:async()=>assert.fail('Non-network errors must not wait'),run:async()=>{attempts++;throw Error(message);},
    }),e=>e.message===message);assert.equal(attempts,1);
  }
});

test('create and merge are never run by the retry helper',async()=>{
  for(const action of ['create','merge','close'])await assert.rejects(githubQuery(['pr',action,'7'],{
    run:async()=>assert.fail('A publish write must not be automatically replayed'),
  }),/read-only/);
});
