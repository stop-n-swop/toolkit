import {
  BaseError,
  IError,
  UnknownError,
  ValidationError,
} from '@stop-n-swop/abyss';
import { nanoid } from 'nanoid';
import { Redis } from './cache';

type EmitBase = Record<string, any>;

export interface EmitType<E extends EmitBase> {
  <K extends keyof E>(key: K, data: E[K]): void;
}

const normalizeError = (e: any): IError => {
  if (e?.details?.[0]?.message) {
    // Joi / Validation error
    const errors = e.details.reduce(
      (acc: Record<string, string>, e: { path: string[]; message: string }) => {
        const key = e.path.join('.');

        return { ...acc, [key]: e.message };
      },
      {} as Record<string, string>,
    );
    return new ValidationError(errors);
  }
  if (e instanceof BaseError) {
    return e;
  }
  console.warn(e);
  return new UnknownError(e.message);
};

export const makeEmit = <E extends EmitBase>(redis: Redis): EmitType<E> => {
  const client = redis.duplicate();
  client.connect();
  return (key, _data) => {
    const data = { ..._data };
    // Serialise errors
    if (data?.error) {
      data.error = normalizeError(data.error).toHttpResponse();
    }
    if (!data.rayId) {
      data.rayId = nanoid(7);
    }
    console.debug(`Event [${String(key)}] (rayId ${data.rayId})`);
    client.publish(key as string, JSON.stringify(data));
  };
};
