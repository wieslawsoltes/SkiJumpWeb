import { clamp, Random } from '@wieslawsoltes/ski-core';
/** Dependency-free Web Audio mixer. All sound is synthesized; no samples are shipped. */
export class SkiAudio {
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
