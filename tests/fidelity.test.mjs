import test from 'node:test';
import assert from 'node:assert/strict';
import { HILLS } from '@wieslawsoltes/ski-hills';
import { JumpSimulation, CPUController, FIXED_DT, scoreJump, pointsPerMetre, startSignal, START_WINDOW_SECONDS, START_BLINK_SECONDS, LANDING_CHORD_SECONDS } from '@wieslawsoltes/ski-physics';
import { Competition, createField, createTeams, TEAM_CUP_POINTS } from '@wieslawsoltes/ski-competition';
import { ReplayRecorder, ReplayPlayer, validateReplay } from '@wieslawsoltes/ski-replay';
import { GameStore, DEFAULT_SETTINGS } from '@wieslawsoltes/ski-storage';
import { SkiInput } from '@wieslawsoltes/ski-input';
import { CLASSIC_HUD_LAYOUT, drawClassicHUD } from '@wieslawsoltes/ski-ui';
const player={name:'REFERENCE',country:'FIN'};
const step=(s,n)=>{for(let i=0;i<n;i++)s.step();};
const flight=()=>{const s=new JumpSimulation('fin',{rules:'dsj210',seed:42}); s.state.phase='flight';s.state.flightTime=1;s.state.y=100;return s;};
const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};

test('documented start-window and blink thresholds are 15 and 10 seconds',()=>{
 assert.equal(START_WINDOW_SECONDS,15);assert.equal(START_BLINK_SECONDS,10);
 assert.equal(startSignal(4.99).blinking,false);assert.equal(startSignal(5).blinking,true);
 assert.equal(startSignal(15).red,true);assert.equal(startSignal(15).green,false);assert.equal(startSignal(15).expired,true);
 assert.throws(()=>startSignal(NaN));
});
test('original-profile gate expires precisely on step 1800 and emits one zero-score disqualification',()=>{
 const s=new JumpSimulation('fin',{rules:'dsj210'});let count=0;s.events.on('finish',()=>count++);
 step(s,1799);assert.equal(s.state.phase,'gate');assert.equal(s.result,null);s.step();
 assert.equal(s.state.phase,'finished');assert.equal(s.result.disqualified,true);assert.equal(s.result.reason,'start-time-exceeded');
 assert.equal(s.state.time,15);assert.equal(s.result.total,0);assert.deepEqual(s.result.judges,[0,0,0,0,0]);
 step(s,300);assert.equal(count,1);assert.equal(s.start(),false);assert.equal(s.disqualify(),false);
});
test('gate wind evolves before start but legacy gate semantics remain unchanged',()=>{
 const a=new JumpSimulation('fin',{rules:'dsj210',seed:23}),b=new JumpSimulation('fin',{seed:23});
 const initial=a.state.wind;step(a,300);step(b,300);assert.notEqual(a.state.wind,initial);assert.ok(Math.abs(a.state.time-2.5)<1e-10);
 assert.equal(b.state.time,0);assert.equal(b.state.gateElapsed,0);assert.equal(b.state.phase,'gate');
 assert.equal(a.start(),true);step(a,1800);assert.equal(a.state.disqualified,false);
});
test('reset restores original start signal and clears timed foot state',()=>{
 const a=flight();a.landingFoot('right');a.reset();assert.equal(a.state.phase,'gate');assert.equal(a.state.startRemaining,15);assert.equal(a.state.rightLandingTime,-1);
});
for(const [category,k,ppm,base] of [['small',70,2,60],['large',135,1.8,60],['flying',170,1.2,120]]) {
 test(`manual scoring coefficient and K-point base for ${category} hills`,()=>{
  assert.equal(pointsPerMetre(k,'dsj210',category),ppm);
  const r=scoreJump({distance:k+10,k,judges:[18,19,20,19.5,17],rules:'dsj210',hillClass:category});
  assert.equal(r.distancePoints,base+10*ppm);assert.equal(r.stylePoints,56.5);assert.deepEqual(r.counted,[0,1,3]);
 });
}
test('legacy distance coefficients remain available without changing old saved results',()=>{assert.equal(pointsPerMetre(50),4.8);assert.equal(pointsPerMetre(105),2.4);assert.equal(pointsPerMetre(50,'dsj210'),2);assert.throws(()=>pointsPerMetre(50,'unknown'));});
for(const side of ['left','right']){
 test(`simultaneous feet in ${side}-first order prepare parallel landing`,()=>{
  const s=flight();s.landingFoot(side);s.landingFoot(side==='left'?'right':'left');assert.equal(s.state.landing,'parallel');assert.equal(s.state.telemarkWidth,0);
 });
 test(`sequential feet in ${side}-first order prepare telemark with timing-based width`,()=>{
  const s=flight();s.landingFoot(side);s.state.flightTime+=.2;s.landingFoot(side==='left'?'right':'left');assert.equal(s.state.landing,'telemark');assert.ok(Math.abs(s.state.telemarkWidth-.5)<1e-12);
 });
}
test('longer interval makes a wider telemark and repeated same-foot press cannot complete it',()=>{
 const a=flight(),b=flight();for(const s of [a,b]){s.landingFoot('left');assert.equal(s.landingFoot('left'),false);assert.equal(s.state.rightLandingTime,-1);}
 a.state.flightTime+=.1;b.state.flightTime+=.3;a.landingFoot('right');b.landingFoot('right');assert.ok(b.state.telemarkWidth>a.state.telemarkWidth);
 assert.equal(a.landingFoot('other'),false);
});
test('authored simultaneous tolerance is inclusive and distinct from a sequential telemark',()=>{
 const a=flight(),b=flight();a.landingFoot('left');b.landingFoot('left');a.state.flightTime+=LANDING_CHORD_SECONDS;b.state.flightTime+=LANDING_CHORD_SECONDS+.001;
 a.landingFoot('right');b.landingFoot('right');assert.equal(a.state.landing,'parallel');assert.equal(b.state.landing,'telemark');
});
test('an incomplete one-foot landing falls rather than silently converting to telemark',()=>{
 const s=flight();s.landingFoot('left');s.state.flightTime+=.2;s.touchdown({angle:0});assert.equal(s.result.crashed,true);
});
test('excessively wide telemark can fall; accessibility commands complete both feet',()=>{
 const s=flight();s.landingFoot('left');s.state.flightTime+=.6;s.landingFoot('right');s.touchdown({angle:0});assert.equal(s.result.crashed,true);
 const a=flight();a.land('telemark');assert.ok(a.state.leftLandingTime>=0&&a.state.rightLandingTime>=0);assert.equal(a.state.telemarkWidth,.5);
});
for(const hill of HILLS) test(`DSJ 2.10 profile completes ${hill.name} K${hill.k} with finite scores`,()=>{
 const s=new JumpSimulation(hill,{rules:'dsj210',seed:42}),cpu=new CPUController(42,.98);
 for(let i=0;i<12000&&s.state.phase!=='finished';i++){cpu.update(s);s.step();}
 assert.equal(s.state.phase,'finished');assert.equal(s.result.crashed,false);assert.equal(s.result.rules,'dsj210');assert.ok(Number.isFinite(s.result.total));
 assert.equal(s.result.physics,'sjw-dsj210-1');
});
test('documented team cup awards 200,160,120,100 rather than individual points',()=>{
 assert.deepEqual(TEAM_CUP_POINTS,[200,160,120,100]);const teams=createTeams([player],3);
 const c=new Competition({mode:'team',teams,players:teams.flatMap(t=>t.members),rules:'dsj210'});
 while(c.status==='running'){const p=c.current();c.submit({hillId:'fin',total:100-teams.findIndex(t=>t.id===p.teamId),rules:'dsj210'});}
 assert.deepEqual(c.standings().map(r=>r.total),[200,160,120,100]);
 const old=new Competition({mode:'team',teams,players:teams.flatMap(t=>t.members)});
 while(old.status==='running')old.submit({hillId:'fin',total:1});assert.equal(old.standings()[0].total,100);
});
test('cup serialization snapshots rules; pre-0.3 saves restore as legacy and reject unknown profiles',()=>{
 const c=new Competition({players:createField([player],0),rules:'dsj210'});assert.equal(Competition.restore(c.serialize()).options().rules,'dsj210');
 const d=JSON.parse(c.serialize());delete d.rules;assert.equal(Competition.restore(JSON.stringify(d)).rules,'legacy');
 d.rules='invalid';assert.throws(()=>Competition.restore(JSON.stringify(d)));
 assert.throws(()=>c.submit({hillId:'fin',total:100,rules:'legacy'}));
});
test('timed-out cup jump advances exactly once and carries zero points',()=>{
 const c=new Competition({players:createField([player],0),rules:'dsj210'}),s=new JumpSimulation(c.hill,c.options());step(s,1800);assert.equal(c.submit(s.result),'round');assert.equal(c.rows()[0].total,0);
});
test('fresh installations use original profile; previous settings preserve legacy mode',()=>{
 assert.equal(new GameStore(memory()).settings().rules,'dsj210');assert.equal(DEFAULT_SETTINGS.control,'classic');
 const s=new GameStore(memory());s.set('settings',{volume:.4,control:'modern'});assert.equal(s.settings().rules,'legacy');assert.equal(s.settings().presentation,'enhanced');
});
test('records, leaderboards and ghosts are isolated by rules and reject disqualification',()=>{
 const store=new GameStore(memory());const base={hillId:'fin',distance:110,total:140,assisted:false,crashed:false};
 assert.equal(store.updateRecord(base,player),true);assert.equal(store.updateRecord({...base,distance:100,rules:'dsj210'},player),true);
 assert.equal(store.hillLeaderboard('fin')[0].distance,110);assert.equal(store.hillLeaderboard('fin',false,10,'dsj210')[0].distance,100);
 assert.equal(store.personalBests(player.name,false,'dsj210').fin.distance,100);
 const dsq={...base,distance:999,disqualified:true,rules:'dsj210'};assert.equal(store.updateRecord(dsq,player),false);store.addJump(dsq);assert.equal(store.stats().landings,0);
 const restored=new GameStore(memory());restored.importData(store.exportData());assert.equal(restored.hillLeaderboard('fin',false,10,'dsj210')[0].distance,100);
});
test('version-2 replay round-trips stance and gate time; old version-1 replays still play',()=>{
 for(const rules of ['dsj210','legacy']){
  const s=new JumpSimulation('fin',{rules,seed:42}),rec=new ReplayRecorder(s,player),cpu=new CPUController(42,.98);step(s,60);rec.capture();
  for(let i=0;i<12000&&s.state.phase!=='finished';i++){cpu.update(s);s.step();rec.capture();}
  const r=rec.finish(),validated=validateReplay(JSON.parse(JSON.stringify(r))),p=new ReplayPlayer(validated);
  assert.equal(r.version,rules==='dsj210'?2:1);assert.equal(r.frames[0].length,rules==='dsj210'?18:12);
  const last=p.sample(p.duration);assert.equal(last.phase,'finished');assert.equal(last.gateElapsed,rules==='dsj210'?.5:0);
  if(rules==='dsj210')assert.equal(last.telemarkWidth,r.result.telemarkWidth);
 }
});
test('disqualification replays retain the entire gate clock and terminal status',()=>{
 const s=new JumpSimulation('fin',{rules:'dsj210'}),r=new ReplayRecorder(s,player);for(let i=0;i<1800;i++){s.step();r.capture();}
 const p=new ReplayPlayer(r.finish());assert.equal(p.duration,15);assert.equal(p.sample(15).disqualified,true);assert.equal(p.sample(10).phase,'gate');
 const bad=r.finish();bad.frames[0][14]=2;assert.throws(()=>validateReplay(bad));
});
test('classic HUD has 13-pixel status band and measured wind/judge positions, without guide overlays',()=>{
 const calls=[];const ctx=new Proxy({}, {get:(o,k)=>o[k]??((...args)=>calls.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});
 drawClassicHUD(ctx,320,200,{...flight().state,phase:'runout',distance:145}, {name:'Finland',k:105},player,{presentation:'classic'},{result:{distance:145,judges:[18,18,19,19,18],counted:[0,1,2]}});
 assert.equal(CLASSIC_HUD_LAYOUT.statusHeight,13);assert.ok(calls.some(c=>JSON.stringify(c)==='["fillRect",0,187,320,13]'));
 assert.ok(calls.some(c=>JSON.stringify(c)==='["fillRect",287,3,29,27]'));assert.ok(calls.some(c=>JSON.stringify(c)==='["fillRect",291,58,25,11]'));
});

test('scoped record reset preserves every other profile, assisted board and replay library',()=>{
 const s=new GameStore(memory());
 for(const rules of ['legacy','dsj210'])for(const assisted of [false,true]){
  const key=s.recordKey('fin',assisted,rules);s.updateRecord({hillId:'fin',distance:100,total:120,rules,assisted},player);s.set('ghost.'+key,{sentinel:true});
 }
 s.set('replays',[{id:'preserve'}]);s.resetRecords(false,'dsj210');
 assert.equal(s.records()['fin.dsj210'],undefined);assert.equal(s.leaderboards()['fin.dsj210'],undefined);assert.equal(s.get('ghost.fin.dsj210'),null);
 for(const key of ['fin','fin.assisted','fin.dsj210.assisted']){assert.ok(s.records()[key]);assert.ok(s.get('ghost.'+key));}
 assert.equal(s.get('replays')[0].id,'preserve');assert.throws(()=>s.resetRecords(false,'invalid'));
});
test('legacy telemark retains its visual split stance',()=>{
 const s=new JumpSimulation('fin');s.state.phase='flight';s.state.flightTime=1;s.land('telemark');assert.equal(s.state.telemarkWidth,.5);s.land('parallel');assert.equal(s.state.telemarkWidth,0);
});
test('replay wind arrow interpolates the shortest arc and gate clock is continuous',()=>{
 const sim=new JumpSimulation('fin',{rules:'dsj210'}),rec=new ReplayRecorder(sim,player);sim.step();rec.capture(true);
 const r=rec.finish();r.frames[0][16]=3.1;r.frames[1][16]=-3.1;r.frames[1][0]=1;r.frames[1][15]=1;
 const p=new ReplayPlayer(r),v=p.sample(.5);assert.ok(Math.abs(v.windAngle)>3);assert.equal(v.gateElapsed,.5);
});
