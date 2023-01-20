import type { SubscribeType } from './subscribe';
import type { EmitType } from './emit';
type AnyEvent = {
    rayId: string;
    [key: string]: any;
};
type AnyEvents = Record<string, AnyEvent>;
export type WatchEmitType<E extends AnyEvents> = <T extends keyof E, U extends keyof E, V extends keyof E>(signal: T, payload: Omit<E[T], 'rayId'>, success: U, failure?: V) => Promise<E[U]>;
export declare const makeWatchEmit: <E extends AnyEvents>(subscribe: SubscribeType<E>, emit: EmitType<E>) => WatchEmitType<E>;
export {};
