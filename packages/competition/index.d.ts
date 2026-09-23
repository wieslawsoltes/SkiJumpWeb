import { Hill } from '@wieslawsoltes/ski-hills';
import { JumpResult, JumpOptions, JumpRules } from '@wieslawsoltes/ski-physics';
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
export declare const TEAM_CUP_POINTS: readonly number[];
export declare function normalizePlayer(player?: Partial<Player>, index?: number): Player;
export declare function createField(humans: Partial<Player>[], aiCount?: number, difficulty?: number): Player[];
export declare function createTeams(humans: Partial<Player>[], aiTeamCount?: number, difficulty?: number): Team[];
export declare function ranked<T extends {
    id: string;
}>(items: T[], value?: (item: T) => number): Ranked<T>[];
export interface CompetitionOptions {
    rules?: JumpRules;
    mode?: 'world' | 'team';
    hills?: string[];
    players: Player[];
    teams?: Team[] | null;
    seed?: number;
    windStrength?: number;
}
export declare class Competition {
    rules: JumpRules;
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
    startList(): Array<Player & { bib: number; group: number; completed: boolean; current: boolean; previous: JumpResult | null }>;
    target(stylePoints?: number): { leader: string; points: number; assumedStyle: number; distance: number } | null;
    teamDetails(teamId: string): Array<Player & ScoreFields>;
    cpuResult(): JumpResult;
    serialize(): string;
    static restore(text: string): Competition;
}

export declare class TourSchedule {
    hills: string[];
    name: string;
    constructor(hills?: string[], name?: string);
    insert(hillId: string, index?: number): this;
    remove(index: number): this;
    move(from: number, to: number): this;
    reverse(): this;
    shuffle(seed?: number): this;
    serialize(): string;
    static parse(text: string): TourSchedule;
}
export declare function competitionCSV(competition: Competition): string;
