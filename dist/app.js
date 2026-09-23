/*! SkiJumpWeb 0.4.0 - independent recreation, MIT. See README for scope. */
(function(){'use strict';
const modules=new Map(),cache=new Map();
function define(id,factory){modules.set(id,factory)}
function require(id){if(cache.has(id))return cache.get(id);const factory=modules.get(id);if(!factory)throw new Error('Missing module '+id);const exports=factory(require);cache.set(id,exports);return exports}
define("@wieslawsoltes/ski-core",function(require){
/** Small deterministic game primitives, free of browser or rendering dependencies. */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const radians = d => d * Math.PI / 180;
const round = (v, decimals = 2) => Math.round((v + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
function hashString(text) {
    let h = 2166136261;
    for (const c of String(text))
        h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
}
class Random {
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
class Events {
    constructor() { this.listeners = new Map(); }
    on(name, listener) { if (!this.listeners.has(name))
        this.listeners.set(name, new Set()); this.listeners.get(name).add(listener); return () => this.listeners.get(name)?.delete(listener); }
    emit(name, data) { for (const fn of this.listeners.get(name) || [])
        fn(data); }
    clear() { this.listeners.clear(); }
}
/** Fixed-step simulation with bounded catch-up; presentation is independent of simulation rate. */
class FixedClock {
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
function colorRGB(hex) {
    const s = String(hex).replace('#', '');
    if (!/^[a-f\d]{6}$/i.test(s))
        return [0.16, 0.36, 0.88];
    const n = parseInt(s, 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function assertFinite(object, keys) {
    for (const k of keys)
        if (!Number.isFinite(object[k]))
            throw new TypeError(`Non-finite ${k}`);
    return object;
}

return {clamp,lerp,smoothstep,radians,round,wrapAngle,hashString,Random,Events,FixedClock,colorRGB,assertFinite};
});
define("@wieslawsoltes/ski-hills",function(require){
const { clamp, lerp, smoothstep, radians, Random }=require("@wieslawsoltes/ski-core");
// Country labels, K-points and order: Mediamond's public DSJ2 hill-record selector.
// All profile parameters, scenery and mesh geometry below are NEW reconstructions.
const roster = [
    ['FIN', 'Finland', 105, 'nordic', 35.6, 35.0], ['SUI', 'Switzerland', 170, 'alpine', 37.3, 35.8],
    ['CZE', 'Czech Rep.', 135, 'forest', 36.2, 34.2], ['BLR', 'Belarus', 220, 'nordic', 38.0, 36.0],
    ['AUT', 'Austria', 70, 'alpine', 34.5, 34.3], ['USA', 'USA', 130, 'alpine', 36.8, 35.0],
    ['LAT', 'Latvia', 165, 'forest', 37.0, 34.7], ['POL', 'Poland', 80, 'forest', 35.0, 34.0],
    ['JPN', 'Japan', 210, 'alpine', 37.6, 35.5], ['BEL', 'Belgium', 95, 'forest', 35.2, 33.5],
    ['ISL', 'Iceland', 190, 'arctic', 38.2, 35.3], ['ENG', 'England', 50, 'forest', 33.5, 33.0],
    ['GER', 'Germany', 120, 'forest', 36.0, 35.5], ['EST', 'Estonia', 155, 'nordic', 36.4, 34.7],
    ['NOR', 'Norway', 90, 'nordic', 35.4, 35.7], ['AUS', 'Australia', 240, 'alpine', 38.0, 36.1],
    ['IRL', 'Ireland', 125, 'forest', 35.8, 34.6], ['UKR', 'Ukraine', 60, 'forest', 34.3, 33.8],
    ['HUN', 'Hungary', 180, 'forest', 36.8, 35.4], ['SWE', 'Sweden', 140, 'nordic', 36.3, 35.2],
    ['ITA', 'Italy', 230, 'alpine', 38.1, 35.8], ['DEN', 'Denmark', 75, 'nordic', 34.8, 33.2],
    ['SVK', 'Slovakia', 110, 'alpine', 35.9, 35.4], ['CAN', 'Canada', 185, 'forest', 37.2, 35.7],
    ['LTU', 'Lithuania', 145, 'forest', 36.3, 34.0], ['KAZ', 'Kazakhstan', 85, 'arctic', 35.1, 35.5],
    ['CHN', 'China', 205, 'alpine', 37.7, 35.5], ['FRA', 'France', 160, 'alpine', 36.7, 35.8],
    ['NED', 'Holland', 100, 'forest', 35.5, 34.1], ['RUS', 'Russia', 200, 'arctic', 37.5, 35.5],
    ['KOR', 'Korea', 150, 'alpine', 36.5, 34.5], ['SLO', 'Slovenia', 250, 'alpine', 38.3, 36.3]
];
const HILLS = Object.freeze(roster.map((r, i) => Object.freeze({
    id: r[0].toLowerCase(), code: r[0], name: r[1], k: r[2], biome: r[3], inrunAngle: r[4], landingAngle: r[5],
    index: i, seed: 918273 + i * 7919, category: r[2] < 90 ? 'small' : r[2] < 165 ? 'large' : 'flying',
    description: `${r[1]} K${r[2]} · ${r[3] === 'alpine' ? 'Mountain panorama' : r[3] === 'arctic' ? 'Open, windswept terrain' : r[3] === 'nordic' ? 'Northern pine forest' : 'Woodland valley'}`
})));
function getHill(id) { const h = HILLS.find(h => h.id === id || h.code === id); if (!h)
    throw new RangeError(`Unknown hill: ${id}`); return h; }
const TOUR_PRESETS = Object.freeze({
    'Original eight': HILLS.slice(0, 8).map(h => h.id),
    'All 32 hills': HILLS.map(h => h.id),
    'Small hills': HILLS.filter(h => h.k <= 100).sort((a, b) => a.k - b.k).map(h => h.id),
    'Ski flying': HILLS.filter(h => h.k >= 180).sort((a, b) => a.k - b.k).map(h => h.id),
    'Four hills': ['aut', 'ger', 'pol', 'slo']
});
/** Smooth, sampled profile parameterized by actual slope arc-length in metres. */
class HillProfile {
    constructor(hill) {
        this.hill = typeof hill === 'string' ? getHill(hill) : hill;
        const { k, inrunAngle } = this.hill;
        this.k = k;
        this.drop = 2.3 + k * 0.021;
        this.tableSlope = 0.11;
        this.inrunLength = 5 + k * 0.43;
        this.transition = Math.min(21, this.inrunLength * 0.31);
        this.steepSlope = Math.tan(radians(inrunAngle));
        this.startX = -this.inrunLength;
        this.startY = this.inrunY(this.startX);
        this.step = 0.35;
        this.points = [];
        let x = 0, y = -this.drop, s = 0;
        for (let i = 0; s <= k * 2.4; i++, s = i * this.step) {
            const angle = this.slopeAngle(s);
            this.points.push({ x, y, s, angle });
            const am = this.slopeAngle(s + this.step * 0.5);
            x += Math.cos(am) * this.step;
            y -= Math.sin(am) * this.step;
        }
        this.kPoint = this.atDistance(k);
        this.end = this.points.at(-1);
    }
    inrunY(x) {
        const t = this.transition, a = this.steepSlope, b = this.tableSlope;
        if (x < -this.inrunLength)
            return this.inrunY(-this.inrunLength);
        if (x < -t)
            return (a + b) * t * 0.5 + a * (-x - t);
        return -b * x + (a - b) * x * x / (2 * t);
    }
    inrunDerivative(x) {
        if (x < -this.inrunLength)
            return 0;
        return x < -this.transition ? -this.steepSlope : -this.tableSlope + (this.steepSlope - this.tableSlope) * x / this.transition;
    }
    slopeAngle(s) {
        const k = this.k, a = radians(this.hill.landingAngle);
        if (s < k * 0.27)
            return lerp(radians(15.5), a + radians(2), smoothstep(0, k * 0.27, s));
        if (s < k)
            return lerp(a + radians(2), a, smoothstep(k * 0.27, k, s));
        return lerp(a, 0, smoothstep(k, k * 1.65, s));
    }
    atDistance(s) {
        s = clamp(s, 0, this.points.at(-1)?.s || 1e9);
        const f = s / this.step, i = Math.min(Math.floor(f), this.points.length - 2), a = this.points[Math.max(0, i)], b = this.points[Math.max(1, i + 1)], t = f - i;
        return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s, angle: lerp(a.angle, b.angle, t) };
    }
    atX(x) {
        if (x < 0)
            return { x, y: -this.drop - x * 0.24, s: 0, angle: radians(15.5) };
        if (x >= this.end.x)
            return { x, y: this.end.y, s: this.end.s + x - this.end.x, angle: 0 };
        let lo = 0, hi = this.points.length - 1;
        while (hi - lo > 1) {
            const m = (lo + hi) >> 1;
            if (this.points[m].x < x)
                lo = m;
            else
                hi = m;
        }
        const a = this.points[lo], b = this.points[hi], t = (x - a.x) / (b.x - a.x);
        return { x, y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t), angle: lerp(a.angle, b.angle, t) };
    }
    groundY(x, z = 0) {
        const p = this.atX(x), side = Math.max(0, Math.abs(z) - 10);
        return p.y + Math.min(side * 0.16, 12) + (Math.sin(x * .018 + z * .041) + Math.sin(z * .026 - x * .014)) * Math.min(side * .065, 3.4);
    }
    speedEstimate(gate = 0) {
        const h = this.inrunY(this.startX + gate * 0.8);
        return Math.sqrt(Math.max(1, 2 * 9.81 * h * .88));
    }
}
function hillPreview(hill) { const p = new HillProfile(hill); return [...Array(90)].map((_, i) => { const x = lerp(p.startX - 8, p.kPoint.x * 1.6, i / 89); return { x, y: x <= 0 ? p.inrunY(x) : p.atX(x).y }; }); }

/** Visual specification, intentionally separate from simulation parameters.
 * Roster/K-points are verified; layout/color/camera remain visual reconstructions.
 * Explicit per-hill records let future measurements replace a value without
 * changing random-number consumption, collision geometry or saved jump scores.
 */
const visualRows = [
    ['fin','ochre'],['sui','brown'],['cze','gray'],['blr','teal'],
    ['aut','ochre'],['usa','teal'],['lat','ochre'],['pol','teal'],
    ['jpn','ochre'],['bel','teal'],['isl','ochre'],['eng','teal'],
    ['ger','ochre'],['est','teal'],['nor','ochre'],['aus','teal'],
    ['irl','ochre'],['ukr','teal'],['hun','ochre'],['swe','teal'],
    ['ita','ochre'],['den','teal'],['svk','ochre'],['can','teal'],
    ['ltu','ochre'],['kaz','teal'],['chn','ochre'],['fra','teal'],
    ['ned','ochre'],['rus','teal'],['kor','ochre'],['slo','teal']
];
// Flat fascia colors observed in the unmodified publisher demo, 2026-09-23.
// These are color measurements, not imported game palettes or bitmap assets.
const fascia = {
    ochre:[[117,85,12],[93,69,12],[69,48,8],[44,32,8],[20,16,8]],
    brown:[[117,60,32],[93,48,24],[69,36,20],[44,24,16],[20,12,12]],
    gray:[[109,109,113],[97,97,101],[85,85,89],[73,73,77],[60,60,65]],
    teal:[[24,97,101],[16,73,77],[12,48,52],[4,24,28],[0,0,8]]
};
// The public gameplay gallery shows brighter landing-wall paint than inrun
// fascias. These independently authored family colors are not recovered palette
// indices or verified assignments for the unobserved hills.
const landingPaint = { ochre:[.69,.68,.08], teal:[.09,.69,.71], brown:[.62,.39,.20], gray:[.60,.61,.63] };
const HILL_VISUALS = Object.freeze(visualRows.map(([id,palette]) => {
    const hill=getHill(id);
    return Object.freeze({id,k:hill.k,version:1,palette,
        railColor:Object.freeze(fascia[palette][0].map(v=>v/255)),
        landingRailColor:Object.freeze([...landingPaint[palette]]),
        inrunBands:Object.freeze(fascia[palette].map(c=>Object.freeze(c.map(v=>v/255)))),
        inrunDepth:4.8,platformLength:18,supportRadius:3.6,
        inrunWidth:3.6,landingWidth:8,landingFlare:.027,
        cameraHeight:28,cameraYaw:-.16,cameraElevation:.17,
        treeSeed:hill.seed,treeCount:180,
        evidence:Object.freeze({roster:'publisher',geometry:'reconstructed',
            palette:['fin','sui','cze','blr'].includes(id)?'observed-inrun-colors':'unverified',landingRails:'gallery-family-reconstruction',scenery:'reconstructed',camera:'reconstructed',pixelParity:'unverified'})
    });
}));
function getHillVisual(id) {
    const hill=getHill(id),visual=HILL_VISUALS.find(v=>v.id===hill.id);
    if(!visual)throw new Error(`Missing visual definition for ${hill.id}`);
    return visual;
}

return {HILLS,getHill,TOUR_PRESETS,HillProfile,hillPreview,HILL_VISUALS,getHillVisual};
});
define("@wieslawsoltes/ski-physics",function(require){
const { clamp, lerp, smoothstep, round, Random, Events, wrapAngle }=require("@wieslawsoltes/ski-core");
const { HillProfile }=require("@wieslawsoltes/ski-hills");
const PHYSICS_VERSION = 'sjw-1';
const FIXED_DT = 1 / 120;
const CLASSIC_PHYSICS_VERSION = 'sjw-dsj210-1';
const START_WINDOW_SECONDS = 15;
const START_BLINK_SECONDS = 10;
// Input tolerance and stance response are authored, not recovered original constants.
const LANDING_CHORD_SECONDS = 1 / 20;
function validateRules(rules = 'legacy') {
    if (rules !== 'legacy' && rules !== 'dsj210') throw new RangeError('Unknown jumping rules');
    return rules;
}
/** Category boundaries are a reconstruction; the three coefficients are documented in READ-ENG.TXT. */
function classicHillClass(k) {
    if (!Number.isFinite(k) || k < 1) throw new RangeError('Invalid K point');
    return k < 110 ? 'small' : k < 165 ? 'large' : 'flying';
}
function startSignal(elapsed, active = true) {
    if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('Invalid gate clock');
    const remaining = Math.max(0, START_WINDOW_SECONDS - elapsed);
    const blinking = active && remaining > 0 && remaining <= START_BLINK_SECONDS;
    // Two flashes/second is our presentation choice; the documented onset is exactly ten seconds remaining.
    return { remaining, expired: remaining === 0, blinking,
        green: active && remaining > 0 && (!blinking || Math.floor(elapsed * 4) % 2 === 0),
        red: active && remaining === 0 };
}
/** Positive wind is a headwind. Absolute-time noise makes wind independent of input calls. */
class WindField {
    constructor(seed = 1, strength = 1, base = null) {
        const r = new Random(seed);
        this.base = base ?? r.range(-1.2, 2.5);
        this.strength = strength;
        this.phase = r.range(0, 6.28);
        this.secondary = r.range(0, 6.28);
    }
    sample(t, x = 0) { return clamp(this.base + (Math.sin(t * .57 + this.phase + x * .008) * .46 + Math.sin(t * 1.23 + this.secondary) * .18) * this.strength, -4.5, 4.5); }
}
function pointsPerMetre(k, rules = 'legacy', hillClass = classicHillClass(k)) {
    validateRules(rules);
    if (!['small', 'large', 'flying'].includes(hillClass)) throw new RangeError('Invalid hill class');
    if (rules === 'dsj210') return { small: 2, large: 1.8, flying: 1.2 }[hillClass];
    return k < 60 ? 4.8 : k < 70 ? 4.4 : k < 80 ? 4 : k < 90 ? 3.6 : k < 100 ? 2.8 : k < 110 ? 2.4 : k < 165 ? 1.8 : 1.2; }
function scoreJump({ distance, k, judges, crashed = false, rules = 'legacy', hillClass = classicHillClass(k) }) {
    if (!Number.isFinite(distance) || distance < 0 || !Number.isFinite(k) || k < 1)
        throw new TypeError('Invalid jump distance or hill');
    if (!Array.isArray(judges) || judges.length !== 5 || judges.some(n => !Number.isFinite(n) || n < 0 || n > 20))
        throw new TypeError('Exactly five valid judge marks are required');
    const sorted = judges.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v || a.i - b.i);
    const counted = sorted.slice(1, 4).map(j => j.i);
    const flying = rules === 'dsj210' ? hillClass === 'flying' : k >= 165;
    const distancePoints = round((flying ? 120 : 60) + (distance - k) * pointsPerMetre(k, rules, hillClass), 1);
    const stylePoints = round(sorted.slice(1, 4).reduce((n, j) => n + j.v, 0), 1);
    return { distancePoints, stylePoints, total: round(Math.max(0, distancePoints + stylePoints), 1), counted, crashed };
}
class JumpSimulation {
    constructor(hill, options = {}) {
        this.profile = hill instanceof HillProfile ? hill : new HillProfile(hill);
        this.hill = this.profile.hill;
        this.options = { rules: 'legacy', seed: 1, gate: 0, windStrength: 1, windBase: null, assist: false, ...options };
        this.options.rules = validateRules(this.options.rules);
        this.physicsVersion = this.options.rules === 'dsj210' ? CLASSIC_PHYSICS_VERSION : PHYSICS_VERSION;
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
        Object.assign(this.state, { gateElapsed: 0, startRemaining: START_WINDOW_SECONDS, disqualified: false,
            leftLandingTime: -1, rightLandingTime: -1, telemarkWidth: 0, windAngle: 0 });
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
    /** Deploy one ski independently. Either order works; repeated presses on the same ski are inert. */
    landingFoot(side) {
        const s = this.state;
        if (side !== 'left' && side !== 'right') return false;
        if (this.options.rules === 'legacy') return this.land(s.landing === 'none' ? 'telemark' : 'parallel');
        if (s.phase !== 'flight' || s.flightTime < .28 || s[side + 'LandingTime'] >= 0) return false;
        s[side + 'LandingTime'] = s.flightTime;
        if (s.landing === 'none') { s.landingTime = s.flightTime; s.landing = 'telemark'; }
        const both = s.leftLandingTime >= 0 && s.rightLandingTime >= 0;
        if (both) {
            const delay = Math.abs(s.leftLandingTime - s.rightLandingTime);
            s.landing = delay <= LANDING_CHORD_SECONDS + 1e-9 ? 'parallel' : 'telemark';
            s.telemarkWidth = s.landing === 'parallel' ? 0 : clamp(delay * 2.5, 0, 1.5);
        }
        this.events.emit('landing-foot', { side, time: s.flightTime, complete: both });
        return true;
    }
    /** Accessible one-action preparation, also used by CPU control. Not an original mouse gesture. */
    land(kind = 'telemark') {
        const s = this.state;
        if (s.phase !== 'flight' || s.flightTime < .28)
            return false;
        if (kind !== 'telemark' && kind !== 'parallel')
            return false;
        if (this.options.rules === 'dsj210') {
            // Explicit accessibility actions complete both feet; raw mouse input uses landingFoot instead.
            if (s.landing !== 'none' && kind !== 'parallel') return false;
            s.leftLandingTime = s.rightLandingTime = s.flightTime;
            s.telemarkWidth = kind === 'telemark' ? .5 : 0;
        }
        // Legacy one-action preparation retains its pre-profile visual stance.
        if (this.options.rules === 'legacy' && (s.landing === 'none' || kind === 'parallel')) s.telemarkWidth = kind === 'telemark' ? .5 : 0;
        if (s.landing === 'none') {
            s.landingTime = s.flightTime;
            s.landing = kind;
            this.events.emit('landing-prep', kind);
        }
        else if (kind === 'parallel')
            s.landing = 'parallel';
        return true;
    }
    command(kind) { if (kind === 'left-foot' || kind === 'right-foot') return this.landingFoot(kind.split('-')[0]); if (kind === 'start')
        return this.start(); if (kind === 'takeoff')
        return this.takeoff(); if (kind === 'telemark' || kind === 'parallel')
        return this.land(kind); return false; }
    disqualify() {
        const s = this.state;
        if (s.phase !== 'gate') return false;
        s.disqualified = true; s.startRemaining = 0; s.phase = 'finished';
        this.result = { hillId: this.hill.id, k: this.hill.k, distance: 0, judges: [0, 0, 0, 0, 0],
            landing: 'none', crashed: false, disqualified: true, reason: 'start-time-exceeded',
            takeoffQuality: 0, takeoffX: null, flightTime: 0, speed: 0, wind: round(s.wind, 2), impact: 0,
            seed: this.options.seed, assisted: !!this.options.assist, gate: this.options.gate,
            physics: this.physicsVersion, rules: this.options.rules, distancePoints: 0, stylePoints: 0,
            total: 0, counted: [], gateElapsed: s.gateElapsed, telemarkWidth: 0 };
        this.events.emit('disqualified', this.result); this.events.emit('finish', this.result);
        return true;
    }
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
            if (this.options.rules === 'dsj210') {
                const step = Math.min(dt, START_WINDOW_SECONDS - s.gateElapsed);
                s.gateElapsed = Math.min(START_WINDOW_SECONDS, s.gateElapsed + step);
                // Avoid a one-tick grace period caused by accumulated floating point error.
                if (START_WINDOW_SECONDS - s.gateElapsed < 1e-9) s.gateElapsed = START_WINDOW_SECONDS;
                s.time = s.gateElapsed; s.startRemaining = START_WINDOW_SECONDS - s.gateElapsed;
                s.wind = this.windField.sample(s.time, s.x);
                s.windAngle = Math.atan2(.25 * Math.sin(s.time * .31 + this.options.seed), -s.wind);
                if (s.startRemaining === 0) this.disqualify();
            } else s.wind = this.windField.sample(0, s.x);
            return;
        }
        s.time += dt;
        s.wind = this.windField.sample(s.time, s.x);
        s.windAngle = Math.atan2(.25 * Math.sin(s.time * .31 + this.options.seed), -s.wind);
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
        const incomplete = this.options.rules === 'dsj210' && (s.leftLandingTime < 0 || s.rightLandingTime < 0);
        const overWide = this.options.rules === 'dsj210' && s.telemarkWidth > 1.25;
        s.crashed = s.crashed || incomplete || overWide || s.landing === 'none' || prep < .075 || normalSpeed > safe || Math.abs(s.lean) > 1.07 || (over > 1.32 && s.landing === 'telemark');
        const avgError = s.flightError / Math.max(.1, s.flightTime);
        let style = s.crashed ? 7.8 : 20 - (s.landing === 'parallel' ? 2.1 : 0) - clamp(avgError * .75, 0, 2.5) - Math.max(0, normalSpeed / Math.sqrt(this.hill.k) - .55) * .8 - Math.max(0, prep - .8) * .9;
        if (this.options.rules === 'dsj210' && s.landing === 'telemark' && !s.crashed)
            style -= Math.abs(s.telemarkWidth - .55) * 1.5;
        const r = new Random(this.options.seed + Math.round(s.distance * 100));
        const judges = Array.from({ length: 5 }, () => clamp(Math.round((style + r.range(-.55, .35)) * 2) / 2, 0, 20));
        const distance = Math.floor(Math.max(0, s.distance) * 100) / 100;
        this.result = { hillId: this.hill.id, k: this.hill.k, distance, judges, landing: s.landing, crashed: s.crashed,
            takeoffQuality: round(s.quality, 3), takeoffX: this.takeoffX, flightTime: round(s.flightTime, 3),
            speed: round(s.speed * 3.6, 1), wind: round(s.wind, 2), impact: round(normalSpeed, 2), seed: this.options.seed,
            assisted: !!this.options.assist, gate: this.options.gate, physics: this.physicsVersion, rules: this.options.rules, gateElapsed: s.gateElapsed, telemarkWidth: s.telemarkWidth, disqualified: false,
            ...scoreJump({ distance, k: this.hill.k, judges, crashed: s.crashed, rules: this.options.rules }) };
        s.phase = 'runout';
        s.runoutTime = 0;
        this.events.emit(s.crashed ? 'crash' : 'land', this.result);
    }
}
/** CPU competitors use exactly the same physics, not random precomputed distances. */
class CPUController {
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
function simulateCPU(hill, options = {}, skill = .85) {
    const sim = new JumpSimulation(hill, options), cpu = new CPUController(options.seed || 1, skill);
    for (let i = 0; i < 12000 && sim.state.phase !== 'finished'; i++) {
        cpu.update(sim, FIXED_DT);
        sim.step(FIXED_DT);
    }
    if (!sim.result)
        throw new Error('CPU simulation did not finish');
    return sim.result;
}

return {PHYSICS_VERSION,FIXED_DT,CLASSIC_PHYSICS_VERSION,START_WINDOW_SECONDS,START_BLINK_SECONDS,LANDING_CHORD_SECONDS,validateRules,classicHillClass,startSignal,WindField,pointsPerMetre,scoreJump,JumpSimulation,CPUController,simulateCPU};
});
define("@wieslawsoltes/ski-competition",function(require){
const { clamp, Random, round }=require("@wieslawsoltes/ski-core");
const { getHill }=require("@wieslawsoltes/ski-hills");
const { simulateCPU, validateRules, pointsPerMetre }=require("@wieslawsoltes/ski-physics");
const CUP_POINTS = Object.freeze([100, 80, 60, 50, 45, 40, 36, 32, 29, 26, 24, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
const TEAM_CUP_POINTS = Object.freeze([200, 160, 120, 100]);
const aiNames = ['A. KORHONEN', 'M. WEBER', 'J. NOWICKI', 'T. BERG', 'S. YAMAMOTO', 'P. NOVAK', 'L. ROSSI', 'E. ANDERSEN', 'D. MILLER', 'R. KOVAC', 'O. LIND', 'N. MARTIN', 'K. LEE', 'V. PETROV', 'B. FISCHER', 'A. KOVAL'];
const countries = ['FIN', 'GER', 'POL', 'NOR', 'JPN', 'CZE', 'ITA', 'AUT', 'USA', 'SLO', 'SWE', 'FRA', 'KOR', 'RUS', 'SUI', 'UKR'];
const suits = ['#225be7', '#dc303b', '#cf3c37', '#14689e', '#8c38b8', '#2a9d66', '#238ed0', '#e95321', '#943db9', '#258753', '#1d7296', '#e7c329'];
function normalizePlayer(p = {}, index = 0) {
    const name = String(p.name || `PLAYER ${index + 1}`).replace(/[\x00-\x1f<>]/g, '').slice(0, 22).trim() || `PLAYER ${index + 1}`;
    const color = v => /^#[0-9a-f]{6}$/i.test(v || '') ? v : null;
    return { id: String(p.id || `human-${index + 1}`).slice(0, 50), name, country: String(p.country || 'POL').replace(/[^A-Z]/g, '').slice(0, 3) || 'POL',
        suit: color(p.suit) || suits[index % suits.length], helmet: color(p.helmet) || '#e93135', skis: color(p.skis) || '#e6cf21',
        team: String(p.team || p.country || 'POL').replace(/[\x00-\x1f<>]/g, '').slice(0, 20), human: p.human !== false, skill: clamp(Number(p.skill) || .85, .1, 1) };
}
function createField(humans, aiCount = 15, difficulty = .8) {
    if (!Array.isArray(humans) || humans.length < 1 || humans.length > 16)
        throw new RangeError('Choose 1–16 human players');
    const field = humans.map((p, i) => normalizePlayer({ ...p, human: true, id: `human-${i + 1}` }, i));
    const r = new Random(1234);
    const count = Math.floor(clamp(Number(aiCount) || 0, 0, 64 - field.length));
    for (let i = 0; i < count; i++)
        field.push(normalizePlayer({ id: `cpu-${i}`, name: aiNames[i % 16] + (i >= 16 ? ` ${Math.floor(i / 16) + 1}` : ''), country: countries[i % 16], human: false, skill: clamp(difficulty + r.range(-.17, .1), .2, .99) }, i + 1));
    return field;
}
function createTeams(humans, aiTeamCount = 7, difficulty = .8) {
    const groups = new Map();
    humans.forEach((p, i) => { const n = normalizePlayer({ ...p, human: true, id: `human-${i + 1}` }, i); let team = groups.get(n.team); if (!team) {
        team = { id: `team-${groups.size}`, name: n.team, country: n.country, members: [] };
        groups.set(n.team, team);
    } if (team.members.length >= 4)
        throw new RangeError('A team can have at most four human jumpers'); team.members.push(n); });
    const teams = [...groups.values()];
    for (let i = 0; i < aiTeamCount && teams.length < 16; i++)
        teams.push({ id: `team-ai-${i}`, name: `${countries[i % 16]} TEAM`, country: countries[i % 16], members: [] });
    const r = new Random(9876);
    teams.forEach((t, i) => { while (t.members.length < 4) {
        const j = t.members.length;
        t.members.push(normalizePlayer({ id: `${t.id}-cpu-${j}`, name: aiNames[(i * 4 + j) % 16], country: t.country, human: false, team: t.name, skill: clamp(difficulty + r.range(-.16, .12), .2, 1) }, i));
    } t.members.forEach((p, j) => { p.teamId = t.id; p.slot = j; }); });
    return teams;
}
function ranked(items, value = x => x.total) {
    let prev = NaN, rank = 0;
    return [...items].sort((a, b) => value(b) - value(a) || String(a.id).localeCompare(String(b.id))).map((item, i) => { const v = round(value(item), 1); if (v !== prev)
        rank = i + 1; prev = v; return { ...item, rank }; });
}
/** Serializable two-round individual / four-athlete team competition state machine. */
class Competition {
    constructor({ mode = 'world', hills = ['fin'], players, teams = null, seed = 1, windStrength = 1, rules = 'legacy' } = {}) {
        if (!['world', 'team'].includes(mode))
            throw new RangeError('Invalid competition mode');
        if (!hills.length || hills.length > 64)
            throw new RangeError('Select 1–64 hill events');
        hills.forEach(getHill);
        if (!Array.isArray(players) || players.length < 1 || players.length > 64)
            throw new RangeError('Invalid field');
        if (players.some(p => !p || typeof p.id !== 'string' || !p.id || ['__proto__', 'constructor', 'prototype'].includes(p.id)) || new Set(players.map(p => p.id)).size !== players.length)
            throw new Error('Player IDs must be unique');
        if (mode === 'team' && (!teams?.length || teams.some(t => t.members.length !== 4)))
            throw new Error('Team cup requires four jumpers per team');
        this.rules = validateRules(rules);
        this.version = 1;
        this.mode = mode;
        this.hills = [...hills];
        this.players = players;
        this.teams = teams;
        this.seed = seed >>> 0;
        this.windStrength = windStrength;
        this.eventIndex = 0;
        this.round = 1;
        this.status = 'running';
        this.history = [];
        this.cup = {};
        this.scores = {};
        this.turn = 0;
        this.beginEvent();
    }
    get hill() { return getHill(this.hills[this.eventIndex]); }
    get competitors() { return this.mode === 'team' ? this.teams : this.players; }
    beginEvent() {
        this.round = 1;
        this.status = 'running';
        this.scores = {};
        this.turn = 0;
        this.players.forEach(p => this.scores[p.id] = [null, null]);
        const r = new Random(this.seed + this.eventIndex * 101);
        const order = this.eventIndex === 0 ? r.shuffle(this.competitors) : ranked(this.competitors, t => this.cup[t.id] || 0).reverse();
        this.queue = this.buildQueue(order);
    }
    buildQueue(order) { return this.mode === 'team' ? [0, 1, 2, 3].flatMap(slot => order.map(t => t.members[slot].id)) : order.map(p => p.id); }
    current() { if (this.status !== 'running')
        return null; return this.players.find(p => p.id === this.queue[this.turn]) || null; }
    options() { return { rules: this.rules, seed: this.seed + this.eventIndex * 7919 + this.round * 101, windStrength: this.windStrength, assist: false, gate: 0 }; }
    rows() {
        if (this.mode === 'world')
            return ranked(this.players.map(p => { const jumps = this.scores[p.id] || []; return { ...p, jumps, total: round(jumps.reduce((n, r) => n + (r?.total || 0), 0), 1) }; }));
        return ranked(this.teams.map(t => { const jumps = t.members.flatMap(p => this.scores[p.id] || []); return { ...t, jumps, total: round(jumps.reduce((n, r) => n + (r?.total || 0), 0), 1) }; }));
    }
    submit(result) {
        const p = this.current();
        if (!p)
            throw new Error('No active turn');
        if (!result || result.hillId !== this.hill.id || !Number.isFinite(result.total))
            throw new Error('Result does not match current event');
        if (result.rules !== undefined && result.rules !== this.rules) throw new Error('Result rules do not match cup');
        if (this.scores[p.id][this.round - 1])
            throw new Error('Result already submitted');
        this.scores[p.id][this.round - 1] = { ...result };
        this.turn++;
        if (this.turn >= this.queue.length) {
            if (this.round === 1) {
                const rows = this.rows(), cut = this.mode === 'team' ? 8 : 30;
                // Include all competitors tied with the last qualifying score.
                const limit = rows[Math.min(cut, rows.length) - 1].total;
                const qualified = rows.filter(r => r.total >= limit).reverse();
                this.queue = this.buildQueue(qualified);
                this.round = 2;
                this.turn = 0;
                return 'round';
            }
            this.status = 'event-complete';
            const rows = this.rows();
            for (const row of rows)
                this.cup[row.id] = (this.cup[row.id] || 0) + ((this.rules === 'dsj210' && this.mode === 'team' ? TEAM_CUP_POINTS : CUP_POINTS)[row.rank - 1] || 0);
            this.history.push({ hillId: this.hill.id, rows: rows.map(r => ({ id: r.id, name: r.name, rank: r.rank, total: r.total, jumps: r.jumps })) });
            return 'event';
        }
        return 'turn';
    }
    nextEvent() {
        if (this.status !== 'event-complete')
            throw new Error('Finish the current hill before continuing');
        if (this.eventIndex + 1 >= this.hills.length) {
            this.status = 'finished';
            return false;
        }
        this.eventIndex++;
        this.beginEvent();
        return true;
    }
    standings() { return ranked(this.competitors.map(p => ({ ...p, total: this.cup[p.id] || 0 }))); }
    startList() {
        return this.queue.map((id, i) => {
            const player = this.players.find(p => p.id === id);
            return { ...player, bib: i + 1, group: this.mode === 'team' ? Math.floor(i / (this.queue.length / 4)) + 1 : 1,
                completed: i < this.turn, current: this.status === 'running' && i === this.turn,
                previous: this.round === 2 ? this.scores[id][0] : null };
        });
    }
    target(stylePoints = 54) {
        const player = this.current();
        if (!player || !Number.isFinite(stylePoints)) return null;
        const id = this.mode === 'team' ? player.teamId : player.id;
        const rows = this.rows(), self = rows.find(row => row.id === id);
        const rivals = rows.filter(row => row.id !== id && row.jumps.some(Boolean));
        if (!rivals.length || !self) return null;
        const leader = rivals.reduce((a, b) => a.total >= b.total ? a : b);
        const needed = round(leader.total - self.total + .1, 1);
        const k = this.hill.k, base = k >= 165 ? 120 : 60;
        return { leader: leader.name, points: needed, assumedStyle: clamp(stylePoints, 0, 60),
            distance: Math.max(0, Math.ceil((k + (needed - clamp(stylePoints, 0, 60) - base) / pointsPerMetre(k, this.rules)) * 2) / 2) };
    }
    teamDetails(teamId) {
        if (this.mode !== 'team') throw new Error('Team details require a team cup');
        const team = this.teams.find(t => t.id === teamId);
        if (!team) throw new Error('Unknown team');
        return team.members.map(p => ({ ...p, jumps: this.scores[p.id].map(j => j ? { ...j } : null),
            total: round(this.scores[p.id].reduce((sum, j) => sum + (j?.total || 0), 0), 1) }));
    }
    cpuResult() { const p = this.current(); if (!p || p.human)
        throw new Error('Current turn is not a CPU'); return simulateCPU(this.hill, this.options(), p.skill); }
    serialize() { return JSON.stringify(this); }
    static restore(text) {
        if (typeof text !== 'string' || text.length > 4000000)
            throw new Error('Invalid cup save');
        const d = JSON.parse(text);
        if (d.version !== 1 || !['world', 'team'].includes(d.mode) || !['running', 'event-complete', 'finished'].includes(d.status))
            throw new Error('Unsupported cup save');
        if (!Array.isArray(d.hills) || !d.hills.length || d.hills.length > 64)
            throw new Error('Invalid tour');
        d.hills.forEach(getHill);
        if (!Number.isInteger(d.eventIndex) || d.eventIndex < 0 || d.eventIndex >= d.hills.length || ![1, 2].includes(d.round))
            throw new Error('Invalid cup position');
        if (!Array.isArray(d.players) || !d.players.length || d.players.length > 64 || new Set(d.players.map(p => p.id)).size !== d.players.length)
            throw new Error('Invalid players');
        if (!Array.isArray(d.queue) || !d.queue.length || new Set(d.queue).size !== d.queue.length || (d.status === 'running' && d.turn >= d.queue.length) || d.queue.length > 64 || d.queue.some(id => !d.players.some(p => p.id === id)) || !Number.isInteger(d.turn) || d.turn < 0 || d.turn > d.queue.length)
            throw new Error('Invalid turn queue');
        if (d.players.some(p => !p || typeof p.id !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(p.id))) throw new Error('Invalid player ID');
        if (!d.scores || !d.cup || !Array.isArray(d.history) || d.history.length > 64)
            throw new Error('Invalid score data');
        for (const p of d.players) {
            const a = d.scores[p.id];
            if (!Array.isArray(a) || a.length !== 2 || a.some(r => r !== null && (!r || !Number.isFinite(r.total))))
                throw new Error('Invalid jump score');
        }
        if (d.mode === 'team' && (!Array.isArray(d.teams) || d.teams.length > 16 || d.teams.some(t => !Array.isArray(t.members) || t.members.length !== 4 || t.members.some(p => !d.players.some(q => q.id === p.id)))))
            throw new Error('Invalid team data');
        const obj = Object.create(Competition.prototype);
        obj.rules = validateRules(d.rules ?? 'legacy');
        for (const key of ['version', 'mode', 'hills', 'players', 'teams', 'seed', 'windStrength', 'eventIndex', 'round', 'status', 'history', 'cup', 'scores', 'turn', 'queue'])
            obj[key] = d[key];
        return obj;
    }
}

/** Ordered tour with repeated venues. A preset's order is never inferred from DOM order. */
class TourSchedule {
    constructor(hills = [], name = 'CUSTOM TOUR') {
        if (!Array.isArray(hills) || hills.length > 64) throw new RangeError('A tour supports at most 64 events');
        hills.forEach(getHill);
        this.hills = [...hills];
        this.name = String(name).replace(/[<>\x00-\x1f]/g, '').trim().slice(0, 40) || 'CUSTOM TOUR';
    }
    insert(hillId, index = this.hills.length) {
        getHill(hillId);
        if (this.hills.length >= 64) throw new RangeError('A tour supports at most 64 events');
        if (!Number.isInteger(index) || index < 0 || index > this.hills.length) throw new RangeError('Invalid event position');
        this.hills.splice(index, 0, hillId); return this;
    }
    remove(index) { this.checkIndex(index); this.hills.splice(index, 1); return this; }
    move(from, to) { this.checkIndex(from); this.checkIndex(to); const [id] = this.hills.splice(from, 1); this.hills.splice(to, 0, id); return this; }
    checkIndex(index) { if (!Number.isInteger(index) || index < 0 || index >= this.hills.length) throw new RangeError('Invalid event position'); }
    reverse() { this.hills.reverse(); return this; }
    shuffle(seed = 1) { this.hills = new Random(seed).shuffle(this.hills); return this; }
    serialize() { return JSON.stringify({ format: 'ski-jump-web-tour', version: 1, name: this.name, hills: this.hills }); }
    static parse(text) {
        if (typeof text !== 'string' || text.length > 10000) throw new Error('Invalid tour file');
        const data = JSON.parse(text);
        if (!data || data.format !== 'ski-jump-web-tour' || data.version !== 1) throw new Error('Unsupported tour file');
        return new TourSchedule(data.hills, data.name);
    }
}

/** RFC 4180 output; neutralizes spreadsheet formulas in untrusted player names. */
function competitionCSV(competition) {
    const cell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, c => "'" + c).replace(/"/g, '""') + '"';
    const lines = [['Event', 'Hill', 'Rank', 'Name', 'Round 1 metres', 'Round 2 metres', 'Points']];
    competition.history.forEach((event, index) => event.rows.forEach(row => lines.push([
        index + 1, getHill(event.hillId).name, row.rank, row.name,
        competition.mode === 'team' ? '' : row.jumps[0]?.distance ?? '',
        competition.mode === 'team' ? '' : row.jumps[1]?.distance ?? '', row.total
    ])));
    lines.push([], ['Cup rank', 'Name', 'Cup points']);
    competition.standings().forEach(row => lines.push([row.rank, row.name, row.total]));
    return lines.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

return {CUP_POINTS,TEAM_CUP_POINTS,normalizePlayer,createField,createTeams,ranked,Competition,TourSchedule,competitionCSV};
});
define("@wieslawsoltes/ski-replay",function(require){
const { clamp, lerp, round, wrapAngle }=require("@wieslawsoltes/ski-core");
const { getHill }=require("@wieslawsoltes/ski-hills");
const { PHYSICS_VERSION, validateRules }=require("@wieslawsoltes/ski-physics");
const REPLAY_VERSION = 2;
const REPLAY_PHASES = ['gate', 'inrun', 'flight', 'runout', 'finished'];
const FRAME_FIELDS = ['time', 'x', 'y', 'pitch', 'lean', 'speed', 'distance', 'wind', 'phase', 'landing', 'crashed', 'quality'];
function frame(s, version) { const f = [round(s.time, 4), round(s.x, 4), round(s.y, 4), round(s.pitch, 5), round(s.lean, 5), round(s.speed, 4), round(s.distance, 3), round(s.wind, 3), REPLAY_PHASES.indexOf(s.phase), s.landing === 'telemark' ? 1 : s.landing === 'parallel' ? 2 : 0, s.crashed ? 1 : 0, round(s.quality, 4)]; if (version === 2) f.push(round(s.leftLandingTime ?? -1, 4), round(s.rightLandingTime ?? -1, 4), round(s.telemarkWidth ?? 0, 4), round(s.gateElapsed ?? 0, 4), round(s.windAngle ?? 0, 5), s.disqualified ? 1 : 0); return f; }
class ReplayRecorder {
    constructor(sim, player = { name: 'PLAYER 1' }, hz = 60) { this.sim = sim; this.version = sim.options.rules === 'dsj210' ? 2 : 1; this.player = { ...player }; this.hz = hz; this.next = 0; this.frames = []; this.capture(true); }
    capture(force = false) { const s = this.sim.state; if (this.frames.length >= 14400)
        return; if (!force && s.time < this.next)
        return; if (this.frames.length && round(s.time, 4) <= this.frames.at(-1)[0])
        return; this.frames.push(frame(s, this.version)); this.next = s.time + 1 / this.hz - .00001; }
    finish() { this.capture(true); return { format: 'ski-jump-web-replay', version: this.version, physics: this.sim.physicsVersion || PHYSICS_VERSION, hillId: this.sim.hill.id, player: this.player, options: { ...this.sim.options }, result: this.sim.result ? { ...this.sim.result } : null, createdAt: new Date().toISOString(), frames: this.frames.map(f => [...f]) }; }
}
function validateReplay(data) {
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
function parseReplay(text) { if (typeof text !== 'string' || text.length > 3000000)
    throw new Error('Replay exceeds 3 MB'); return validateReplay(JSON.parse(text)); }
function serializeReplay(replay) { return JSON.stringify(validateReplay(replay)); }
class ReplayPlayer {
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

return {REPLAY_VERSION,REPLAY_PHASES,FRAME_FIELDS,ReplayRecorder,validateReplay,parseReplay,serializeReplay,ReplayPlayer};
});
define("@wieslawsoltes/ski-renderer",function(require){
const { clamp, lerp, Random, colorRGB }=require("@wieslawsoltes/ski-core");
const { HillProfile, getHillVisual }=require("@wieslawsoltes/ski-hills");
const { MeshBuilder, vsub, vadd, vmul, norm, multiply, lookAt, ortho, perspective, projected, shade }=require("@wieslawsoltes/ski-renderer/mesh.js");

const { createClassicHillScene, createProjectedShadow }=require("@wieslawsoltes/ski-renderer/scene.js");

const { SCENE_WGSL, SKY_WGSL, SCENE_GLSL, SKY_GLSL, SNOW_WGSL, SNOW_GLSL, SCENE_VERTEX_GLSL, SNAP_WGSL }=require("@wieslawsoltes/ski-renderer/shading.js");
const { SoftwareRasterizer }=require("@wieslawsoltes/ski-renderer/raster.js");
const SNOW = [.88, .9, .97], WOOD = [.50, .33, .075], DARKWOOD = [.29, .21, .06], STEEL = [.42, .44, .50];
function tree(m, x, y, z, h, r) { m.box(x - .15, y, z - .15, .3, h * .55, .3, [.25, .19, .13]); const greens = [[.12, .28, .21], [.16, .31, .25], [.11, .24, .19]]; for (let j = 0; j < 3; j++) {
    const base = y + h * (.16 + j * .21), radius = h * (.26 - j * .055);
    m.cone(x, base, z, radius, h * .48, greens[(j + r) % 3], 6);
    m.cone(x, base + h * .15, z, radius * .65, h * .33, [.79, .85, .88], 6);
} }
function stripe(m, p, d, width, color, thickness = .23) { const a = p.atDistance(d - thickness), b = p.atDistance(d + thickness); m.quad([a.x, a.y + .07, -width], [b.x, b.y + .07, -width], [b.x, b.y + .07, width], [a.x, a.y + .07, width], color, false); }
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function groundNumber(m, p, d, width, n) { const a = p.atDistance(d), text = String(n), scale = .31; for (let c = 0; c < text.length; c++) {
    const glyph = DIGITS[+text[c]];
    for (let j = 0; j < 15; j++)
        if (glyph[j] === '1') {
            const xx = a.x + (j % 3) * scale, zz = width + 1 + (Math.floor(j / 3) + c * 6) * scale, yy = p.atX(xx).y + .09;
            m.quad([xx, yy, zz], [xx + scale * .8, yy, zz], [xx + scale * .8, yy, zz + scale * .8], [xx, yy, zz + scale * .8], [.29, .38, .57], false);
        }
} }
/** Static, batched terrain / structures. No mesh creation or full-scene uploads per frame. */
function createHillMesh(profile, quality = 1, record = 0) {
    const p = profile instanceof HillProfile ? profile : new HillProfile(profile), m = new MeshBuilder(), r = new Random(p.hill.seed);
    const x0 = p.startX - 95, x1 = p.end.x + 90, step = quality < 1 ? 20 : 12, zMin = -210, zMax = 110;
    for (let x = x0; x < x1; x += step)
        for (let z = zMin; z < zMax; z += step) {
            const q = [[x, p.groundY(x, z), z], [x + step, p.groundY(x + step, z), z], [x + step, p.groundY(x + step, z + step), z + step], [x, p.groundY(x, z + step), z + step]];
            m.quad(...q, shade(SNOW, r.range(.94, 1.035)));
        }
    // Distant folded mountain silhouettes, authored geometry.
    if (p.hill.biome === 'alpine' || p.hill.biome === 'arctic')
        for (let i = 0; i < 14; i++) {
            const x = lerp(x0 - 80, x1 + 100, i / 13), z = -170 - r.range(0, 100), y = p.groundY(x, z) - 5, h = r.range(28, p.hill.biome === 'alpine' ? 72 : 40), w = r.range(35, 65);
            m.tri([x - w, y, z], [x, y + h, z - 10], [x + w, y, z], [.69, .74, .85]);
            m.tri([x, y + h, z - 10], [x + w, y, z], [x + w * .7, y, z - 25], [.55, .62, .76]);
            m.tri([x - w * .3, y + h * .7, z - 7], [x, y + h, z - 10], [x + w * .3, y + h * .7, z - 7], [.93, .94, .99]);
        }
    const stride = quality < 1 ? 5 : 2.5;
    for (let s = 0; s < p.k * 2.1; s += stride) {
        const a = p.atDistance(s), b = p.atDistance(s + stride), wa = 4 + s * .027, wb = 4 + (s + stride) * .027;
        m.quad([a.x, a.y + .035, -wa], [b.x, b.y + .035, -wb], [b.x, b.y + .035, wb], [a.x, a.y + .035, wa], [.96, .96, 1]);
        for (const side of [-1, 1])
            m.quad([a.x, a.y + .05, side * wa], [b.x, b.y + .05, side * wb], [b.x, b.y + .05, side * (wb + .16)], [a.x, a.y + .05, side * (wa + .16)], [.61, .65, .76]);
    }
    for (let s = 10; s < p.k * 1.55; s += 10) {
        const a = p.atDistance(s), width = 4 + s * .027;
        stripe(m, p, s, width, [.70, .75, .85], .05);
        groundNumber(m, p, s, width, Math.round(s));
        for (const z of [-width - 1, width + 1]) {
            m.box(a.x - .08, a.y, z - .07, .16, 1.2, .14, [.87, .16, .17]);
            m.box(a.x - .08, a.y + .65, z - .07, .16, .3, .14, [1, .95, .9]);
        }
    }
    stripe(m, p, p.k, 4 + p.k * .027, [.79, .16, .15], .28);
    stripe(m, p, p.k * 1.1, 4 + p.k * 1.1 * .027, [.22, .34, .67], .2);
    if (record > 0)
        stripe(m, p, record, 4 + record * .027, [.88, .72, .09], .11);
    // Inrun snow, ochre timber fascia, twin rails, and slender concrete supports.
    for (let x = p.startX; x < 0; x += 1.3) {
        const b = Math.min(0, x + 1.3), y = p.inrunY(x), yb = p.inrunY(b);
        m.quad([x, y, -1.75], [b, yb, -1.75], [b, yb, 1.75], [x, y, 1.75], [.94, .95, 1]);
        m.quad([x, y - .1, 1.9], [b, yb - .1, 1.9], [b, yb - 1.6, 1.9], [x, y - 1.6, 1.9], WOOD);
        m.quad([x, y - .1, -1.9], [b, yb - .1, -1.9], [b, yb - 1.6, -1.9], [x, y - 1.6, -1.9], DARKWOOD);
        m.quad([x, y - 1.6, -1.9], [b, yb - 1.6, -1.9], [b, yb - 1.6, 1.9], [x, y - 1.6, 1.9], DARKWOOD);
        for (const z of [-.32, .32])
            m.quad([x, y + .01, z - .06], [b, yb + .01, z - .06], [b, yb + .01, z + .06], [x, y + .01, z + .06], [.54, .58, .67]);
        for (const z of [-1.95, 1.75]) {
            m.quad([x, y + .55, z], [b, yb + .55, z], [b, yb + .55, z + .2], [x, y + .55, z + .2], [.72, .54, .19]);
            m.quad([x, y + .55, z + .2], [b, yb + .55, z + .2], [b, yb - .02, z + .2], [x, y - .02, z + .2], WOOD);
        }
    }
    for (let x = p.startX + 3; x < -5; x += Math.max(9, p.k * .055)) {
        const top = p.inrunY(x) - 1.65, bottom = p.groundY(x, 0);
        for (const z of [-1.1, .9])
            m.box(x - .4, bottom, z - .28, .8, Math.max(.3, top - bottom), .56, STEEL);
        m.beam([x, bottom + .8, -1], [x + 6, p.inrunY(x + 6) - 1.6, -1], .17, [.37, .39, .43]);
    }
    const sy = p.startY, g = p.groundY(p.startX - 4, 0);
    m.box(p.startX - 9, sy - 2, -3, 9, 1.9, 6, WOOD);
    m.box(p.startX - 9, sy - .1, -3, 9, .12, 6, [.96, .96, 1]);
    for (const x of [p.startX - 8, p.startX - 2])
        for (const z of [-2.2, 2.2])
            m.box(x - .45, g, z - .45, .9, sy - 2 - g, .9, STEEL);
    for (const z of [-3, 2.8]) {
        m.box(p.startX - 9, sy, z, 9, .55, .22, DARKWOOD);
        m.box(p.startX - 9, sy + .52, z, 9, .08, .22, [.83, .81, .69]);
    }
    m.box(p.startX - 9, sy, -3, .2, .6, 6, DARKWOOD);
    m.box(p.startX - 1, sy - .4, -2.6, .2, 3.5, .2, [.31, .32, .37]);
    m.box(p.startX - 1.27, sy + 2.15, -2.64, .72, 1.1, .25, [.12, .14, .19]);
    m.sphere(p.startX - .9, sy + 2.4, -2.36, .19, [.18, .9, .16]);
    // Exit fence, flags and a small judges' stand.
    for (let s = p.k * .55; s < p.k * 1.8; s += 8) {
        const a = p.atDistance(s), width = 6 + s * .027;
        m.box(a.x, a.y, width, .13, 1.5, .13, [.38, .30, .21]);
        const b = p.atDistance(s + 8);
        m.beam([a.x, a.y + 1.1, width], [b.x, b.y + 1.1, 6 + (s + 8) * .027], .07, [.46, .33, .16]);
    }
    const tower = p.atDistance(p.k * .8);
    m.box(tower.x - 3, tower.y + 1, 19, 7, 8, 6, [.43, .44, .46]);
    m.box(tower.x - 3.3, tower.y + 8.7, 18.7, 7.6, .65, 6.6, [.87, .89, .94]);
    m.box(tower.x - 2.7, tower.y + 6, 18.95, 6.4, 1.7, .1, [.18, .26, .36]);
    for (let j = 0; j < 6; j++) {
        const a = p.atDistance(p.k * (.65 + j * .10)), z = -10 - a.s * .027;
        m.beam([a.x, a.y, z], [a.x, a.y + 6, z], .08, [.47, .49, .53]);
        m.quad([a.x, a.y + 6, z], [a.x + 2, a.y + 5.6, z], [a.x + 2, a.y + 4.7, z], [a.x, a.y + 5.1, z], j % 2 ? [.86, .16, .16] : [.85, .87, .96]);
    }
    const count = Math.round((p.hill.biome === 'arctic' ? 75 : 220) * quality);
    for (let i = 0; i < count; i++) {
        const x = r.range(x0, x1), side = r.next() < .88 ? -1 : 1, z = side * r.range(x < 0 ? 9 : 18, side < 0 ? 160 : 65);
        if (x > 0 && Math.abs(z) < 11 + p.atX(x).s * .027)
            continue;
        tree(m, x, p.groundY(x, z), z, r.range(3.5, 9.8), i);
    }
    // A low-poly spectator line. Kept outside the jump corridor.
    for (let i = 0; i < 75 * quality; i++) {
        const s = r.range(p.k * .65, p.k * 1.6), a = p.atDistance(s), z = -8 - s * .027 - r.range(0, 4);
        m.box(a.x, a.y, z, .45, .9, .3, [r.range(.1, .7), r.range(.1, .5), r.range(.2, .75)]);
        m.sphere(a.x + .22, a.y + 1.1, z + .15, .19, [.79, .65, .51]);
    }
    return m.finish();
}
function shadowMesh(state, profile) {
    const m = new MeshBuilder();
    if (state.phase === 'gate' || state.phase === 'inrun')
        return m.finish();
    const x = state.x + .25 * Math.max(0, state.height || 0), z = .7, g = profile.atX(x), radius = 1.5 + Math.min(2, (state.height || 0) * .022), col = [.51, .56, .67];
    for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5, b = (i + 1) * Math.PI / 5;
        const p = t => { const xx = x + Math.cos(t) * radius; return [xx, profile.atX(xx).y + .065, z + Math.sin(t) * .44]; };
        m.tri([x, g.y + .065, z], p(a), p(b), col, false);
    }
    return m.finish();
}
function skierMesh(state, player = {}, ghost = false) {
    const m = new MeshBuilder(), s = state, suit = ghost ? [.66, .89, .95] : colorRGB(player.suit || '#225be7'), helmet = ghost ? [.86, .94, .97] : colorRGB(player.helmet || '#e63235'), skis = ghost ? [.74, .94, .97] : colorRGB(player.skis || '#f0db1c');
    let rotation = s.pitch || 0, offsetY = .05;
    if (s.crashed && ['runout', 'finished'].includes(s.phase)) {
        rotation += Math.min(5, s.runoutTime || s.time % 4) * 3.8;
        offsetY = .55;
    }
    const C = Math.cos(rotation), S = Math.sin(rotation), tr = p => [s.x + p[0] * C - p[1] * S, s.y + p[0] * S + p[1] * C + offsetY, (s.z || 0) + p[2] + (ghost ? -1.4 : 0)];
    const limb = (a, b, r, c) => m.beam(tr(a), tr(b), r, c, 5), ball = (a, r, c) => { const v = tr(a); m.sphere(...v, r, c); };
    let hip, shoulder, head, knee, foot;
    const flight = s.phase === 'flight', standing = (s.phase === 'runout' || s.phase === 'finished') && !s.crashed;
    if (flight) {
        hip = [-.22, .58, 0];
        shoulder = [.63, .76, 0];
        head = [1, .85, 0];
        knee = [-.67, .34, 0];
        foot = [-.58, .10, 0];
    }
    else if (standing) {
        hip = [-.13, 1.05, 0];
        shoulder = [.14, 1.66, 0];
        head = [.31, 1.96, 0];
        knee = [.40, .62, 0];
        foot = [0, .1, 0];
    }
    else {
        hip = [-.35, .74, 0];
        shoulder = [.32, 1.01, 0];
        head = [.67, 1.18, 0];
        knee = [.39, .44, 0];
        foot = [-.05, .1, 0];
    }
    for (const side of [-1, 1]) {
        const vstyle = flight && s.landing === 'none', tele = (standing || flight) && s.landing === 'telemark', width = s.telemarkWidth ?? .5, shift = tele ? side * width * .9 : 0;
        const z = side * .19;
        const back = [-1.55 + shift, .02, vstyle ? side * .055 : z], tip = [1.55 + shift, .02, vstyle ? side * .65 : z];
        limb(back, tip, .067, skis);
        limb(tip, [1.78 + shift, .10, tip[2] + (vstyle ? side * .03 : 0)], .05, skis);
        const f = [foot[0] + shift, foot[1], z], k = [knee[0] + shift * .65, knee[1], z], h = [hip[0], hip[1], z * .7];
        limb([f[0] - .11, f[1], z], [f[0] + .2, f[1], z], .12, [.15, .17, .21]);
        limb(f, k, .105, suit);
        limb(k, h, .14, suit);
        const sh = [shoulder[0], shoulder[1], side * .22], el = flight ? [.14, .46, side * .32] : standing ? [.12, 1.16, side * .42] : [.42, .59, side * .31], hand = flight ? [-.39, .40, side * .25] : standing ? [-.19, .85, side * .43] : [.57, .51, side * .2];
        limb(sh, el, .08, suit);
        limb(el, hand, .07, suit);
        ball(hand, .082, [.13, .15, .2]);
    }
    limb(hip, shoulder, .21, suit);
    limb([shoulder[0] - .08, shoulder[1] + .03, 0], [shoulder[0] + .13, shoulder[1] + .08, 0], .222, ghost ? [.9, .96, 1] : [.95, .94, .90]);
    limb(shoulder, head, .1, [.91, .69, .51]);
    ball(head, .23, helmet);
    ball([head[0] + .18, head[1] - .025, .04], .13, [.12, .17, .24]);
    return m.finish();
}
const GPU_SHADER=SCENE_WGSL, GPU_SKY=SKY_WGSL, GPU_SNOW=SNOW_WGSL;
const GPU_SNOW_DRAW = SNAP_WGSL+`
struct Weather { wind:f32, dt:f32, width:f32, height:f32 };
@group(0) @binding(0) var<storage,read> particles:array<vec4<f32>>;
@group(0) @binding(1) var<uniform> weather:Weather;
@vertex fn vs(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->@builtin(position) vec4<f32>{
 let q=array<vec2<f32>,6>(vec2<f32>(-1,-1),vec2<f32>(1,-1),vec2<f32>(1,1),vec2<f32>(-1,-1),vec2<f32>(1,1),vec2<f32>(-1,1));let p=particles[ii];return snapClip(vec4<f32>(p.xy+q[vi]*vec2<f32>(1.0/weather.width,1.0/weather.height)*p.w,0,1),vec2<f32>(weather.width,weather.height));
}
@fragment fn fs()->@location(0) vec4<f32>{return vec4<f32>(.94,.96,1,.75);}
`;
class SkiRenderer {
    constructor(host, options = {}) {
        if (!host?.appendChild)
            throw new TypeError('A renderer host element is required');
        this.host = host;
        this.options = { resolution: 'classic', renderer: 'auto', weather: 'clear', camera: 'classic', presentation: 'enhanced', ...options };
        this.softwareRaster = new SoftwareRasterizer();
        this.frameMilliseconds = 0;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'ski-scene';
        this.canvas.setAttribute('aria-hidden', 'true');
        host.appendChild(this.canvas);
        this.kind = 'initializing';
        this.staticData = null;
        this.dynamicCapacity = 65536;
        this.dynamicData = new Float32Array(this.dynamicCapacity);
        this.uniformData = new Float32Array(28);
        this.weatherData = new Float32Array(4);
        this.width = 320;
        this.height = 200;
        this.camera = { x: 0, y: 0 };
        this.cameraReady = false;
        this.fps = 0;
        this.frames = 0;
        this.lastFrameTime = 0;
        this.losses = 0;
        this.disposed = false;
        this.ready = this.initialize();
    }
    async initialize() {
        if(this.disposed)return;
        const requested = this.options.renderer;
        if (requested === 'auto' && globalThis.isSecureContext && navigator.gpu) {
            try {
                const adapter = await Promise.race([navigator.gpu.requestAdapter({ powerPreference: 'low-power' }), new Promise((_, reject) => setTimeout(() => reject(new Error('GPU adapter timeout')), 2200))]);
                if (adapter) {
                    const device = await adapter.requestDevice();
                    if (this.disposed) {
                        device.destroy();
                        return;
                    }
                    await this.initGPU(device);
                    return;
                }
            }
            catch (e) {
                this.fallbackReason = String(e.message || e);
                this.device?.destroy();
                this.device = null;
            }
        }
        if (this.disposed || this.kind === 'webgpu')
            return;
        this.newCanvas();
        if (requested !== 'software') {
            try {
                this.initGL();
                if (this.kind === 'webgl2')
                    return;
            }
            catch (e) {
                this.fallbackReason = String(e.message || e);
            }
        }
        this.newCanvas();
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.kind = 'software';
        this.resize();
        if (this.profile)
            this.setHill(this.profile, this.record);
    }
    newCanvas() { const c = document.createElement('canvas'); c.className = 'ski-scene'; c.setAttribute('aria-hidden', 'true'); this.canvas.replaceWith(c); this.canvas = c; this.gl=null; this.ctx=null; }
    async initGPU(device) {
        this.device = device;
        const ctx = this.canvas.getContext('webgpu');
        if (!ctx)
            throw new Error('WebGPU canvas unavailable');
        this.gpuContext = ctx;
        this.format = navigator.gpu.getPreferredCanvasFormat();
        device.pushErrorScope('validation');
        const mod = device.createShaderModule({ label: 'Flat-shaded ski scene', code: GPU_SHADER }), sky = device.createShaderModule({ label: 'Palette sky', code: GPU_SKY });
        for (const module of [mod, sky]) {
            const info = await module.getCompilationInfo();
            const errors = info.messages.filter(m => m.type === 'error');
            if (errors.length)
                throw new Error(errors.map(m => m.message).join('; '));
        }
        this.uniform = device.createBuffer({ size: 112, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.pipeline = device.createRenderPipeline({ label: 'Ski mesh pipeline', layout: 'auto', vertex: { module: mod, entryPoint: 'vs', buffers: [{ arrayStride: 24, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }] }] }, fragment: { module: mod, entryPoint: 'fs', targets: [{ format: this.format }] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less-equal' } });
        this.skyPipeline = device.createRenderPipeline({ label: 'Sky pipeline', layout: 'auto', vertex: { module: sky, entryPoint: 'vs' }, fragment: { module: sky, entryPoint: 'fs', targets: [{ format: this.format }] }, primitive: { topology: 'triangle-list' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' } });
        this.bind = device.createBindGroup({ layout: this.pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.uniform } }] });
        this.skyBind = device.createBindGroup({ layout: this.skyPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.uniform } }] });
        this.dynamicBuffer = device.createBuffer({ size: this.dynamicCapacity * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        this.snowBuffer = device.createBuffer({ size: 384 * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        const data = new Float32Array(384 * 4), rng = new Random(713);
        for (let i = 0; i < 384; i++)
            data.set([rng.range(-1, 1), rng.range(-1, 1), rng.next(), rng.range(.65, 1.6)], i * 4);
        device.queue.writeBuffer(this.snowBuffer, 0, data);
        this.weatherUniform = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        const compute = device.createShaderModule({ code: GPU_SNOW }), snow = device.createShaderModule({ code: GPU_SNOW_DRAW });
        for (const module of [compute, snow]) {
            const info = await module.getCompilationInfo();
            const errors = info.messages.filter(m => m.type === 'error');
            if (errors.length)
                throw new Error(errors.map(m => m.message).join('; '));
        }
        this.snowCompute = device.createComputePipeline({ layout: 'auto', compute: { module: compute, entryPoint: 'update' } });
        this.snowPipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: snow, entryPoint: 'vs' }, fragment: { module: snow, entryPoint: 'fs', targets: [{ format: this.format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }] }, primitive: { topology: 'triangle-list' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' } });
        const resources = [{ binding: 0, resource: { buffer: this.snowBuffer } }, { binding: 1, resource: { buffer: this.weatherUniform } }];
        this.computeBind = device.createBindGroup({ layout: this.snowCompute.getBindGroupLayout(0), entries: resources });
        this.snowBind = device.createBindGroup({ layout: this.snowPipeline.getBindGroupLayout(0), entries: resources });
        const error = await device.popErrorScope();
        if (error)
            throw new Error(error.message);
        this.kind = 'webgpu';
        this.resize();
        if (this.profile)
            this.setHill(this.profile, this.record);
        device.lost.then(info => {
            if (this.disposed || this.device !== device) return;
            this.losses++;
            this.fallbackReason = `GPU device lost: ${info.reason}`;
            this.kind = 'lost';
            for (const name of ['depth', 'staticBuffer', 'dynamicBuffer', 'uniform', 'snowBuffer', 'weatherUniform']) {
                this[name]?.destroy();
                this[name] = null;
            }
            this.gpuContext?.unconfigure();
            this.device = null;
            this.options.renderer = 'webgl';
            this.ready = this.initialize();
        });
        device.addEventListener('uncapturederror', e => { if (this.disposed || this.device !== device) return; this.lastError = e.error.message; console.error('WebGPU:', e.error.message); });
    }
    initGL() {
        const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
        if (!gl)
            throw new Error('WebGL2 unavailable');
        this.gl = gl;
        // Render in a top-left logical framebuffer, matching WebGPU edge inclusion.
        // The compositor reverses storage orientation without an extra readback/copy.
        this.canvas.style.transform = 'scaleY(-1)';
        gl.disable(gl.DITHER); // Our explicit ordered palette handles dithering.
        const compile = (type, code) => { const sh = gl.createShader(type); gl.shaderSource(sh, code); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
            throw new Error(gl.getShaderInfoLog(sh)); return sh; };
        const vs = SCENE_VERTEX_GLSL;
        const fs = SCENE_GLSL;
        const program = (v, f) => { const pr = gl.createProgram(); gl.attachShader(pr, compile(gl.VERTEX_SHADER, v)); gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, f)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(pr)); return pr; };
        this.glProgram = program(vs, fs);
        this.glMatrix = gl.getUniformLocation(this.glProgram, 'matrix');
        this.glEye = gl.getUniformLocation(this.glProgram, 'eye');
        this.glWeather = gl.getUniformLocation(this.glProgram, 'weather');
        this.glViewport = gl.getUniformLocation(this.glProgram, 'viewport');
        this.glSky = program(`#version 300 es\nprecision highp float;void main(){vec2 q=vec2((gl_VertexID==1)?3.:-1.,(gl_VertexID==2)?3.:-1.);gl_Position=vec4(q,.999,1);}`, SKY_GLSL);
        this.glSkyWeather = gl.getUniformLocation(this.glSky, 'weather');
        this.glSkyViewport = gl.getUniformLocation(this.glSky, 'viewport');
        this.glSkyOffset = gl.getUniformLocation(this.glSky, 'skyOffset');
        this.glSnow = program(SNOW_GLSL, `#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(.94,.96,1.,.75);}`);
        this.glConditions = gl.getUniformLocation(this.glSnow, 'conditions');
        this.glStatic = gl.createBuffer();
        this.glDynamic = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glDynamic);
        gl.bufferData(gl.ARRAY_BUFFER, this.dynamicCapacity * 4, gl.DYNAMIC_DRAW);
        if(this.glLifecycleCanvas!==this.canvas){
            const canvas=this.canvas;this.glLifecycleCanvas=canvas;
            canvas.addEventListener('webglcontextlost',e=>{
                e.preventDefault();if(this.disposed||canvas!==this.canvas)return;
                this.losses++;this.kind='lost';this.fallbackReason='WebGL context lost';
            });
            canvas.addEventListener('webglcontextrestored',()=>{
                if(this.disposed||canvas!==this.canvas)return;
                try{this.initGL();}catch(error){this.lastError=String(error.message||error);}
            });
        }
        this.kind = 'webgl2';
        this.resize();
        if (this.profile)
            this.setHill(this.profile, this.record);
    }
    setOptions(options) {
        const style=this.options.presentation;
        Object.assign(this.options, options);
        if(style!==this.options.presentation && this.profile) this.setHill(this.profile,this.record);
        this.resize();
    }
    resize() {
        const rect = this.host.getBoundingClientRect(), aspect = Math.max(.45, rect.width / Math.max(1, rect.height));
        let h = this.options.resolution === 'classic' ? 200 : this.options.resolution === 'sharp' ? 400 : Math.min(900, Math.round(rect.height * (globalThis.devicePixelRatio || 1)));
        let w = Math.round(h * aspect);
        if (aspect < 1) {
            w = this.options.resolution === 'classic' ? 320 : this.options.resolution === 'sharp' ? 480 : Math.min(720, Math.round(rect.width * (globalThis.devicePixelRatio || 1)));
            h = Math.round(w / aspect);
        }
        w = clamp(w, 160, 1800);
        h = clamp(h, 120, 1800);
        if (this.width === w && this.height === h && this.canvas.width === w && this.canvas.height === h && (!this.device || this.depth))
            return;
        this.width = w;
        this.height = h;
        this.canvas.width = w;
        this.canvas.height = h;
        if (this.kind === 'webgpu') {
            this.gpuContext.configure({ device: this.device, format: this.format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
            this.depth?.destroy();
            this.depth = this.device.createTexture({ size: [w, h], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
        }
        if (this.gl)
            this.gl.viewport(0, 0, w, h);
        if(this.kind==='software')this.softwareRaster.resize(w,h);
    }
    setHill(hill, record = 0) {
        this.profile = hill instanceof HillProfile ? hill : new HillProfile(hill);
        this.record = record;
        this.cameraReady = false;
        this.scene = this.options.presentation==='classic' ? createClassicHillScene(this.profile,record) : null;
        const data = this.scene ? this.scene.vertices : createHillMesh(this.profile, 1, record);
        if(data.length%18!==0 || !data.every(Number.isFinite)) throw new RangeError('Invalid hill vertex stream');
        this.staticData = data;
        this.vertexCount = data.length / 6;
        if (this.kind === 'webgpu') {
            this.staticBuffer?.destroy();
            this.staticBuffer = this.device.createBuffer({ size: Math.max(4, data.byteLength), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            this.device.queue.writeBuffer(this.staticBuffer, 0, data);
        }
        if (this.kind === 'webgl2') {
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.glStatic);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
        }
    }
    cameraMatrix(state, dt, overview = false) {
        const p = this.profile, aspect = this.width / this.height, type = this.options.camera;
        let h = type === 'close' ? 37 : type === 'wide' ? 87 : 52 + p.k * .024;
        const classic=this.options.presentation==='classic';
        if(classic && type==='classic')h=getHillVisual(p.hill.id).cameraHeight;
        if (aspect < 1) h *= 1.4;
        let x = state.x + h * aspect * .16, y = state.y - h * .17, eyeOffset = [-11, 24, 90];
        if(classic && type==='classic') {
            const visual=getHillVisual(p.hill.id);
            eyeOffset=[visual.cameraYaw*90,visual.cameraElevation*90,90];
            x=state.x+h*aspect*.02;y=state.y-h*.10;
        }
        if (type === 'chase') {
            eyeOffset = [-52, 22, 54];
            x = state.x + 15;
            y = state.y - 9;
        }
        if (overview) {
            h = Math.max(72, p.k * .65);
            x = -p.inrunLength * .35;
            y = p.startY * .38;
            eyeOffset = [-12, 34, 110];
        }
        if (!this.cameraReady) {
            this.camera.x = x;
            this.camera.y = y;
            this.cameraReady = true;
        }
        const t = this.options.presentation==='classic'&&!overview ? 1 : 1 - Math.exp(-Math.min(Math.max(0,dt), .05) * (overview ? 3 : 9));
        this.camera.x = lerp(this.camera.x, x, t);
        this.camera.y = lerp(this.camera.y, y, t);
        const perspectiveView=classic&&!overview;
        if(perspectiveView)eyeOffset=vmul(norm(eyeOffset),h/(2*Math.tan(Math.PI/15)));
        const center = [this.camera.x, this.camera.y, 0], eye = vadd(center, eyeOffset);
        this.eye = eye;
        const projection=perspectiveView ? perspective(Math.PI/7.5,aspect,.3,900,this.kind==='webgpu') : ortho(-h*aspect/2,h*aspect/2,-h/2,h/2,.1,700,this.kind==='webgpu');
        const matrix=multiply(projection,lookAt(eye,center));
        this.matrix = matrix;
        return matrix;
    }
    project(x, y, z = 0) { return this.matrix ? projected(this.matrix, [x, y, z], this.width, this.height) : [0, 0, 0]; }
    render(state, player = {}, dt = 1 / 60, overview = false, ghost = null) {
        if (!this.profile || !['webgpu', 'webgl2', 'software'].includes(this.kind))
            return;
        const started=performance.now();
        this.resize();
        const matrix = this.cameraMatrix(state, dt, overview), skier = skierMesh(state, player), ghostData = ghost ? skierMesh(ghost, player, true) : null;
        const shadow = overview ? null : this.options.presentation==='classic' ? createProjectedShadow(skier,this.profile,state) : shadowMesh(state, this.profile);
        const dynamicLength = (shadow?.length || 0) + (ghostData?.length || 0) + skier.length;
        if (dynamicLength > this.dynamicCapacity) throw new RangeError('Dynamic mesh capacity exceeded');
        // Reuse the same upload storage on every backend; only the populated range is submitted.
        const dyn = this.dynamicData.subarray(0, dynamicLength);
        let off = 0;
        for (const data of [shadow, ghostData, skier])
            if (data) {
                dyn.set(data, off);
                off += data.length;
            }
        const weather = Math.max(0,['clear', 'snow', 'dusk', 'night'].indexOf(this.options.weather));
        const time=Number.isFinite(state.time)?state.time:0, wind=Number.isFinite(state.wind)?state.wind:0;
        const skyOffset=this.profile.hill.index*.37+this.camera.x*.001;
        if (this.kind === 'webgpu') {
            const u = this.uniformData;
            u.set(matrix);
            u.set([.86, .88, .96, skyOffset], 16);
            u.set([weather, time, this.width, this.height], 20);
            u.set([...this.eye, dt], 24);
            this.device.queue.writeBuffer(this.uniform, 0, u);
            if (dyn.length > this.dynamicCapacity)
                throw new Error('Dynamic mesh capacity exceeded');
            this.device.queue.writeBuffer(this.dynamicBuffer, 0, dyn);
            const encoder = this.device.createCommandEncoder();
            if (weather === 1) {
                this.weatherData.set([wind, time, this.width, this.height]);
                this.device.queue.writeBuffer(this.weatherUniform, 0, this.weatherData);
                const c = encoder.beginComputePass();
                c.setPipeline(this.snowCompute);
                c.setBindGroup(0, this.computeBind);
                c.dispatchWorkgroups(6);
                c.end();
            }
            const pass = encoder.beginRenderPass({ colorAttachments: [{ view: (this.lastTexture=this.gpuContext.getCurrentTexture()).createView(), clearValue: { r: .65, g: .65, b: .85, a: 1 }, loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: { view: this.depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' } });
            pass.setPipeline(this.skyPipeline);
            pass.setBindGroup(0, this.skyBind);
            pass.draw(3);
            pass.setPipeline(this.pipeline);
            pass.setBindGroup(0, this.bind);
            pass.setVertexBuffer(0, this.staticBuffer);
            pass.draw(this.vertexCount);
            pass.setVertexBuffer(0, this.dynamicBuffer);
            pass.draw(dyn.length / 6);
            if (weather === 1) {
                pass.setPipeline(this.snowPipeline);
                pass.setBindGroup(0, this.snowBind);
                pass.draw(6, 384);
            }
            pass.end();
            this.device.queue.submit([encoder.finish()]);
        }
        else if (this.kind === 'webgl2') {
            const gl = this.gl;
            gl.clearColor(.65, .65, .85, 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.disable(gl.DEPTH_TEST);
            gl.useProgram(this.glSky);
            gl.uniform1f(this.glSkyWeather, weather);
            gl.uniform2f(this.glSkyViewport,this.width,this.height);
            gl.uniform1f(this.glSkyOffset,skyOffset);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.LEQUAL);
            gl.useProgram(this.glProgram);
            gl.uniformMatrix4fv(this.glMatrix, false, matrix);
            gl.uniform3fv(this.glEye, this.eye);
            gl.uniform1f(this.glWeather, weather);
            gl.uniform2f(this.glViewport,this.width,this.height);
            const draw = (buf, count) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); gl.drawArrays(gl.TRIANGLES, 0, count); };
            draw(this.glStatic, this.vertexCount);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.glDynamic);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, dyn);
            draw(this.glDynamic, dyn.length / 6);
            if(weather===1){
                gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);
                gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
                gl.useProgram(this.glSnow);gl.uniform4f(this.glConditions,wind,time,this.width,this.height);
                gl.drawArraysInstanced(gl.TRIANGLES,0,6,384);gl.disable(gl.BLEND);
            }
        }
        else
            this.softwareRaster.render(this.ctx,matrix,[this.staticData,dyn],this.eye,weather,time,wind,skyOffset);
        this.frameMilliseconds=performance.now()-started;
        this.frames++;
        this.fps = lerp(this.fps, 1 / Math.max(.001, dt), .04);
    }
    /** Read the just-rendered frame as top-left RGBA8. Call immediately after render.
     * GPU row pitch and BGRA conversion are handled here; the caller owns the copy.
     */
    async captureFrame() {
        if(this.disposed)throw new Error('Renderer is disposed');
        const width=this.width,height=this.height,pixels=new Uint8Array(width*height*4);
        if(this.kind==='software'){
            pixels.set(this.softwareRaster.image.data);return {width,height,pixels};
        }
        if(this.kind==='webgl2'){
            const data=new Uint8Array(pixels.length);
            this.gl.readPixels(0,0,width,height,this.gl.RGBA,this.gl.UNSIGNED_BYTE,data);
            pixels.set(data); // GL storage was rendered in top-left logical orientation.
            return {width,height,pixels};
        }
        if(this.kind!=='webgpu'||!this.lastTexture)throw new Error('No rendered frame available');
        const device=this.device,pitch=Math.ceil(width*4/256)*256;
        const buffer=device.createBuffer({label:'Frame readback',size:pitch*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
        try {
            const encoder=device.createCommandEncoder();
            encoder.copyTextureToBuffer({texture:this.lastTexture},{buffer,bytesPerRow:pitch,rowsPerImage:height},{width,height,depthOrArrayLayers:1});
            device.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);
            const data=new Uint8Array(buffer.getMappedRange());
            for(let y=0;y<height;y++)pixels.set(data.subarray(y*pitch,y*pitch+width*4),y*width*4);
            if(this.format.startsWith('bgra'))for(let i=0;i<pixels.length;i+=4){const red=pixels[i];pixels[i]=pixels[i+2];pixels[i+2]=red;}
            buffer.unmap();return {width,height,pixels};
        } finally {buffer.destroy();}
    }
    diagnostics() { return { backend: this.kind, renderProfile: this.options.presentation, hillId:this.profile?.hill.id || null, visualParity:this.profile?getHillVisual(this.profile.hill.id).evidence.pixelParity:'unverified', frameMilliseconds:this.frameMilliseconds, sections:this.scene?.sections || [], resolution: [this.width, this.height], triangles: Math.round((this.vertexCount || 0) / 3), fps: Math.round(this.fps), staticBytes: this.staticData?.byteLength || 0, deviceLosses: this.losses, fallbackReason: this.fallbackReason || null, lastError: this.lastError || null }; }
    dispose() { this.disposed = true; this.depth?.destroy(); this.staticBuffer?.destroy(); this.dynamicBuffer?.destroy(); this.uniform?.destroy(); this.snowBuffer?.destroy(); this.weatherUniform?.destroy(); this.gpuContext?.unconfigure(); this.device?.destroy(); if (this.gl) {
        for (const p of [this.glProgram, this.glSky, this.glSnow])
            this.gl.deleteProgram(p);
        for (const b of [this.glStatic, this.glDynamic])
            this.gl.deleteBuffer(b);
    } this.canvas.remove(); }
}

return {createHillMesh,SkiRenderer,MeshBuilder,createClassicHillScene};
});
define("@wieslawsoltes/ski-renderer/mesh.js",function(require){
const { clamp }=require("@wieslawsoltes/ski-core");
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
function multiply(a, b) { const r = new Float32Array(16); for (let c = 0; c < 4; c++)
    for (let row = 0; row < 4; row++)
        for (let k = 0; k < 4; k++)
            r[c * 4 + row] += a[k * 4 + row] * b[c * 4 + k]; return r; }
function lookAt(eye, center) { const z = norm(vsub(eye, center)), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]); }
function ortho(l, r, b, t, n, f, gpu) { return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, (gpu ? 1 : 2) / (n - f), 0, (l + r) / (l - r), (t + b) / (b - t), gpu ? n / (n - f) : (f + n) / (n - f), 1]); }
function perspective(fov, aspect, near, far, gpu) {
    const y=1/Math.tan(fov/2), z=(gpu?far:far+near)/(near-far), t=(gpu?1:2)*far*near/(near-far);
    return new Float32Array([y/aspect,0,0,0,0,y,0,0,0,0,z,-1,0,0,t,0]);
}
function projected(m, p, w, h) { const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]; const divisor=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15]; return [(x/divisor*.5+.5)*w,(-y/divisor*.5+.5)*h,z/divisor]; }
const shade = (c, f) => c.map(x => clamp(x * f, 0, 1));
class MeshBuilder {
    constructor() { this.data = []; }
    tri(a, b, c, color, lighting = true) { let f = 1; if (lighting) {
        const n = norm(cross(vsub(b, a), vsub(c, a)));
        f = .69 + .31 * Math.abs(dot(n, norm([-.35, .9, .3])));
    } const col = shade(color, f); for (const p of [a, b, c])
        this.data.push(...p, ...col); return this; }
    quad(a, b, c, d, color, lighting = true) { this.tri(a, b, c, color, lighting); this.tri(a, c, d, color, lighting); return this; }
    box(x, y, z, w, h, d, color) { const p = [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], [x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d]]; for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]])
        this.quad(...f.map(i => p[i]), color); return this; }
    beam(a, b, r, color, sides = 5) { const n = norm(vsub(b, a)), u = norm(cross(n, Math.abs(n[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = cross(n, u); for (let i = 0; i < sides; i++) {
        const aa = i / sides * Math.PI * 2, bb = (i + 1) / sides * Math.PI * 2;
        const off = t => vadd(vmul(u, Math.cos(t) * r), vmul(v, Math.sin(t) * r));
        const x = off(aa), y = off(bb);
        this.quad(vadd(a, x), vadd(a, y), vadd(b, y), vadd(b, x), color);
        this.tri(b, vadd(b, x), vadd(b, y), color);
    } return this; }
    cone(x, y, z, r, h, color, sides = 6) { for (let i = 0; i < sides; i++) {
        const a = i / sides * 6.2831853, b = (i + 1) / sides * 6.2831853;
        this.tri([x + Math.cos(a) * r, y, z + Math.sin(a) * r], [x, y + h, z], [x + Math.cos(b) * r, y, z + Math.sin(b) * r], color);
    } return this; }
    sphere(x, y, z, r, color) { const a = [x - r, y, z], b = [x + r, y, z], c = [x, y - r, z], d = [x, y + r, z], e = [x, y, z - r], f = [x, y, z + r]; for (const v of [[a, d, e], [e, d, b], [b, d, f], [f, d, a], [a, e, c], [e, b, c], [b, f, c], [f, a, c]])
        this.tri(...v, color); return this; }
    finish() { return new Float32Array(this.data); }
}

return {vsub,vadd,vmul,dot,cross,norm,multiply,lookAt,ortho,perspective,projected,shade,MeshBuilder};
});
define("@wieslawsoltes/ski-renderer/scene.js",function(require){
/** DSJ2 screenshot-informed scene construction. No original meshes or textures.
 * The sampled HillProfile remains the single source of surface/contact geometry.
 * Scene parameters are reconstructions unless a field's provenance says otherwise.
 */
const { clamp, lerp, Random }=require("@wieslawsoltes/ski-core");
const { HillProfile, getHillVisual }=require("@wieslawsoltes/ski-hills");
const { MeshBuilder, shade }=require("@wieslawsoltes/ski-renderer/mesh.js");

function surface(m, a, b, wa, wb, color, height = 0) {
    m.quad([a.x,a.y+height,-wa],[b.x,b.y+height,-wb],[b.x,b.y+height,wb],[a.x,a.y+height,wa],color,false);
}
function wall(m, a, b, za, zb, width, height, color) {
    // Broad flat side panels, a light cap and dark reverse, as seen in the reference.
    m.quad([a.x,a.y,za],[b.x,b.y,zb],[b.x,b.y+height,zb],[a.x,a.y+height,za],shade(color,.68),false);
    m.quad([a.x,a.y+height,za],[b.x,b.y+height,zb],[b.x,b.y+height,zb+width],[a.x,a.y+height,za+width],shade(color,1.13),false);
    m.quad([a.x,a.y,za+width],[a.x,a.y+height,za+width],[b.x,b.y+height,zb+width],[b.x,b.y,zb+width],shade(color,.9),false);
}
function rampFascia(m,a,b,z,side,spec){
    const depth=spec.inrunDepth, bands=spec.inrunBands;
    for(let i=0;i<bands.length;i++){
        const top=-depth*i/bands.length,bottom=-depth*(i+1)/bands.length,zz=z+side*i*.055;
        m.quad([a.x,a.y+bottom,zz],[b.x,b.y+bottom,zz],[b.x,b.y+top,zz],[a.x,a.y+top,zz],bands[i],false);
        // Join each stepped fascia to the next band. Open strips show through
        // from oblique cameras even when a side-on image looks solid.
        if(i+1<bands.length){
            const next=zz+side*.055;
            m.quad([a.x,a.y+bottom,zz],[a.x,a.y+bottom,next],[b.x,b.y+bottom,next],[b.x,b.y+bottom,zz],shade(bands[i],.82),false);
        }
    }
    wall(m,a,b,z,z,side*.22,.38,shade(spec.railColor,.48));
}
function support(m,x,y,z,height,radius){
    for(let i=0;i<12;i++){
        const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
        const ax=x+Math.cos(a)*radius,az=z+Math.sin(a)*radius*.8,bx=x+Math.cos(b)*radius,bz=z+Math.sin(b)*radius*.8;
        m.quad([ax,y,az],[bx,y,bz],[bx,y+height,bz],[ax,y+height,az],shade([.35,.37,.39],.58+.42*Math.abs(Math.cos((a+b)*.5))),false);
    }
}
function pine(m,x,y,z,height,seed) {
    const rng=new Random(seed), trunk=[.26,.20,.12];
    m.box(x-.08,y,z-.08,.16,height*.89,.16,trunk);
    // Sparse individual branch fans, rather than the previous three snow cones.
    // All branch endpoints are generated at the same seed at every resolution.
    for(let layer=0;layer<11;layer++) {
        const t=layer/11, yy=y+height*(.20+.72*t), span=height*(1-t)*.29;
        const rot=rng.range(0,Math.PI*2);
        for(let branch=0;branch<5;branch++) {
            const angle=rot+branch*Math.PI*.4, len=span*rng.range(.60,1), dx=Math.cos(angle), dz=Math.sin(angle);
            const a=[x+dx*len,yy-height*.045,z+dz*len], b=[x,yy+height*.07,z], w=len*.19;
            const c=[x+dx*len*.46-dz*w,yy-height*.025,z+dz*len*.46+dx*w];
            const d=[x+dx*len*.46+dz*w,yy-height*.025,z+dz*len*.46-dx*w];
            const green=[.035,.19+.04*rng.next(),.105];
            if(branch%2===0){
                // Partition the facet instead of overlaying an intersecting snow
                // triangle. Opaque coverage is shared without coplanar depth races.
                const ab=b.map((v,i)=>v+(a[i]-v)*.36),cb=b.map((v,i)=>v+(c[i]-v)*.36);
                m.quad(a,ab,cb,c,green,false);
                m.tri(b,cb,ab,[.75,.77,.77],false);
            }else m.tri(a,b,c,green,false);
            m.tri(a,d,b,[.025,.15,.08],false);
        }
    }
}

/** Full-detail independent scene, identical topology on WebGPU/WebGL/software. */
function createClassicHillScene(profile, record=0) {
    const p=profile instanceof HillProfile?profile:new HillProfile(profile);
    const spec=getHillVisual(p.hill.id), m=new MeshBuilder(), sections=[];
    const section=(name,fn)=>{const first=m.data.length/6;fn();sections.push({name,first,count:m.data.length/6-first});};
    const halfWidth=s=>spec.landingWidth/2+Math.max(0,s)*spec.landingFlare;
    const x0=p.startX-80,x1=p.end.x+100;
    // Narrow cells along the actual profile prevent the terrain penetrating a finer
    // landing mesh. Corridor and surrounding snow share exactly the same samples.
    const rings=[{x:x0,y:p.atX(x0).y,s:0},...Array.from({length:Math.ceil((p.startX-x0)/4)+1},(_,i)=>{
        const x=Math.min(0,x0+i*4);return {x,y:p.atX(x).y,s:0};
    }),...Array.from({length:Math.ceil(-p.startX/2)},(_,i)=>{
        const x=p.startX+i*2;return {x,y:p.atX(x).y,s:0};
    }),...p.points.filter((_,i)=>i%4===0),p.end,{x:x1,y:p.end.y,s:p.end.s+x1-p.end.x}]
    .sort((a,b)=>a.x-b.x).filter((q,i,a)=>i===0||q.x>a[i-1].x+.001);
    section('snow',()=>{
        for(let i=0;i<rings.length-1;i++) {
            const a=rings[i],b=rings[i+1],wa=halfWidth(a.s),wb=halfWidth(b.s);
            // Suppress the random per-quad checkerboard of the previous renderer.
            const brightness=.64+.14*clamp((a.angle||.4)/.7,0,1);
            const c=[brightness,brightness,brightness+.022];
            surface(m,a,b,wa,wb,c,.015);
            for(const side of [-1,1]) {
                const zbands=[0,6,20,48,100,220,420];
                for(let j=0;j<zbands.length-1;j++) {
                    const z0=zbands[j],z1=zbands[j+1];
                    const point=(q,w,z)=>[q.x,q.y+(side<0?Math.min(12,z*.08):-Math.min(28,z*.12))+Math.sin(q.x*.011+z*.018)*Math.min(2,z*.025),side*(w+z)];
                    const color=shade([.73,.74,.77],1+Math.min(.14,z0*.001));
                    m.quad(point(a,wa,z0),point(b,wb,z0),point(b,wb,z1),point(a,wa,z1),color,false);
                }
            }
        }
    });
    section('landing-walls',()=>{
        const end=p.end.s;
        for(let s=0;s<end;s+=2) {
            const a=p.atDistance(s),b=p.atDistance(Math.min(end,s+2));
            for(const side of [-1,1]) wall(m,a,b,side*halfWidth(s),side*halfWidth(b.s),side*.27,.72,spec.landingRailColor);
        }
        for(let s=4;s<end;s+=10) {
            const q=p.atDistance(s);
            for(const side of [-1,1]) m.box(q.x-.13,q.y-.04,side*halfWidth(s)-.16,.26,.85,.32,shade(spec.railColor,.38));
        }
    });
    section('distance-lines',()=>{
        // Narrow green reference lines; K line remains red. No invented blue HS line.
        const distances=[];
        for(let s=Math.ceil(p.k*.65/10)*10;s<=p.k*1.25;s+=10) distances.push(s);
        if(!distances.includes(p.k))distances.push(p.k);
        for(const s of distances) {
            const a=p.atDistance(s-.045),b=p.atDistance(s+.045);
            surface(m,a,b,halfWidth(a.s),halfWidth(b.s),s===p.k?[.72,.10,.12]:[.10,.32,.13],.032);
        }
        if(Number.isFinite(record)&&record>0&&record<=p.end.s) surface(m,p.atDistance(record-.035),p.atDistance(record+.035),halfWidth(record),halfWidth(record),[.8,.55,.12],.04);
    });
    section('inrun',()=>{
        const points=[];
        for(let x=p.startX;x<0;x+=.8)points.push({x,y:p.inrunY(x)});
        points.push({x:0,y:p.inrunY(0)});
        const width=spec.inrunWidth/2;
        const shell=(a,b)=>{
            const shoulder=width+.22,outer=shoulder+(spec.inrunBands.length-1)*.055;
            for(const side of [-1,1]){
                m.quad([a.x,a.y,side*width],[b.x,b.y,side*width],[b.x,b.y,side*shoulder],[a.x,a.y,side*shoulder],shade(spec.railColor,.48),false);
            }
            surface(m,a,b,outer,outer,spec.inrunBands.at(-1),-spec.inrunDepth);
        };
        const cap=q=>{
            // Cross-section has the same five widths as the fascia. A box cap
            // would intersect its faces and reintroduce coplanar depth races.
            for(let i=0;i<spec.inrunBands.length;i++){
                const w=width+.22+i*.055,top=q.y-spec.inrunDepth*i/spec.inrunBands.length,bottom=q.y-spec.inrunDepth*(i+1)/spec.inrunBands.length;
                m.quad([q.x,top,-w],[q.x,top,w],[q.x,bottom,w],[q.x,bottom,-w],shade(spec.inrunBands[i],.8),false);
            }
        };
        for(let i=0;i<points.length-1;i++) {
            const a=points[i],b=points[i+1];
            surface(m,a,b,width,width,[.73,.76,.79]);
            shell(a,b);
            for(const z of [-.26,.26]) m.quad([a.x,a.y+.008,z-.045],[b.x,b.y+.008,z-.045],[b.x,b.y+.008,z+.045],[a.x,a.y+.008,z+.045],[.34,.38,.39],false);
            for(const side of [-1,1])rampFascia(m,a,b,side*(width+.22),side,spec);
        }
        const length=spec.platformLength,depth=spec.inrunDepth;
        const a={x:p.startX-length,y:p.startY},b={x:p.startX,y:p.startY};
        surface(m,a,b,width,width,[.73,.76,.79]);
        shell(a,b);cap(a);cap(points.at(-1));
        for(const side of [-1,1])rampFascia(m,a,b,side*(width+.22),side,spec);
        for(let x=p.startX-5;x<-.5;x+=Math.max(12,p.inrunLength*.32)){
            const top=x<p.startX?p.startY:p.inrunY(x),bottom=p.atX(x).y;
            support(m,x,bottom,0,Math.max(.1,top-bottom-depth),spec.supportRadius);
        }
        // The underside and both terminal cross-sections are closed above.
    });
    const trees=[];
    section('trees',()=>{
        const rng=new Random(spec.treeSeed);
        for(let i=0;i<spec.treeCount;i++) {
            const x=rng.range(x0,x1), q=p.atX(x), side=rng.next()<.94?-1:1;
            const offset=rng.range(4,140), z=side*(halfWidth(q.s)+offset);
            // Match the snow mesh's linear interpolation instead of floating trees.
            let lo=0,hi=rings.length-1;
            while(hi-lo>1){const mid=(lo+hi)>>1;if(rings[mid].x<x)lo=mid;else hi=mid;}
            const a=rings[lo],b=rings[hi],f=(x-a.x)/(b.x-a.x);
            const zs=[0,6,20,48,100,220,420];let zi=0;while(zs[zi+1]<offset)zi++;
            const lift=z=>(side<0?Math.min(12,z*.08):-Math.min(28,z*.12))+Math.sin(x*.011+z*.018)*Math.min(2,z*.025);
            const y=lerp(a.y,b.y,f)+lerp(lift(zs[zi]),lift(zs[zi+1]),(offset-zs[zi])/(zs[zi+1]-zs[zi]));
            const height=rng.range(2.5,14),seed=(spec.treeSeed+i*7919)>>>0;
            trees.push({x,y,z,height,seed}); pine(m,x,y,z,height,seed);
        }
    });
    return {vertices:m.finish(),sections,trees,visual:spec,surface:'HillProfile',version:1};
}

/** Project the real articulated mesh on the landing surface, not an oval blob.
 * Bisection solves the light-ray/sampled-surface contact for every mesh vertex.
 */
function createProjectedShadow(vertices, profile, state) {
    if(['gate','inrun'].includes(state.phase)) return new Float32Array(0);
    const data=new Float32Array(vertices.length),light=[.48,-1,.30];
    for(let i=0;i<vertices.length;i+=6) {
        const x=vertices[i],y=vertices[i+1],z=vertices[i+2];let lo=0,hi=Math.max(1,(y-profile.atX(x).y)*2+8);
        const gap=t=>y+light[1]*t-profile.atX(x+light[0]*t).y;
        for(let n=0;n<5&&gap(hi)>0;n++)hi*=2;
        for(let n=0;n<18;n++){const t=(lo+hi)*.5;if(gap(t)>0)lo=t;else hi=t;}
        const xx=x+light[0]*hi;
        data.set([xx,profile.atX(xx).y+.023,z+light[2]*hi,.38,.39,.42],i);
    }
    return data;
}

return {createClassicHillScene,createProjectedShadow};
});
define("@wieslawsoltes/ski-renderer/shading.js",function(require){
/** One shading source emitted to WGSL and GLSL. Pixel coordinates are top-left.
 * The software rasterizer below uses the identical documented scalar equations.
 * Quantization is a reconstructed six-bit DAC look, not the original 256-color table.
 */
const COMMON = `
vec4 snapClip(vec4 p,vec2 size){
 if(abs(p.w)<0.000001){return p;}
 vec2 pixel=vec2((p.x/p.w*0.5+0.5)*size.x,(0.5-p.y/p.w*0.5)*size.y);
 pixel=floor(pixel*16.0+vec2(0.5))/16.0;
 return vec4((pixel.x/size.x*2.0-1.0)*p.w,(1.0-pixel.y/size.y*2.0)*p.w,p.z,p.w);
}
float wrap(float x,float period){return x-floor(x/period)*period;}
float ordered(float x,float y){
 float a=wrap(floor(x),2.0);float b=wrap(floor(y),2.0);
 float c=wrap(floor(x/2.0),2.0);float d=wrap(floor(y/2.0),2.0);
 return (8.0*abs(a-b)+4.0*b+2.0*abs(c-d)+d+0.5)/16.0-0.5;
}
vec3 palette(vec3 color,float x,float y){
 return floor(clamp(color+vec3(ordered(x,y)/63.0),vec3(0.0),vec3(1.0))*63.0+vec3(0.5))/63.0;
}
vec3 shadeScene(vec3 color,vec3 world,vec3 eye,float weather,float x,float y){
 float fog=smoothstep(180.0,500.0,distance(world,eye))*0.32;
 vec3 c=mix(color,vec3(0.80,0.81,0.86),fog);
 if(weather>2.5){c=c*vec3(0.35,0.43,0.65);}
 else if(weather>1.5){c=c*vec3(1.0,0.84,0.80);}
 return palette(c,x,y);
}
vec3 shadeSky(float x,float y,float width,float height,float weather,float offset){
 float u=(x+0.5)/width;float v=(y+0.5)/height;
 vec3 top=vec3(0.35,0.34,0.76);vec3 bottom=vec3(0.88,0.86,0.92);
 if(weather>2.5){top=vec3(0.035,0.045,0.13);bottom=vec3(0.22,0.27,0.41);}
 else if(weather>1.5){top=vec3(0.30,0.29,0.51);bottom=vec3(0.89,0.68,0.57);}
 vec3 c=mix(top,bottom,smoothstep(0.0,0.18,v));
 float ridge=0.115+0.025*sin(u*9.0+offset)+0.01*sin(u*29.0+offset*0.3);
 if(v>ridge){c=bottom*0.98;}
 if(v>ridge+0.055){c=bottom*0.955;}
 if(v>ridge+0.12){c=bottom*0.93;}
 if(weather>2.5 && v<ridge && wrap(floor(x)*13.0+floor(y)*127.0,997.0)>995.0){c=vec3(0.82,0.85,0.93);}
 return palette(c,x,y);
}
vec4 snowAt(float index,float time,float wind){
 float bx=wrap(index*73.0+17.0,389.0)/389.0*2.06;
 float by=wrap(index*151.0+31.0,397.0)/397.0*2.06;
 float speed=0.12+wrap(index*19.0+7.0,101.0)/101.0*0.25;
 float size=0.65+wrap(index*37.0+3.0,103.0)/103.0*0.95;
 return vec4(wrap(bx+time*(wind*0.024+0.025),2.06)-1.03,wrap(by-time*speed,2.06)-1.03,speed,size);
}
`;
function wgsl(source) {
    const type=t=>t==='float'?'f32':t+'<f32>';
    return source.replace(/\b(float|vec[234])\s+(\w+)\(([^)]*)\)\s*\{/g,(_,t,name,args)=>
        `fn ${name}(${args.split(',').filter(Boolean).map(a=>{const [t,n]=a.trim().split(/\s+/);return n+':'+type(t);}).join(',')})->${type(t)}{`)
        .replace(/\b(float|vec[234])\s+(\w+)\s*=/g,(_,t,n)=>`var ${n}:${type(t)}=`)
        .replace(/\b(vec[234])\(/g,'$1<f32>(');
}
const UNIFORM=`struct Scene { matrix:mat4x4<f32>, fog:vec4<f32>, params:vec4<f32>, camera:vec4<f32> };
@group(0) @binding(0) var<uniform> scene:Scene;`;
const SCENE_WGSL=UNIFORM+wgsl(COMMON)+`
struct Out { @builtin(position) pos:vec4<f32>, @location(0) color:vec3<f32>, @location(1) world:vec3<f32> };
@vertex fn vs(@location(0) p:vec3<f32>,@location(1) c:vec3<f32>)->Out{
 var o:Out;o.pos=snapClip(scene.matrix*vec4<f32>(p,1.0),scene.params.zw);o.color=c;o.world=p;return o;
}
@fragment fn fs(o:Out)->@location(0) vec4<f32>{return vec4<f32>(shadeScene(o.color,o.world,scene.camera.xyz,scene.params.x,floor(o.pos.x),floor(o.pos.y)),1.0);}`;
const SKY_WGSL=UNIFORM+wgsl(COMMON)+`
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{
 let p=array<vec2<f32>,3>(vec2<f32>(-1,-1),vec2<f32>(3,-1),vec2<f32>(-1,3));return vec4<f32>(p[i],0.999,1.0);
}
@fragment fn fs(@builtin(position) p:vec4<f32>)->@location(0) vec4<f32>{return vec4<f32>(shadeSky(floor(p.x),floor(p.y),scene.params.z,scene.params.w,scene.params.x,scene.fog.w),1.0);}`;
const SCENE_VERTEX_GLSL=`#version 300 es\nprecision highp float;\n${COMMON}
layout(location=0)in vec3 p;layout(location=1)in vec3 c;uniform mat4 matrix;uniform vec2 viewport;out vec3 color;out vec3 world;
void main(){gl_Position=snapClip(matrix*vec4(p,1.0),viewport);gl_Position.y=-gl_Position.y;color=c;world=p;}`;
const SNAP_WGSL=wgsl(COMMON);
const SCENE_GLSL=`#version 300 es\nprecision highp float;\n${COMMON}
in vec3 color;in vec3 world;uniform vec3 eye;uniform float weather;uniform vec2 viewport;out vec4 outColor;
void main(){outColor=vec4(shadeScene(color,world,eye,weather,floor(gl_FragCoord.x),floor(gl_FragCoord.y)),1.0);}`;
const SKY_GLSL=`#version 300 es\nprecision highp float;\n${COMMON}
uniform float weather;uniform vec2 viewport;uniform float skyOffset;out vec4 outColor;
void main(){outColor=vec4(shadeSky(floor(gl_FragCoord.x),floor(gl_FragCoord.y),viewport.x,viewport.y,weather,skyOffset),1.0);}`;
const SNOW_WGSL=wgsl(COMMON)+`
struct Weather {wind:f32,time:f32,width:f32,height:f32};
@group(0) @binding(0) var<storage,read_write> particles:array<vec4<f32>>;
@group(0) @binding(1) var<uniform> weather:Weather;
@compute @workgroup_size(64) fn update(@builtin(global_invocation_id) id:vec3<u32>){if(id.x<384u){particles[id.x]=snowAt(f32(id.x),weather.time,weather.wind);}}`;
const SNOW_GLSL=`#version 300 es\nprecision highp float;\n${COMMON}
uniform vec4 conditions;
void main(){
 vec4 p=snowAt(float(gl_InstanceID),conditions.y,conditions.x);
 int i=gl_VertexID;vec2 q=vec2((i==1||i==2||i==4)?1.0:-1.0,(i==2||i==4||i==5)?1.0:-1.0);
 gl_Position=snapClip(vec4(p.xy+q/conditions.zw*p.w,0.0,1.0),conditions.zw);gl_Position.y=-gl_Position.y;
}`;
const wrap=(x,p)=>x-Math.floor(x/p)*p;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function orderedDither(x,y) {
    const a=wrap(Math.floor(x),2),b=wrap(Math.floor(y),2),c=wrap(Math.floor(x/2),2),d=wrap(Math.floor(y/2),2);
    return (8*Math.abs(a-b)+4*b+2*Math.abs(c-d)+d+.5)/16-.5;
}
function paletteChannel(c,n) {return Math.round(Math.floor(Math.max(0,Math.min(1,c+n/63))*63+.5)/63*255);}
function sceneRGB(r,g,b,x,y,z,eye,weather,px,py,out,offset) {
    const f=smooth(180,500,Math.hypot(x-eye[0],y-eye[1],z-eye[2]))*.32,n=orderedDither(px,py);
    r=r+(0.80-r)*f;g=g+(0.81-g)*f;b=b+(0.86-b)*f;
    if(weather===3){r*=.35;g*=.43;b*=.65;}else if(weather===2){g*=.84;b*=.8;}
    out[offset]=paletteChannel(r,n);out[offset+1]=paletteChannel(g,n);out[offset+2]=paletteChannel(b,n);out[offset+3]=255;
}
function skyRGB(x,y,w,h,weather,offset,out,pos) {
    const u=(x+.5)/w,v=(y+.5)/h,n=orderedDither(x,y),t=smooth(0,.18,v);
    const top=weather===3?[.035,.045,.13]:weather===2?[.30,.29,.51]:[.35,.34,.76];
    const bottom=weather===3?[.22,.27,.41]:weather===2?[.89,.68,.57]:[.88,.86,.92];
    const ridge=.115+.025*Math.sin(u*9+offset)+.01*Math.sin(u*29+offset*.3);
    const factor=v>ridge+.12?.93:v>ridge+.055?.955:v>ridge?.98:0;
    const star=weather===3&&v<ridge&&wrap(Math.floor(x)*13+Math.floor(y)*127,997)>995;
    for(let j=0;j<3;j++)out[pos+j]=paletteChannel(star?[.82,.85,.93][j]:factor?bottom[j]*factor:top[j]+(bottom[j]-top[j])*t,n);
    out[pos+3]=255;
}
function snowParticle(index,time,wind) {
    const bx=wrap(index*73+17,389)/389*2.06,by=wrap(index*151+31,397)/397*2.06;
    return [wrap(bx+time*(wind*.024+.025),2.06)-1.03,wrap(by-time*(.12+wrap(index*19+7,101)/101*.25),2.06)-1.03,.12+wrap(index*19+7,101)/101*.25,.65+wrap(index*37+3,103)/103*.95];
}

return {SCENE_WGSL,SKY_WGSL,SCENE_VERTEX_GLSL,SNAP_WGSL,SCENE_GLSL,SKY_GLSL,SNOW_WGSL,SNOW_GLSL,orderedDither,paletteChannel,sceneRGB,skyRGB,snowParticle};
});
define("@wieslawsoltes/ski-renderer/raster.js",function(require){
const { sceneRGB, skyRGB, snowParticle }=require("@wieslawsoltes/ski-renderer/shading.js");
const topLeft=(x0,y0,x1,y1)=>y1<y0||(y1===y0&&x1>x0);
const clipDistance=(v,i,plane)=>v[i+3]+(plane%2===0?1:-1)*v[i+(plane>>1)];

/** Shared-topology correctness fallback: homogeneous frustum clipping, perspective
 * interpolation, top-left fill, per-fragment depth/fog and deterministic weather.
 * Buffers and clipping scratch are reused. No painter sort or reduced-detail mesh.
 */
class SoftwareRasterizer {
    constructor(){
        this.width=0;this.height=0;this.depth=null;this.image=null;this.vertices=new Float64Array(0);
        this.clipA=new Float64Array(120);this.clipB=new Float64Array(120);
    }
    resize(width,height){
        if(width===this.width&&height===this.height)return;
        if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4000000)throw new RangeError('Invalid raster surface');
        this.width=width;this.height=height;this.depth=new Float32Array(width*height);this.image=new ImageData(width,height);
    }
    triangle(v,ai,bi,ci,eye,weather){
        const w=this.width,h=this.height,pixels=this.image.data,depth=this.depth;
        const aw=1/v[ai+3];let bw=1/v[bi+3],cw=1/v[ci+3];
        const screenX=(i,inv)=>Math.round((v[i]*inv*.5+.5)*w*256)/256;
        const screenY=(i,inv)=>Math.round((.5-v[i+1]*inv*.5)*h*256)/256;
        const ax=screenX(ai,aw),ay=screenY(ai,aw),az=v[ai+2]*aw*.5+.5;
        let bx=screenX(bi,bw),by=screenY(bi,bw),bz=v[bi+2]*bw*.5+.5,cx=screenX(ci,cw),cy=screenY(ci,cw),cz=v[ci+2]*cw*.5+.5;
        let area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
        if(!Number.isFinite(area)||Math.abs(area)<1e-9)return;
        if(area<0){[bx,cx]=[cx,bx];[by,cy]=[cy,by];[bz,cz]=[cz,bz];[bw,cw]=[cw,bw];[bi,ci]=[ci,bi];area=-area;}
        const xmin=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),xmax=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)-.5));
        const ymin=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),ymax=Math.min(h-1,Math.floor(Math.max(ay,by,cy)-.5));
        if(xmin>xmax||ymin>ymax)return;
        const ta=topLeft(bx,by,cx,cy),tb=topLeft(cx,cy,ax,ay),tc=topLeft(ax,ay,bx,by),inv=1/area;
        for(let y=ymin;y<=ymax;y++){
            const py=y+.5;
            let ea=(cx-bx)*(py-by)-(cy-by)*(xmin+.5-bx),eb=(ax-cx)*(py-cy)-(ay-cy)*(xmin+.5-cx),ec=(bx-ax)*(py-ay)-(by-ay)*(xmin+.5-ax);
            for(let x=xmin;x<=xmax;x++,ea-=cy-by,eb-=ay-cy,ec-=by-ay){
                if(ea<0||eb<0||ec<0||(ea===0&&!ta)||(eb===0&&!tb)||(ec===0&&!tc))continue;
                let a=ea*inv,b=eb*inv,c=ec*inv;const z=Math.fround(a*az+b*bz+c*cz),index=y*w+x;
                if(z<0||z>1||z>depth[index])continue;depth[index]=z;
                const denominator=a*aw+b*bw+c*cw;a=a*aw/denominator;b=b*bw/denominator;c=c*cw/denominator;
                const wx=a*v[ai+4]+b*v[bi+4]+c*v[ci+4],wy=a*v[ai+5]+b*v[bi+5]+c*v[ci+5],wz=a*v[ai+6]+b*v[bi+6]+c*v[ci+6];
                const r=a*v[ai+7]+b*v[bi+7]+c*v[ci+7],g=a*v[ai+8]+b*v[bi+8]+c*v[ci+8],blue=a*v[ai+9]+b*v[bi+9]+c*v[ci+9];
                sceneRGB(r,g,blue,wx,wy,wz,eye,weather,x,y,pixels,index*4);
            }
        }
    }
    render(ctx,matrix,streams,eye,weather,time,wind,skyOffset=0){
        const w=this.width,h=this.height,pixels=this.image.data;this.depth.fill(Infinity);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)skyRGB(x,y,w,h,weather,skyOffset,pixels,(y*w+x)*4);
        for(const data of streams){
            if(!data)continue;
            const length=data.length/6*4;if(this.vertices.length<length)this.vertices=new Float64Array(length);
            const v=this.vertices;
            for(let i=0,j=0;i<data.length;i+=6,j+=4){
                const x=data[i],y=data[i+1],z=data[i+2];
                for(let k=0;k<4;k++)v[j+k]=matrix[k]*x+matrix[4+k]*y+matrix[8+k]*z+matrix[12+k];
                // Match both native vertex stages on a deliberate 1/16-pixel grid.
                const cw=v[j+3];if(Math.abs(cw)>=.000001){
                    const px=Math.floor((v[j]/cw*.5+.5)*w*16+.5)/16;
                    const py=Math.floor((.5-v[j+1]/cw*.5)*h*16+.5)/16;
                    v[j]=(px/w*2-1)*cw;v[j+1]=(1-py/h*2)*cw;
                }
            }
            for(let i=0,j=0;i<data.length;i+=18,j+=12){
                let a=this.clipA,b=this.clipB,n=3,mask=0,rejected=false;
                for(let vertex=0;vertex<3;vertex++){
                    const offset=vertex*10,clip=j+vertex*4,raw=i+vertex*6;
                    for(let k=0;k<4;k++)a[offset+k]=v[clip+k];
                    for(let k=0;k<6;k++)a[offset+4+k]=data[raw+k];
                }
                for(let plane=0;plane<6;plane++){
                    let outside=0;for(let k=0;k<3;k++)if(clipDistance(a,k*10,plane)<0)outside++;
                    if(outside===3){rejected=true;break;}if(outside)mask|=1<<plane;
                }
                if(rejected)continue;
                for(let plane=0;plane<6&&n;plane++)if(mask&(1<<plane)){
                    let count=0,previous=(n-1)*10,dp=clipDistance(a,previous,plane);
                    for(let k=0;k<n;k++){
                        const current=k*10,dc=clipDistance(a,current,plane);
                        if((dp<0)!==(dc<0)){
                            const t=dp/(dp-dc);for(let c=0;c<10;c++)b[count*10+c]=a[previous+c]+(a[current+c]-a[previous+c])*t;count++;
                        }
                        if(dc>=0){for(let c=0;c<10;c++)b[count*10+c]=a[current+c];count++;}
                        previous=current;dp=dc;
                    }
                    [a,b]=[b,a];n=count;
                }
                for(let k=1;k+1<n;k++)this.triangle(a,0,k*10,(k+1)*10,eye,weather);
            }
        }
        if(weather===1)for(let i=0;i<384;i++){
            const p=snowParticle(i,time,wind),cx=(p[0]*.5+.5)*w,cy=(.5-p[1]*.5)*h,half=p[3]*.5;
            const snap=n=>Math.floor(n*16+.5)/16;
            for(let y=Math.max(0,Math.ceil(snap(cy-half)-.5));y<Math.min(h,Math.ceil(snap(cy+half)-.5));y++)
                for(let x=Math.max(0,Math.ceil(snap(cx-half)-.5));x<Math.min(w,Math.ceil(snap(cx+half)-.5));x++){
                    const at=(y*w+x)*4;pixels[at]=Math.round(.94*255*.75+pixels[at]*.25);pixels[at+1]=Math.round(.96*255*.75+pixels[at+1]*.25);pixels[at+2]=Math.round(255*.75+pixels[at+2]*.25);
                }
        }
        ctx.putImageData(this.image,0,0);
    }
}

return {SoftwareRasterizer};
});
define("@wieslawsoltes/ski-audio",function(require){
const { clamp, Random }=require("@wieslawsoltes/ski-core");
/** Dependency-free Web Audio mixer. All sound is synthesized; no samples are shipped. */
class SkiAudio {
    constructor(options = {}) { this.volume = clamp(Number.isFinite(options.volume) ? options.volume : .55, 0, 1); this.muted = !!options.mute; this.ready = false; this.voices = new Set(); this.loops = []; this.failed = false; }
    async unlock() {
        if (this.failed || this.disposed)
            return false;
        try {
            if (!this.context) {
                const C = globalThis.AudioContext || globalThis.webkitAudioContext;
                if (!C) {
                    this.failed = true;
                    return false;
                }
                this.context = new C({ latencyHint: 'interactive' });
                const c = this.context;
                this.master = c.createGain();
                this.master.gain.value = this.muted ? 0 : this.volume * .7;
                const limiter = c.createDynamicsCompressor();
                limiter.threshold.value = -8;
                limiter.knee.value = 10;
                limiter.ratio.value = 8;
                limiter.attack.value = .004;
                limiter.release.value = .18;
                this.master.connect(limiter);
                limiter.connect(c.destination);
                this.noise = c.createBuffer(1, Math.round(c.sampleRate * 2), c.sampleRate);
                const data = this.noise.getChannelData(0), r = new Random(8471);
                for (let i = 0; i < data.length; i++)
                    data[i] = r.range(-1, 1);
                this.wind = this.makeLoop(380, .018);
                this.ski = this.makeLoop(1600, 0);
                this.ready = true;
            }
            if (this.context.state === 'suspended')
                await this.context.resume();
            return true;
        }
        catch (e) {
            this.error = String(e);
            this.failed = true;
            return false;
        }
    }
    makeLoop(frequency, volume) { const c = this.context, src = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain(); src.buffer = this.noise; src.loop = true; filter.type = 'lowpass'; filter.frequency.value = frequency; gain.gain.value = volume; src.connect(filter); filter.connect(gain); gain.connect(this.master); src.start(); const loop = { src, filter, gain }; this.loops.push(loop); return loop; }
    setVolume(volume, muted = this.muted) { this.volume = clamp(Number.isFinite(volume) ? volume : this.volume, 0, 1); this.muted = !!muted; if (this.master)
        this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * .7, this.context.currentTime, .03); }
    update(state, paused = false) {
        if (!this.ready)
            return;
        const t = this.context.currentTime, active = !paused && state && state.phase !== 'gate' && state.phase !== 'finished', speed = active ? state.speed || 0 : 0;
        this.wind.gain.gain.setTargetAtTime(active ? .014 + clamp(speed / 55, 0, 1) * .15 : .005, t, .09);
        this.wind.filter.frequency.setTargetAtTime(250 + speed * 24, t, .1);
        const sliding = active && ['inrun', 'runout'].includes(state.phase);
        this.ski.gain.gain.setTargetAtTime(sliding ? clamp(speed / 38, 0, 1) * .18 : 0, t, .04);
        this.ski.filter.frequency.setTargetAtTime(650 + speed * 38, t, .04);
    }
    tone(freq, duration = .09, type = 'square', volume = .10, endFreq = freq, delay = 0) { if (!this.ready || this.voices.size >= 20)
        return; const c = this.context, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay; o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(volume, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + duration); o.connect(g); g.connect(this.master); this.voices.add(o); o.onended = () => { o.disconnect(); g.disconnect(); this.voices.delete(o); }; o.start(t); o.stop(t + duration + .02); }
    burst(duration, volume, frequency, type = 'lowpass', delay = 0) { if (!this.ready || this.voices.size >= 20)
        return; const c = this.context, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + delay; s.buffer = this.noise; f.type = type; f.frequency.value = frequency; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(volume, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + duration); s.connect(f); f.connect(g); g.connect(this.master); this.voices.add(s); s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); this.voices.delete(s); }; s.start(t); s.stop(t + duration + .01); }
    play(name) {
        if (!this.ready)
            return;
        if (name === 'menu')
            this.tone(660, .045, 'square', .05, 740);
        if (name === 'start')
            this.tone(880, .10, 'square', .07);
        if (name === 'takeoff') {
            this.burst(.19, .22, 2800, 'bandpass');
            this.tone(180, .12, 'triangle', .11, 420);
        }
        if (name === 'land') {
            this.burst(.33, .4, 900);
            this.tone(110, .17, 'triangle', .2, 45);
            this.burst(1.3, .1, 1300, 'bandpass', .16);
        }
        if (name === 'crash') {
            this.burst(.8, .5, 1200);
            this.tone(145, .45, 'sawtooth', .11, 38);
        }
        if (name === 'record' || name === 'win') {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, i === 3 ? .38 : .16, 'square', .09, f, i * .13));
            this.burst(1.6, .13, 1700, 'bandpass', .35);
        }
    }
    async suspend() { if (this.context?.state === 'running')
        await this.context.suspend().catch(() => { }); }
    dispose() { this.disposed = true; for (const v of this.voices) {
        try {
            v.stop();
        }
        catch { }
    } for (const l of this.loops) {
        try {
            l.src.stop();
        }
        catch { }
        l.src.disconnect();
        l.filter.disconnect();
        l.gain.disconnect();
    } this.loops = []; this.voices.clear(); this.context?.close().catch(() => { }); this.ready = false; }
}

return {SkiAudio};
});
define("@wieslawsoltes/ski-input",function(require){
const { clamp }=require("@wieslawsoltes/ski-core");
/** Pointer/mouse chord, touch drag, keyboard, gamepad and optional device-tilt adapter. */
class SkiInput {
    constructor(element, handlers = {}, options = {}) {
        this.element = element;
        this.handlers = handlers;
        this.options = { sensitivity: 1, control: 'modern', motion: false, ...options };
        this.enabled = false;
        this.keys = new Set();
        this.pointers = new Map();
        this.cleanup = [];
        this.lastMouse = null;
        this.lastButtons = 0;
        this.gamepadButtons = [];
        this.motionCenter = null;
        this.lastMotion = 0;
        this.listen(element, 'contextmenu', e => { if (this.enabled)
            e.preventDefault(); });
        this.listen(element, 'pointerdown', e => this.pointerDown(e));
        this.listen(element, 'pointermove', e => this.pointerMove(e));
        this.listen(element, 'pointerup', e => this.pointerUp(e));
        this.listen(element, 'pointercancel', e => this.pointerUp(e));
        this.listen(element, 'lostpointercapture', e => { this.pointers.delete(e.pointerId); if (e.pointerType === 'mouse') { this.lastMouse = null; this.lastButtons = 0; } });
        // Pointer Events fire pointerdown only for the first mouse button. mousedown observes chords.
        this.listen(element, 'mousedown', e => { if (this.enabled && !this.interactive(e.target)) {
            e.preventDefault();
            this.handleMouseButtons(e.buttons);
        } });
        this.listen(element, 'mouseup', e => { this.lastButtons = e.buttons; });
        this.listen(window, 'keydown', e => this.keyDown(e));
        this.listen(window, 'keyup', e => this.keys.delete(e.code));
        this.listen(window, 'blur', () => this.reset());
        this.listen(document, 'visibilitychange', () => { if (document.hidden)
            this.reset(); });
        this.listen(window, 'deviceorientation', e => this.orientation(e));
        this.listen(window, 'orientationchange', () => { this.motionCenter = null; this.lastMotion = 0; });
    }
    listen(target, type, fn, options) { target.addEventListener(type, fn, options); this.cleanup.push(() => target.removeEventListener(type, fn, options)); }
    interactive(target) { return !!target.closest?.('button,input,select,textarea,a,[data-no-input]'); }
    setEnabled(value) { this.enabled = !!value; if (!value)
        this.reset(); }
    setOptions(options) { Object.assign(this.options, options); }
    phase() { return this.handlers.phase?.() || 'gate'; }
    action(name) { this.handlers.unlock?.(); this.handlers.action?.(name); }
    primary(parallel = false) { const p = this.phase(); this.action(p === 'gate' ? 'start' : p === 'inrun' ? 'takeoff' : parallel ? 'parallel' : 'telemark'); }
    handleMouseButtons(buttons) {
        const previous = this.lastButtons;
        this.lastButtons = buttons;
        if (buttons === previous || !(buttons & ~previous & 3))
            return;
        const p = this.phase(), both = (buttons & 3) === 3;
        if (p === 'gate') {
            if ((buttons & ~previous & 1) !== 0) this.action('start');
            return;
        }
        if (p === 'inrun') {
            if (this.options.control === 'modern' || both)
                this.action('takeoff');
            return;
        }
        if (p === 'flight') {
            if (this.options.control === 'classic') {
                if (buttons & ~previous & 1) this.action('left-foot');
                if (buttons & ~previous & 2) this.action('right-foot');
                return;
            }
            if (both || (this.options.control === 'modern' && (buttons & 2)))
                this.action('parallel');
            else if (buttons & 3)
                this.action('telemark');
        }
    }
    virtualButton(side, down) {
        if (!this.enabled || !['left', 'right'].includes(side)) return;
        const mask = side === 'left' ? 1 : 2;
        if (down) this.handleMouseButtons(this.lastButtons | mask);
        else this.lastButtons &= ~mask;
    }
    pointerDown(e) {
        if (!this.enabled || this.interactive(e.target))
            return;
        this.handlers.unlock?.();
        this.lastMouse = { x: e.clientX, y: e.clientY };
        if (e.pointerType === 'mouse') {
            // Canceling mouse pointerdown suppresses compatibility mousedown, including the chord.
            // Handle the first edge here; the mousedown listener handles additional buttons, deduplicated.
            this.handleMouseButtons(e.buttons);
            return;
        }
        e.preventDefault();
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startY: e.clientY });
        try {
            this.element.setPointerCapture(e.pointerId);
        }
        catch { }
        if (this.phase() === 'gate')
            this.action('start');
        else if (this.options.control === 'classic' && this.options.rules !== 'dsj210' && this.pointers.size >= 2)
            this.primary(true);
    }
    pointerMove(e) {
        if (!this.enabled)
            return;
        if (e.pointerType === 'mouse') {
            if (this.interactive(e.target))
                return;
            if (this.lastMouse && this.phase() === 'flight')
                this.handlers.lean?.(-clamp(e.clientY - this.lastMouse.y, -60, 60) * .0038 * this.options.sensitivity);
            this.lastMouse = { x: e.clientX, y: e.clientY };
            if (e.buttons !== this.lastButtons)
                this.handleMouseButtons(e.buttons);
            return;
        }
        const p = this.pointers.get(e.pointerId);
        if (!p)
            return;
        e.preventDefault();
        if (this.phase() === 'flight')
            this.handlers.lean?.(-clamp(e.clientY - p.y, -80, 80) * .006 * this.options.sensitivity);
        p.x = e.clientX;
        p.y = e.clientY;
    }
    pointerUp(e) { this.pointers.delete(e.pointerId); if (e.pointerType === 'mouse')
        this.lastButtons = e.buttons; }
    keyDown(e) {
        if (!this.enabled || this.interactive(e.target))
            return;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'KeyP', 'KeyZ', 'KeyX', 'KeyR', 'KeyC', 'KeyM', 'KeyF'].includes(e.code))
            e.preventDefault();
        this.keys.add(e.code);
        if (e.repeat)
            return;
        if (e.code === 'Space')
            this.primary();
        if (e.code === 'KeyZ')
            this.action('telemark');
        if (e.code === 'KeyX')
            this.action('parallel');
        for (const [key, action] of Object.entries({ Escape: 'pause', KeyP: 'pause', KeyR: 'retry', KeyC: 'camera', KeyM: 'mute', KeyF: 'fullscreen' }))
            if (e.code === key)
                this.action(action);
    }
    poll(dt) {
        if (!this.enabled || !Number.isFinite(dt) || dt <= 0)
            return;
        let axis = 0;
        if (this.keys.has('ArrowUp') || this.keys.has('ArrowLeft'))
            axis += 1;
        if (this.keys.has('ArrowDown') || this.keys.has('ArrowRight'))
            axis -= 1;
        const pads = navigator.getGamepads?.() || [], pad = [...pads].find(p => p?.connected);
        if (pad) {
            const a = pad.axes[1] || 0;
            if (Math.abs(a) > .15)
                axis -= a;
            for (let i = 0; i < pad.buttons.length; i++) {
                const pressed = pad.buttons[i].pressed;
                if (pressed && !this.gamepadButtons[i]) {
                    if (i === 0)
                        this.primary();
                    if (i === 1)
                        this.action('parallel');
                    if (i === 9)
                        this.action('pause');
                }
                this.gamepadButtons[i] = pressed;
            }
        }
        if (!pad) this.gamepadButtons = [];
        if (axis)
            this.handlers.lean?.(axis * .9 * dt * this.options.sensitivity);
    }
    async enableMotion() { const C = globalThis.DeviceOrientationEvent; if (!C)
        throw new Error('This browser does not expose device tilt. Touch drag remains available.'); if (typeof C.requestPermission === 'function') {
        const status = await C.requestPermission();
        if (status !== 'granted')
            throw new Error('Motion permission was not granted.');
    } this.options.motion = true; this.motionCenter = null; this.lastMotion = 0; return true; }
    orientation(e) { if (!this.enabled || !this.options.motion)
        return; const angle = screen.orientation?.angle ?? window.orientation ?? 0; const raw = Math.abs(angle) % 180 === 90 ? (e.gamma || 0) * (angle === 90 ? -1 : 1) : (e.beta || 0); if (this.motionCenter === null) {
        this.motionCenter = raw;
        return;
    } const current = clamp((raw - this.motionCenter) / 32, -1, 1); if (this.phase() === 'flight')
        this.handlers.lean?.((current - this.lastMotion) * this.options.sensitivity); this.lastMotion = current; }
    calibrate() { this.motionCenter = null; this.lastMotion = 0; }
    reset() { this.keys.clear(); this.pointers.clear(); this.lastMouse = null; this.lastButtons = 0; this.gamepadButtons = []; }
    dispose() { this.reset(); this.cleanup.splice(0).forEach(fn => fn()); }
}

