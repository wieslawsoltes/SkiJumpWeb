import { JumpResult } from '@wieslawsoltes/ski-physics';
import { Replay, ReplayPlayerInfo } from '@wieslawsoltes/ski-replay';
export interface Settings {
    resolution: 'classic' | 'sharp' | 'native';
    renderer: 'auto' | 'webgl' | 'software';
    weather: 'clear' | 'snow' | 'dusk' | 'night';
    volume: number;
    mute: boolean;
    sensitivity: number;
    control: 'modern' | 'classic';
    assist: boolean;
    guide: boolean;
    ghost: boolean;
    camera: 'classic' | 'close' | 'wide' | 'chase';
    haptics: boolean;
    windStrength: number;
    windBase: number | null;
    gate: number;
    watchCPU: boolean;
    difficulty: number;
    aiCount: number;
    scanlines: boolean;
    showFPS: boolean;
    motion: boolean;
}
export interface HillRecord {
    distance: number;
    total: number;
    name: string;
    country?: string;
    date: string;
    assisted: boolean;
    gate: number;
    wind: number;
}
export interface Stats {
    jumps: number;
    landings: number;
    falls: number;
    distance: number;
    cups: number;
}
export interface ReplayEntry {
    label?: string;
    id: string;
    name: string;
    hillId: string;
    distance: number;
    date: string;
}
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
export declare const DEFAULT_SETTINGS: Readonly<Settings>;
export declare function validateSettings(raw?: Partial<Settings>): Settings;
export declare class GameStore {
    storage: StorageLike | null;
    prefix: string;
    memory: Map<string, string>;
    persistent: boolean;
    lastError: string | null;
    constructor(storage?: StorageLike | null, prefix?: string);
    get<T = unknown>(key: string, fallback?: T): T;
    set(key: string, value: unknown): boolean;
    remove(key: string): void;
    settings(): Settings;
    saveSettings(settings: Partial<Settings>): boolean;
    records(): Record<string, HillRecord>;
    recordKey(hillId: string, assisted?: boolean): string;
    leaderboards(): Record<string, HillRecord[]>;
    hillLeaderboard(hillId: string, assisted?: boolean, limit?: number): HillRecord[];
    personalBests(name: string, assisted?: boolean): Record<string, HillRecord>;
    tours(): Array<{ name: string; hills: string[] }>;
    saveTour(tour: { name: string; hills: string[] }): string;
    deleteTour(name: string): void;
    renameReplay(id: string, name: string): void;
    updateRecord(result: JumpResult, player: ReplayPlayerInfo, replay?: Replay | null): boolean;
    ghost(hillId: string, assisted?: boolean): Replay | null;
    replays(): ReplayEntry[];
    saveReplay(replay: Replay): string;
    loadReplay(id: string): Replay | null;
    deleteReplay(id: string): void;
    stats(): Stats;
    addJump(result: JumpResult): void;
    exportData(): string;
    importData(text: string): void;
}
