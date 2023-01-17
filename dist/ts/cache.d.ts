import { type RedisClientType } from 'redis';
export type Redis = RedisClientType;
export type CacheType<E extends Record<string, any>> = {
    get<K extends keyof E>(key: K, args: Record<string, any>): Promise<[value: E[K], ttl: number]>;
    set<K extends keyof E>(key: K, args: Record<string, any>, value: E[K]): Promise<void>;
    withCache<K extends keyof E, F extends () => Promise<any>>(key: K, args: Record<string, any>, fn: F): ReturnType<F>;
    flush<K extends keyof E>(key: K, ...keys: string[]): Promise<void>;
};
export declare const makeCache: <E extends Record<string, any>>(redis: Redis) => CacheType<E>;
export declare const makeRedis: () => Redis;
