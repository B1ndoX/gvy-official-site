import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {verificationPlan,validatePlan,hasPassedVerification,validateGateResults,REQUIRED_CHECKS} from '../scripts/lib/verification-plan.mjs';

const root=resolve(new URL('..',import.meta.url).pathname);
test('ship changes select game checks and entries, without unrelated media or arena suites',()=>{
 const p=verificationPlan(['games/ship-battle/src/render/WeaponEffects.ts']);
 assert.equal(p.ship,true);assert.equal(p.media,false);assert.equal(p.publisher,false);
 assert.deepEqual(p.suites,['fleet-game-hub.spec.js','ship-release-entry.spec.js']);
});
test('known documentation still runs the independent site gate and requires no browser tools',()=>{
 const p=verificationPlan(['README.md','上下文.md','games/ship-battle/docs/TESTING.md']);
 assert.equal(p.mode,'docs');assert.equal(p.tools,false);assert.deepEqual(p.suites,[]);
});
test('roster updates exercise both host games without upstream queries or full physics regressions',()=>{
 const p=verificationPlan(['assets/js/fleet-members.js','assets/member-avatars/'+'a'.repeat(64)+'.webp']);
 assert.equal(p.ship,false);assert.equal(p.media,false);
 assert.ok(p.suites.includes('production-smoke.spec.js')&&p.suites.includes('ship-release-entry.spec.js'));
 assert.ok(!p.suites.some(s=>s.startsWith('arena-')));
});
test('gallery, publisher and media select their real dependencies and can be combined',()=>{
 const gallery=verificationPlan(['assets/js/archive-carousel.js']);assert.deepEqual(gallery.suites,['archive-interaction.spec.js']);assert.equal(gallery.publisher,false);
 const publisher=verificationPlan(['tools/gallery-publisher/lib/process.mjs']);assert.equal(publisher.publisher,true);assert.equal(publisher.media,false);
 const media=verificationPlan(['assets/hero-random/v2/cut.mp4']);assert.equal(media.media,true);assert.ok(media.suites.includes('video-playback.spec.js'));
 const combined=verificationPlan(['tools/gallery-publisher/server.mjs','games/ship-battle/src/App.tsx']);assert.equal(combined.ship,true);assert.equal(combined.publisher,true);
});
test('shared files, workflow changes, dependency locks, unknown paths and empty comparisons fail closed to full coverage',()=>{
 for(const path of ['index.html','assets/cinematic-homepage.css','assets/js/ship-game-cache.js','package-lock.json','scripts/build-site.mjs','.github/workflows/verify.yml','.nvmrc','unclassified/new-file.bin','tests/new-contract.test.js']) {
  const p=verificationPlan([path]);assert.equal(p.mode,'full',path);assert.ok(p.ship&&p.publisher&&p.media&&p.browser);
 }
 assert.equal(verificationPlan([]).mode,'full');
 assert.equal(verificationPlan(['README.md'],{full:true}).mode,'full');
});
test('unsafe paths and malformed or contradictory plans are rejected before executing commands',()=>{
 for(const path of ['/outside','../outside','a/../outside',''])assert.throws(()=>verificationPlan([path]));
 const p=verificationPlan(['README.md']);
 for(const changed of [{version:2},{tools:true},{browser:true},{suites:['../../script.js']},{mode:'full'},{mode:'unknown'}])assert.throws(()=>validatePlan({...p,...changed}));
});
const candidate='a'.repeat(40),tree='b'.repeat(40);
const proof=()=>({candidate,sourceTree:tree,targetTree:tree,run:{head_sha:candidate,path:'.github/workflows/verify.yml',event:'pull_request',conclusion:'success',check_suite_id:17},checks:REQUIRED_CHECKS.map(name=>({name,head_sha:candidate,app:{id:15368},check_suite:{id:17},status:'completed',conclusion:'success'}))});
test('post-merge reuse requires identical trees, matching SHA, actual workflow and both actual successful Actions checks',()=>{
 assert.equal(hasPassedVerification(proof()),true);
 for(const change of [{targetTree:'c'.repeat(40)},{candidate:'d'.repeat(40)},{checks:[]},{run:{...proof().run,conclusion:'failure'}},{run:{...proof().run,path:'.github/workflows/other.yml'}}])assert.equal(hasPassedVerification({...proof(),...change}),false);
 for(const mutate of [p=>p.checks[0].app.id=1,p=>p.checks[0].head_sha=tree,p=>p.checks[0].check_suite.id=18,p=>p.checks[1].conclusion='skipped',p=>p.checks[0].status='in_progress']){const p=proof();mutate(p);assert.equal(hasPassedVerification(p),false);}
 assert.equal(verificationPlan(['index.html'],{verifiedMerge:true}).mode,'verified-merge');
});
test('git comparison includes a deleted source when it is renamed to documentation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gvy-verification-diff-'));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git('init');git('config','user.name','CI fixture');git('config','user.email','fixture@example.invalid');
  await writeFile(join(dir,'index.html'),'fixture');git('add','.');git('commit','-m','base');const base=git('rev-parse','HEAD');
  await writeFile(join(dir,'README.md'),'fixture');await rm(join(dir,'index.html'));git('add','-A');git('commit','-m','rename');git('remote','add','origin',dir);
  await writeFile(join(dir,'event.json'),JSON.stringify({pull_request:{base:{sha:base}}}));
  execFileSync(process.execPath,[resolve(root,'scripts/plan-verification.mjs')],{cwd:dir,env:{...process.env,GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:'B1ndoX/gvy-official-site',GITHUB_EVENT_PATH:join(dir,'event.json')},stdio:'pipe'});
  assert.equal(JSON.parse(await readFile(join(dir,'verification-plan.json'),'utf8')).mode,'full');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('required gates reject failed, cancelled, missing and skipped selected jobs',()=>{
 const ship=verificationPlan(['games/ship-battle/src/App.tsx']);
 validateGateResults(ship,{plan:'success',game:'success',tools:'success'});
 for(const changed of [{plan:'failure'},{game:'failure'},{game:'cancelled'},{game:'skipped'},{tools:undefined},{tools:'failure'},{tools:'skipped'}])assert.throws(()=>validateGateResults(ship,{plan:'success',game:'success',tools:'success',...changed}));
 const docs=verificationPlan(['README.md']);validateGateResults(docs,{plan:'success',game:'skipped',tools:'skipped'});
 assert.throws(()=>validateGateResults(docs,{plan:'success',game:'failure',tools:'skipped'}));
});
test('a failed selected check fails the game process rather than reporting a successful gate',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gvy-verification-failure-'));
 try{
  const fake=join(dir,'npm');await writeFile(fake,'#!/bin/sh\nexit 23\n');await chmod(fake,0o755);
  const result=spawnSync(process.execPath,[resolve(root,'scripts/run-verification.mjs'),'game'],{cwd:root,encoding:'utf8',env:{...process.env,PATH:dir+':'+process.env.PATH,GVY_VERIFICATION_PLAN:JSON.stringify(verificationPlan(['games/ship-battle/src/App.tsx']))}});
  assert.notEqual(result.status,0);assert.match(result.stderr,/status: 23/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