return {SkiInput};
});
define("@wieslawsoltes/ski-storage",function(require){
const { clamp }=require("@wieslawsoltes/ski-core");
const { getHill, HILLS }=require("@wieslawsoltes/ski-hills");
const { validateRules }=require("@wieslawsoltes/ski-physics");
const { validateReplay }=require("@wieslawsoltes/ski-replay");
const { Competition, normalizePlayer }=require("@wieslawsoltes/ski-competition");
const DEFAULT_SETTINGS = Object.freeze({ resolution: 'classic', renderer: 'auto', weather: 'clear', volume: .55, mute: false,
    sensitivity: 1, control: 'classic', rules: 'dsj210', presentation: 'classic', assist: false, guide: false, ghost: false, camera: 'classic', haptics: true,
    windStrength: 1, windBase: null, gate: 0, watchCPU: false, difficulty: .8, aiCount: 15, scanlines: false, showFPS: false, motion: false });
function validateSettings(raw = {}) {
    const s = { ...DEFAULT_SETTINGS };
    for (const k of ['mute', 'assist', 'guide', 'ghost', 'haptics', 'watchCPU', 'scanlines', 'showFPS', 'motion'])
        if (typeof raw[k] === 'boolean')
            s[k] = raw[k];
    for (const [k, range] of Object.entries({ volume: [0, 1], sensitivity: [.2, 3], windStrength: [0, 2], gate: [-5, 8], difficulty: [.2, 1], aiCount: [0, 49] }))
        if (Number.isFinite(raw[k]))
            s[k] = clamp(raw[k], ...range);
    for (const [k, choices] of Object.entries({ rules: ['legacy', 'dsj210'], presentation: ['classic', 'enhanced'], resolution: ['classic', 'sharp', 'native'], renderer: ['auto', 'webgl', 'software'], weather: ['clear', 'snow', 'dusk', 'night'], control: ['modern', 'classic'], camera: ['classic', 'close', 'wide', 'chase'] }))
        if (choices.includes(raw[k]))
            s[k] = raw[k];
    if (raw.windBase === null || Number.isFinite(raw.windBase))
        s.windBase = raw.windBase === null ? null : clamp(raw.windBase, -4, 4);
    s.gate = Math.round(s.gate);
    s.aiCount = Math.round(s.aiCount);
    return s;
}
/** Quota/security errors degrade to in-memory storage, never stop the game loop. */
class GameStore {
    constructor(storage = null, prefix = 'ski-jump-web.v1.') {
        if (!storage) {
            try {
                storage = globalThis.localStorage;
            }
            catch {
                storage = null;
            }
        }
        this.storage = storage;
        this.prefix = prefix;
        this.memory = new Map();
        this.persistent = !!storage;
        this.lastError = null;
    }
    get(key, fallback = null) { try {
        const s = this.memory.has(key) ? this.memory.get(key) : this.storage?.getItem(this.prefix + key);
        return s == null ? fallback : JSON.parse(s);
    }
    catch (e) {
        this.lastError = String(e);
        return fallback;
    } }
    set(key, value) { const s = JSON.stringify(value); this.memory.set(key, s); try {
        this.storage?.setItem(this.prefix + key, s);
        return !!this.storage;
    }
    catch (e) {
        this.lastError = String(e);
        this.persistent = false;
        return false;
    } }
    remove(key) { this.memory.delete(key); try {
        this.storage?.removeItem(this.prefix + key);
    }
    catch { } }
    settings() {
        const raw = this.get('settings', null);
        return validateSettings(raw ? { rules: 'legacy', presentation: 'enhanced', ...raw } : {});
    }
    saveSettings(settings) { return this.set('settings', validateSettings(settings)); }
    records() { const r = this.get('records', {}); return r && typeof r === 'object' && !Array.isArray(r) ? r : {}; }
    resetRecords(assisted = false, rules = 'legacy') {
        validateRules(rules);
        const records = this.records(), boards = this.leaderboards();
        for (const hill of HILLS) {
            const key = this.recordKey(hill.id, assisted, rules);
            delete records[key]; delete boards[key]; this.remove('ghost.' + key);
        }
        this.set('records', records); this.set('leaderboards', boards);
    }
    recordKey(hillId, assisted = false, rules = 'legacy') { getHill(hillId); validateRules(rules); return `${hillId}${rules === 'dsj210' ? '.dsj210' : ''}${assisted ? '.assisted' : ''}`; }
    leaderboards() {
        const value = this.get('leaderboards', {});
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    hillLeaderboard(hillId, assisted = false, limit = 10, rules = 'legacy') {
        const key = this.recordKey(hillId, assisted, rules), records = this.leaderboards()[key];
        if (Array.isArray(records)) return records.slice(0, clamp(Math.floor(limit) || 10, 1, 64)).map(r => ({ ...r }));
        const best = this.records()[key]; return best ? [{ ...best }] : [];
    }
    personalBests(name, assisted = false, rules = 'legacy') {
        const board = this.leaderboards(), output = {};
        for (const key of Object.keys(board)) {
            if (key.includes('.dsj210') !== (rules === 'dsj210')) continue;
            if (key.endsWith('.assisted') !== !!assisted) continue;
            const result = Array.isArray(board[key]) ? board[key].find(row => row.name === name) : null;
            if (result) output[key.split('.')[0]] = { ...result };
        }
        return output;
    }
    tours() {
        const raw = this.get('tours', []);
        return (Array.isArray(raw) ? raw : []).filter(t => t && typeof t.name === 'string' && Array.isArray(t.hills)).slice(0, 20);
    }
    saveTour(tour) {
        if (!tour || !Array.isArray(tour.hills) || !tour.hills.length || tour.hills.length > 64) throw new Error('Select 1–64 tour events');
        tour.hills.forEach(getHill);
        const name = String(tour.name || 'CUSTOM TOUR').replace(/[<>\x00-\x1f]/g, '').trim().slice(0, 40) || 'CUSTOM TOUR';
        const rows = this.tours().filter(t => t.name !== name);
        rows.unshift({ name, hills: [...tour.hills] }); this.set('tours', rows.slice(0, 20)); return name;
    }
    deleteTour(name) { this.set('tours', this.tours().filter(t => t.name !== name)); }
    renameReplay(id, name) {
        const list = this.replays(), row = list.find(r => r.id === id);
        if (!row) throw new Error('Replay not found');
        row.label = String(name).replace(/[<>\x00-\x1f]/g, '').trim().slice(0, 48) || row.name;
        this.set('replays', list);
    }
    updateRecord(result, player, replay = null) {
        if (!result || result.disqualified || result.crashed || !Number.isFinite(result.distance) || result.distance < 0 || result.distance > 2000 || !Number.isFinite(result.total))
            return false;
        const key = this.recordKey(result.hillId, result.assisted, result.rules), all = this.records(), old = all[key];
        const boards = this.leaderboards(), board = this.hillLeaderboard(result.hillId, result.assisted, 64, result.rules);
        const name = String(player.name).replace(/[<>\x00-\x1f]/g, '').slice(0, 22);
        const personal = board.find(r => r.name === name);
        if (!personal || personal.distance < result.distance) {
            const next = board.filter(r => r.name !== name);
            next.push({ distance: result.distance, total: result.total, name, country: player.country,
                date: new Date().toISOString(), assisted: !!result.assisted, gate: result.gate, wind: result.wind });
            next.sort((a, b) => b.distance - a.distance || a.name.localeCompare(b.name));
            boards[key] = next.slice(0, 64); this.set('leaderboards', boards);
        }
        if (old && old.distance >= result.distance)
            return false;
        all[key] = { distance: result.distance, total: result.total, name: String(player.name).slice(0, 22), country: player.country, date: new Date().toISOString(), assisted: result.assisted, gate: result.gate, wind: result.wind };
        this.set('records', all);
        if (replay) {
            try {
                this.set(`ghost.${key}`, validateReplay(replay));
            }
            catch { }
        }
        return true;
    }
    ghost(hillId, assisted = false, rules = 'legacy') { try {
        const r = this.get(`ghost.${this.recordKey(hillId, assisted, rules)}`);
        return r ? validateReplay(r) : null;
    }
    catch {
        return null;
    } }
    replays() { const a = this.get('replays', []); return (Array.isArray(a) ? a : []).filter(r => r && typeof r.id === 'string').slice(0, 20); }
    saveReplay(replay) { const r = validateReplay(replay), id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; const list = this.replays(); list.unshift({ id, name: r.player.name, hillId: r.hillId, distance: r.result?.distance || 0, date: r.createdAt }); while (list.length > 20) {
        const dropped = list.pop();
        this.remove(`replay.${dropped.id}`);
    } this.set(`replay.${id}`, r); this.set('replays', list); return id; }
    loadReplay(id) { const r = this.get(`replay.${id}`); return r ? validateReplay(r) : null; }
    deleteReplay(id) { this.remove(`replay.${id}`); this.set('replays', this.replays().filter(r => r.id !== id)); }
    stats() { return { jumps: 0, landings: 0, falls: 0, distance: 0, cups: 0, ...this.get('stats', {}) }; }
    addJump(r) { if (r.disqualified) { this.set('disqualifications', this.get('disqualifications', 0) + 1); return; } const s = this.stats(); s.jumps++; s[r.crashed ? 'falls' : 'landings']++; s.distance += r.distance; this.set('stats', s); }
    exportData() { return JSON.stringify({ format: 'ski-jump-web-save', version: 1, settings: this.settings(), players: this.get('players', []), records: this.records(), leaderboards: this.leaderboards(), tours: this.tours(), stats: this.stats(), cup: this.get('cup') }, null, 2); }
    importData(text) {
        if (typeof text !== 'string' || text.length > 5000000)
            throw new Error('Save file exceeds 5 MB');
        const d = JSON.parse(text);
        if (!d || d.format !== 'ski-jump-web-save' || d.version !== 1)
            throw new Error('Unsupported save file');
        if (!Array.isArray(d.players) || d.players.length > 16 || !d.records || typeof d.records !== 'object' || Array.isArray(d.records) || Object.keys(d.records).length > 128)
            throw new Error('Invalid save data');
        for (const [key, r] of Object.entries(d.records)) {
            if (!/^[a-z]{3}(\.dsj210)?(\.assisted)?$/.test(key))
                throw new Error('Invalid record key');
            getHill(key.split('.')[0]);
            if (!r || !Number.isFinite(r.distance) || r.distance < 0 || r.distance > 2000)
                throw new Error('Invalid record');
        }
        const boards = d.leaderboards ?? {};
        if (!boards || typeof boards !== 'object' || Array.isArray(boards) || Object.keys(boards).length > 128) throw new Error('Invalid leaderboards');
        for (const [key, rows] of Object.entries(boards)) {
            if (!/^[a-z]{3}(\.dsj210)?(\.assisted)?$/.test(key)) throw new Error('Invalid leaderboard key');
            getHill(key.split('.')[0]);
            if (!Array.isArray(rows) || rows.length > 64 || rows.some(r => !r || typeof r.name !== 'string' || !Number.isFinite(r.distance) || r.distance < 0 || r.distance > 2000)) throw new Error('Invalid leaderboard');
        }
        const tours = d.tours ?? [];
        if (!Array.isArray(tours) || tours.length > 20 || tours.some(t => !t || typeof t.name !== 'string' || !Array.isArray(t.hills) || !t.hills.length || t.hills.length > 64)) throw new Error('Invalid saved tours');
        tours.forEach(t => t.hills.forEach(getHill));
        if (d.players.some(p => !p || typeof p !== 'object' || Array.isArray(p))) throw new Error('Invalid player');
        const players = d.players.map(normalizePlayer);
        let cup = null;
        if (d.cup !== null && d.cup !== undefined) {
            if (typeof d.cup !== 'string') throw new Error('Invalid saved cup');
            cup = Competition.restore(d.cup).serialize();
        }
        this.set('leaderboards', boards); this.set('tours', tours);
        this.saveSettings({ rules: 'legacy', presentation: 'enhanced', ...(d.settings && typeof d.settings === 'object' ? d.settings : {}) });
        this.set('players', players);
        this.set('records', d.records);
        if (d.stats) {
            const s = {};
            for (const key of ['jumps', 'landings', 'falls', 'distance', 'cups'])
                s[key] = Number.isFinite(d.stats[key]) ? clamp(d.stats[key], 0, 1e12) : 0;
            this.set('stats', s);
        }
        if (cup) this.set('cup', cup); else this.remove('cup');
    }
}

return {DEFAULT_SETTINGS,validateSettings,GameStore};
});
define("@wieslawsoltes/ski-ui",function(require){
const { clamp }=require("@wieslawsoltes/ski-core");
// Authored 5x7 bitmap glyphs, rendered with rectangles; no external/font files.
const GLYPHS = {
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'], C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'], E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'], G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'], H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'], I: ['111', '010', '010', '010', '010', '010', '111'], J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'], K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'], S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'], U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'], W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'], X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'], Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'], Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['010', '110', '010', '010', '010', '010', '111'], '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'], '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
    ' ': ['000', '000', '000', '000', '000', '000', '000'], '.': ['0', '0', '0', '0', '0', '1', '1'], ',': ['00', '00', '00', '00', '00', '01', '10'], ':': ['0', '1', '1', '0', '1', '1', '0'], '-': ['000', '000', '000', '111', '000', '000', '000'], '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'], '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'], '%': ['11001', '11010', '00100', '01000', '10110', '00110', '00000'], '!': ['1', '1', '1', '1', '1', '0', '1'], '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'], '(': ['001', '010', '100', '100', '100', '010', '001'], ')': ['100', '010', '001', '001', '001', '010', '100'], '>': ['100', '010', '001', '001', '001', '010', '100'], '<': ['001', '010', '100', '100', '100', '010', '001'], '=': ['000', '000', '111', '000', '111', '000', '000'], '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'], "'": ['1', '1', '0', '0', '0', '0', '0'], '#': ['01010', '11111', '01010', '01010', '11111', '01010', '00000']
};
function plainASCII(text) { return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/Š/g, 'S').toUpperCase(); }
function textWidth(text, scale = 1) { return [...plainASCII(text)].reduce((n, c) => n + ((GLYPHS[c] || GLYPHS['?'])[0].length + 1) * scale, 0) - scale; }
function drawText(ctx, text, x, y, color = '#eeee43', scale = 1, shadow = false) { text = plainASCII(text); if (shadow)
    drawText(ctx, text, x + scale, y + scale, '#151618', scale, false); ctx.fillStyle = color; for (const c of text) {
    const g = GLYPHS[c] || GLYPHS['?'];
    for (let yy = 0; yy < 7; yy++)
        for (let xx = 0; xx < g[yy].length; xx++)
            if (g[yy][xx] === '1')
                ctx.fillRect(Math.round(x + xx * scale), Math.round(y + yy * scale), scale, scale);
    x += (g[0].length + 1) * scale;
} return x; }
function pixelCanvas(text, color = '#eeee43', scale = 2) { const c = document.createElement('canvas'); c.width = Math.max(1, textWidth(text, scale) + 2); c.height = 7 * scale + 2; c.setAttribute('aria-hidden', 'true'); c.className = 'pixel-label'; drawText(c.getContext('2d'), text, 0, 0, color, scale); return c; }
function paintLabels(root = document) { root.querySelectorAll('[data-pixel]').forEach(el => { const text = el.dataset.pixel || el.textContent; el.setAttribute('aria-label', text); el.replaceChildren(pixelCanvas(text, el.dataset.color || '#eeee43', Number(el.dataset.size) || 2)); }); }
function drawLogo(canvas) { canvas.width = 314; canvas.height = 58; const c = canvas.getContext('2d'); drawText(c, 'DELUXE', 64, 2, '#c2c547', 2); drawText(c, 'SKI JUMP', 5, 22, '#eeee43', 4); drawText(c, '2', 188, 22, '#eeee43', 4); c.fillStyle = '#9fa546'; c.fillRect(62, 17, 138, 2); }
function escapeHTML(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function downloadText(filename, text, mime = 'application/json') { const blob = new Blob([text], { type: mime }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
/** Reference-space layout measured from the publisher's DSJ2.10 gallery (not copied bitmap assets). */
const CLASSIC_HUD_LAYOUT = Object.freeze({ width: 320, height: 200, statusHeight: 13,
    windWidth: 29, windHeight: 27, right: 4, top: 3, judgeTop: 58, judgeStep: 12 });
function drawClassicHUD(ctx, W, H, state, hill, player, options = {}, meta = {}) {
    const fit = (s, width) => { s = String(s); while (s.length && textWidth(s) > width) s = s.slice(0, -1); return s; };
    const text = (s, x, y, color = '#eeee43') => drawText(ctx, s, Math.round(x), Math.round(y), color, 1);
    // Snow belongs behind instruments, never on top of their labels.
    if (options.weather === 'snow' && meta.backend !== 'webgpu') {
        ctx.fillStyle = '#f5f8ffbb';
        for (let i = 0; i < 110; i++) ctx.fillRect(Math.floor(((i * 47.317 + state.time * (4 + state.wind * 2)) % W + W) % W), Math.floor((i * 37.317 + state.time * (5 + i % 7)) % H), 1, 1);
    }
    const L = CLASSIC_HUD_LAYOUT, wx = W - L.right - L.windWidth;
    ctx.fillStyle = '#24242c'; ctx.fillRect(0, H - L.statusHeight, W, L.statusHeight);
    const landed = state.phase === 'runout' || state.phase === 'finished';
    const mode = meta.replay ? 'REPLAY' : String(meta.mode || 'PRACTICE');
    text(fit(mode, W * .49), 3, H - 10);
    if (state.disqualified) text('DISQUALIFIED', Math.max(W * .51, W - 77), H - 10);
    else if (landed) text((meta.result?.distance ?? state.distance).toFixed(1) + 'M', W * .53, H - 10);
    else if (mode !== 'PRACTICE') text(fit(player.name || 'PLAYER', W * .44), W * .53, H - 10);
    ctx.fillStyle = '#101017'; ctx.fillRect(wx, L.top, L.windWidth, L.windHeight);
    const wind = Number.isFinite(state.wind) ? state.wind : 0;
    const angle = Number.isFinite(state.windAngle) ? state.windAngle : wind >= 0 ? Math.PI : 0;
    // Arrow rotates within the wind box; gust direction is authored because original 2D wind physics is not recovered.
    const cx = wx + 14, cy = 12, dx = Math.cos(angle), dy = Math.sin(angle), px = -dy, py = dx;
    ctx.fillStyle = '#ef3030'; ctx.beginPath();
    ctx.moveTo(cx + dx * 9, cy + dy * 9);
    ctx.lineTo(cx - dx * 1 + px * 4, cy - dy * 1 + py * 4);
    ctx.lineTo(cx - dx * 1 + px, cy - dy * 1 + py);
    ctx.lineTo(cx - dx * 8 + px, cy - dy * 8 + py);
    ctx.lineTo(cx - dx * 8 - px, cy - dy * 8 - py);
    ctx.lineTo(cx - dx * 1 - px, cy - dy * 1 - py);
    ctx.lineTo(cx - dx * 1 - px * 4, cy - dy * 1 - py * 4); ctx.closePath(); ctx.fill();
    const speed = Math.abs(wind).toFixed(1); text(speed, wx + (L.windWidth - textWidth(speed)) / 2, 21);
    if (state.phase === 'gate' && !meta.replay) {
        const elapsed = state.gateElapsed || 0, remaining = state.startRemaining ?? 15;
        const on = remaining > 10 || Math.floor(elapsed * 4) % 2 === 0;
        ctx.fillStyle = '#15151a'; ctx.fillRect(wx - 19, 3, 15, 27);
        ctx.fillStyle = remaining > 0 ? '#651717' : '#ff3830'; ctx.fillRect(wx - 16, 6, 9, 8);
        ctx.fillStyle = remaining > 0 && on ? '#39e02b' : '#163d14'; ctx.fillRect(wx - 16, 18, 9, 8);
    }
    const result = meta.result;
    if (landed && result && !result.disqualified) {
        result.judges.forEach((mark, i) => {
            const x = W - 29, y = L.judgeTop + i * L.judgeStep;
            ctx.fillStyle = '#20202a'; ctx.fillRect(x, y, 25, 11);
            text(mark.toFixed(1), x + 1, y + 2, result.counted.includes(i) ? '#eeee43' : '#98954e');
        });
    }
    if (options.showFPS) text(fit(`${meta.backend || ''} ${meta.fps || 0} FPS`, W - 60), 3, 3, '#c9c9d6');
}
class JumpHUD {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.fps = 0; }
    render(state, hill, player, options = {}, meta = {}) {
        const c = this.canvas, ctx = this.ctx, w = c.width, h = c.height, portrait = h > w, scale = Math.max(1, Math.floor(w / (portrait ? 160 : 320))), W = w / scale, H = h / scale;
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.scale(scale, scale);
        if (options.presentation === 'classic') { drawClassicHUD(ctx, W, H, state, hill, player, options, meta); ctx.restore(); return; }
        const fit = (s, width) => { s = String(s); while (s.length && textWidth(s) > width)
            s = s.slice(0, -1); return s; };
        const text = (s, x, y, color = '#eeee43', shadow = true) => drawText(ctx, s, x, y, color, 1, shadow), center = (s, y, color) => text(s, (W - textWidth(s)) / 2, y, color);
        ctx.fillStyle = '#08090ddd';
        ctx.fillRect(0, H - 17, W, 17);
        ctx.fillStyle = '#8e9149';
        ctx.fillRect(0, H - 18, W, 1);
        text(`${hill.name} K${hill.k}`, 6, 6);
        text(fit(meta.mode || 'PRACTICE', W - 45), 6, 17, '#f5f3d6');
        const distance = `${(state.distance || 0).toFixed(2)} M`;
        text(fit(`${player.country || 'POL'} ${player.name || 'PLAYER 1'}`, W - textWidth(distance) - 17), 5, H - 11);
        text(distance, W - textWidth(distance) - 5, H - 11);
        const wx = W - 35;
        ctx.fillStyle = '#16181ce8';
        ctx.fillRect(wx, 4, 31, 30);
        text(`${(state.wind || 0).toFixed(1)}`, wx + 5, 23, '#f3ecdd', false);
        ctx.fillStyle = state.wind >= 0 ? '#68c953' : '#e1513a';
        const dir = state.wind >= 0 ? -1 : 1;
        ctx.fillRect(wx + 7, 11, 16, 2);
        ctx.beginPath();
        ctx.moveTo(wx + 15 + dir * 10, 12);
        ctx.lineTo(wx + 15 + dir * 3, 7);
        ctx.lineTo(wx + 15 + dir * 3, 17);
        ctx.fill();
        if (state.phase === 'inrun' || state.phase === 'flight')
            text(`${(state.speed * 3.6).toFixed(1)} KM/H`, 6, 29, '#f7f8fc');
        if (options.showFPS)
            text(`${meta.backend || ''} ${meta.fps || 0} FPS`, 6, 40, '#d3d8e9');
        if (meta.replay) {
            ctx.fillStyle = '#090a10c0';
            ctx.fillRect(W / 2 - 32, 4, 64, 13);
            center('REPLAY', 7, '#ffb34e');
        }
        if (state.phase === 'gate' && !meta.replay) {
            const label = meta.touch ? 'TAP START TO JUMP' : 'CLICK / SPACE TO START';
            ctx.fillStyle = '#101217d9';
            const yy = H - (portrait ? 138 : 61);
            ctx.fillRect((W - textWidth(label)) / 2 - 9, yy, textWidth(label) + 18, 33);
            center(fit(player.name || 'PLAYER 1', W - 20), yy + 6);
            center(label, yy + 20, '#fffdfa');
        }
        if (options.guide && !meta.replay) {
            if (state.phase === 'inrun') {
                const ratio = clamp((state.x + 12) / 12, 0, 1), x = W / 2 - 50, y = H - (portrait ? 90 : 34);
                ctx.fillStyle = '#0b0d13cc';
                ctx.fillRect(x - 5, y - 12, 110, 21);
                text(state.x > -3 ? 'JUMP NOW!' : 'WAIT FOR THE LIP', W / 2 - textWidth(state.x > -3 ? 'JUMP NOW!' : 'WAIT FOR THE LIP') / 2, y - 10, state.x > -3 ? '#eff76b' : '#e9e9d1');
                ctx.fillStyle = '#454954';
                ctx.fillRect(x, y, 100, 4);
                ctx.fillStyle = '#5baf65';
                ctx.fillRect(x + 79, y, 19, 4);
                ctx.fillStyle = '#ffec77';
                ctx.fillRect(x + ratio * 99, y - 2, 2, 8);
            }
            else if (state.phase === 'flight') {
                const x = W / 2 - 35, y = H - (portrait ? 85 : 31);
                ctx.fillStyle = '#0a0d12c9';
                ctx.fillRect(x - 5, y - 13, 80, 21);
                text('FLIGHT BALANCE', W / 2 - textWidth('FLIGHT BALANCE') / 2, y - 11, '#f0eed6');
                ctx.fillStyle = '#525760';
                ctx.fillRect(x, y, 70, 3);
                ctx.fillStyle = '#6dca78';
                ctx.fillRect(x + 27, y, 16, 3);
                ctx.fillStyle = '#faf577';
                ctx.fillRect(x + clamp((state.lean + 1) / 2, 0, 1) * 69, y - 2, 2, 7);
                if (state.height < 7) {
                    const label = meta.touch ? 'LAND NOW' : 'Z / X: LAND';
                    center(label, H - (portrait ? 108 : 54), '#fcf67a');
                }
                if (state.flightTime < .9)
                    center(`${Math.round(state.quality * 100)}% TAKEOFF`, 49, state.quality > .8 ? '#f5f866' : '#f2b562');
            }
        }
        if (state.phase === 'runout' || state.phase === 'finished') {
            const label = state.crashed ? 'FALL!' : state.landing === 'telemark' ? 'TELEMARK' : 'TWO-FOOT LANDING';
            center(label, H - 45, state.crashed ? '#ff9272' : '#f5f475');
        }
        if (options.weather === 'snow' && meta.backend !== 'webgpu') {
            ctx.fillStyle = '#f5f8ffbb';
            for (let i = 0; i < 110; i++) {
                const x = ((Math.sin(i * 74.37) * 13475 + (state.time || 0) * (4 + (state.wind || 0) * 2)) % W + W) % W, y = ((i * 37.317 + (state.time || 0) * (5 + i % 7)) % H + H) % H;
                ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
            }
        }
        ctx.restore();
    }
}

return {GLYPHS,plainASCII,textWidth,drawText,pixelCanvas,paintLabels,drawLogo,escapeHTML,downloadText,CLASSIC_HUD_LAYOUT,drawClassicHUD,JumpHUD};
});
define("app",function(require){
const { FixedClock, Random, clamp, round }=require("@wieslawsoltes/ski-core");
const { HILLS, getHill, HillProfile, TOUR_PRESETS }=require("@wieslawsoltes/ski-hills");
const { JumpSimulation, CPUController, FIXED_DT }=require("@wieslawsoltes/ski-physics");
const { Competition, TourSchedule, competitionCSV, createField, createTeams, normalizePlayer }=require("@wieslawsoltes/ski-competition");
const { ReplayRecorder, ReplayPlayer, parseReplay, serializeReplay }=require("@wieslawsoltes/ski-replay");
const { SkiRenderer }=require("@wieslawsoltes/ski-renderer");
const { SkiAudio }=require("@wieslawsoltes/ski-audio");
const { SkiInput }=require("@wieslawsoltes/ski-input");
const { GameStore, DEFAULT_SETTINGS }=require("@wieslawsoltes/ski-storage");
const { JumpHUD, paintLabels, drawLogo, escapeHTML, downloadText, pixelCanvas }=require("@wieslawsoltes/ski-ui");
const $ = s => document.querySelector(s), esc = escapeHTML;
const btn = (action, label, cls = 'small-button', extra = '') => `<button class="${cls}" data-action="${action}" ${extra}>${esc(label)}</button>`;
const pixelBtn = (action, label, extra = '') => `<button class="menu-item" data-action="${action}" ${extra}><span data-pixel="${esc(label)}"></span></button>`;
const option = (value, label, selected) => `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;
const countries = [...new Map(HILLS.map(h => [h.code, h.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
class SkiJumpApp {
    constructor() {
        this.store = new GameStore();
        this.settings = this.store.settings();
        const saved = this.store.get('players', []);
        this.players = (Array.isArray(saved) && saved.length ? saved.slice(0, 16) : [{ name: 'PLAYER 1', country: 'POL', team: 'POLAND' }]).map(normalizePlayer);
        this.playerIndex = 0;
        this.practiceLog = [];
        this.readyRound = null;
        this.view = 'main';
        this.clock = new FixedClock(120);
        this.lastTime = 0;
        this.seed = (Date.now() % 1000000) >>> 0;
        this.turnToken = 0;
        this.replayBack = 'replays';
        this.lastHill = this.store.get('lastHill', 'fin');
        try {
            getHill(this.lastHill);
        }
        catch {
            this.lastHill = 'fin';
        }
        this.touch = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
        this.arena = $('#arena'); this.arena.dataset.presentation = this.settings.presentation;
        this.menu = $('#menu-layer');
        this.content = $('#menu-content');
        this.audio = new SkiAudio(this.settings);
        this.renderer = new SkiRenderer($('#scene-host'), this.settings);
        this.hud = new JumpHUD($('#hud'));
        this.input = new SkiInput(this.arena, { phase: () => this.sim?.state.phase, action: k => this.gameAction(k), lean: d => this.sim?.control(d), unlock: () => this.audio.unlock() }, this.settings);
        drawLogo($('#logo'));
        this.bind();
        this.setHill(this.lastHill);
        this.showMain();
        this.resize();
        this.renderer.ready.then(() => { this.updateBackend(); this.resize(); }).catch(e => this.showError(e));
        this.frameId = requestAnimationFrame(t => this.frame(t));
        if (new URLSearchParams(location.search).has('debug'))
            globalThis.__SKI_DEBUG__ = this;
        globalThis.SkiJumpWeb = { version: '0.3.0', hills: HILLS.map(h => ({ ...h })), practice: id => this.startPractice(id), diagnostics: () => this.renderer.diagnostics(), getState: () => this.sim?.snapshot() || null };
        if (location.protocol !== 'file:' && 'serviceWorker' in navigator)
            navigator.serviceWorker.register('./sw.js').catch(() => { });
    }
    bind() {
        this.menu.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (!b || b.disabled)
            return; this.audio.unlock(); this.audio.play('menu'); this.act(b.dataset.action, b).catch?.(e => this.showError(e)); });
        this.menu.addEventListener('change', e => { try { this.change(e); } catch (error) { this.showError(error); } });
        document.querySelectorAll('[data-game]').forEach(b => { b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); this.audio.unlock(); this.gameAction(b.dataset.game); }); b.addEventListener('click', e => { if (e.detail === 0)
            this.gameAction(b.dataset.game); }); });
        this.virtualPointers = new Map();
        document.querySelectorAll('[data-mouse]').forEach(b => {
            b.addEventListener('pointerdown', e => {
                e.stopPropagation(); e.preventDefault(); if (!this.input.enabled) return;
                b.setPointerCapture(e.pointerId); this.virtualPointers.set(e.pointerId, b.dataset.mouse);
                this.input.virtualButton(b.dataset.mouse, true);
            });
            const release = e => {
                e.stopPropagation(); e.preventDefault(); const side = this.virtualPointers.get(e.pointerId);
                this.virtualPointers.delete(e.pointerId);
                if (side && ![...this.virtualPointers.values()].includes(side)) this.input.virtualButton(side, false);
            };
            for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(event, release);
        });
        document.querySelectorAll('[data-replay]').forEach(b => b.addEventListener('click', () => this.replayAction(b.dataset.replay)));
        $('#replay-speed').addEventListener('change', e => { if (this.playback)
            this.playback.speed = Number(e.target.value); });
        $('#replay-seek').addEventListener('input', e => { if (this.playback)
            this.playback.seek(Number(e.target.value) / 1000 * this.playback.duration); });
        $('#file-import').addEventListener('change', async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f)
            return; try {
            if (f.size > 5000000)
                throw new Error('The file exceeds the 5 MB limit.');
            const text = await f.text();
            if (this.importKind === 'save') {
                this.store.importData(text);
                this.settings = this.store.settings();
                const p = this.store.get('players', []);
                this.players = (p.length ? p : [{}]).slice(0, 16).map(normalizePlayer);
                this.applySettings();
                this.showMain();
                this.toast('Saved settings, players and records imported.');
            }
            else if (this.importKind === 'tour') {
                const tour = TourSchedule.parse(text); this.store.saveTour(tour);
                this.tour = tour; this.selectedHills = new Set(tour.hills); this.setupPreset = 'custom'; this.showTourEditor();
            }
            else {
                const replay = parseReplay(text);
                this.store.saveReplay(replay);
                this.showReplays();
                this.toast('Replay imported.');
            }
        }
        catch (error) {
            this.showError(error);
        } });
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('fullscreenchange', () => this.resize());
        document.addEventListener('visibilitychange', () => { if (document.hidden) {
            if (this.view === 'game')
                this.pause();
            this.audio.suspend();
        } this.lastTime = 0; this.clock.reset(); });
        window.addEventListener('keydown', e => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName))
                return;
            if (this.view === 'replay') {
                const keys = { ArrowLeft: 'frame-back', ArrowRight: 'frame-next', Home: 'start', End: 'end', KeyT: 'takeoff', KeyL: 'landing', KeyC: 'camera' };
                if (keys[e.code]) { e.preventDefault(); this.replayAction(keys[e.code]); return; }
                if (e.code === 'Space') {
                    e.preventDefault();
                    this.replayAction('play');
                }
                if (e.code === 'Escape')
                    this.replayAction('back');
                return;
            }
            if (this.view === 'game') {
                if (this.cpu && ['Space', 'Escape', 'KeyP'].includes(e.code)) {
                    e.preventDefault(); this.gameAction(e.code === 'Space' ? 'skip-cpu' : 'pause');
                }
                return;
            }
            if (e.code === 'Escape') {
                e.preventDefault();
                if (['tour'].includes(this.view)) { this.selectedHills = new Set(this.tour.hills); this.renderSetup(); }
                else if (['live-results', 'cup-history', 'history-event', 'team-details'].includes(this.view)) this.showStartList();
                else if (this.view === 'pause')
                    this.resume();
                else if (this.view === 'result')
                    this.mode === 'practice' ? this.showHills() : this.showStartList();
                else
                    this.showMain();
            }
            if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
                const buttons = [...this.content.querySelectorAll('button:not(:disabled),select,input')];
                const i = buttons.indexOf(document.activeElement);
                if (buttons.length) {
                    e.preventDefault();
                    buttons[(i + (e.code === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
                }
            }
            if (e.code === 'Enter' && e.target === document.body) {
                if (this.view === 'main')
                    this.showHills();
                else if (this.view === 'result')
                    this.nextJump();
            }
        });
        window.addEventListener('pagehide', () => { this.saveCup(); this.savePlayers(); });
    }
    resize() { const portrait = innerHeight > innerWidth * 1.08; this.arena.classList.toggle('portrait', portrait); const r = this.arena.getBoundingClientRect(), mw = portrait ? 360 : 640, scale = Math.min(r.width / mw, portrait ? 10 : r.height / 400), mh = portrait ? r.height / scale : 400; this.menu.style.setProperty('--menu-width', `${mw}px`); this.menu.style.setProperty('--menu-height', `${mh}px`); this.menu.style.setProperty('--ui-scale', String(scale)); this.renderer.resize(); this.clock.reset(); }
    updateBackend() { const d = this.renderer.diagnostics(); $('#renderer-name').textContent = `${d.backend.toUpperCase()} / ${d.resolution.join('X')}`; $('#footer-left').textContent = this.store.persistent ? '32 HILLS / LOCAL HOT-SEAT' : 'LOCAL STORAGE UNAVAILABLE / IN-MEMORY'; }
    setHill(id) { const hill = typeof id === 'string' ? getHill(id) : id; this.hill = hill; this.profile = new HillProfile(hill); const record = this.store.records()[this.store.recordKey(hill.id, this.settings.assist, this.settings.rules)]?.distance || 0; this.hillRecordKey = this.store.recordKey(hill.id, this.settings.assist, this.settings.rules); this.renderer.setHill(this.profile, record); this.idle = new JumpSimulation(this.profile).snapshot(); this.lastHill = hill.id; this.store.set('lastHill', hill.id); }
    openMenu(view, title, html) { this.view = view; this.menu.dataset.view = view; this.input.setEnabled(false); this.virtualPointers?.clear(); this.menu.hidden = false; this.arena.classList.add('menu-open'); $('#game-toolbar').hidden = true; $('#touch-controls').hidden = true; $('#replay-controls').hidden = true; $('#menu-heading').innerHTML = title ? `<span data-pixel="${esc(title)}" data-color="#f2bf4c"></span>` : ''; this.content.innerHTML = html; this.content.scrollTop = 0; paintLabels(this.menu); this.audio.update(null, true); this.updateBackend(); }
    hideMenu(view = 'game') { this.view = view; this.menu.hidden = true; this.arena.classList.remove('menu-open'); $('#game-toolbar').hidden = view !== 'game'; $('#skip-cpu').hidden = !this.cpu; $('#touch-controls').hidden = view !== 'game' || !this.touch; $('#replay-controls').hidden = view !== 'replay'; this.input.setEnabled(view === 'game' && !this.cpu); this.clock.reset(); this.lastTime = 0; }
    showMain() {
        this.turnToken++; this.paused = false;
        const cup = this.store.get('cup'), stats = this.store.stats(), classic = this.settings.presentation === 'classic';
        const original = pixelBtn('world', 'WORLD CUP') + pixelBtn('team', 'TEAM CUP') + pixelBtn('practice', 'PRACTICE') + pixelBtn('records', 'HILL RECORDS') + pixelBtn('replays', 'REPLAY STUDIO') + pixelBtn('sound', 'SOUND SETUP') + pixelBtn('quit', 'QUIT');
        const extended = `${cup ? pixelBtn('continue-cup', 'CONTINUE CUP') : ''}${pixelBtn('world', 'WORLD CUP')}${pixelBtn('team', 'TEAM CUP')}${pixelBtn('practice', 'PRACTICE')}${pixelBtn('players', 'PLAYERS')}${pixelBtn('records', 'HILL RECORDS')}${pixelBtn('replays', 'REPLAYS')}${pixelBtn('options', 'OPTIONS')}${pixelBtn('help', 'HOW TO JUMP')}`;
        this.openMenu('main', classic ? 'MAIN MENU' : '', `<nav class="main-menu" aria-label="Main menu">${classic ? original : extended}</nav>${classic ? `<div class="classic-extensions" aria-label="Browser extensions">${cup ? btn('continue-cup','CONTINUE CUP') : ''}${btn('players','PLAYERS')}${btn('options','OPTIONS')}${btn('help','HOW TO JUMP')}</div>` : `<aside class="main-side">${stats.jumps} JUMPS / ${stats.landings} LANDED<br>ENGLAND K50 - SLOVENIA K250<br>NO DOWNLOADS. NO SIGN-IN.</aside>`}`);
    }
    showSound() {
        const s = this.settings;
        this.openMenu('sound', 'SOUND SETUP', `<div class="sound-setup"><p class="hint">WEB AUDIO / PROCEDURAL STEREO<br>Browser audio replaces DOS device, port and DMA configuration.</p><label class="field">VOLUME<input data-setting="volume" type="range" min="0" max="1" step=".05" value="${s.volume}"></label><label class="check"><input type="checkbox" data-setting="mute" ${s.mute ? 'checked' : ''}>MUTE SOUND</label><div class="buttons">${btn('sound-test','TEST SOUND')}${btn('main','DONE','small-button primary')}</div></div>`);
    }
    quit() {
        this.saveCup(); this.audio.suspend();
        this.openMenu('quit', 'SKIJUMPWEB', `<div class="empty">SESSION SAVED.<br>Close this browser tab to exit.</div><div class="buttons">${btn('main','RETURN TO GAME','small-button primary')}</div>`);
    }
    showHills(filter = 'all') {
        this.hillFilter = filter;
        const records = this.store.records(), list = HILLS.filter(h => filter === 'all' || (filter === 'small' ? h.k <= 100 : filter === 'large' ? h.k > 100 && h.k < 180 : h.k >= 180));
        this.openMenu('hills', 'SELECT HILL TO PRACTICE', `<div class="toolbar"><label>HILLS <select id="hill-filter">${[['all', 'ALL 32'], ['small', 'K50 - K100'], ['large', 'K105 - K170'], ['flying', 'SKI FLYING']].map(([v, t]) => option(v, t, filter)).join('')}</select></label><label>JUMPER <select id="practice-player">${this.players.map((p, i) => option(i, p.name, this.playerIndex)).join('')}</select></label>${btn('random-hill', 'RANDOM')}</div><div class="hill-grid">${list.map(h => { const r = records[this.store.recordKey(h.id, this.settings.assist, this.settings.rules)]; return `<button class="hill-button" data-action="hill" data-id="${h.id}" data-selected="${h.id === this.lastHill}" aria-label="${esc(h.name)} K${h.k}"><span data-pixel="${esc(h.name)}" data-size="1"></span><span class="hill-sub"><span>${h.code}</span><span class="pb">${r ? r.distance.toFixed(2) + ' M' : 'NO RECORD'}</span><span class="hill-k">K${h.k}</span></span></button>`; }).join('')}</div><div class="buttons">${btn('main', 'BACK')}${btn('help', 'CONTROLS')}<span class="hint">Every hill is unlocked.</span></div>`);
    }
    startPractice(id = this.lastHill, sameSeed = false) { this.turnToken++; this.cup = null; this.mode = 'practice'; if (!sameSeed)
        this.seed = (this.seed + 7919) >>> 0; this.practiceSeed = this.seed; this.launchJump(getHill(id), this.players[this.playerIndex] || this.players[0], { rules: this.settings.rules, seed: this.seed, windStrength: this.settings.windBase === null ? this.settings.windStrength : 0, windBase: this.settings.windBase, gate: this.settings.gate, assist: this.settings.assist }); }
    launchJump(hill, player, options, cpu = false) {
        if (this.hill?.id !== hill.id || this.hillRecordKey !== this.store.recordKey(hill.id, !!options.assist, options.rules)) {
            this.setHill(hill);
            this.hillRecordKey = this.store.recordKey(hill.id, !!options.assist, options.rules);
            this.renderer.setHill(this.profile, this.store.records()[this.hillRecordKey]?.distance || 0);
        }
        this.input.reset(); this.virtualPointers.clear();
        this.player = player;
        this.sim = new JumpSimulation(this.profile, options);
        this.recorder = new ReplayRecorder(this.sim, player);
        this.cpu = cpu ? new CPUController(options.seed, player.skill) : null;
        this.needsFinish = false;
        this.paused = false;
        this.lastPhase = '';
        this.ghostPlayer = null;
        if (this.mode === 'practice' && this.settings.ghost) {
            const g = this.store.ghost(hill.id, !!options.assist, options.rules);
            if (g)
                this.ghostPlayer = new ReplayPlayer(g);
        }
        for (const name of ['start', 'takeoff', 'land', 'crash'])
            this.sim.events.on(name, r => { this.audio.play(name); if (this.settings.haptics && navigator.vibrate && ['takeoff', 'land', 'crash'].includes(name))
                navigator.vibrate(name === 'crash' ? [45, 30, 45] : 18); if (name === 'land' || name === 'crash')
                $('#live-status').textContent = `${name === 'crash' ? 'Fall.' : 'Landed.'} ${r.distance.toFixed(2)} metres. ${r.total.toFixed(1)} points.`; });
        this.sim.events.on('disqualified', () => { $('#live-status').textContent = 'Disqualified. The 15-second start window expired.'; });
        this.sim.events.on('finish', () => this.needsFinish = true);
        this.renderer.cameraReady = false;
        this.hideMenu();
        this.input.calibrate();
        this.clock.reset();
        this.refreshTouch();
        this.audio.unlock();
    }
    refreshTouch() {
        $('#classic-pads').hidden = this.settings.control !== 'classic' || this.sim?.options.rules !== 'dsj210'; const phase = this.sim?.state.phase || 'gate'; $('#touch-main').textContent = phase === 'gate' ? 'START' : phase === 'inrun' ? 'JUMP' : phase === 'flight' ? 'TELEMARK' : 'FINISH'; $('#touch-safe').disabled = phase !== 'flight'; $('#drag-tip').innerHTML = phase === 'flight' ? 'DRAG UP / DOWN<br>TO BALANCE' : phase === 'inrun' ? 'WAIT FOR THE LIP<br>THEN TAP JUMP' : 'HOLD WITH BOTH HANDS'; }
    gameAction(action) {
        if (action === 'skip-cpu') {
            if (this.view === 'game' && this.cpu && this.cup) {
                // Finish the current simulation, not a fresh CPU run: observed and skipped outcomes agree.
                let steps = 0;
                while (this.sim.state.phase !== 'finished' && steps++ < 14400) {
                    this.cpu.update(this.sim, FIXED_DT); this.sim.step(FIXED_DT); this.recorder.capture();
                }
                if (this.sim.state.phase !== 'finished') throw new Error('CPU jump exceeded simulation budget');
                this.finishJump();
            }
            return;
        }
        if (action === 'fullscreen') {
            this.fullscreen();
            return;
        }
        if (action === 'mute') {
            this.settings.mute = !this.settings.mute;
            this.applySettings();
            return;
        }
        if (action === 'camera') {
            this.cycleCamera();
            return;
        }
        if (action === 'pause') {
            if (this.view === 'pause')
                this.resume();
            else if (this.view === 'game')
                this.pause();
            return;
        }
        if (this.view !== 'game' || this.paused || this.cpu)
            return;
        if (action === 'retry') {
            if (this.mode === 'practice')
                this.startPractice(this.lastHill, true);
            else
                this.toast('Retry is available in practice. Cup jumps count once.');
            return;
        }
        if (action === 'primary') {
            const p = this.sim.state.phase;
            action = p === 'gate' ? 'start' : p === 'inrun' ? 'takeoff' : 'telemark';
        }
        this.sim.command(action);
        this.refreshTouch();
    }
    pause() { if (this.view !== 'game')
        return; this.paused = true; this.openMenu('pause', 'GAME PAUSED', `<nav class="main-menu pause-menu">${pixelBtn('resume', 'CONTINUE JUMP')}${this.mode === 'practice' ? pixelBtn('retry', 'RETRY JUMP') : ''}${pixelBtn('pause-options', 'OPTIONS')}${pixelBtn('pause-help', 'CONTROLS')}${pixelBtn('quit-jump', 'RETURN TO MENU')}</nav><p class="hint" style="text-align:center;margin-top:20px">The simulation and wind are frozen.</p>`); }
    resume() { this.paused = false; this.hideMenu(); this.audio.unlock(); }
    finishJump() {
        this.needsFinish = false;
        this.lastReplay = this.recorder.finish();
        this.lastResult = this.sim.result;
        this.lastPlayer = this.player;
        this.lastWasCPU = !!this.cpu;
        if (this.mode === 'practice' && !this.cpu) {
            this.practiceLog.unshift({ ...this.lastResult, name: this.player.name });
            this.practiceLog.length = Math.min(this.practiceLog.length, 50);
        }
        this.newRecord = false;
        if (!this.cpu) {
            this.store.addJump(this.lastResult);
            this.newRecord = this.store.updateRecord(this.lastResult, this.player, this.lastReplay);
            if (this.newRecord)
                this.audio.play('record');
        }
        let transition = 'turn';
        if (this.mode !== 'practice' && this.cup) {
            transition = this.cup.submit(this.lastResult);
            this.saveCup();
        }
        if (this.cpu) {
            this.proceedTurn(transition === 'round').catch(e => this.showError(e));
            return;
        }
        this.showResult();
    }
    showResult() {
        const r = this.lastResult;
        if (!r) {
            this.showHills();
            return;
        }
        const style = r.disqualified ? 'DISQUALIFIED / START TIME EXCEEDED' : r.crashed ? 'FALL' : r.landing === 'telemark' ? 'TELEMARK' : 'TWO-FOOT LANDING';
        this.openMenu('result', `${this.lastPlayer.name} / ${getHill(r.hillId).name}`, `<div class="result-top"><div class="jump-distance"><span data-pixel="${r.distance.toFixed(2)} M" data-size="4"></span><p class="${r.crashed ? 'bad' : 'good'}" style="font-size:11px">${style}${r.assisted ? ' / ASSISTED PRACTICE' : ''}</p></div><div class="points-big">${r.total.toFixed(1)}<small>TOTAL POINTS</small></div></div>${this.newRecord ? '<div class="new-record">NEW LOCAL HILL RECORD!</div>' : ''}<div class="judge-marks">${r.judges.map((j, i) => `<div class="judge ${r.counted.includes(i) ? '' : 'dropped'}"><small>JUDGE ${i + 1}</small>${j.toFixed(1)}</div>`).join('')}</div><div class="result-meta"><div>DISTANCE<strong>${r.distancePoints.toFixed(1)} PTS</strong></div><div>STYLE<strong>${r.stylePoints.toFixed(1)} PTS</strong></div><div>TAKEOFF<strong>${Math.round(r.takeoffQuality * 100)}%</strong></div><div>WIND<strong>${r.wind.toFixed(1)} M/S</strong></div></div><p class="hint">${r.disqualified ? 'The 15-second green-light window expired. This jump scores zero and cannot become a hill record.' : r.crashed ? (r.landing === 'none' ? 'Prepare your landing before touching the snow. Use Z / X or the touch landing buttons.' : 'A hard impact, late landing or unstable body position caused the fall. Try a two-foot landing.') : r.takeoffQuality < .6 ? 'Jump closer to the lip for a stronger takeoff.' : 'The highest and lowest judge marks are discarded.'}</p><div class="buttons">${btn('next-jump', this.mode === 'practice' ? 'JUMP AGAIN' : 'CONTINUE CUP', 'small-button primary')}${btn('last-replay', 'REPLAY')}${btn('save-last-replay', 'SAVE REPLAY')}${this.mode === 'practice' ? btn('practice', 'HILLS') + btn('session', 'SESSION') + btn('retry', 'SAME WIND') : btn('cup-table', 'STANDINGS')}${btn('main', 'MENU')}</div>`);
    }
    nextJump() { if (this.mode === 'practice')
        this.startPractice(this.lastHill);
    else
        this.proceedTurn().catch(e => this.showError(e)); }
    showPlayers(index = this.playerIndex) { this.playerIndex = clamp(index, 0, this.players.length - 1); const p = this.players[this.playerIndex]; this.openMenu('players', 'PLAYERS / UP TO 16 HOT-SEAT', `<div class="player-editor"><div><div class="player-list">${this.players.map((p, i) => `<button class="player-row ${i === this.playerIndex ? 'active' : ''}" data-action="edit-player" data-index="${i}"><span class="swatch" style="background:${p.suit}"></span>${esc(p.name)}</button>`).join('')}</div><div class="buttons">${btn('add-player', 'ADD', 'small-button', this.players.length >= 16 ? 'disabled' : '')}${btn('delete-player', 'REMOVE', 'small-button', this.players.length <= 1 ? 'disabled' : '')}</div></div><div class="form-grid"><label class="field full">NAME<input id="player-name" maxlength="22" value="${esc(p.name)}"></label><label class="field">COUNTRY<select id="player-country">${countries.map(([c, n]) => option(c, n, p.country)).join('')}</select></label><label class="field">TEAM NAME<input id="player-team" maxlength="20" value="${esc(p.team)}"></label><label class="field">SUIT<input id="player-suit" type="color" value="${p.suit}"></label><label class="field">HELMET<input id="player-helmet" type="color" value="${p.helmet}"></label><label class="field">SKIS<input id="player-skis" type="color" value="${p.skis}"></label><p class="hint">Matching team names group up to four human jumpers. Empty team positions are filled by CPU jumpers.</p></div></div><div class="buttons">${btn('save-players', 'SAVE & BACK', 'small-button primary')}${btn('practice', 'PRACTICE')}</div>`); }
    flushPlayer() { if (this.view !== 'players')
        return; const read = id => $(id)?.value; this.players[this.playerIndex] = normalizePlayer({ ...this.players[this.playerIndex], name: read('#player-name'), country: read('#player-country'), team: read('#player-team'), suit: read('#player-suit'), helmet: read('#player-helmet'), skis: read('#player-skis') }, this.playerIndex); this.savePlayers(); }
    savePlayers() { this.store.set('players', this.players); }
    showSetup(mode) {
        this.setupMode = mode; this.setupAI = mode === 'team' ? 7 : this.settings.aiCount;
        this.tour = new TourSchedule(TOUR_PRESETS['Original eight'], 'Original eight');
        this.selectedHills = new Set(this.tour.hills); this.setupPreset = 'Original eight'; this.renderSetup();
    }
    renderSetup() { const mode = this.setupMode; this.openMenu('setup', mode === 'team' ? 'TEAM CUP / SELECT HILLS' : 'WORLD CUP / SELECT HILLS', `<div class="setup-top"><label class="field">TOUR<select id="tour-preset">${Object.keys(TOUR_PRESETS).map(n => option(n, n, this.setupPreset)).join('')}${option('custom', 'Custom selection', this.setupPreset)}</select></label><label class="field">${mode === 'team' ? 'CPU TEAMS' : 'CPU JUMPERS'}<select id="cup-ai">${(mode === 'team' ? [0, 3, 7, 11] : [0, 7, 15, 31, 49]).map(n => option(n, n, this.setupAI)).join('')}</select></label></div><div class="toolbar"><span>${this.players.length} HUMAN PLAYER${this.players.length > 1 ? 'S' : ''}</span>${btn('players', 'EDIT PLAYERS')}${btn('select-all', 'ALL HILLS')}${btn('select-none', 'CLEAR')}${btn('edit-tour', 'ORDER / REPEAT')}</div><div class="check-grid">${HILLS.map(h => `<label class="check"><input type="checkbox" data-hill="${h.id}" ${this.selectedHills.has(h.id) ? 'checked' : ''}>${h.code} K${h.k}</label>`).join('')}</div><p class="hint">${mode === 'team' ? 'Four jumpers per team. Two rounds, top eight teams qualify.' : 'Two rounds per hill. Top 30 (including ties) qualify for the final.'} Final round in reverse score order. Cups are saved automatically.</p><div class="buttons">${btn('start-cup', 'START CUP', 'small-button primary')}${btn('main', 'BACK')}</div>`); }
    async startCup() {
        const hills = [...this.tour.hills];
        if (!hills.length)
            throw new Error('Select at least one hill.');
        const ai = this.setupAI;
        let players, teams = null;
        if (this.setupMode === 'team') {
            teams = createTeams(this.players, ai, this.settings.difficulty);
            players = teams.flatMap(t => t.members);
        }
        else
            players = createField(this.players, ai, this.settings.difficulty);
        this.mode = this.setupMode;
        this.cup = new Competition({ mode: this.mode, hills, players, teams, seed: (this.seed + 10243) >>> 0, rules: this.settings.rules, windStrength: this.settings.windStrength });
        this.saveCup();
        await this.proceedTurn();
    }
    saveCup() { if (this.cup) {
        if (this.cup.status === 'finished')
            this.store.remove('cup');
        else
            this.store.set('cup', this.cup.serialize());
    } }
    async continueCup() { const text = this.store.get('cup'); if (!text)
        throw new Error('There is no saved cup.'); try {
        this.cup = Competition.restore(text);
    }
    catch (e) {
        this.store.remove('cup');
        throw e;
    } this.mode = this.cup.mode; await this.proceedTurn(); }
    async proceedTurn(showList = true) {
        if (!this.cup) {
            this.showMain();
            return;
        }
        if (this.cup.status === 'event-complete') { this.showEvent(); return; }
        if (this.cup.status === 'finished') { this.showCupStandings(true); return; }
        if (showList && this.cup.status === 'running') { this.showStartList(); return; }
        const ticket = ++this.turnToken, cup = this.cup;
        let processed = 0;
        this.openMenu('loading', 'CUP IN PROGRESS', `<div class="loading">${esc(cup.hill.name)} K${cup.hill.k}<br><span class="muted">SIMULATING CPU JUMPERS...</span></div>`);
        await new Promise(r => setTimeout(r, 0));
        while (cup.status === 'running' && cup.current() && !cup.current().human && !this.settings.watchCPU) {
            if (ticket !== this.turnToken)
                return;
            const transition = cup.submit(cup.cpuResult());
            processed++;
            if (transition === 'round') { this.saveCup(); this.showStartList(); return; }
            if (processed % 4 === 0)
                await new Promise(r => setTimeout(r, 0));
        }
        if (ticket !== this.turnToken)
            return;
        this.saveCup();
        if (cup.status === 'event-complete') {
            this.showEvent();
            return;
        }
        if (cup.status === 'finished') {
            this.showCupStandings(true);
            return;
        }
        const p = cup.current();
        this.launchJump(cup.hill, p, cup.options(), !p.human);
    }
    resultTable(rows, team = false) { return `<div class="table-wrap"><table><thead><tr><th>#</th><th>${team ? 'TEAM' : 'JUMPER'}</th>${team ? '' : '<th class="num">ROUND 1</th><th class="num">ROUND 2</th>'}<th class="num">POINTS</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.human || r.members?.some(p => p.human) ? 'you' : ''}"><td>${r.rank}</td><td>${esc(r.name)}${team && r.members ? btn('team-details', 'DETAILS', 'small-button tiny', `data-id="${esc(r.id)}"`) : ''}</td>${team ? '' : (r.jumps || [null, null]).map(j => `<td class="num">${j ? j.disqualified ? 'DSQ' : j.distance.toFixed(2) + (j.crashed ? ' F' : '') : '-'}</td>`).join('')}<td class="num">${r.total.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>`; }
    showEvent() { const c = this.cup; this.openMenu('event', `${c.hill.name} / EVENT ${c.eventIndex + 1} OF ${c.hills.length}`, `${this.resultTable(c.rows(), c.mode === 'team')}<div class="buttons">${btn('next-event', c.eventIndex + 1 < c.hills.length ? 'NEXT HILL' : 'FINAL STANDINGS', 'small-button primary')}${btn('cup-table', 'CUP STANDINGS')}${btn('main', 'SAVE & EXIT')}</div>`); }
    showCupStandings(final = false) { const c = this.cup; if (!c)
        return; this.standingsBack = final ? 'main' : c.status === 'event-complete' ? 'event' : 'result'; this.openMenu('standings', final ? 'FINAL CUP STANDINGS' : 'CUP STANDINGS', `${this.resultTable(c.standings(), true)}<p class="hint">${c.history.length} OF ${c.hills.length} EVENTS COMPLETE. ${c.mode === 'team' && c.rules === 'dsj210' ? 'Team points: 200, 160, 120, 100.' : 'Points: 100, 80, 60, 50, 45 ... down to 1.'}</p><div class="buttons">${btn('standings-back', final ? 'MAIN MENU' : 'BACK', 'small-button primary')}${btn('export-cup', 'EXPORT RESULTS')}${btn('export-csv', 'CSV')}${btn('cup-history', 'EVENT HISTORY')}</div>`); }
    showRecords() {
        const records = this.store.records(), assisted = !!this.recordsAssisted, classic = this.settings.presentation === 'classic';
        this.recordPage = Math.floor(clamp(this.recordPage || 0, 0, 3));
        let sum = 0, count = 0;
        for (const hill of HILLS) { const r = records[this.store.recordKey(hill.id, assisted, this.settings.rules)]; if (r) { sum += r.distance; count++; } }
        const selected = classic ? HILLS.slice(this.recordPage * 8, this.recordPage * 8 + 8) : HILLS;
        const rows = selected.map(h => { const r = records[this.store.recordKey(h.id, assisted, this.settings.rules)];
            if (classic) return `<button class="classic-record" data-action="hill-records" data-id="${h.id}"><span data-pixel="${esc(h.name)}" data-color="#49d8d1"></span><span data-pixel="K${h.k}:" data-color="#49d8d1"></span><span data-pixel="${r ? r.distance.toFixed(1) + 'M' : '-'}"></span></button>`;
            return `<tr><td><button class="table-link" data-action="hill-records" data-id="${h.id}">${esc(h.name)}</button></td><td>K${h.k}</td><td class="num">${r ? r.distance.toFixed(2) : '-'}</td><td>${r ? esc(r.name) : '-'}</td><td class="num">${r ? Number(r.total || 0).toFixed(1) : '-'}</td></tr>`;
        }).join('');
        const content = classic ? `<div class="classic-records"><span class="record-page" data-pixel="PAGE ${this.recordPage + 1}/4"></span>${rows}</div><div class="classic-record-nav">${pixelBtn('records-next','NEXT PAGE')}${pixelBtn('records-reset','RESET HILL RECORDS')}${pixelBtn('main','BACK')}</div>` : `<div class="table-wrap"><table><thead><tr><th>HILL</th><th>K</th><th class="num">METRES</th><th>JUMPER</th><th class="num">POINTS</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        this.openMenu('records', classic ? 'HILL RECORDS' : 'LOCAL HILL RECORDS', `${content}${classic ? '<details class="classic-record-tools"><summary>BROWSER / BOARD OPTIONS</summary>' : ''}<div class="toolbar record-extensions"><label class="check"><input id="records-assisted" type="checkbox" ${assisted ? 'checked' : ''}>ASSISTED PRACTICE</label><span>${count}/32 HILLS / TOTAL ${sum.toFixed(2)} M</span></div><div class="buttons record-extensions">${classic ? '' : btn('main','BACK')}${btn('personal-records','PERSONAL TOTALS')}${btn('export-save','EXPORT SAVE')}${btn('import-save','IMPORT SAVE')}</div><p class="hint record-extensions">Local records only. Rules profiles and assisted records have separate boards. Reset applies only to the selected board.</p>${classic ? '</details>' : ''}`);
    }
    confirmResetRecords() {
        this.openMenu('reset-records', 'RESET HILL RECORDS', `<div class="empty">RESET ALL 32 HILL RECORDS FOR THIS BOARD?<br>${this.settings.rules.toUpperCase()} / ${this.recordsAssisted ? 'ASSISTED' : 'UNASSISTED'}<br>Other rules and replay-library entries are preserved.</div><div class="buttons">${btn('records','CANCEL','small-button primary')}${btn('records-reset-confirm','RESET THIS BOARD')}</div>`);
    }
    showReplays() { const list = this.store.replays(); this.openMenu('replays', 'REPLAYS', `${list.length ? list.map(r => `<div class="replay-row"><div class="replay-info">${esc(r.label || r.name)} / ${getHill(r.hillId).name} K${getHill(r.hillId).k}<small>${r.distance.toFixed(2)} M / ${esc(r.date.slice(0, 10))}</small></div>${btn('play-replay', 'PLAY', 'small-button', `data-id="${r.id}"`)}${btn('export-replay', 'EXPORT', 'small-button', `data-id="${r.id}"`)}${btn('rename-replay', 'NAME', 'small-button', `data-id="${r.id}"`)}${btn('delete-replay', 'DELETE', 'small-button', `data-id="${r.id}"`)}</div>`).join('') : '<div class="empty">NO SAVED REPLAYS YET.<br>Finish a jump, then choose SAVE REPLAY.<br>Playback supports seeking, slow motion and four cameras.</div>'}<div class="buttons">${btn('import-replay', 'IMPORT REPLAY')}${this.lastReplay ? btn('last-replay', 'LAST JUMP') : ''}${btn('main', 'BACK')}</div><p class="hint">SkiJumpWeb .sjr.json format. Original DSJ2 .rpl files are not compatible.</p>`); }
    startReplay(replay, back = 'replays') { this.playback = new ReplayPlayer(replay); this.replayBack = back; this.cpu = null; this.setHill(replay.hillId); this.player = replay.player; this.renderer.cameraReady = false; this.hideMenu('replay'); this.audio.update(null, true); $('#replay-speed').value = '1'; $('#replay-play').textContent = 'II'; $('#replay-loop').textContent = 'LOOP ON'; }
    replayAction(action) {
        if (this.playback) {
            if (action === 'frame-back' || action === 'frame-next') this.playback.stepFrame(action === 'frame-back' ? -1 : 1);
            if (['start', 'end', 'takeoff', 'landing'].includes(action)) this.playback.jumpTo(action);
            if (action === 'loop') { this.playback.loop = !this.playback.loop; $('#replay-loop').textContent = this.playback.loop ? 'LOOP ON' : 'LOOP OFF'; }
            if (action === 'flight-loop') { this.playback.setLoop(this.playback.flightStart, this.playback.runoutStart); this.playback.loop = true; this.playback.seek(this.playback.flightStart); $('#replay-loop').textContent = 'FLIGHT LOOP'; }
            if (action === 'whole-loop') { this.playback.setLoop(); $('#replay-loop').textContent = this.playback.loop ? 'LOOP ON' : 'LOOP OFF'; }
            $('#replay-play').textContent = this.playback.paused ? 'PLAY' : 'II';
            $('#replay-seek').value = String(Math.round(this.playback.time / this.playback.duration * 1000));
        }
        if (!this.playback)
        return; if (action === 'back') {
        this.playback = null;
        if (this.replayBack === 'result')
            this.showResult();
        else if (this.replayBack === 'records') this.showRecords();
        else
            this.showReplays();
    } if (action === 'play') {
        this.playback.paused = !this.playback.paused;
        $('#replay-play').textContent = this.playback.paused ? 'PLAY' : 'II';
    } if (action === 'camera')
        this.cycleCamera(); if (action === 'export')
        this.exportReplay(this.playback.replay); }
    exportReplay(replay) { downloadText(`${replay.hillId}-${(replay.result?.distance || 0).toFixed(2)}m.sjr.json`, serializeReplay(replay)); }
    showOptions(back = 'main') {
        this.optionsBack = back;
        const s = this.settings;
        const select = (key, label, items) => `<label class="field">${label}<select data-setting="${key}">${items.map(([v, n]) => option(v, n, s[key])).join('')}</select></label>`, check = (key, label) => `<label class="check"><input type="checkbox" data-setting="${key}" ${s[key] ? 'checked' : ''}>${label}</label>`;
        this.openMenu('options', 'OPTIONS', `<div class="form-grid">${select('rules', 'JUMPING RULES', [['dsj210', 'DSJ 2.10 DOCUMENTED RULES'], ['legacy', 'SKIJUMPWEB 0.2 LEGACY']])}${select('presentation', 'HUD / PRESENTATION', [['classic', 'ORIGINAL COMPACT HUD'], ['enhanced', 'ENHANCED / GUIDES']])}${select('resolution', 'RESOLUTION', [['classic', 'CLASSIC / 320 x 200'], ['sharp', 'SHARP / 640 x 400'], ['native', 'NATIVE / ADAPTIVE']])}${select('camera', 'CAMERA', [['classic', 'CLASSIC SIDE VIEW'], ['close', 'CLOSE'], ['wide', 'WIDE'], ['chase', 'CHASE']])}${select('control', 'MOUSE CONTROLS', [['modern', 'ONE BUTTON / KEYBOARD'], ['classic', 'CLASSIC / TWO BUTTONS']])}${select('weather', 'WEATHER', [['clear', 'CLEAR'], ['snow', 'SNOW'], ['dusk', 'DUSK'], ['night', 'NIGHT']])}<label class="field">SENSITIVITY <input data-setting="sensitivity" type="range" min=".2" max="3" step=".1" value="${s.sensitivity}"></label><label class="field">SOUND VOLUME <input data-setting="volume" type="range" min="0" max="1" step=".05" value="${s.volume}"></label>${select('difficulty', 'CPU SKILL', [[.45, 'ROOKIE'], [.65, 'CLUB'], [.8, 'EXPERT'], [.96, 'CHAMPION']])}<label class="field">PRACTICE WIND<select data-setting="windBase">${[[null, 'DYNAMIC WIND'], [0, 'CALM'], [1.5, 'HEADWIND +1.5'], [3, 'HEADWIND +3.0'], [-2, 'TAILWIND -2.0']].map(([v, n]) => option(v === null ? 'null' : v, n, s.windBase === null ? 'null' : s.windBase)).join('')}</select></label><label class="field">PRACTICE GATE (-5 HIGHER / +8 LOWER)<input data-setting="gate" type="number" min="-5" max="8" value="${s.gate}"></label>${select('renderer', 'RENDERER (RELOAD REQUIRED)', [['auto', 'WEBGPU / AUTOMATIC FALLBACK'], ['webgl', 'WEBGL2'], ['software', 'SOFTWARE']])}${check('guide', 'TAKEOFF / FLIGHT GUIDES')}${check('assist', 'FLIGHT ASSIST (PRACTICE ONLY)')}${check('ghost', 'PERSONAL-BEST GHOST')}${check('mute', 'MUTE SOUND')}${check('watchCPU', 'WATCH CPU JUMPERS')}${check('haptics', 'TOUCH VIBRATION')}${check('scanlines', 'CRT SCANLINES')}${check('showFPS', 'PERFORMANCE COUNTER')}${check('motion', 'DEVICE TILT (AFTER PERMISSION)')}<div class="field">${btn('motion', 'ENABLE / CALIBRATE TILT')}</div></div><p class="hint">Practice wind, gate and flight-assist overrides do not apply to cup jumps. Portrait resolution adapts to the screen. Audio starts after your first interaction.</p><div class="buttons">${btn('options-back', 'SAVE & BACK', 'small-button primary')}${btn('original-profile', 'DSJ 2.10 PROFILE')}${btn('reset-options', 'DEFAULTS')}${btn('about', 'ABOUT / FIDELITY')}</div>`);
    }
    applySettings() { this.arena.dataset.presentation = this.settings.presentation; this.store.saveSettings(this.settings); this.audio.setVolume(this.settings.volume, this.settings.mute); this.input.setOptions(this.settings); this.renderer.setOptions(this.settings); this.arena.classList.toggle('scanline-on', this.settings.scanlines); this.resize(); }
    showHelp(back = 'main') { this.helpBack = back; this.openMenu('help', 'HOW TO JUMP', `<div class="help-grid"><div><h3>1. START / TAKEOFF</h3><p>Click the left button or press <kbd>SPACE</kbd> to start. In the DSJ 2.10 rules profile you have 15 seconds; the green light blinks with 10 seconds remaining. Wait until the jumper reaches the end of the ramp, then press <kbd>SPACE</kbd> again. Timing makes the difference.</p><p>Classic mouse mode: press <strong>both mouse buttons together</strong> for takeoff. Modern mode also accepts a left click.</p><h3>2. FLY</h3><p>Move the mouse gently <strong>down to lean forward</strong>, up to raise the nose. Or use <kbd>UP</kbd> / <kbd>DOWN</kbd>. The optional enhanced HUD provides a balance indicator; the compact HUD does not. Too much lean sacrifices lift.</p></div><div><h3>3. LAND</h3><p>Classic mouse: press left and right together for two feet, or one then the other for telemark. Either order works; the interval changes stance width. Release both buttons after takeoff. An unfinished one-foot landing can fall. <kbd>Z</kbd>/<kbd>X</kbd> remain accessible one-action shortcuts in either profile.</p><h3>TOUCH / MOBILE</h3><p>Tap <strong>START</strong>, then <strong>JUMP</strong> at the lip. Drag up/down on the scene to balance. Tap <strong>TELEMARK</strong> or <strong>TWO FEET</strong> just before touchdown. The separate LEFT / RIGHT pads reproduce the original mouse sequence, including two-thumb takeoff and timed telemark.</p><p>Optional tilt steering is enabled and calibrated in Options. Both portrait and landscape work without restarting the jump.</p></div></div><p class="hint"><kbd>P</kbd> / <kbd>ESC</kbd> pause. <kbd>R</kbd> retry practice. <kbd>C</kbd> camera. <kbd>M</kbd> mute. <kbd>F</kbd> fullscreen. Gamepad: left stick, A to start/jump/telemark, B for two feet, Start to pause.</p><div class="buttons">${btn('help-back', 'BACK', 'small-button primary')}${btn('practice', 'CHOOSE A HILL')}</div>`); }
    showAbout() { this.openMenu('about', 'ABOUT THIS RECREATION', `<div class="help-grid"><div><h3>SKIJUMPWEB 0.4.0</h3><p>An independent implementation of the classic ski-jumping game concept. HTML, JavaScript and an actual WebGPU 3D renderer. WebGL2 and software fallback are included.</p><p>The 32 country labels, K-points and roster order match Mediamond's public DSJ2 hill list. All hills are playable.</p><h3>NEWLY AUTHORED</h3><p>The hill geometry, flight model, skier, scenery, sounds and bitmap glyphs are newly written. No original executable, assets or sound recordings are bundled.</p></div><div><h3>FIDELITY BOUNDARY</h3><p>This is not the original game, an official port, or a verified 1:1 reconstruction. Hill profiles and physics are approximations. Menus and low-resolution 3D presentation recreate the visual style rather than pixel-matching every original screen.</p><p>Original .rpl replays, original save files and Mediamond's online records service are not supported. This build uses its own local records, saves and replays.</p><h3>TECHNICAL</h3><p>120 Hz fixed-step physics. Static batched terrain. GPU snow compute. Procedural Web Audio. Ten reusable npm packages. No runtime downloads, analytics or sign-in.</p></div></div><div class="buttons">${btn('main', 'MAIN MENU')}${btn('export-diagnostics', 'EXPORT DIAGNOSTICS')}</div>`); }
    change(e) {
        if (e.target.id === 'cup-ai') { this.setupAI = Number(e.target.value); return; }
        if (e.target.id === 'tour-name') { this.tour.name = e.target.value.slice(0, 40); return; }
        const el = e.target;
        if (el.id === 'hill-filter')
            this.showHills(el.value);
        if (el.id === 'practice-player')
            this.playerIndex = Number(el.value);
        if (el.id === 'records-assisted') {
            this.recordsAssisted = el.checked;
            this.showRecords();
        }
        if (el.id === 'tour-preset') {
            this.setupPreset = el.value;
            if (TOUR_PRESETS[el.value]) {
                this.tour = new TourSchedule(TOUR_PRESETS[el.value], el.value);
                this.selectedHills = new Set(this.tour.hills);
            }
            this.renderSetup();
        }
        if (el.dataset.hill) {
            if (el.checked) {
                try { this.tour.insert(el.dataset.hill); this.selectedHills.add(el.dataset.hill); }
                catch (error) { el.checked = false; this.toast(error.message); }
            } else {
                this.tour.hills = this.tour.hills.filter(id => id !== el.dataset.hill);
                this.selectedHills.delete(el.dataset.hill);
            }
            this.setupPreset = 'custom';
            $('#tour-preset').value = 'custom';
        }
        if (el.dataset.setting) {
            const k = el.dataset.setting;
            let v = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? Number(el.value) : el.value;
            if (['difficulty'].includes(k))
                v = Number(v);
            if (k === 'windBase')
                v = v === 'null' ? null : Number(v);
            this.settings[k] = v;
            this.applySettings();
            if (k === 'renderer')
                this.toast('Renderer choice saved. Reload the page to switch backend.');
        }
    }
    async act(action, button) {
        if (this.view === 'players' && !['delete-player'].includes(action))
            this.flushPlayer();
        switch (action) {
            case 'continue-start-list': await this.proceedTurn(false); break;
            case 'start-list': this.showStartList(); break;
            case 'edit-tour': this.showTourEditor(); break;
            case 'tour-back': this.selectedHills = new Set(this.tour.hills); this.renderSetup(); break;
            case 'tour-up': this.tour.move(Number(button.dataset.index), Number(button.dataset.index) - 1); this.showTourEditor(); break;
            case 'tour-down': this.tour.move(Number(button.dataset.index), Number(button.dataset.index) + 1); this.showTourEditor(); break;
            case 'tour-remove': this.tour.remove(Number(button.dataset.index)); this.showTourEditor(); break;
            case 'tour-duplicate': this.tour.insert(this.tour.hills[Number(button.dataset.index)], Number(button.dataset.index) + 1); this.showTourEditor(); break;
            case 'tour-add': this.tour.insert($('#tour-add-hill').value); this.showTourEditor(); break;
            case 'tour-reverse': this.tour.reverse(); this.showTourEditor(); break;
            case 'tour-shuffle': this.tour.shuffle(++this.seed); this.showTourEditor(); break;
            case 'tour-save': this.tour.name = $('#tour-name').value; this.store.saveTour(this.tour); this.showTourEditor(); this.toast('Tour saved locally.'); break;
            case 'tour-load': {
                const tour = this.store.tours()[Number($('#saved-tour').value)];
                if (tour) { this.tour = new TourSchedule(tour.hills, tour.name); this.showTourEditor(); } break;
            }
            case 'tour-delete': { const tour = this.store.tours()[Number($('#saved-tour').value)]; if (tour) this.store.deleteTour(tour.name); this.showTourEditor(); break; }
            case 'tour-export': this.tour.name = $('#tour-name').value; downloadText('ski-jump-tour.json', this.tour.serialize()); break;
            case 'tour-import': this.importKind = 'tour'; $('#file-import').click(); break;
            case 'session': this.showSession(); break;
            case 'live-results': this.openMenu('live-results', 'CURRENT HILL STANDINGS', this.resultTable(this.cup.rows(), this.cup.mode === 'team') + `<div class="buttons">${btn('start-list', 'BACK')}</div>`); break;
            case 'cup-history': this.showCupHistory(); break;
            case 'history-event': this.showHistoryEvent(Number(button.dataset.index)); break;
            case 'team-details': this.showTeamDetails(button.dataset.id); break;
            case 'export-csv': downloadText('ski-jump-cup.csv', competitionCSV(this.cup), 'text/csv;charset=utf-8'); break;
            case 'personal-records': this.showPersonalRecords(); break;
            case 'hill-records': this.showHillRecords(button.dataset.id); break;
            case 'record-ghost': {
                const replay = this.store.ghost(button.dataset.id, !!this.recordsAssisted, this.settings.rules);
                if (replay) this.startReplay(replay, 'records'); else this.toast('No replay was saved for this record.'); break;
            }
            case 'rename-replay': {
                const id = button.dataset.id, row = this.store.replays().find(r => r.id === id);
                this.openMenu('rename-replay', 'REPLAY NAME', `<label class="field">NAME<input id="replay-name" maxlength="48" value="${esc(row.label || row.name)}"></label><div class="buttons">${btn('confirm-rename-replay', 'SAVE', 'small-button primary', `data-id="${esc(id)}"`)}${btn('replays', 'CANCEL')}</div>`); break;
            }
            case 'confirm-rename-replay': this.store.renameReplay(button.dataset.id, $('#replay-name').value); this.showReplays(); break;
            case 'main':
                this.showMain();
                break;
            case 'practice':
                this.showHills();
                break;
            case 'hill':
                this.startPractice(button.dataset.id);
                break;
            case 'random-hill':
                this.startPractice(new Random(this.seed++).pick(HILLS).id);
                break;
            case 'world':
                this.showSetup('world');
                break;
            case 'team':
                this.showSetup('team');
                break;
            case 'select-all':
                this.tour = new TourSchedule(HILLS.map(h => h.id), 'All 32 hills');
                this.selectedHills = new Set(this.tour.hills);
                this.setupPreset = 'All 32 hills';
                this.renderSetup();
                break;
            case 'select-none':
                this.tour = new TourSchedule(); this.selectedHills.clear();
                this.setupPreset = 'custom';
                this.renderSetup();
                break;
            case 'start-cup':
                await this.startCup();
                break;
            case 'continue-cup':
                await this.continueCup();
                break;
            case 'players':
                this.showPlayers();
                break;
            case 'edit-player':
                this.showPlayers(Number(button.dataset.index));
                break;
            case 'add-player':
                if (this.players.length < 16) {
                    this.players.push(normalizePlayer({}, this.players.length));
                    this.showPlayers(this.players.length - 1);
                }
                break;
            case 'delete-player':
                if (this.players.length > 1) {
                    this.players.splice(this.playerIndex, 1);
                    this.savePlayers();
                    this.showPlayers(Math.max(0, this.playerIndex - 1));
                }
                break;
            case 'save-players':
                this.savePlayers();
                this.showMain();
                break;
            case 'records-next':
                this.recordPage = ((this.recordPage || 0) + 1) % 4; this.showRecords(); break;
            case 'records-reset':
                this.confirmResetRecords(); break;
            case 'records-reset-confirm':
                this.store.resetRecords(!!this.recordsAssisted, this.settings.rules); this.showRecords(); break;
            case 'sound':
                this.showSound(); break;
            case 'sound-test':
                this.audio.play('land'); break;
            case 'quit':
                this.quit(); break;
            case 'records':
                this.showRecords();
                break;
            case 'replays':
                this.showReplays();
                break;
            case 'options':
                this.showOptions();
                break;
            case 'help':
                this.showHelp();
                break;
            case 'about':
                this.showAbout();
                break;
            case 'resume':
                this.resume();
                break;
            case 'retry':
                this.startPractice(this.lastHill, true);
                break;
            case 'pause-options':
                this.showOptions('pause');
                break;
            case 'pause-help':
                this.showHelp('pause');
                break;
            case 'quit-jump':
                this.saveCup();
                this.showMain();
                break;
            case 'options-back':
                this.applySettings();
                if (this.optionsBack === 'pause') {
                    this.view = 'game';
                    this.pause();
                }
                else
                    this.showMain();
                break;
            case 'help-back':
                if (this.helpBack === 'pause') {
                    this.view = 'game';
                    this.pause();
                }
                else
                    this.showMain();
                break;
            case 'original-profile':
                Object.assign(this.settings, { rules: 'dsj210', presentation: 'classic', control: 'classic', resolution: 'classic', guide: false, assist: false, ghost: false, camera: 'classic' });
                this.applySettings(); this.showOptions(this.optionsBack); break;
            case 'reset-options':
                this.settings = { ...DEFAULT_SETTINGS };
                this.applySettings();
                this.showOptions(this.optionsBack);
                break;
            case 'motion':
                await this.input.enableMotion();
                this.settings.motion = true;
                this.input.calibrate();
                this.applySettings();
                this.toast('Tilt enabled. Hold your normal playing position when the jump starts.');
                break;
            case 'next-jump':
                this.nextJump();
                break;
            case 'last-replay':
                if (this.lastReplay)
                    this.startReplay(this.lastReplay, this.view === 'result' ? 'result' : 'replays');
                break;
            case 'save-last-replay':
                if (this.lastReplay) {
                    this.store.saveReplay(this.lastReplay);
                    this.toast('Replay saved to the local replay library.');
                }
                break;
            case 'play-replay':
                this.startReplay(this.store.loadReplay(button.dataset.id));
                break;
            case 'export-replay':
                this.exportReplay(this.store.loadReplay(button.dataset.id));
                break;
            case 'delete-replay':
                this.store.deleteReplay(button.dataset.id);
                this.showReplays();
                break;
            case 'import-replay':
                this.importKind = 'replay';
                $('#file-import').click();
                break;
            case 'import-save':
                this.importKind = 'save';
                $('#file-import').click();
                break;
            case 'export-save':
                downloadText('ski-jump-web-save.json', this.store.exportData());
                break;
            case 'cup-table':
                this.showCupStandings();
                break;
            case 'standings-back':
                if (this.standingsBack === 'event')
                    this.showEvent();
                else if (this.standingsBack === 'result')
                    this.showResult();
                else
                    this.showMain();
                break;
            case 'next-event':
                if (this.cup.nextEvent()) {
                    this.saveCup();
                    await this.proceedTurn();
                }
                else {
                    this.saveCup();
                    const stats = this.store.stats();
                    stats.cups++;
                    this.store.set('stats', stats);
                    this.audio.play('win');
                    this.showCupStandings(true);
                }
                break;
            case 'export-cup':
                downloadText('ski-jump-web-cup-results.json', JSON.stringify({ mode: this.cup.mode, history: this.cup.history, standings: this.cup.standings() }, null, 2));
                break;
            case 'export-diagnostics':
                downloadText('ski-jump-web-diagnostics.json', JSON.stringify({ version: '0.3.0', ...this.renderer.diagnostics(), settings: this.settings, storagePersistent: this.store.persistent, userAgent: navigator.userAgent }, null, 2));
                break;
        }
    }
    showTourEditor() {
        this.setupPreset = 'custom';
        this.openMenu('tour', 'TOUR SCHEDULE / ORDER AND REPEAT', `<div class="toolbar"><label>NAME <input id="tour-name" maxlength="40" value="${esc(this.tour.name)}"></label><span>${this.tour.hills.length}/64 EVENTS</span></div><div class="tour-events">${this.tour.hills.map((id, i) => `<div class="tour-event"><strong>${i + 1}. ${esc(getHill(id).name)} K${getHill(id).k}</strong>${btn('tour-up', 'UP', 'small-button tiny', `data-index="${i}" ${i === 0 ? 'disabled' : ''}`)}${btn('tour-down', 'DOWN', 'small-button tiny', `data-index="${i}" ${i === this.tour.hills.length - 1 ? 'disabled' : ''}`)}${btn('tour-duplicate', '+1', 'small-button tiny', `data-index="${i}" ${this.tour.hills.length === 64 ? 'disabled' : ''}`)}${btn('tour-remove', 'X', 'small-button tiny', `data-index="${i}"`)}</div>`).join('') || '<p class="empty">ADD A HILL TO BEGIN.</p>'}</div><div class="toolbar"><select id="tour-add-hill" aria-label="Add hill">${HILLS.map(h => option(h.id, `${h.name} K${h.k}`, this.lastHill)).join('')}</select>${btn('tour-add', 'ADD', 'small-button', this.tour.hills.length === 64 ? 'disabled' : '')}${btn('tour-reverse', 'REVERSE')}${btn('tour-shuffle', 'SHUFFLE')}</div><div class="toolbar"><select id="saved-tour" aria-label="Saved tour">${this.store.tours().map((t, i) => option(i, t.name, 0)).join('')}</select>${btn('tour-load', 'LOAD')}${btn('tour-save', 'SAVE')}${btn('tour-delete', 'DELETE')}</div><div class="buttons">${btn('tour-back', 'DONE', 'small-button primary')}${btn('tour-export', 'EXPORT')}${btn('tour-import', 'IMPORT')}</div>`);
    }
    showStartList() {
        const c = this.cup;
        if (!c) { this.showMain(); return; }
        if (c.status === 'event-complete') { this.showEvent(); return; }
        if (c.status === 'finished') { this.showCupStandings(true); return; }
        this.turnToken++; this.cpu = null;
        const target = c.target();
        this.openMenu('start-list', `${c.hill.name} K${c.hill.k} / ROUND ${c.round}`, `<div class="toolbar"><strong>EVENT ${c.eventIndex + 1}/${c.hills.length}</strong><span>${c.turn}/${c.queue.length} JUMPS COMPLETE</span></div><div class="table-wrap start-list-table"><table><thead><tr><th>BIB</th><th>JUMPER</th><th>TEAM</th><th class="num">PREVIOUS</th><th>STATUS</th></tr></thead><tbody>${c.startList().map(p => `<tr class="${p.current ? 'you' : ''}"><td>${p.bib}${c.mode === 'team' ? ' / G' + p.group : ''}</td><td>${esc(p.name)}</td><td>${esc(p.team)}</td><td class="num">${p.previous ? p.previous.distance.toFixed(2) + ' M' : '-'}</td><td>${p.completed ? 'DONE' : p.current ? 'NEXT' : p.human ? 'HUMAN' : 'CPU'}</td></tr>`).join('')}</tbody></table></div>${target ? `<p class="hint">CURRENT JUMPER TARGET: ${target.distance.toFixed(1)} M TO LEAD ${esc(target.leader)}. Estimate assumes ${target.assumedStyle} style points, not a guaranteed winning distance.</p>` : ''}<div class="buttons">${btn('continue-start-list', 'CONTINUE', 'small-button primary')}${btn('live-results', 'HILL STANDINGS')}${btn('cup-history', 'HISTORY')}${btn('main', 'SAVE & EXIT')}</div>`);
    }
    showCupHistory() {
        if (!this.cup) return;
        this.openMenu('cup-history', 'CUP EVENT HISTORY', `<div class="tour-events">${this.cup.history.map((e, i) => `<div class="tour-event"><strong>${i + 1}. ${esc(getHill(e.hillId).name)} / ${esc(e.rows[0]?.name || '')}</strong>${btn('history-event', 'RESULTS', 'small-button', `data-index="${i}"`)}</div>`).join('') || '<p class="empty">NO COMPLETED HILLS YET.</p>'}</div><div class="buttons">${btn('start-list', 'BACK TO CUP')}${btn('export-csv', 'EXPORT CSV')}</div>`);
    }
    showHistoryEvent(index) {
        const event = this.cup?.history[index]; if (!event) return;
        this.openMenu('history-event', `EVENT ${index + 1} / ${getHill(event.hillId).name}`, this.resultTable(event.rows, this.cup.mode === 'team') + `<div class="buttons">${btn('cup-history', 'BACK')}</div>`);
    }
    showTeamDetails(id) {
        const team = this.cup?.teams?.find(t => t.id === id); if (!team) return;
        this.openMenu('team-details', `${team.name} / JUMPER BREAKDOWN`, this.resultTable(this.cup.teamDetails(id).map((p, i) => ({ ...p, rank: i + 1 }))) + `<div class="buttons">${btn('start-list', 'BACK TO CUP')}</div>`);
    }
    showHillRecords(id) {
        const hill = getHill(id), assisted = !!this.recordsAssisted, rows = this.store.hillLeaderboard(id, assisted, 10, this.settings.rules);
        this.openMenu('hill-records', `${hill.name} K${hill.k} / LOCAL TOP TEN`, `<div class="table-wrap"><table><thead><tr><th>#</th><th>JUMPER</th><th class="num">METRES</th><th class="num">POINTS</th><th>DATE</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td class="num">${r.distance.toFixed(2)}</td><td class="num">${Number(r.total || 0).toFixed(1)}</td><td>${esc(String(r.date || '').slice(0, 10))}</td></tr>`).join('')}</tbody></table></div><p class="hint">Best landed jump per player name. ${assisted ? 'Assisted' : 'Unassisted'} records. Practice gates are recorded but not separate categories.</p><div class="buttons">${btn('records', 'BACK')}${btn('hill', 'JUMP HERE', 'small-button primary', `data-id="${id}"`)}${btn('record-ghost', 'BEST REPLAY', 'small-button', `data-id="${id}"`)}</div>`);
    }
    showPersonalRecords() {
        const assisted = !!this.recordsAssisted;
        const names = new Set(this.players.map(p => p.name));
        for (const [key, rows] of Object.entries(this.store.leaderboards())) {
            if (key.endsWith('.assisted') === assisted && Array.isArray(rows)) rows.forEach(r => names.add(r.name));
        }
        const totals = [...names].map(name => { const records = Object.values(this.store.personalBests(name, assisted, this.settings.rules));
            return { name, hills: records.length, distance: records.reduce((sum, r) => sum + r.distance, 0) }; })
            .sort((a, b) => b.distance - a.distance || a.name.localeCompare(b.name));
        this.openMenu('personal-records', 'PERSONAL HILL RECORD TOTALS', `<div class="table-wrap"><table><thead><tr><th>#</th><th>JUMPER</th><th>HILLS</th><th class="num">TOTAL METRES</th></tr></thead><tbody>${totals.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.hills}/32</td><td class="num">${r.distance.toFixed(2)}</td></tr>`).join('')}</tbody></table></div><p class="hint">${assisted ? 'ASSISTED' : 'UNASSISTED'} best landed jump on each hill, summed by player name. Up to 64 player names per hill are retained.</p><div class="buttons">${btn('records', 'BACK')}</div>`);
    }
    showSession() {
        const rows = this.practiceLog, landed = rows.filter(r => !r.crashed && !r.disqualified), average = rows.length ? rows.reduce((s, r) => s + r.distance, 0) / rows.length : 0;
        this.openMenu('session', 'PRACTICE SESSION / LAST 50 JUMPS', `<p class="hint">${rows.length} JUMPS / ${landed.length} LANDED / AVERAGE ${average.toFixed(2)} M</p><div class="table-wrap"><table><thead><tr><th>#</th><th>HILL</th><th class="num">METRES</th><th class="num">TAKEOFF</th><th>LANDING</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${rows.length - i}</td><td>${esc(getHill(r.hillId).name)}</td><td class="num">${r.distance.toFixed(2)}</td><td class="num">${Math.round(r.takeoffQuality * 100)}%</td><td>${r.disqualified ? 'DSQ' : r.crashed ? 'FALL' : esc(r.landing.toUpperCase())}</td></tr>`).join('')}</tbody></table></div><div class="buttons">${btn('next-jump', 'JUMP AGAIN', 'small-button primary')}${btn('retry', 'SAME WIND')}${btn('practice', 'HILLS')}</div>`);
    }
    cycleCamera() { const modes = ['classic', 'close', 'wide', 'chase']; this.settings.camera = modes[(modes.indexOf(this.settings.camera) + 1) % modes.length]; this.renderer.setOptions(this.settings); this.renderer.cameraReady = false; this.store.saveSettings(this.settings); this.toast(`${this.settings.camera.toUpperCase()} CAMERA`); }
    async fullscreen() { try {
        if (document.fullscreenElement)
            await document.exitFullscreen();
        else if (this.arena.requestFullscreen)
            await this.arena.requestFullscreen();
        else
            this.toast('Use Add to Home Screen for a full-screen mobile experience.');
    }
    catch {
        this.toast('Fullscreen is not available in this browser.');
    } }
    toast(message) { const t = $('#toast'); t.textContent = String(message); t.hidden = false; clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => t.hidden = true, 3500); }
    showError(error) { console.error(error); this.toast(error?.message || String(error)); }
    frame(now) {
        const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, .1) : 1 / 60;
        this.lastTime = now;
        try {
            let state = this.idle, overview = true, ghost = null;
            if (this.view === 'game' && !this.paused && this.sim) {
                this.clock.advance(dt, t => { this.input.poll(t); this.cpu?.update(this.sim, t); this.sim.step(t); this.recorder.capture(); });
                state = this.sim.state;
                overview = false;
                if (this.needsFinish)
                    this.finishJump();
                if (this.ghostPlayer && state.phase !== 'gate')
                    ghost = this.ghostPlayer.sample(Math.max(0, state.time - (state.gateElapsed || 0)) + (this.ghostPlayer.replay.result?.gateElapsed || 0));
                if (state.phase === 'gate' && this.sim.options.rules === 'dsj210') { const seconds = Math.ceil(state.startRemaining); if (seconds !== this.lastGateSeconds) { this.lastGateSeconds = seconds; $('#live-status').textContent = `${seconds} seconds to start.`; } }
                if (this.lastPhase !== state.phase) {
                    this.lastPhase = state.phase;
                    this.refreshTouch();
                }
                this.audio.update(state);
            }
            else if (this.view === 'replay' && this.playback) {
                state = this.playback.update(dt);
                overview = false;
                $('#replay-seek').value = String(Math.round(this.playback.time / this.playback.duration * 1000));
            }
            else if (['pause', 'result'].includes(this.view) && this.sim) {
                state = this.sim.state;
                overview = false;
            }
            const renderNow = !overview || !this.lastMenuFrame || now - this.lastMenuFrame > 100;
            if (renderNow) {
                this.renderer.render(state, this.player || this.players[0], dt, overview, ghost);
                if (overview)
                    this.lastMenuFrame = now;
            }
            if (this.view === 'game' || this.view === 'replay') {
                const hud = $('#hud');
                if (hud.width !== this.renderer.width || hud.height !== this.renderer.height) {
                    hud.width = this.renderer.width;
                    hud.height = this.renderer.height;
                }
                const mode = this.mode === 'practice' ? 'PRACTICE' : `${this.mode === 'team' ? 'TEAM' : 'WORLD'} CUP / ROUND ${this.cup?.round || 1}`;
                this.hud.render(state, this.hill, this.player || this.players[0], this.settings, { result: this.view === 'replay' ? this.playback.replay.result : this.sim?.result, mode, replay: this.view === 'replay', touch: this.touch, backend: this.renderer.kind, fps: Math.round(this.renderer.fps) });
            }
        }
        catch (e) {
            this.input.setEnabled(false);
            this.openMenu('error', 'GAME ERROR', `<div class="empty">${esc(e.message)}<br>Return to the menu or select a different renderer in Options.</div><div class="buttons">${btn('main', 'MAIN MENU')}${btn('options', 'OPTIONS')}</div>`);
            this.showError(e);
        }
        this.frameId = requestAnimationFrame(t => this.frame(t));
    }
}
new SkiJumpApp();

return {SkiJumpApp};
});
require('app');
})();
