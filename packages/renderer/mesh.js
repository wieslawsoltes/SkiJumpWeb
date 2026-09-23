import { clamp } from '@wieslawsoltes/ski-core';
export const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
export function multiply(a, b) { const r = new Float32Array(16); for (let c = 0; c < 4; c++)
    for (let row = 0; row < 4; row++)
        for (let k = 0; k < 4; k++)
            r[c * 4 + row] += a[k * 4 + row] * b[c * 4 + k]; return r; }
export function lookAt(eye, center) { const z = norm(vsub(eye, center)), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]); }
export function ortho(l, r, b, t, n, f, gpu) { return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, (gpu ? 1 : 2) / (n - f), 0, (l + r) / (l - r), (t + b) / (b - t), gpu ? n / (n - f) : (f + n) / (n - f), 1]); }
export function perspective(fov, aspect, near, far, gpu) {
    const y=1/Math.tan(fov/2), z=(gpu?far:far+near)/(near-far), t=(gpu?1:2)*far*near/(near-far);
    return new Float32Array([y/aspect,0,0,0,0,y,0,0,0,0,z,-1,0,0,t,0]);
}
export function projected(m, p, w, h) { const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]; const divisor=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15]; return [(x/divisor*.5+.5)*w,(-y/divisor*.5+.5)*h,z/divisor]; }
export const shade = (c, f) => c.map(x => clamp(x * f, 0, 1));
export class MeshBuilder {
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
