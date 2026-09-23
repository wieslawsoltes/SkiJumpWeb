import { FixedClock, Random, clamp, round } from '@wieslawsoltes/ski-core';
import { HILLS, getHill, HillProfile, TOUR_PRESETS } from '@wieslawsoltes/ski-hills';
import { JumpSimulation, CPUController, FIXED_DT } from '@wieslawsoltes/ski-physics';
import { Competition, TourSchedule, competitionCSV, createField, createTeams, normalizePlayer } from '@wieslawsoltes/ski-competition';
import { ReplayRecorder, ReplayPlayer, parseReplay, serializeReplay } from '@wieslawsoltes/ski-replay';
import { SkiRenderer } from '@wieslawsoltes/ski-renderer';
import { SkiAudio } from '@wieslawsoltes/ski-audio';
import { SkiInput } from '@wieslawsoltes/ski-input';
import { GameStore, DEFAULT_SETTINGS } from '@wieslawsoltes/ski-storage';
import { JumpHUD, paintLabels, drawLogo, escapeHTML, downloadText, pixelCanvas } from '@wieslawsoltes/ski-ui';
const $ = s => document.querySelector(s), esc = escapeHTML;
const btn = (action, label, cls = 'small-button', extra = '') => `<button class="${cls}" data-action="${action}" ${extra}>${esc(label)}</button>`;
const pixelBtn = (action, label, extra = '') => `<button class="menu-item" data-action="${action}" ${extra}><span data-pixel="${esc(label)}"></span></button>`;
const option = (value, label, selected) => `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;
const countries = [...new Map(HILLS.map(h => [h.code, h.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
export class SkiJumpApp {
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
