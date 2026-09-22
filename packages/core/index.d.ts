export declare const clamp: (value: number, min: number, max: number) => number;
export declare const lerp: (a: number, b: number, t: number) => number;
export declare const smoothstep: (a: number, b: number, x: number) => number;
export declare const radians: (degrees: number) => number;
export declare const round: (value: number, decimals?: number) => number;
export declare const wrapAngle: (angle: number) => number;
export declare function hashString(text: unknown): number;
export declare class Random {
    state: number;
    constructor(seed?: number | string);
    next(): number;
    range(a: number, b: number): number;
    int(a: number, b: number): number;
    pick<T>(items: readonly T[]): T;
    shuffle<T>(items: readonly T[]): T[];
}
export declare class Events {
    listeners: Map<string, Set<(data: unknown) => void>>;
    on<T = unknown>(name: string, listener: (data: T) => void): () => void;
    emit(name: string, data?: unknown): void;
    clear(): void;
}
export declare class FixedClock {
    dt: number;
    maxSteps: number;
    accumulator: number;
    ticks: number;
    constructor(hz?: number, maxSteps?: number);
    advance(seconds: number, update: (dt: number) => void): number;
    reset(): void;
}
export declare function colorRGB(hex: string): number[];
export declare function assertFinite<T extends object>(object: T, keys: (keyof T)[]): T;
