import { Hill, HillProfile, HillVisual } from '@wieslawsoltes/ski-hills';
export type Vec3 = [
    number,
    number,
    number
];
export interface RenderState {
    x: number;
    y: number;
    z?: number;
    phase: string;
    time?: number;
    pitch?: number;
    lean?: number;
    landing?: string;
    telemarkWidth?: number;
    crashed?: boolean;
    runoutTime?: number;
    height?: number;
    wind?: number;
}
export interface SkierAppearance {
    suit?: string;
    helmet?: string;
    skis?: string;
}
export interface RendererOptions {
    presentation?: 'classic' | 'enhanced';
    resolution?: 'classic' | 'sharp' | 'native';
    renderer?: 'auto' | 'webgl' | 'software';
    weather?: 'clear' | 'snow' | 'dusk' | 'night';
    camera?: 'classic' | 'close' | 'wide' | 'chase';
}
export interface RenderDiagnostics {
    backend: string;
    renderProfile: 'classic' | 'enhanced';
    hillId: string | null;
    visualParity: string;
    frameMilliseconds: number;
    sections: Array<{name: string; first: number; count: number}>;
    resolution: number[];
    triangles: number;
    fps: number;
    staticBytes: number;
    deviceLosses: number;
    fallbackReason: string | null;
    lastError: string | null;
}
export declare class MeshBuilder {
    data: number[];
    tri(a: Vec3, b: Vec3, c: Vec3, color: number[], lighting?: boolean): this;
    quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: number[], lighting?: boolean): this;
    box(x: number, y: number, z: number, w: number, h: number, d: number, color: number[]): this;
    beam(a: Vec3, b: Vec3, radius: number, color: number[], sides?: number): this;
    cone(x: number, y: number, z: number, radius: number, height: number, color: number[], sides?: number): this;
    sphere(x: number, y: number, z: number, radius: number, color: number[]): this;
    finish(): Float32Array;
}
export declare function createHillMesh(profile: HillProfile | Hill | string, quality?: number, record?: number): Float32Array;
export declare class SkiRenderer {
    canvas: HTMLCanvasElement;
    kind: string;
    ready: Promise<void>;
    width: number;
    height: number;
    cameraReady: boolean;
    fps: number;
    constructor(host: HTMLElement, options?: RendererOptions);
    resize(): void;
    setOptions(options: RendererOptions): void;
    setHill(hill: HillProfile | Hill | string, record?: number): void;
    render(state: RenderState, player?: SkierAppearance, dt?: number, overview?: boolean, ghost?: RenderState | null): void;
    project(x: number, y: number, z?: number): number[];
    captureFrame(): Promise<{width: number; height: number; pixels: Uint8Array}>;
    diagnostics(): RenderDiagnostics;
    dispose(): void;
}

export interface ClassicHillScene {
    vertices: Float32Array;
    sections: Array<{name: string; first: number; count: number}>;
    trees: Array<{x: number; y: number; z: number; height: number; seed: number}>;
    visual: HillVisual;
    surface: string;
    version: number;
}
export declare function createClassicHillScene(profile: HillProfile | Hill | string, record?: number): ClassicHillScene;
