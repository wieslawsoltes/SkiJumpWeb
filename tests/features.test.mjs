import test from 'node:test';
import assert from 'node:assert/strict';
import { Competition, TourSchedule, competitionCSV, createField, createTeams, normalizePlayer } from '../packages/competition/index.js';
import { HILLS, TOUR_PRESETS } from '../packages/hills/index.js';
import { JumpSimulation, CPUController, scoreJump } from '../packages/physics/index.js';
import { ReplayPlayer, ReplayRecorder } from '../packages/replay/index.js';
import { GameStore } from '../packages/storage/index.js';
import { SkiInput } from '../packages/input/index.js';

const player = normalizePlayer({ name: 'ALPHA' });
const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const result = (cup, value = 100) => ({ hillId: cup.hill.id, total: value, distance: 100, crashed: false, judges: [18,18,18,18,18] });
function replay() {
    const sim = new JumpSimulation('fin', { seed: 42, windBase: 1 });
    const cpu = new CPUController(42, .98), recorder = new ReplayRecorder(sim, player);
    for (let i = 0; sim.state.phase !== 'finished' && i < 14400; i++) { cpu.update(sim); sim.step(); recorder.capture(); }
    return recorder.finish();
}
const recording = replay();

test('tour presets preserve their explicit sequence, not hill roster order', () => {
    for (const [name, hills] of Object.entries(TOUR_PRESETS)) {
        const tour = new TourSchedule(hills, name);
        assert.deepEqual(tour.hills, hills);
        assert.deepEqual(TourSchedule.parse(tour.serialize()).hills, hills);
    }
});
test('tour duplicate, movement and removal work by event index', () => {
    const t = new TourSchedule(['slo','fin','eng']);
    t.insert('fin', 1).move(3, 0).remove(2);
    assert.deepEqual(t.hills, ['eng','slo','fin']);
    t.reverse(); assert.deepEqual(t.hills, ['fin','slo','eng']);
});
test('tour operations never mutate the source preset', () => {
    const hills = ['eng','fin']; new TourSchedule(hills).reverse().insert('slo'); assert.deepEqual(hills, ['eng','fin']);
});
test('tour supports 64 repeated venues and rejects a 65th', () => {
    const t = new TourSchedule(Array(64).fill('eng')); assert.equal(t.hills.length,64);
    assert.throws(() => t.insert('eng'), RangeError); assert.throws(() => new TourSchedule(Array(65).fill('eng')), RangeError);
});
test('tour rejects unknown hills, malformed files, and invalid indices', () => {
    assert.throws(() => TourSchedule.parse('{}')); assert.throws(() => TourSchedule.parse('x'.repeat(10001)));
    assert.throws(() => new TourSchedule(['bad'])); assert.throws(() => new TourSchedule(null));
    const t = new TourSchedule(['fin']);
    for (const index of [-1, .2, Infinity, NaN, 2]) assert.throws(() => t.insert('eng',index));
    assert.throws(() => t.move(0,1)); assert.throws(() => t.remove(-1));
});
test('tour shuffle is deterministic, preserves multiplicity, and remains serializable', () => {
    const hills = ['slo','fin','fin','eng']; const a = new TourSchedule(hills).shuffle(73), b = new TourSchedule(hills).shuffle(73);
    assert.deepEqual(a.hills,b.hills); assert.deepEqual([...a.hills].sort(),[...hills].sort());
    assert.equal(TourSchedule.parse(a.serialize()).serialize(),a.serialize());
});
test('start list exposes bib, state and previous round without mutating a cup', () => {
    const c = new Competition({ players: createField([player], 1), seed: 12 });
    let original = c.serialize(), rows = c.startList();
    assert.equal(rows[0].bib,1); assert.equal(rows[0].current,true); assert.equal(rows[1].completed,false); assert.equal(c.serialize(),original);
    c.submit(result(c)); assert.equal(c.startList()[0].completed,true); c.submit(result(c,101));
    assert.equal(c.round,2); assert.ok(c.startList().every(row => row.previous));
});
test('team start list separates the four jumping groups', () => {
    const teams = createTeams([player],2), c = new Competition({mode:'team',teams,players:teams.flatMap(t=>t.members)});
    assert.deepEqual(c.startList().map(p=>p.group),[1,1,1,2,2,2,3,3,3,4,4,4]);
});
test('target estimate clears the leader after the assumed style points', () => {
    const c = new Competition({players:createField([player],1)});
    assert.equal(c.target(),null); c.submit(result(c,120)); const target = c.target();
    assert.ok(target); assert.equal(target.assumedStyle,54);
    assert.ok(scoreJump({ distance:target.distance,k:c.hill.k,judges:[18,18,18,18,18]}).total>120);
});
test('team details expose all four athletes and both round scores', () => {
    const teams=createTeams([player],0),c=new Competition({mode:'team',teams,players:teams.flatMap(t=>t.members)});
    c.submit(result(c)); const rows=c.teamDetails(teams[0].id);
    assert.equal(rows.length,4); assert.equal(rows[0].total,100); assert.equal(rows[0].jumps.length,2);
    rows[0].jumps[0].total=1; assert.equal(c.rows()[0].total,100);
    assert.throws(()=>c.teamDetails('bad'));
});
test('a repeated 64-event tour progresses, saves, and resumes through every event', () => {
    let c=new Competition({players:createField([player],0),hills:Array(64).fill('eng')});
    for(let i=0;i<64;i++) {
        assert.equal(c.eventIndex,i); c.submit(result(c)); c=Competition.restore(c.serialize());
        c.submit(result(c)); assert.equal(c.nextEvent(),i<63);
    }
    assert.equal(c.status,'finished'); assert.equal(c.history.length,64); assert.equal(c.standings()[0].total,6400);
});
test('cup restoration rejects duplicate queue entries and an exhausted running queue',()=>{
    const c=new Competition({players:createField([player],1)}),d=JSON.parse(c.serialize());
    d.queue[1]=d.queue[0];assert.throws(()=>Competition.restore(JSON.stringify(d)));
    d.queue=JSON.parse(c.serialize()).queue;d.turn=d.queue.length;assert.throws(()=>Competition.restore(JSON.stringify(d)));
});
test('reserved prototype property player IDs are rejected',()=>{
    for(const id of ['__proto__','constructor','prototype']) assert.throws(()=>new Competition({players:[{...player,id}]}));
});
test('CSV exports all event results and cup standings with escaped fields',()=>{
    const c=new Competition({players:createField([{...player,name:'=1+1,"TEST"'}],0)});
    c.submit(result(c));c.submit(result(c));const csv=competitionCSV(c);
    assert.ok(csv.includes('"Cup rank","Name","Cup points"'));assert.ok(csv.includes("\"'=1+1,\"\"TEST\"\"\""));assert.ok(csv.endsWith('\r\n'));
});
for(const direction of [-1,1]) test(`replay frame step ${direction} follows actual recorded timestamps`,()=>{
    const p=new ReplayPlayer(recording),fs=p.replay.frames;
    p.seek(fs[50][0]);p.stepFrame(direction);assert.equal(p.time,fs[50+direction][0]);assert.equal(p.paused,true);
    p.seek((fs[50][0]+fs[51][0])/2);p.stepFrame(direction);assert.equal(p.time,fs[direction>0?51:50][0]);
});
test('replay multiframe stepping and boundary clamps',()=>{
    const p=new ReplayPlayer(recording),fs=p.replay.frames;
    p.seek(fs[50][0]);p.stepFrame(10);assert.equal(p.time,fs[60][0]);p.stepFrame(-1000);assert.equal(p.time,0);
    p.stepFrame(100000);assert.equal(p.time,p.duration);assert.throws(()=>p.stepFrame(0));assert.throws(()=>p.stepFrame(.5));
});
test('replay markers point to recorded flight and landing transitions',()=>{
    const p=new ReplayPlayer(recording);p.jumpTo('takeoff');assert.equal(p.sample(p.time).phase,'flight');
    p.jumpTo('landing');assert.equal(p.sample(p.time).phase,'runout');p.jumpTo('end');assert.equal(p.time,p.duration);
    assert.throws(()=>p.jumpTo('unknown'));
});
test('reverse non-looping replay pauses exactly at the beginning',()=>{
    const p=new ReplayPlayer(recording);p.loop=false;p.seek(.25);p.speed=-1;p.update(.25);assert.equal(p.time,0);assert.equal(p.paused,true);
});
test('forward non-looping replay pauses exactly at its final frame',()=>{
    const p=new ReplayPlayer(recording);p.loop=false;p.time=p.duration-.25;p.update(.25);assert.equal(p.time,p.duration);assert.equal(p.paused,true);
});
test('flight-only loop wraps correctly forwards and backwards',()=>{
    const p=new ReplayPlayer(recording);p.setLoop(1,3);p.seek(2.8);p.speed=1;p.update(.4);assert.ok(Math.abs(p.time-1.2)<1e-8);
    p.seek(1.2);p.speed=-1;p.update(.4);assert.ok(Math.abs(p.time-2.8)<1e-8);
});
test('invalid loop ranges, deltas and playback rates do not produce NaN state',()=>{
    const p=new ReplayPlayer(recording);
    for(const range of [[2,1],[-1,2],[0,Infinity],[0,0]])assert.throws(()=>p.setLoop(...range));
    p.seek(1);for(const delta of [NaN,Infinity,-1])p.update(delta);assert.equal(p.time,1);p.speed=NaN;p.update(1);assert.equal(p.time,1);
});
test('record board keeps one best per name, excludes falls, and sorts top ten',()=>{
    const store=new GameStore(memory()),r=recording.result;
    for(let i=0;i<16;i++)store.updateRecord({...r,distance:100+i},{name:`P${i}`});
    assert.equal(store.hillLeaderboard('fin').length,10);assert.equal(store.hillLeaderboard('fin')[0].name,'P15');
    assert.equal(store.personalBests('P0').fin.distance,100);
    store.updateRecord({...r,distance:99},{name:'P15'});assert.equal(store.hillLeaderboard('fin')[0].distance,115);
    store.updateRecord({...r,distance:120,crashed:true},{name:'P0'});assert.equal(store.personalBests('P0').fin.distance,100);
});
test('leaderboards migrate the old overall record on the first additional jump',()=>{
    const store=new GameStore(memory()),r={...recording.result,name:'OLD',date:'2026-01-01'};
    store.set('records',{fin:r});assert.equal(store.hillLeaderboard('fin')[0].name,'OLD');
    store.updateRecord({...r,distance:r.distance-1},{name:'NEW'});assert.equal(store.hillLeaderboard('fin').length,2);
});
test('assisted personal bests and leaderboard snapshots remain isolated',()=>{
    const store=new GameStore(memory()),r=recording.result;
    store.updateRecord(r,player);store.updateRecord({...r,distance:190,assisted:true},player);
    assert.equal(store.personalBests('ALPHA',true).fin.distance,190);
    const rows=store.hillLeaderboard('fin');rows[0].distance=0;assert.equal(store.hillLeaderboard('fin')[0].distance,r.distance);
});
test('named saved tours preserve repeats and bounded library size',()=>{
    const store=new GameStore(memory());for(let i=0;i<22;i++)store.saveTour(new TourSchedule(['slo','slo','eng'],`T${i}`));
    assert.equal(store.tours().length,20);store.saveTour({name:'T21',hills:['fin']});assert.deepEqual(store.tours()[0].hills,['fin']);
    store.deleteTour('T21');assert.equal(store.tours().length,19);assert.throws(()=>store.saveTour({name:'X',hills:[]}));
});
test('replay label editing leaves the recorded player and frames unchanged',()=>{
    const store=new GameStore(memory()),id=store.saveReplay(recording);store.renameReplay(id,'<FINLAND> RECORD');
    assert.equal(store.replays()[0].label,'FINLAND RECORD');assert.equal(store.loadReplay(id).player.name,recording.player.name);
    assert.throws(()=>store.renameReplay('missing','NAME'));
});
test('backup roundtrip retains named tours and personal record boards',()=>{
    const s=new GameStore(memory());s.saveTour(new TourSchedule(['slo','eng'],'MY TOUR'));s.updateRecord(recording.result,player);
    const target=new GameStore(memory());target.importData(s.exportData());assert.deepEqual(target.tours(),s.tours());assert.deepEqual(target.leaderboards(),s.leaderboards());
});
test('invalid tour or leaderboard import cannot partially replace existing data',()=>{
    const s=new GameStore(memory());s.saveSettings({volume:.8});const before=s.exportData(),d=JSON.parse(before);
    d.settings.volume=.1;d.tours=[{name:'BAD',hills:['bad']}];assert.throws(()=>s.importData(JSON.stringify(d)));assert.equal(s.exportData(),before);
    d.tours=[];d.leaderboards={fin:[{name:'X',distance:-1}]};assert.throws(()=>s.importData(JSON.stringify(d)));assert.equal(s.exportData(),before);
});
// Unit-test input button transition logic without a DOM or a global browser shim.
function input(control='classic') {
    let phase='gate';const events=[];const i=Object.create(SkiInput.prototype);
    Object.assign(i,{lastButtons:0,options:{control},handlers:{phase:()=>phase,action:name=>events.push(name)}});
    return {i,events,setPhase:value=>{phase=value}};
}
test('releasing mouse buttons never starts, takes off or changes a landing',()=>{
    for(const phase of ['gate','inrun','flight']) {const {i,events,setPhase}=input('modern');setPhase(phase);i.lastButtons=3;i.handleMouseButtons(1);i.handleMouseButtons(0);assert.deepEqual(events,[]);}
});
test('classic takeoff requires a rising two-button chord',()=>{
    const {i,events,setPhase}=input();setPhase('inrun');i.handleMouseButtons(1);assert.deepEqual(events,[]);
    i.handleMouseButtons(3);i.handleMouseButtons(3);assert.deepEqual(events,['takeoff']);
});
test('classic landing upgrades a one-button telemark to a two-button parallel landing',()=>{
    const {i,events,setPhase}=input();setPhase('flight');i.handleMouseButtons(1);i.handleMouseButtons(3);i.handleMouseButtons(2);i.handleMouseButtons(0);
    assert.deepEqual(events,['telemark','parallel']);
});
test('middle mouse button and movement with no buttons never issue jump commands',()=>{
    const {i,events}=input('modern');i.handleMouseButtons(4);i.handleMouseButtons(0);assert.deepEqual(events,[]);
});

test('backup rejects malformed cup before replacing settings and records', () => {
    const store = new GameStore(memory()); store.saveSettings({ volume: .37 });
    const data = JSON.parse(store.exportData()); data.settings.volume = .9; data.cup = '{"version":1}';
    assert.throws(() => store.importData(JSON.stringify(data)));
    assert.equal(store.settings().volume, .37);
});
test('importing a backup without a cup removes an unrelated saved cup', () => {
    const store = new GameStore(memory());
    const data = store.exportData(); store.set('cup', new Competition({ players: [player] }).serialize());
    store.importData(data); assert.equal(store.get('cup', null), null);
});
test('audio volume never becomes nonfinite and a disposed mixer stays disposed', async () => {
    const { SkiAudio } = await import('../packages/audio/index.js');
    const audio = new SkiAudio({ volume: NaN }); assert.equal(audio.volume,.55);
    audio.setVolume(.3); audio.setVolume(Infinity); assert.equal(audio.volume,.3);
    audio.dispose(); assert.equal(await audio.unlock(), false);
});
