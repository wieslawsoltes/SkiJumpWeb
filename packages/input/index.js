import { clamp } from '@wieslawsoltes/ski-core';
/** Pointer/mouse chord, touch drag, keyboard, gamepad and optional device-tilt adapter. */
export class SkiInput {
    constructor(element, handlers = {}, options = {}) {
        this.element = element;
        this.handlers = handlers;
        this.options = { sensitivity: 1, control: 'modern', motion: false, ...options };
        this.enabled = false;
        this.keys = new Set();
        this.pointers = new Map();
        this.cleanup = [];
        this.lastMouse = null;
        this.lastButtons = 0;
        this.gamepadButtons = [];
        this.motionCenter = null;
        this.lastMotion = 0;
        this.listen(element, 'contextmenu', e => { if (this.enabled)
            e.preventDefault(); });
        this.listen(element, 'pointerdown', e => this.pointerDown(e));
        this.listen(element, 'pointermove', e => this.pointerMove(e));
        this.listen(element, 'pointerup', e => this.pointerUp(e));
        this.listen(element, 'pointercancel', e => this.pointerUp(e));
        this.listen(element, 'lostpointercapture', e => this.pointers.delete(e.pointerId));
        // Pointer Events fire pointerdown only for the first mouse button. mousedown observes chords.
        this.listen(element, 'mousedown', e => { if (this.enabled && !this.interactive(e.target)) {
            e.preventDefault();
            this.handleMouseButtons(e.buttons);
        } });
        this.listen(element, 'mouseup', e => { this.lastButtons = e.buttons; });
        this.listen(window, 'keydown', e => this.keyDown(e));
        this.listen(window, 'keyup', e => this.keys.delete(e.code));
        this.listen(window, 'blur', () => this.reset());
        this.listen(document, 'visibilitychange', () => { if (document.hidden)
            this.reset(); });
        this.listen(window, 'deviceorientation', e => this.orientation(e));
        this.listen(window, 'orientationchange', () => { this.motionCenter = null; this.lastMotion = 0; });
    }
    listen(target, type, fn, options) { target.addEventListener(type, fn, options); this.cleanup.push(() => target.removeEventListener(type, fn, options)); }
    interactive(target) { return !!target.closest?.('button,input,select,textarea,a,[data-no-input]'); }
    setEnabled(value) { this.enabled = !!value; if (!value)
        this.reset(); }
    setOptions(options) { Object.assign(this.options, options); }
    phase() { return this.handlers.phase?.() || 'gate'; }
    action(name) { this.handlers.unlock?.(); this.handlers.action?.(name); }
    primary(parallel = false) { const p = this.phase(); this.action(p === 'gate' ? 'start' : p === 'inrun' ? 'takeoff' : parallel ? 'parallel' : 'telemark'); }
    handleMouseButtons(buttons) {
        const previous = this.lastButtons;
        this.lastButtons = buttons;
        if (buttons === previous)
            return;
        const p = this.phase(), both = (buttons & 3) === 3;
        if (p === 'gate') {
            this.action('start');
            return;
        }
        if (p === 'inrun') {
            if (this.options.control === 'modern' || both)
                this.action('takeoff');
            return;
        }
        if (p === 'flight') {
            if (both || (this.options.control === 'modern' && (buttons & 2)))
                this.action('parallel');
            else if (buttons & 3)
                this.action('telemark');
        }
    }
    pointerDown(e) {
        if (!this.enabled || this.interactive(e.target))
            return;
        e.preventDefault();
        this.handlers.unlock?.();
        this.lastMouse = { x: e.clientX, y: e.clientY };
        if (e.pointerType === 'mouse')
            return;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startY: e.clientY });
        try {
            this.element.setPointerCapture(e.pointerId);
        }
        catch { }
        if (this.phase() === 'gate')
            this.action('start');
        else if (this.options.control === 'classic' && this.pointers.size >= 2)
            this.primary(true);
    }
    pointerMove(e) {
        if (!this.enabled)
            return;
        if (e.pointerType === 'mouse') {
            if (this.interactive(e.target))
                return;
            if (this.lastMouse && this.phase() === 'flight')
                this.handlers.lean?.(-clamp(e.clientY - this.lastMouse.y, -60, 60) * .0038 * this.options.sensitivity);
            this.lastMouse = { x: e.clientX, y: e.clientY };
            if (e.buttons !== this.lastButtons)
                this.handleMouseButtons(e.buttons);
            return;
        }
        const p = this.pointers.get(e.pointerId);
        if (!p)
            return;
        e.preventDefault();
        if (this.phase() === 'flight')
            this.handlers.lean?.(-clamp(e.clientY - p.y, -80, 80) * .006 * this.options.sensitivity);
        p.x = e.clientX;
        p.y = e.clientY;
    }
    pointerUp(e) { this.pointers.delete(e.pointerId); if (e.pointerType === 'mouse')
        this.lastButtons = e.buttons; }
    keyDown(e) {
        if (!this.enabled || this.interactive(e.target))
            return;
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'KeyP', 'KeyZ', 'KeyX', 'KeyR', 'KeyC', 'KeyM', 'KeyF'].includes(e.code))
            e.preventDefault();
        this.keys.add(e.code);
        if (e.repeat)
            return;
        if (e.code === 'Space')
            this.primary();
        if (e.code === 'KeyZ')
            this.action('telemark');
        if (e.code === 'KeyX')
            this.action('parallel');
        for (const [key, action] of Object.entries({ Escape: 'pause', KeyP: 'pause', KeyR: 'retry', KeyC: 'camera', KeyM: 'mute', KeyF: 'fullscreen' }))
            if (e.code === key)
                this.action(action);
    }
    poll(dt) {
        if (!this.enabled)
            return;
        let axis = 0;
        if (this.keys.has('ArrowUp') || this.keys.has('ArrowLeft'))
            axis += 1;
        if (this.keys.has('ArrowDown') || this.keys.has('ArrowRight'))
            axis -= 1;
        const pads = navigator.getGamepads?.() || [], pad = [...pads].find(p => p?.connected);
        if (pad) {
            const a = pad.axes[1] || 0;
            if (Math.abs(a) > .15)
                axis -= a;
            for (let i = 0; i < pad.buttons.length; i++) {
                const pressed = pad.buttons[i].pressed;
                if (pressed && !this.gamepadButtons[i]) {
                    if (i === 0)
                        this.primary();
                    if (i === 1)
                        this.action('parallel');
                    if (i === 9)
                        this.action('pause');
                }
                this.gamepadButtons[i] = pressed;
            }
        }
        if (axis)
            this.handlers.lean?.(axis * .9 * dt * this.options.sensitivity);
    }
    async enableMotion() { const C = globalThis.DeviceOrientationEvent; if (!C)
        throw new Error('This browser does not expose device tilt. Touch drag remains available.'); if (typeof C.requestPermission === 'function') {
        const status = await C.requestPermission();
        if (status !== 'granted')
            throw new Error('Motion permission was not granted.');
    } this.options.motion = true; this.motionCenter = null; this.lastMotion = 0; return true; }
    orientation(e) { if (!this.enabled || !this.options.motion)
        return; const angle = screen.orientation?.angle ?? window.orientation ?? 0; const raw = Math.abs(angle) % 180 === 90 ? (e.gamma || 0) * (angle === 90 ? -1 : 1) : (e.beta || 0); if (this.motionCenter === null) {
        this.motionCenter = raw;
        return;
    } const current = clamp((raw - this.motionCenter) / 32, -1, 1); if (this.phase() === 'flight')
        this.handlers.lean?.((current - this.lastMotion) * this.options.sensitivity); this.lastMotion = current; }
    calibrate() { this.motionCenter = null; this.lastMotion = 0; }
    reset() { this.keys.clear(); this.pointers.clear(); this.lastMouse = null; this.lastButtons = 0; this.gamepadButtons = []; }
    dispose() { this.reset(); this.cleanup.splice(0).forEach(fn => fn()); }
}
