import { clamp } from '@wieslawsoltes/ski-core';
// Authored 5x7 bitmap glyphs, rendered with rectangles; no external/font files.
export const GLYPHS = {
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'], C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'], E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'], G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'], H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'], I: ['111', '010', '010', '010', '010', '010', '111'], J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'], K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'], S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'], U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'], W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'], X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'], Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'], Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['010', '110', '010', '010', '010', '010', '111'], '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'], '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
    ' ': ['000', '000', '000', '000', '000', '000', '000'], '.': ['0', '0', '0', '0', '0', '1', '1'], ',': ['00', '00', '00', '00', '00', '01', '10'], ':': ['0', '1', '1', '0', '1', '1', '0'], '-': ['000', '000', '000', '111', '000', '000', '000'], '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'], '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'], '%': ['11001', '11010', '00100', '01000', '10110', '00110', '00000'], '!': ['1', '1', '1', '1', '1', '0', '1'], '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'], '(': ['001', '010', '100', '100', '100', '010', '001'], ')': ['100', '010', '001', '001', '001', '010', '100'], '>': ['100', '010', '001', '001', '001', '010', '100'], '<': ['001', '010', '100', '100', '100', '010', '001'], '=': ['000', '000', '111', '000', '111', '000', '000'], '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'], "'": ['1', '1', '0', '0', '0', '0', '0'], '#': ['01010', '11111', '01010', '01010', '11111', '01010', '00000']
};
export function plainASCII(text) { return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/Š/g, 'S').toUpperCase(); }
export function textWidth(text, scale = 1) { return [...plainASCII(text)].reduce((n, c) => n + ((GLYPHS[c] || GLYPHS['?'])[0].length + 1) * scale, 0) - scale; }
export function drawText(ctx, text, x, y, color = '#eeee43', scale = 1, shadow = false) { text = plainASCII(text); if (shadow)
    drawText(ctx, text, x + scale, y + scale, '#151618', scale, false); ctx.fillStyle = color; for (const c of text) {
    const g = GLYPHS[c] || GLYPHS['?'];
    for (let yy = 0; yy < 7; yy++)
        for (let xx = 0; xx < g[yy].length; xx++)
            if (g[yy][xx] === '1')
                ctx.fillRect(Math.round(x + xx * scale), Math.round(y + yy * scale), scale, scale);
    x += (g[0].length + 1) * scale;
} return x; }
export function pixelCanvas(text, color = '#eeee43', scale = 2) { const c = document.createElement('canvas'); c.width = Math.max(1, textWidth(text, scale) + 2); c.height = 7 * scale + 2; c.setAttribute('aria-hidden', 'true'); c.className = 'pixel-label'; drawText(c.getContext('2d'), text, 0, 0, color, scale); return c; }
export function paintLabels(root = document) { root.querySelectorAll('[data-pixel]').forEach(el => { const text = el.dataset.pixel || el.textContent; el.setAttribute('aria-label', text); el.replaceChildren(pixelCanvas(text, el.dataset.color || '#eeee43', Number(el.dataset.size) || 2)); }); }
export function drawLogo(canvas) { canvas.width = 314; canvas.height = 58; const c = canvas.getContext('2d'); drawText(c, 'DELUXE', 64, 2, '#c2c547', 2); drawText(c, 'SKI JUMP', 5, 22, '#eeee43', 4); drawText(c, '2', 188, 22, '#eeee43', 4); c.fillStyle = '#9fa546'; c.fillRect(62, 17, 138, 2); }
export function escapeHTML(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function downloadText(filename, text, mime = 'application/json') { const blob = new Blob([text], { type: mime }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export class JumpHUD {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.fps = 0; }
    render(state, hill, player, options = {}, meta = {}) {
        const c = this.canvas, ctx = this.ctx, w = c.width, h = c.height, portrait = h > w, scale = Math.max(1, Math.floor(w / (portrait ? 160 : 320))), W = w / scale, H = h / scale;
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.scale(scale, scale);
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
