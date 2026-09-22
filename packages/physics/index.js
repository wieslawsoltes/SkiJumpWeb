import { clamp, lerp, smoothstep, round, Random, Events, wrapAngle } from '@wieslawsoltes/ski-core';
import { HillProfile } from '@wieslawsoltes/ski-hills';
export const PHYSICS_VERSION = 'sjw-1';
export const FIXED_DT = 1 / 120;
/** Positive wind is a headwind. Absolute-time noise makes wind independent of input calls. */
export class WindField {
    constructor(seed = 1, strength = 1, base = null) {
        const r = new Random(seed);
        this.base = base ?? r.range(-1.2, 2.5);
        this.strength = strength;
        this.phase = r.range(0, 6.28);
        this.secondary = r.range(0, 6.28);
    }
    sample(t, x = 0) { return clamp(this.base + (Math.sin(t * .57 + this.phase + x * .008) * .46 + Math.sin(t * 1.23 + this.secondary) * .18) * this.strength, -4.5, 4.5); }
}
export function pointsPerMetre(k) { return k < 60 ? 4.8 : k < 70 ? 4.4 : k < 80 ? 4 : k < 90 ? 3.6 : k < 100 ? 2.8 : k < 110 ? 2.4 : k < 165 ? 1.8 : 1.2; }
export function scoreJump({ distance, k, judges, crashed = false }) {
    if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(k) || k < 1)
        throw new TypeError('Invalid jump distance or hill');
    if (!Array.isArray(judges) || judges.length !== 5 || judges.some(n => !Number.isFinite(n) || n < 0 || n > 20))
        throw new TypeError('Exactly five valid judge marks are required');
    const sorted = judges.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i);
    const counted = sorted.slice(1, 4).map(j => j.i);
    const distancePoints = round((k >= 165 ? 120 : 60) + (distance - k) * pointsPerMetre(k), 1);
    const stylePoints = round(sorted.slice(1, 4).reduce((n, j) => n + j.v, 0), 1);
    return { distancePoints, stylePoints, total: round(Math.max(0, distancePoints + stylePoints), 1), counted, crashed };
}
export class JumpSimulation {
    constructor(hill, options = {}) {
        this.profile = hill instanceof HillProfile ? hill : new HillProfile(hill);
        this.hill = this.profile.hill;
        this.options = { seed: 1, gate: 0, windStrength: 1, windBase: null, assist: false, ...options };
        this.options.gate = clamp(Number(this.options.gate) || 0, -5, 8);
        this.events = new Events();
        this.windField = new WindField(this.options.seed, this.options.windStrength, this.options.windBase);
        this.reset();
    }
    reset() {
        const p = this.profile;
        this.state = { phase: 'gate', time: 0, flightTime: 0, x: p.startX + 2 + this.options.gate * .8, y: 0, z: 0, vx: 0, vy: 0, speed: 0,
            lean: 0, pitch: -Math.atan(p.steepSlope), angularVelocity: 0, wind: 0, height: 0, distance: 0, quality: 0,
            takeoff: false, landing: 'none', crashed: false, landingTime: 0, runoutTime: 0, flightError: 0 };
        this.state.y = p.inrunY(this.state.x);
        this.state.wind = this.windField.sample(0, this.state.x);
        this.result = null;
        this.takeoffX = null;
        this.lastCommand = -Infinity;
    }
    start() { if (this.state.phase !== 'gate')
        return false; this.state.phase = 'inrun'; this.state.speed = 3.2; this.events.emit('start', this.snapshot()); return true; }
    takeoff() {
        const s = this.state;
        if (s.phase !== 'inrun' || s.takeoff)
            return false;
        s.takeoff = true;
        this.takeoffX = s.x;
        const window = 1.2 + this.hill.k * .005;
        s.quality = Math.exp(-(((s.x + 0.8) / window) ** 2));
        this.events.emit('takeoff', { quality: s.quality, x: s.x });
        return true;
    }
    land(kind = 'telemark') {
        const s = this.state;
        if (s.phase !== 'flight' || s.flightTime < .28)
            return false;
        if (kind !== 'telemark' && kind !== 'parallel')
            return false;
        // A second simultaneous button upgrades telemark to a safer two-foot landing.
        if (s.landing === 'none') {
            s.landingTime = s.flightTime;
            s.landing = kind;
            this.events.emit('landing-prep', kind);
        }
        else if (kind === 'parallel')
            s.landing = 'parallel';
        return true;
    }
    command(kind) { if (kind === 'start')
        return this.start(); if (kind === 'takeoff')
        return this.takeoff(); if (kind === 'telemark' || kind === 'parallel')
        return this.land(kind); return false; }
    control(delta) { if (this.state.phase === 'flight' && Number.isFinite(delta))
        this.state.lean = clamp(this.state.lean + delta, -1.25, 1.25); }
    snapshot() { return { ...this.state }; }
    step(dt = FIXED_DT, control = 0) {
        if (!Number.isFinite(dt) || dt <= 0 || dt > .05)
            throw new RangeError('Use fixed simulation steps of at most 50 ms');
        const s = this.state, p = this.profile;
        if (s.phase === 'finished')
            return;
        if (s.phase === 'gate') {
            s.wind = this.windField.sample(0, s.x);
            return;
        }
        s.time += dt;
        s.wind = this.windField.sample(s.time, s.x);
        if (s.phase === 'inrun') {
            const d = p.inrunDerivative(s.x), cos = 1 / Math.sqrt(1 + d * d), sin = -d * cos;
            s.speed = Math.max(0, s.speed + (9.81 * (sin - .022 * cos) - .00105 * s.speed * s.speed) * dt);
            s.vx = s.speed * cos;
            s.vy = s.speed * d * cos;
            s.x += s.vx * dt;
            s.y = p.inrunY(Math.min(s.x, 0));
            s.pitch = Math.atan(d);
            if (s.x >= 0) {
                s.x = 0;
                s.y = 0;
                s.phase = 'flight';
                s.flightTime = 0;
                s.vx = s.speed / Math.sqrt(1 + p.tableSlope * p.tableSlope);
                s.vy = -s.vx * p.tableSlope + (s.takeoff ? (.03 + .215 * s.quality) * Math.sqrt(this.hill.k) : 0.2);
                s.lean = s.takeoff ? .12 : .4;
                s.pitch = .13;
                s.angularVelocity = 0;
                this.events.emit('flight', this.snapshot());
            }
        }
        else if (s.phase === 'flight') {
            const oldX = s.x, oldY = s.y;
            s.flightTime += dt;
            this.control(control * dt);
            s.lean = clamp(s.lean + (.025 + Math.sin(s.time * 1.7 + this.options.seed) * .011 + s.wind * .004) * dt, -1.25, 1.25);
            if (this.options.assist)
                s.lean = lerp(s.lean, -.04, 1 - Math.exp(-2.4 * dt));
            const rx = Math.max(2, s.vx + s.wind), ry = s.vy, air = Math.hypot(rx, ry), flow = Math.atan2(ry, rx);
            let target = flow + .205 + s.lean * .6;
            if (s.landing !== 'none')
                target = lerp(target, .33, smoothstep(0, .45, s.flightTime - s.landingTime));
            s.angularVelocity += (wrapAngle(target - s.pitch) * 11 - s.angularVelocity * 5.5) * dt;
            s.pitch += s.angularVelocity * dt;
            const aoa = wrapAngle(s.pitch - flow), error = (aoa - .205) / .53;
            const efficiency = Math.exp(-error * error * 1.7);
            const deploy = s.landing === 'none' ? 1 : lerp(1, .28, smoothstep(.06, .6, s.flightTime - s.landingTime));
            // Lift / drag coefficients are an authored approximation, not recovered DSJ2 constants.
            const lift = (.21 / this.hill.k) * air * air * (.16 + .84 * efficiency) * deploy;
            const drag = (.12 / this.hill.k) * air * air * (1 + 2.8 * error * error + (1 - deploy) * 2.6);
            const ax = -drag * rx / air - lift * ry / air;
            const ay = -9.81 - drag * ry / air + lift * rx / air;
            s.vx = Math.max(2, s.vx + ax * dt);
            s.vy += ay * dt;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.speed = Math.hypot(s.vx, s.vy);
            s.flightError += Math.abs(error) * dt;
            const ground = p.atX(s.x);
            s.height = s.y - ground.y;
            s.distance = ground.s;
            if (s.height <= 0) {
                // Swept segment / sampled hill intersection removes frame-quantized distance jumps.
                let lo = 0, hi = 1;
                for (let n = 0; n < 14; n++) {
                    const t = (lo + hi) * .5, x = lerp(oldX, s.x, t), y = lerp(oldY, s.y, t);
                    if (y > p.atX(x).y)
                        lo = t;
                    else
                        hi = t;
                }
                s.x = lerp(oldX, s.x, (lo + hi) * .5);
                const hit = p.atX(s.x);
                s.y = hit.y;
                s.distance = hit.s;
                s.height = 0;
                this.touchdown(hit);
            }
            if (s.flightTime > 40 || s.x > p.end.x + 100) {
                s.crashed = true;
                this.touchdown(p.atX(s.x));
            }
        }
        else if (s.phase === 'runout') {
            s.runoutTime += dt;
            const g = p.atX(s.x);
            const deceleration = s.crashed ? 7 : 4.2;
            s.speed = Math.max(0, s.speed + (9.81 * Math.sin(g.angle) - deceleration - .003 * s.speed * s.speed) * dt);
            s.x += s.speed * Math.cos(g.angle) * dt;
            s.y = p.atX(s.x).y;
            s.vx = s.speed * Math.cos(g.angle);
            s.vy = -s.speed * Math.sin(g.angle);
            s.pitch = -g.angle;
            if (s.runoutTime > (s.crashed ? 1.9 : 2.3) || s.speed < .4) {
                s.phase = 'finished';
                this.events.emit('finish', this.result);
            }
        }
        if (!Number.isFinite(s.x + s.y + s.vx + s.vy + s.pitch))
            throw new Error('Non-finite ski-jump state');
    }
    touchdown(ground) {
        const s = this.state;
        if (s.phase !== 'flight')
            return;
        const normalSpeed = Math.max(0, -s.vx * Math.sin(ground.angle) - s.vy * Math.cos(ground.angle));
        const prep = s.landing === 'none' ? 0 : s.flightTime - s.landingTime;
        const over = s.distance / this.hill.k;
        const safe = (s.landing === 'parallel' ? 1.95 : 1.48) * Math.sqrt(this.hill.k);
        s.crashed = s.crashed || s.landing === 'none' || prep < .075 || normalSpeed > safe || Math.abs(s.lean) > 1.07 || (over > 1.32 && s.landing === 'telemark');
        const avgError = s.flightError / Math.max(.1, s.flightTime);
        let style = s.crashed ? 7.8 : 20 - (s.landing === 'parallel' ? 2.1 : 0) - clamp(avgError * .75, 0, 2.5) - Math.max(0, normalSpeed / Math.sqrt(this.hill.k) - .55) * .8 - Math.max(0, prep - .8) * .9;
        const r = new Random(this.options.seed + Math.round(s.distance * 100));
        const judges = Array.from({ length: 5 }, () => clamp(Math.round((style + r.range(-.55, .35)) * 2) / 2, 0, 20));
        const distance = Math.floor(Math.max(0, s.distance) * 100) / 100;
        this.result = { hillId: this.hill.id, k: this.hill.k, distance, judges, landing: s.landing, crashed: s.crashed,
            takeoffQuality: round(s.quality, 3), takeoffX: this.takeoffX, flightTime: round(s.flightTime, 3),
            speed: round(s.speed * 3.6, 1), wind: round(s.wind, 2), impact: round(normalSpeed, 2), seed: this.options.seed,
            assisted: !!this.options.assist, gate: this.options.gate, physics: PHYSICS_VERSION,
            ...scoreJump({ distance, k: this.hill.k, judges, crashed: s.crashed }) };
        s.phase = 'runout';
        s.runoutTime = 0;
        this.events.emit(s.crashed ? 'crash' : 'land', this.result);
    }
}
/** CPU competitors use exactly the same physics, not random precomputed distances. */
export class CPUController {
    constructor(seed = 1, skill = .85) { const r = new Random(seed); this.skill = clamp(skill, 0, 1); this.error = r.range(-1, 1) * (1 - this.skill) * 4.2; this.bias = r.range(-.2, .18) * (1 - this.skill); this.takeoffAt = -.8 + this.error; }
    update(sim, dt = FIXED_DT) {
        const s = sim.state;
        if (s.phase === 'gate')
            sim.start();
        if (s.phase === 'inrun' && !s.takeoff && s.x >= this.takeoffAt)
            sim.takeoff();
        if (s.phase === 'flight') {
            sim.control((-.065 + this.bias - s.lean) * Math.min(1, dt * (3 + this.skill * 5)));
            const g = sim.profile.atX(s.x), closing = Math.max(.1, -s.vy - s.vx * Math.tan(g.angle));
            const until = s.height / closing;
            if (s.flightTime > .4 && s.landing === 'none' && until < .23 + (1 - this.skill) * .2)
                sim.land(s.distance > sim.hill.k * 1.22 ? 'parallel' : 'telemark');
        }
    }
}
export function simulateCPU(hill, options = {}, skill = .85) {
    const sim = new JumpSimulation(hill, options), cpu = new CPUController(options.seed || 1, skill);
    for (let i = 0; i < 12000 && sim.state.phase !== 'finished'; i++) {
        cpu.update(sim, FIXED_DT);
        sim.step(FIXED_DT);
    }
    if (!sim.result)
        throw new Error('CPU simulation did not finish');
    return sim.result;
}
