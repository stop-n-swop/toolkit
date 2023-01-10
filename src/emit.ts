import { Redis } from './cache';

type EmitBase = Record<string, any>;

export interface EmitType<E extends EmitBase> {
  <K extends keyof E>(key: K, data: E[K]): void;
}

export const makeEmit = <E extends EmitBase>(redis: Redis): EmitType<E> => {
  const client = redis.duplicate();
  client.connect();
  return (key, data) => {
    console.debug(`Event [${String(key)}]`);
    if (data?.error?.toHttpResponse) {
      data.error = data.error.toHttpResponse();
    }
    client.publish(key as string, JSON.stringify(data));
  };
};
