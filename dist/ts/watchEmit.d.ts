import type { SubscribeType } from './subscribe';
import type { EmitType } from './emit';
type EventBase = {
    rayId: string;
    [key: string]: any;
};
export type WatchEmitType<E extends EventBase> = <T extends keyof E, U extends keyof E, V extends keyof E>(args: {
    signal: T;
    payload: Omit<E[T], 'rayId'>;
    success: U;
    failure: V;
    timeout?: number;
}) => Promise<E[U]>;
export declare const makeWatchEmit: <E extends EventBase>(subscribe: SubscribeType<E>, emit: EmitType<E>) => WatchEmitType<E>;
export {};
