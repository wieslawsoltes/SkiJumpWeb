export declare const GLYPHS: Record<string, string[]>;
export declare function plainASCII(text: unknown): string;
export declare function textWidth(text: string, scale?: number): number;
export declare function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color?: string, scale?: number, shadow?: boolean): number;
export declare function pixelCanvas(text: string, color?: string, scale?: number): HTMLCanvasElement;
export declare function paintLabels(root?: ParentNode): void;
export declare function drawLogo(canvas: HTMLCanvasElement): void;
export declare function escapeHTML(value: unknown): string;
export declare function downloadText(filename: string, text: string, mime?: string): void;
export interface HUDState {
    gateElapsed?: number;
    startRemaining?: number;
    disqualified?: boolean;
    windAngle?: number;
    phase: string;
    time: number;
    speed: number;
    distance: number;
    wind: number;
    lean: number;
    quality: number;
    landing: string;
    crashed: boolean;
    x: number;
    y: number;
    height: number;
    flightTime: number;
}
export interface HUDOptions {
    presentation?: 'classic' | 'enhanced';
    guide?: boolean;
    weather?: string;
    showFPS?: boolean;
}
export interface HUDMeta {
    mode?: string; replay?: boolean; touch?: boolean; backend?: string; fps?: number;
    result?: { distance: number; judges: number[]; counted: number[]; disqualified?: boolean } | null;
}
export declare class JumpHUD {
    constructor(canvas: HTMLCanvasElement);
    render(state: HUDState, hill: {
        name: string;
        k: number;
    }, player: {
        name: string;
        country?: string;
    }, settings: HUDOptions, meta?: HUDMeta): void;
}

export declare const CLASSIC_HUD_LAYOUT: Readonly<{ width: 320; height: 200; statusHeight: 13; windWidth: 29; windHeight: 27; right: 4; top: 3; judgeTop: 58; judgeStep: 12 }>;
export declare function drawClassicHUD(ctx: CanvasRenderingContext2D, width: number, height: number, state: HUDState, hill: { name: string; k: number }, player: { name: string; country?: string }, options?: HUDOptions, meta?: HUDMeta): void;
