import { JumpSimulation, JumpResult, JumpOptions, JumpState } from '@wieslawsoltes/ski-physics';
export interface ReplayPlayerInfo {
    name: string;
    country?: string;
    suit?: string;
    helmet?: string;
    skis?: string;
}
export type ReplayFrame = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];
export interface Replay {
    format: 'ski-jump-web-replay';
    version: 1;
    physics: string;
    hillId: string;
    player: ReplayPlayerInfo;
    options: JumpOptions;
    result: JumpResult | null;
    createdAt: string;
    frames: ReplayFrame[];
}
export type ReplayState = Pick<JumpState, 'time' | 'x' | 'y' | 'pitch' | 'lean' | 'speed' | 'distance' | 'wind' | 'phase' | 'landing' | 'crashed' | 'quality' | 'z' | 'height' | 'flightTime' | 'runoutTime'>;
export declare const REPLAY_VERSION: 1;
export declare const REPLAY_PHASES: string[];
export declare const FRAME_FIELDS: string[];
export declare class ReplayRecorder {
    sim: JumpSimulation;
    player: ReplayPlayerInfo;
    hz: number;
    frames: ReplayFrame[];
    constructor(sim: JumpSimulation, player?: ReplayPlayerInfo, hz?: number);
    capture(force?: boolean): void;
    finish(): Replay;
}
export declare function validateReplay(data: unknown): Replay;
export declare function parseReplay(text: string): Replay;
export declare function serializeReplay(replay: Replay): string;
export declare class ReplayPlayer {
    replay: Replay;
    time: number;
    speed: number;
    paused: boolean;
    loop: boolean;
    duration: number;
    loopStart: number;
    loopEnd: number;
    readonly markers: { start: number; takeoff: number; landing: number; end: number };
    setLoop(start?: number, end?: number): this;
    stepFrame(direction?: number): ReplayState;
    jumpTo(marker: 'start' | 'takeoff' | 'landing' | 'end'): ReplayState;
    constructor(replay: Replay);
    seek(time: number): ReplayState;
    update(dt: number): ReplayState;
    sample(time: number): ReplayState;
}
