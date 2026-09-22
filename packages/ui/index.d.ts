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
    guide?: boolean;
    weather?: string;
    showFPS?: boolean;
}
export declare class JumpHUD {
    constructor(canvas: HTMLCanvasElement);
    render(state: HUDState, hill: {
        name: string;
        k: number;
    }, player: {
        name: string;
        country?: string;
    }, settings: HUDOptions, meta?: {
        mode?: string;
        replay?: boolean;
        touch?: boolean;
        backend?: string;
        fps?: number;
    }): void;
}
