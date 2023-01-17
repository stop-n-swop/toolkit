import { type RedisClientType, createClient } from 'redis';

export type Redis = RedisClientType;

export type CacheType<E extends Record<string, any>> = {
  // createKey<K extends keyof E>(key: K, args: Record<string, any>): string;
  get<K extends keyof E>(
    key: K,
    args: Record<string, any>,
  ): Promise<[value: E[K], ttl: number]>;
  set<K extends keyof E>(
    key: K,
    args: Record<string, any>,
    value: E[K],
  ): Promise<void>;
  withCache<K extends keyof E, F extends () => Promise<any>>(
    key: K,
    args: Record<string, any>,
    fn: F,
  ): ReturnType<F>;
  flush<K extends keyof E>(key: K, ...keys: string[]): Promise<void>;
};

const CACHE_BUFFER = 60;
const TTL = 60;

const createKey = (...deps: any[]) => {
  return deps
    .map((x) => {
      if (typeof x === 'string') {
        return x;
      }
      return JSON.stringify(x);
    })
    .join('__');
};

export const makeCache = <E extends Record<string, any>>(
  redis: Redis,
): CacheType<E> => {
  const cache: CacheType<E> = {
    async get(key, args) {
      const cacheKey = createKey(key, args);
      const str = await redis.get(cacheKey);
      if (str == null) {
        return [undefined, -1];
      }
      const result = JSON.parse(str);
      const ttl = (await redis.ttl(cacheKey)) - CACHE_BUFFER;

      return [result, ttl];
    },
    async set(key, args, value) {
      const cacheKey = createKey(key, args);
      const expires = TTL + CACHE_BUFFER;
      await redis.setEx(cacheKey, expires, JSON.stringify(value));
    },
    async flush(key, ...search) {
      const allKeys = await redis.keys(`*${createKey(key)}*`);
      const keys = allKeys.filter((key) => {
        const parts = key.split('__');
        return search.every((s) => parts.some((p) => p.includes(s)));
      });
      if (keys.length) {
        await redis.del(keys);
      }
    },
    // @ts-ignore
    async withCache(key, args, fn) {
      const cacheKey = createKey(key, args);

      const callAndCache = async () => {
        const result = await fn();
        cache.set(cacheKey, args, result);
        return result;
      };

      const [value, ttl] = await cache.get(cacheKey, args);

      // Not cached
      if (value === undefined) {
        return callAndCache();
      }

      // Stale
      if (ttl < TTL) {
        callAndCache();
        return value;
      }

      // Cached
      return value;
    },
  };

  return cache;
};

export const makeRedis = (): Redis => {
  return createClient();
};
