import { clamp, lerp, round, wrapAngle } from '@wieslawsoltes/ski-core';
import { getHill } from '@wieslawsoltes/ski-hills';
import { PHYSICS_VERSION, validateRules } from '@wieslawsoltes/ski-physics';
export const REPLAY_VERSION = 2;
export const REPLAY_PHASES = ['gate', 'inrun', 'flight', 'runout', 'finished'];
export const FRAME_FIELDS = ['time', 'x', 'y', 'pitch', 'lean', 'speed', 'distance', 'wind', 'phase', 'landing', 'crashed', 'quality'];
function frame(s, version) { const f = [round(s.time, 4), round(s.x, 4), round(s.y, 4), round(s.pitch, 5), round(s.lean, 5), round(s.speed, 4), round(s.distance, 3), round(s.wind, 3), REPLAY_PHASES.indexOf(s.phase), s.landing === 'telemark' ? 1 : s.landing === 'parallel' ? 2 : 0, s.crashed ? 1 : 0, round(s.quality, 4)]; if (version === 2) f.push(round(s.leftLandingTime ?? -1, 4), round(s.rightLandingTime ?? -1, 4), round(s.telemarkWidth ?? 0, 4), round(s.gateElapsed ?? 0, 4), round(s.windAngle ?? 0, 5), s.disqualified ? 1 : 0); return f; }
export class ReplayRecorder {
    constructor(sim, player = { name: 'PLAYER 1' }, hz = 60) { this.sim = sim; this.version = sim.options.rules === 'dsj210' ? 2 : 1; this.player = { ...player }; this.hz = hz; this.next = 0; this.frames = []; this.capture(true); }
    capture(force = false) { const s = this.sim.state; if (this.frames.length >= 14400)
        return; if (!force && s.time < this.next)
        return; if (this.frames.length && round(s.time, 4) <= this.frames.at(-1)[0])
        return; this.frames.push(frame(s, this.version)); this.next = s.time + 1 / this.hz - .00001; }
    finish() { this.capture(true); return { format: 'ski-jump-web-replay', version: this.version, physics: this.sim.physicsVersion || PHYSICS_VERSION, hillId: this.sim.hill.id, player: this.player, options: { ...this.sim.options }, result: this.sim.result ? { ...this.sim.result } : null, createdAt: new Date().toISOString(), frames: this.frames.map(f => [...f]) }; }
}
export function validateReplay(data) {
    if (!data || data.format !== 'ski-jump-web-replay' || ![1, 2].includes(data.version))
        throw new Error('This is not a SkiJumpWeb .sjr.json replay. Original DSJ2 .rpl files are not supported.');
    getHill(data.hillId);
    if (!Array.isArray(data.frames) || data.frames.length < 2 || data.frames.length > 14400)
        throw new Error('Invalid replay frame count');
    let previous = -1;
    for (const f of data.frames) {
        if (!Array.isArray(f) || f.length !== (data.version === 2 ? 18 : 12) || f.some(n => !Number.isFinite(n) || Math.abs(n) > 1e6))
            throw new Error('Invalid replay frame');
        if (f[0] < 0 || f[0] <= previous || f[0] > 120 || !Number.isInteger(f[8]) || f[8] < 0 || f[8] > 4 || ![0, 1, 2].includes(f[9]) || ![0, 1].includes(f[10]))
            throw new Error('Invalid replay timeline');
        if (data.version === 2 && (f[12] < -1 || f[13] < -1 || f[14] < 0 || f[14] > 1.5 || f[15] < 0 || f[15] > 15 || Math.abs(f[16]) > Math.PI + .0001 || ![0, 1].includes(f[17])))
            throw new Error('Invalid original-profile replay fields');
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
        if (r.disqualified && (r.total !== 0 || r.distance !== 0 || r.judges.some(n => n !== 0))) throw new Error('Invalid disqualified result');
        result = { ...r, hillId: data.hillId };
    }
    validateRules(data.options?.rules ?? 'legacy');
    return { format: data.format, version: data.version, physics: String(data.physics || ''), hillId: data.hillId, player, options: data.options && typeof data.options === 'object' ? { ...data.options } : {}, result, createdAt: String(data.createdAt || '').slice(0, 40), frames: data.frames.map(f => [...f]) };
}
export function parseReplay(text) { if (typeof text !== 'string' || text.length > 3000000)
    throw new Error('Replay exceeds 3 MB'); return validateReplay(JSON.parse(text)); }
