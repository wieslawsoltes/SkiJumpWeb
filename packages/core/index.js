/** Small deterministic game primitives, free of browser or rendering dependencies. */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const radians = d => d * Math.PI / 180;
export const round = (v, decimals = 2) => Math.round((v + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export function hashString(text) {
    let h = 2166136261;
    for (const c of String(text))
        h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
}
export class Random {
    constructor(seed = 1) { this.state = typeof seed === 'string' ? hashString(seed) : seed >>> 0; }
    next() {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        this.state >>>= 0;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    range(a, b) { return lerp(a, b, this.next()); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    pick(items) { return items[this.int(0, items.length - 1)]; }
    shuffle(items) { const a = [...items]; for (let i = a.length - 1; i > 0; i--) {
        const j = this.int(0, i);
        [a[i], a[j]] = [a[j], a[i]];
    } return a; }
}
export class Events {
    constructor() { this.listeners = new Map(); }
    on(name, listener) { if (!this.listeners.has(name))
        this.listeners.set(name, new Set()); this.listeners.get(name).add(listener); return () => this.listeners.get(name)?.delete(listener); }
    emit(name, data) { for (const fn of this.listeners.get(name) || [])
        fn(data); }
    clear() { this.listeners.clear(); }
}
/** Fixed-step simulation with bounded catch-up; presentation is independent of simulation rate. */
export class FixedClock {
    constructor(hz = 120, maxSteps = 16) {
        if (!(hz > 0 && hz <= 1000))
            throw new RangeError('Invalid simulation frequency');
        this.dt = 1 / hz;
        this.maxSteps = maxSteps;
        this.accumulator = 0;
        this.ticks = 0;
    }
    advance(seconds, update) {
        if (!Number.isFinite(seconds) || seconds < 0)
            return 0;
        this.accumulator += Math.min(seconds, this.dt * this.maxSteps);
        let n = 0;
        while (this.accumulator + 1e-10 >= this.dt && n < this.maxSteps) {
            update(this.dt);
            this.accumulator -= this.dt;
            this.ticks++;
            n++;
        }
        this.accumulator = Math.max(0, this.accumulator);
        return this.accumulator / this.dt;
    }
    reset() { this.accumulator = 0; this.ticks = 0; }
}
export function colorRGB(hex) {
    const s = String(hex).replace('#', '');
    if (!/^[a-f\d]{6}$/i.test(s))
        return [0.16, 0.36, 0.88];
    const n = parseInt(s, 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
export function assertFinite(object, keys) {
    for (const k of keys)
        if (!Number.isFinite(object[k]))
            throw new TypeError(`Non-finite ${k}`);
    return object;
}
