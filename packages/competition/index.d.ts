import { Hill } from '@wieslawsoltes/ski-hills';
import { JumpResult, JumpOptions } from '@wieslawsoltes/ski-physics';
export interface Player {
    id: string;
    name: string;
    country: string;
    suit: string;
    helmet: string;
    skis: string;
    team: string;
    human: boolean;
    skill: number;
    teamId?: string;
    slot?: number;
}
export interface Team {
    id: string;
    name: string;
    country: string;
    members: Player[];
}
export type Ranked<T> = T & {
    rank: number;
};
export interface ScoreFields {
    total: number;
    jumps: Array<JumpResult | null>;
}
export interface EventHistory {
    hillId: string;
    rows: Array<{
        id: string;
        name: string;
        rank: number;
        total: number;
        jumps: Array<JumpResult | null>;
    }>;
}
export declare const CUP_POINTS: readonly number[];
export declare function normalizePlayer(player?: Partial<Player>, index?: number): Player;
export declare function createField(humans: Partial<Player>[], aiCount?: number, difficulty?: number): Player[];
export declare function createTeams(humans: Partial<Player>[], aiTeamCount?: number, difficulty?: number): Team[];
export declare function ranked<T extends {
    id: string;
}>(items: T[], value?: (item: T) => number): Ranked<T>[];
export interface CompetitionOptions {
    mode?: 'world' | 'team';
    hills?: string[];
    players: Player[];
    teams?: Team[] | null;
    seed?: number;
    windStrength?: number;
}
export declare class Competition {
    mode: 'world' | 'team';
    hills: string[];
    players: Player[];
    teams: Team[] | null;
    seed: number;
    eventIndex: number;
    round: 1 | 2;
    status: 'running' | 'event-complete' | 'finished';
    history: EventHistory[];
    cup: Record<string, number>;
    scores: Record<string, Array<JumpResult | null>>;
    turn: number;
    queue: string[];
    readonly hill: Hill;
    readonly competitors: Player[] | Team[];
    constructor(options: CompetitionOptions);
    beginEvent(): void;
    current(): Player | null;
    options(): JumpOptions;
    rows(): Array<Ranked<(Player | Team) & ScoreFields>>;
    submit(result: JumpResult): 'turn' | 'round' | 'event';
    nextEvent(): boolean;
    standings(): Array<Ranked<(Player | Team) & {
        total: number;
    }>>;
    cpuResult(): JumpResult;
    serialize(): string;
    static restore(text: string): Competition;
}
