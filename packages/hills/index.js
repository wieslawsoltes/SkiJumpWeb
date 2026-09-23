import { clamp, lerp, smoothstep, radians, Random } from '@wieslawsoltes/ski-core';
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
export const HILLS = Object.freeze(roster.map((r, i) => Object.freeze({
    id: r[0].toLowerCase(), code: r[0], name: r[1], k: r[2], biome: r[3], inrunAngle: r[4], landingAngle: r[5],
    index: i, seed: 918273 + i * 7919, category: r[2] < 90 ? 'small' : r[2] < 165 ? 'large' : 'flying',
    description: `${r[1]} K${r[2]} · ${r[3] === 'alpine' ? 'Mountain panorama' : r[3] === 'arctic' ? 'Open, windswept terrain' : r[3] === 'nordic' ? 'Northern pine forest' : 'Woodland valley'}`
})));
export function getHill(id) { const h = HILLS.find(h => h.id === id || h.code === id); if (!h)
    throw new RangeError(`Unknown hill: ${id}`); return h; }
export const TOUR_PRESETS = Object.freeze({
    'Original eight': HILLS.slice(0, 8).map(h => h.id),
    'All 32 hills': HILLS.map(h => h.id),
    'Small hills': HILLS.filter(h => h.k <= 100).sort((a, b) => a.k - b.k).map(h => h.id),
    'Ski flying': HILLS.filter(h => h.k >= 180).sort((a, b) => a.k - b.k).map(h => h.id),
    'Four hills': ['aut', 'ger', 'pol', 'slo']
});
/** Smooth, sampled profile parameterized by actual slope arc-length in metres. */
export class HillProfile {
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
export function hillPreview(hill) { const p = new HillProfile(hill); return [...Array(90)].map((_, i) => { const x = lerp(p.startX - 8, p.kPoint.x * 1.6, i / 89); return { x, y: x <= 0 ? p.inrunY(x) : p.atX(x).y }; }); }

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
export const HILL_VISUALS = Object.freeze(visualRows.map(([id,palette]) => {
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
export function getHillVisual(id) {
    const hill=getHill(id),visual=HILL_VISUALS.find(v=>v.id===hill.id);
    if(!visual)throw new Error(`Missing visual definition for ${hill.id}`);
    return visual;
}