export function serializeReplay(replay) { return JSON.stringify(validateReplay(replay)); }
export class ReplayPlayer {
    constructor(replay) { this.replay = validateReplay(replay); this.time = 0; this.speed = 1; this.paused = false; this.loop = true; this.duration = this.replay.frames.at(-1)[0]; this.flightStart = this.replay.frames.find(f => f[8] === 2)?.[0] || 0; this.loopStart = 0; this.loopEnd = this.duration; this.runoutStart = this.replay.frames.find(f => f[8] === 3)?.[0] || this.duration; }
    seek(t) { this.time = clamp(Number(t) || 0, 0, this.duration); return this.sample(this.time); }
    get markers() {
        return { start: 0, takeoff: this.flightStart, landing: this.runoutStart, end: this.duration };
    }
    setLoop(start = 0, end = this.duration) {
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > this.duration || end - start < .001)
            throw new RangeError('Loop end must follow its start within the replay');
        this.loopStart = start; this.loopEnd = end; this.seek(clamp(this.time, start, end)); return this;
    }
    stepFrame(direction = 1) {
        if (!Number.isInteger(direction) || !direction) throw new RangeError('Frame direction must be a nonzero integer');
        const frames = this.replay.frames;
        let lo = 0, hi = frames.length;
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (frames[mid][0] < this.time - 1e-7) lo = mid + 1; else hi = mid; }
        const exact = lo < frames.length && Math.abs(frames[lo][0] - this.time) < 1e-7;
        const index = direction > 0 ? (exact ? lo : lo - 1) + direction : lo + direction;
        this.paused = true;
        return this.seek(frames[clamp(index, 0, frames.length - 1)][0]);
    }
    jumpTo(marker) {
        if (!Object.hasOwn(this.markers, marker)) throw new RangeError('Unknown replay marker');
        return this.seek(this.markers[marker]);
    }
    update(dt) {
        if (!this.paused && Number.isFinite(dt) && dt > 0 && Number.isFinite(this.speed)) {
            const speed = clamp(this.speed, -4, 4), start = this.loop ? this.loopStart : 0, end = this.loop ? this.loopEnd : this.duration;
            this.time = clamp(this.time, start, end) + dt * speed;
            if (this.time > end || this.time < start || (!this.loop && ((speed > 0 && this.time === end) || (speed < 0 && this.time === start)))) {
                if (this.loop) { const span = end - start; this.time = start + ((this.time - start) % span + span) % span; }
                else { this.time = clamp(this.time, start, end); this.paused = true; }
            }
        }
        return this.sample(this.time);
    }
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
        const f = a.map((v, i) => i === 16 ? wrapAngle(v + wrapAngle(b[i] - v) * alpha) : i < 8 || i === 11 || i === 14 || i === 15 ? lerp(v, b[i], alpha) : v);
        return { leftLandingTime: f[12] ?? -1, rightLandingTime: f[13] ?? -1, telemarkWidth: f[14] ?? (f[9] === 1 ? .5 : 0), gateElapsed: f[15] ?? 0, startRemaining: 15 - (f[15] ?? 0), windAngle: f[16] ?? (f[7] >= 0 ? Math.PI : 0), disqualified: !!f[17], time: t, x: f[1], y: f[2], pitch: f[3], lean: f[4], speed: f[5], distance: f[6], wind: f[7], phase: REPLAY_PHASES[f[8]], landing: ['none', 'telemark', 'parallel'][f[9]], crashed: !!f[10], quality: f[11], z: 0, height: 0, flightTime: Math.max(0, t - this.flightStart), runoutTime: Math.max(0, t - this.runoutStart) };
    }
}
