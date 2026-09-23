import { clamp, Random, round } from '@wieslawsoltes/ski-core';
import { getHill } from '@wieslawsoltes/ski-hills';
import { simulateCPU, pointsPerMetre } from '@wieslawsoltes/ski-physics';
export const CUP_POINTS = Object.freeze([100, 80, 60, 50, 45, 40, 36, 32, 29, 26, 24, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
const aiNames = ['A. KORHONEN', 'M. WEBER', 'J. NOWICKI', 'T. BERG', 'S. YAMAMOTO', 'P. NOVAK', 'L. ROSSI', 'E. ANDERSEN', 'D. MILLER', 'R. KOVAC', 'O. LIND', 'N. MARTIN', 'K. LEE', 'V. PETROV', 'B. FISCHER', 'A. KOVAL'];
const countries = ['FIN', 'GER', 'POL', 'NOR', 'JPN', 'CZE', 'ITA', 'AUT', 'USA', 'SLO', 'SWE', 'FRA', 'KOR', 'RUS', 'SUI', 'UKR'];
const suits = ['#225be7', '#dc303b', '#cf3c37', '#14689e', '#8c38b8', '#2a9d66', '#238ed0', '#e95321', '#943db9', '#258753', '#1d7296', '#e7c329'];
export function normalizePlayer(p = {}, index = 0) {
    const name = String(p.name || `PLAYER ${index + 1}`).replace(/[\x00-\x1f<>]/g, '').slice(0, 22).trim() || `PLAYER ${index + 1}`;
    const color = v => /^#[0-9a-f]{6}$/i.test(v || '') ? v : null;
    return { id: String(p.id || `human-${index + 1}`).slice(0, 50), name, country: String(p.country || 'POL').replace(/[^A-Z]/g, '').slice(0, 3) || 'POL',
        suit: color(p.suit) || suits[index % suits.length], helmet: color(p.helmet) || '#e93135', skis: color(p.skis) || '#e6cf21',
        team: String(p.team || p.country || 'POL').replace(/[\x00-\x1f<>]/g, '').slice(0, 20), human: p.human !== false, skill: clamp(Number(p.skill) || .85, .1, 1) };
}
export function createField(humans, aiCount = 15, difficulty = .8) {
    if (!Array.isArray(humans) || humans.length < 1 || humans.length > 16)
        throw new RangeError('Choose 1–16 human players');
    const field = humans.map((p, i) => normalizePlayer({ ...p, human: true, id: `human-${i + 1}` }, i));
    const r = new Random(1234);
    const count = Math.floor(clamp(Number(aiCount) || 0, 0, 64 - field.length));
    for (let i = 0; i < count; i++)
        field.push(normalizePlayer({ id: `cpu-${i}`, name: aiNames[i % 16] + (i >= 16 ? ` ${Math.floor(i / 16) + 1}` : ''), country: countries[i % 16], human: false, skill: clamp(difficulty + r.range(-.17, .1), .2, .99) }, i + 1));
    return field;
}
export function createTeams(humans, aiTeamCount = 7, difficulty = .8) {
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
export function ranked(items, value = x => x.total) {
    let prev = NaN, rank = 0;
    return [...items].sort((a, b) => value(b) - value(a) || String(a.id).localeCompare(String(b.id))).map((item, i) => { const v = round(value(item), 1); if (v !== prev)
        rank = i + 1; prev = v; return { ...item, rank }; });
}
/** Serializable two-round individual / four-athlete team competition state machine. */
export class Competition {
    constructor({ mode = 'world', hills = ['fin'], players, teams = null, seed = 1, windStrength = 1 } = {}) {
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
    options() { return { seed: this.seed + this.eventIndex * 7919 + this.round * 101, windStrength: this.windStrength, assist: false, gate: 0 }; }
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
                this.cup[row.id] = (this.cup[row.id] || 0) + (CUP_POINTS[row.rank - 1] || 0);
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
            distance: Math.max(0, Math.ceil((k + (needed - clamp(stylePoints, 0, 60) - base) / pointsPerMetre(k)) * 2) / 2) };
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
        for (const key of ['version', 'mode', 'hills', 'players', 'teams', 'seed', 'windStrength', 'eventIndex', 'round', 'status', 'history', 'cup', 'scores', 'turn', 'queue'])
            obj[key] = d[key];
        return obj;
    }
}

/** Ordered tour with repeated venues. A preset's order is never inferred from DOM order. */
export class TourSchedule {
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
export function competitionCSV(competition) {
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
