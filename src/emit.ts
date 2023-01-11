import { nanoid } from 'nanoid';
import { Redis } from './cache';

type EmitBase = Record<string, any>;

export interface EmitType<E extends EmitBase> {
  <K extends keyof E>(key: K, data: E[K]): void;
}

export const makeEmit = <E extends EmitBase>(redis: Redis): EmitType<E> => {
  const client = redis.duplicate();
  client.connect();
  return (key, _data) => {
    const data = { ..._data };
    // Serialise errors
    if (data?.error?.toHttpResponse) {
      data.error = data.error.toHttpResponse();
    }
    if (!data.rayId) {
      data.rayId = nanoid(7);
    }
    console.debug(`Event [${String(key)}] (rayId ${data.rayId})`);
    client.publish(key as string, JSON.stringify(data));
  };
};
