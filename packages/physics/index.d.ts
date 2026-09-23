import { Events } from '@wieslawsoltes/ski-core';
import { Hill, HillProfile } from '@wieslawsoltes/ski-hills';
export type JumpPhase = 'gate' | 'inrun' | 'flight' | 'runout' | 'finished';
export type Landing = 'none' | 'telemark' | 'parallel';
export type JumpRules = 'legacy' | 'dsj210';
export type HillClass = 'small' | 'large' | 'flying';
export interface JumpOptions {
    rules?: JumpRules;
    seed?: number;
    gate?: number;
    windStrength?: number;
    windBase?: number | null;
    assist?: boolean;
}
export interface JumpState {
    phase: JumpPhase;
    time: number;
    flightTime: number;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    speed: number;
    lean: number;
    pitch: number;
    angularVelocity: number;
    wind: number;
    height: number;
    distance: number;
    quality: number;
    takeoff: boolean;
    landing: Landing;
    crashed: boolean;
    landingTime: number;
    runoutTime: number;
    flightError: number;
    gateElapsed: number;
    startRemaining: number;
    disqualified: boolean;
    leftLandingTime: number;
    rightLandingTime: number;
    telemarkWidth: number;
    windAngle: number;
}
export interface JumpScore {
    distancePoints: number;
    stylePoints: number;
    total: number;
    counted: number[];
    crashed: boolean;
}
export interface JumpResult extends JumpScore {
    rules?: JumpRules;
    disqualified?: boolean;
    reason?: 'start-time-exceeded';
    gateElapsed?: number;
    telemarkWidth?: number;
    hillId: string;
    k: number;
    distance: number;
    judges: number[];
    landing: Landing;
    takeoffQuality: number;
    takeoffX: number | null;
    flightTime: number;
    speed: number;
    wind: number;
    impact: number;
    seed: number;
    assisted: boolean;
    gate: number;
    physics: string;
}
export declare const PHYSICS_VERSION: string;
export declare const FIXED_DT: number;
export declare const CLASSIC_PHYSICS_VERSION: string;
export declare const START_WINDOW_SECONDS: 15;
export declare const START_BLINK_SECONDS: 10;
export declare const LANDING_CHORD_SECONDS: number;
export declare function validateRules(rules?: JumpRules): JumpRules;
export declare function classicHillClass(k: number): HillClass;
export declare function startSignal(elapsed: number, active?: boolean): { remaining: number; expired: boolean; blinking: boolean; green: boolean; red: boolean };
export declare class WindField {
    base: number;
    strength: number;
    phase: number;
    secondary: number;
    constructor(seed?: number, strength?: number, base?: number | null);
    sample(time: number, x?: number): number;
}
export declare function pointsPerMetre(k: number, rules?: JumpRules, hillClass?: HillClass): number;
export declare function scoreJump(input: {
    distance: number;
    k: number;
    judges: number[];
    crashed?: boolean;
    rules?: JumpRules;
    hillClass?: HillClass;
}): JumpScore;
export declare class JumpSimulation {
    profile: HillProfile;
    hill: Hill;
    options: Required<JumpOptions>;
    state: JumpState;
    events: Events;
    windField: WindField;
    result: JumpResult | null;
    takeoffX: number | null;
    physicsVersion: string;
    landingFoot(side: 'left' | 'right'): boolean;
    disqualify(): boolean;
    constructor(hill: Hill | HillProfile | string, options?: JumpOptions);
    reset(): void;
    start(): boolean;
    takeoff(): boolean;
    land(kind?: 'telemark' | 'parallel'): boolean;
    command(kind: string): boolean;
    control(delta: number): void;
    snapshot(): JumpState;
    step(dt?: number, control?: number): void;
}
export declare class CPUController {
    skill: number;
    error: number;
    bias: number;
    takeoffAt: number;
    constructor(seed?: number, skill?: number);
    update(sim: JumpSimulation, dt?: number): void;
}
export declare function simulateCPU(hill: Hill | HillProfile | string, options?: JumpOptions, skill?: number): JumpResult;
