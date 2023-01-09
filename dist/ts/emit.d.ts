import { Redis } from './cache';
type EmitBase = Record<string, any>;
export interface EmitType<E extends EmitBase> {
    <K extends keyof E>(key: K, data: E[K]): void;
}
export declare const makeEmit: <E extends EmitBase>(redis: Redis) => EmitType<E>;
export {};
