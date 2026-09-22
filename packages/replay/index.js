import { clamp, lerp, round } from '@wieslawsoltes/ski-core';
import { getHill } from '@wieslawsoltes/ski-hills';
import { PHYSICS_VERSION } from '@wieslawsoltes/ski-physics';
export const REPLAY_VERSION = 1;
export const REPLAY_PHASES = ['gate', 'inrun', 'flight', 'runout', 'finished'];
export const FRAME_FIELDS = ['time', 'x', 'y', 'pitch', 'lean', 'speed', 'distance', 'wind', 'phase', 'landing', 'crashed', 'quality'];
function frame(s) { return [round(s.time, 4), round(s.x, 4), round(s.y, 4), round(s.pitch, 5), round(s.lean, 5), round(s.speed, 4), round(s.distance, 3), round(s.wind, 3), REPLAY_PHASES.indexOf(s.phase), s.landing === 'telemark' ? 1 : s.landing === 'parallel' ? 2 : 0, s.crashed ? 1 : 0, round(s.quality, 4)]; }
export class ReplayRecorder {
    constructor(sim, player = { name: 'PLAYER 1' }, hz = 60) { this.sim = sim; this.player = { ...player }; this.hz = hz; this.next = 0; this.frames = []; this.capture(true); }
    capture(force = false) { const s = this.sim.state; if (this.frames.length >= 14400)
        return; if (!force && s.time < this.next)
        return; if (this.frames.length && round(s.time, 4) <= this.frames.at(-1)[0])
        return; this.frames.push(frame(s)); this.next = s.time + 1 / this.hz - .00001; }
    finish() { this.capture(true); return { format: 'ski-jump-web-replay', version: REPLAY_VERSION, physics: PHYSICS_VERSION, hillId: this.sim.hill.id, player: this.player, options: { ...this.sim.options }, result: this.sim.result ? { ...this.sim.result } : null, createdAt: new Date().toISOString(), frames: this.frames.map(f => [...f]) }; }
}
export function validateReplay(data) {
    if (!data || data.format !== 'ski-jump-web-replay' || data.version !== 1)
        throw new Error('This is not a SkiJumpWeb .sjr.json replay. Original DSJ2 .rpl files are not supported.');
    getHill(data.hillId);
    if (!Array.isArray(data.frames) || data.frames.length < 2 || data.frames.length > 14400)
        throw new Error('Invalid replay frame count');
    let previous = -1;
    for (const f of data.frames) {
        if (!Array.isArray(f) || f.length !== 12 || f.some(n => !Number.isFinite(n) || Math.abs(n) > 1e6))
            throw new Error('Invalid replay frame');
        if (f[0] < 0 || f[0] <= previous || f[0] > 120 || !Number.isInteger(f[8]) || f[8] < 0 || f[8] > 4 || ![0, 1, 2].includes(f[9]) || ![0, 1].includes(f[10]))
            throw new Error('Invalid replay timeline');
        previous = f[0];
    }
    const player = { name: String(data.player?.name || 'REPLAY').replace(/[<>\x00-\x1f]/g, '').slice(0, 22), country: String(data.player?.country || '').slice(0, 3) };
    for (const key of ['suit', 'helmet', 'skis'])
        player[key] = /^#[0-9a-f]{6}$/i.test(data.player?.[key] || '') ? data.player[key] : '#225be7';
    let result = null;
    if (data.result) {
        const r = data.result;
        if (!Number.isFinite(r.distance) || r.distance < 0 || r.distance > 2000 || !Number.isFinite(r.total) || !Array.isArray(r.judges) || r.judges.length !== 5 || r.judges.some(x => !Number.isFinite(x) || x < 0 || x > 20))
            throw new Error('Invalid replay result');
        result = { ...r, hillId: data.hillId };
    }
    return { format: data.format, version: 1, physics: String(data.physics || ''), hillId: data.hillId, player, options: data.options && typeof data.options === 'object' ? data.options : {}, result, createdAt: String(data.createdAt || '').slice(0, 40), frames: data.frames.map(f => [...f]) };
}
export function parseReplay(text) { if (typeof text !== 'string' || text.length > 3000000)
    throw new Error('Replay exceeds 3 MB'); return validateReplay(JSON.parse(text)); }
export function serializeReplay(replay) { return JSON.stringify(validateReplay(replay)); }
export class ReplayPlayer {
    constructor(replay) { this.replay = validateReplay(replay); this.time = 0; this.speed = 1; this.paused = false; this.loop = true; this.duration = this.replay.frames.at(-1)[0]; this.flightStart = this.replay.frames.find(f => f[8] === 2)?.[0] || 0; this.runoutStart = this.replay.frames.find(f => f[8] === 3)?.[0] || this.duration; }
    seek(t) { this.time = clamp(Number(t) || 0, 0, this.duration); return this.sample(this.time); }
    update(dt) { if (!this.paused) {
        this.time += Math.max(0, dt) * this.speed;
        if (this.time > this.duration) {
            if (this.loop)
                this.time %= this.duration;
            else {
                this.time = this.duration;
                this.paused = true;
            }
        }
    } return this.sample(this.time); }
    sample(t) {
        const fs = this.replay.frames;
        t = clamp(t, 0, this.duration);
        let lo = 0, hi = fs.length - 1;
        while (hi - lo > 1) {
            const m = (lo + hi) >> 1;
            if (fs[m][0] <= t)
                lo = m;
            else
                hi = m;
        }
        const a = t >= fs[hi][0] ? fs[hi] : fs[lo], b = fs[hi], alpha = clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1);
        const f = a.map((v, i) => i < 8 || i === 11 ? lerp(v, b[i], alpha) : v);
        return { time: t, x: f[1], y: f[2], pitch: f[3], lean: f[4], speed: f[5], distance: f[6], wind: f[7], phase: REPLAY_PHASES[f[8]], landing: ['none', 'telemark', 'parallel'][f[9]], crashed: !!f[10], quality: f[11], z: 0, height: 0, flightTime: Math.max(0, t - this.flightStart), runoutTime: Math.max(0, t - this.runoutStart) };
    }
}
