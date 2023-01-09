import { type RedisClientType } from 'redis';
export type Redis = RedisClientType;
export type Cache = {
    createKey(...deps: any[]): string;
    get<T>(key: string): Promise<[value: T, ttl: number]>;
    set<T>(key: string, value: T): Promise<void>;
    wrap<F extends (...args: any[]) => Promise<any>>(fn: F): F;
    flush(...keys: string[]): Promise<void>;
};
export declare const makeCache: (redis: Redis) => Cache;
export declare const makeRedis: () => Redis;
