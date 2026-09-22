import { clamp } from '@wieslawsoltes/ski-core';
import { getHill } from '@wieslawsoltes/ski-hills';
import { validateReplay } from '@wieslawsoltes/ski-replay';
export const DEFAULT_SETTINGS = Object.freeze({ resolution: 'classic', renderer: 'auto', weather: 'clear', volume: .55, mute: false,
    sensitivity: 1, control: 'modern', assist: false, guide: true, ghost: true, camera: 'classic', haptics: true,
    windStrength: 1, windBase: null, gate: 0, watchCPU: false, difficulty: .8, aiCount: 15, scanlines: false, showFPS: false, motion: false });
export function validateSettings(raw = {}) {
    const s = { ...DEFAULT_SETTINGS };
    for (const k of ['mute', 'assist', 'guide', 'ghost', 'haptics', 'watchCPU', 'scanlines', 'showFPS', 'motion'])
        if (typeof raw[k] === 'boolean')
            s[k] = raw[k];
    for (const [k, range] of Object.entries({ volume: [0, 1], sensitivity: [.2, 3], windStrength: [0, 2], gate: [-5, 8], difficulty: [.2, 1], aiCount: [0, 49] }))
        if (Number.isFinite(raw[k]))
            s[k] = clamp(raw[k], ...range);
    for (const [k, choices] of Object.entries({ resolution: ['classic', 'sharp', 'native'], renderer: ['auto', 'webgl', 'software'], weather: ['clear', 'snow', 'dusk', 'night'], control: ['modern', 'classic'], camera: ['classic', 'close', 'wide', 'chase'] }))
        if (choices.includes(raw[k]))
            s[k] = raw[k];
    if (raw.windBase === null || Number.isFinite(raw.windBase))
        s.windBase = raw.windBase === null ? null : clamp(raw.windBase, -4, 4);
    s.gate = Math.round(s.gate);
    s.aiCount = Math.round(s.aiCount);
    return s;
}
/** Quota/security errors degrade to in-memory storage, never stop the game loop. */
export class GameStore {
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
    settings() { return validateSettings(this.get('settings', {})); }
    saveSettings(settings) { return this.set('settings', validateSettings(settings)); }
    records() { const r = this.get('records', {}); return r && typeof r === 'object' && !Array.isArray(r) ? r : {}; }
    recordKey(hillId, assisted = false) { getHill(hillId); return `${hillId}${assisted ? '.assisted' : ''}`; }
    updateRecord(result, player, replay = null) {
        if (!result || result.crashed || !Number.isFinite(result.distance) || result.distance < 0)
            return false;
        const key = this.recordKey(result.hillId, result.assisted), all = this.records(), old = all[key];
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
    ghost(hillId, assisted = false) { try {
        const r = this.get(`ghost.${this.recordKey(hillId, assisted)}`);
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
    addJump(r) { const s = this.stats(); s.jumps++; s[r.crashed ? 'falls' : 'landings']++; s.distance += r.distance; this.set('stats', s); }
    exportData() { return JSON.stringify({ format: 'ski-jump-web-save', version: 1, settings: this.settings(), players: this.get('players', []), records: this.records(), stats: this.stats(), cup: this.get('cup') }, null, 2); }
    importData(text) {
        if (typeof text !== 'string' || text.length > 5000000)
            throw new Error('Save file exceeds 5 MB');
        const d = JSON.parse(text);
        if (!d || d.format !== 'ski-jump-web-save' || d.version !== 1)
            throw new Error('Unsupported save file');
        if (!Array.isArray(d.players) || d.players.length > 16 || !d.records || typeof d.records !== 'object' || Object.keys(d.records).length > 64)
            throw new Error('Invalid save data');
        for (const [key, r] of Object.entries(d.records)) {
            if (!/^[a-z]{3}(\.assisted)?$/.test(key))
                throw new Error('Invalid record key');
            getHill(key.split('.')[0]);
            if (!r || !Number.isFinite(r.distance) || r.distance < 0 || r.distance > 2000)
                throw new Error('Invalid record');
        }
        this.saveSettings(d.settings && typeof d.settings === 'object' ? d.settings : {});
        this.set('players', d.players);
        this.set('records', d.records);
        if (d.stats) {
            const s = {};
            for (const key of ['jumps', 'landings', 'falls', 'distance', 'cups'])
                s[key] = Number.isFinite(d.stats[key]) ? clamp(d.stats[key], 0, 1e12) : 0;
            this.set('stats', s);
        }
        if (typeof d.cup === 'string' && d.cup.length < 4000000)
            this.set('cup', d.cup);
    }
}
