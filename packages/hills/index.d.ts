export interface Hill {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly k: number;
    readonly biome: string;
    readonly inrunAngle: number;
    readonly landingAngle: number;
    readonly index: number;
    readonly seed: number;
    readonly category: string;
    readonly description: string;
}
export interface ProfilePoint {
    x: number;
    y: number;
    s: number;
    angle: number;
}
export declare const HILLS: readonly Hill[];
export declare function getHill(id: string): Hill;
export declare const TOUR_PRESETS: Readonly<Record<string, string[]>>;
export declare class HillProfile {
    hill: Hill;
    k: number;
    drop: number;
    tableSlope: number;
    inrunLength: number;
    transition: number;
    steepSlope: number;
    startX: number;
    startY: number;
    step: number;
    points: ProfilePoint[];
    kPoint: ProfilePoint;
    end: ProfilePoint;
    constructor(hill: Hill | string);
    inrunY(x: number): number;
    inrunDerivative(x: number): number;
    slopeAngle(distance: number): number;
    atDistance(distance: number): ProfilePoint;
    atX(x: number): ProfilePoint;
    groundY(x: number, z?: number): number;
    speedEstimate(gate?: number): number;
}
export declare function hillPreview(hill: Hill | string): Array<{
    x: number;
    y: number;
}>;

export interface HillVisual {
    readonly id: string;
    readonly k: number;
    readonly version: number;
    readonly palette: string;
    readonly railColor: readonly number[];
    readonly inrunBands: readonly (readonly number[])[];
    readonly inrunDepth: number;
    readonly platformLength: number;
    readonly supportRadius: number;
    readonly inrunWidth: number;
    readonly landingWidth: number;
    readonly landingFlare: number;
    readonly cameraHeight: number;
    readonly cameraYaw: number;
    readonly cameraElevation: number;
    readonly treeSeed: number;
    readonly treeCount: number;
    readonly evidence: Readonly<Record<'roster' | 'geometry' | 'palette' | 'scenery' | 'camera' | 'pixelParity', string>>;
}
export declare const HILL_VISUALS: readonly HillVisual[];
export declare function getHillVisual(id: string): HillVisual;
