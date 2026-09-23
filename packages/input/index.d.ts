export interface InputOptions {
    sensitivity?: number;
    control?: 'modern' | 'classic';
    motion?: boolean;
    rules?: 'legacy' | 'dsj210';
}
export interface InputHandlers {
    phase?: () => string;
    action?: (name: string) => void;
    lean?: (delta: number) => void;
    unlock?: () => unknown;
}
export declare class SkiInput {
    enabled: boolean;
    options: InputOptions;
    constructor(element: HTMLElement, handlers: InputHandlers, options?: InputOptions);
    virtualButton(side: 'left' | 'right', down: boolean): void;
    setEnabled(value: boolean): void;
    setOptions(options: InputOptions): void;
    phase(): string;
    action(name: string): void;
    primary(parallel?: boolean): void;
    poll(dt: number): void;
    enableMotion(): Promise<boolean>;
    calibrate(): void;
    reset(): void;
    dispose(): void;
}
