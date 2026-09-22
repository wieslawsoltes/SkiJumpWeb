export interface AudioState {
    phase: string;
    speed?: number;
}
export declare class SkiAudio {
    volume: number;
    muted: boolean;
    ready: boolean;
    failed: boolean;
    error?: string;
    context?: AudioContext;
    constructor(options?: {
        volume?: number;
        mute?: boolean;
    });
    unlock(): Promise<boolean>;
    setVolume(volume: number, muted?: boolean): void;
    update(state: AudioState | null, paused?: boolean): void;
    tone(frequency: number, duration?: number, type?: OscillatorType, volume?: number, endFrequency?: number, delay?: number): void;
    burst(duration: number, volume: number, frequency: number, type?: BiquadFilterType, delay?: number): void;
    play(name: 'menu' | 'start' | 'takeoff' | 'land' | 'crash' | 'record' | 'win'): void;
    suspend(): Promise<void>;
    dispose(): void;
}
