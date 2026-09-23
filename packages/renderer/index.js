import { clamp, lerp, Random, colorRGB } from '@wieslawsoltes/ski-core';
import { HillProfile, getHillVisual } from '@wieslawsoltes/ski-hills';
import { MeshBuilder, vsub, vadd, vmul, norm, multiply, lookAt, ortho, perspective, projected, shade } from './mesh.js';
export { MeshBuilder };
import { createClassicHillScene, createProjectedShadow } from './scene.js';
export { createClassicHillScene };
import { SCENE_WGSL, SKY_WGSL, SCENE_GLSL, SKY_GLSL, SNOW_WGSL, SNOW_GLSL, SCENE_VERTEX_GLSL, SNAP_WGSL } from './shading.js';
import { SoftwareRasterizer } from './raster.js';
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
export function createHillMesh(profile, quality = 1, record = 0) {
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
export class SkiRenderer {
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
