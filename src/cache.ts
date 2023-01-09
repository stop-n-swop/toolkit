import { type RedisClientType, createClient } from 'redis';

export type Redis = RedisClientType;

export type Cache = {
  createKey(...deps: any[]): string;
  get<T>(key: string): Promise<[value: T, ttl: number]>;
  set<T>(key: string, value: T): Promise<void>;
  wrap<F extends (...args: any[]) => Promise<any>>(fn: F): F;
  flush(...keys: string[]): Promise<void>;
};

const CACHE_BUFFER = 60;
const TTL = 60;

export const makeCache = (redis: Redis): Cache => {
  const cache: Cache = {
    createKey(...deps) {
      return deps
        .map((x) => {
          if (typeof x === 'string') {
            return x;
          }
          return JSON.stringify(x);
        })
        .join('__');
    },
    async get(key) {
      const str = await redis.get(key);
      if (str == null) {
        return [null, -1];
      }
      const result = JSON.parse(str);
      const ttl = (await redis.ttl(key)) - CACHE_BUFFER;

      return [result, ttl];
    },
    async set(key, value) {
      await redis.setEx(key, TTL + CACHE_BUFFER, JSON.stringify(value));
    },
    async flush(key, ...search) {
      const allKeys = await redis.keys(`*${key}*`);
      const keys = allKeys.filter((key) => {
        const parts = key.split('__');
        return search.every((s) => parts.some((p) => p.includes(s)));
      });
      if (keys.length) {
        await redis.del(keys);
      }
    },
    wrap(fn): any {
      return async (...args: any[]): Promise<any> => {
        const key = cache.createKey(...args);

        const callAndCache = async () => {
          const result = await fn(...args);
          cache.set(key, result);
          return result;
        };

        const [value, ttl] = await cache.get(key);

        // Not cached
        if (value == null) {
          return callAndCache();
        }

        // Cached but stale
        if (ttl < TTL) {
          callAndCache();
          return value;
        }

        // Cached
        return value;
      };
    },
  };

  return cache;
};

export const makeRedis = (): Redis => {
  return createClient();
};
