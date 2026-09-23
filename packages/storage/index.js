import { clamp } from '@wieslawsoltes/ski-core';
import { getHill, HILLS } from '@wieslawsoltes/ski-hills';
import { validateRules } from '@wieslawsoltes/ski-physics';
import { validateReplay } from '@wieslawsoltes/ski-replay';
import { Competition, normalizePlayer } from '@wieslawsoltes/ski-competition';
export const DEFAULT_SETTINGS = Object.freeze({ resolution: 'classic', renderer: 'auto', weather: 'clear', volume: .55, mute: false,
    sensitivity: 1, control: 'classic', rules: 'dsj210', presentation: 'classic', assist: false, guide: false, ghost: false, camera: 'classic', haptics: true,
    windStrength: 1, windBase: null, gate: 0, watchCPU: false, difficulty: .8, aiCount: 15, scanlines: false, showFPS: false, motion: false });
export function validateSettings(raw = {}) {
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
