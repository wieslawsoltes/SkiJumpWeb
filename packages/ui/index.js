import { clamp } from '@wieslawsoltes/ski-core';
import { GLYPHS, plainASCII, textWidth, drawText, pixelCanvas, paintLabels } from './bitmap.js';
import { ClassicMenuSkin, CLASSIC_MENU_LAYOUT, classicViewport, navigationIndex, drawMenuBackdrop, drawClassicLogo } from './classic.js';
export { GLYPHS, plainASCII, textWidth, drawText, pixelCanvas, paintLabels, ClassicMenuSkin, CLASSIC_MENU_LAYOUT, classicViewport, navigationIndex, drawMenuBackdrop, drawClassicLogo };
export function drawLogo(canvas) { canvas.width = 314; canvas.height = 58; const c = canvas.getContext('2d'); drawText(c, 'DELUXE', 64, 2, '#c2c547', 2); drawText(c, 'SKI JUMP', 5, 22, '#eeee43', 4); drawText(c, '2', 188, 22, '#eeee43', 4); c.fillStyle = '#9fa546'; c.fillRect(62, 17, 138, 2); }
export function escapeHTML(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function downloadText(filename, text, mime = 'application/json') { const blob = new Blob([text], { type: mime }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
/** Reference-space layout measured from the publisher's DSJ2.10 gallery (not copied bitmap assets). */
export const CLASSIC_HUD_LAYOUT = Object.freeze({ width: 320, height: 200, statusHeight: 13,
    windWidth: 29, windHeight: 27, right: 4, top: 3, judgeTop: 58, judgeStep: 12 });
export function drawClassicHUD(ctx, W, H, state, hill, player, options = {}, meta = {}) {
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
export class JumpHUD {
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
