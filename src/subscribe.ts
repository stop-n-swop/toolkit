import { responseToError } from '@stop-n-swop/abyss';
import { Redis } from './cache';

type SubscribeBase = Record<string, any>;

export type Unsubscribe = () => void;

export interface SubscribeType<E extends SubscribeBase> {
  <K extends keyof E>(key: K, callback: (data: E[K]) => any): Unsubscribe;
  <K extends keyof E>(
    key: K,
    name: string,
    callback: (data: E[K]) => any,
  ): Unsubscribe;
  <K extends keyof E>(
    key: K,
    filter: (data: E[K]) => boolean,
    callback: (data: E[K]) => any,
  ): Unsubscribe;
  <K extends keyof E>(
    key: K,
    name: string,
    filter: (data: E[K]) => boolean,
    callback: (data: E[K]) => any,
  ): Unsubscribe;
}

const makeListener =
  (
    filter: (data: any) => boolean,
    name: string,
    key: string,
    callback: (data: any) => any,
  ) =>
  async (data: any) => {
    try {
      if (filter && filter(data) === false) {
        return;
      }
      console.debug(
        `Triggering subscriber [${name}] for event [${key}] (rayId: ${data.rayId})`,
      );
      await callback(data);
    } catch (e) {
      console.error(e);
    }
  };

const addListenerGroup = (
  client: Redis,
  listeners: Record<string, Array<(data: any) => void>>,
  key: string,
) => {
  // eslint-disable-next-line no-param-reassign
  listeners[key] = [];
  client.subscribe(key, (message) => {
    const data = JSON.parse(message);
    // hydrate errors
    if (data.error) {
      data.error = responseToError({
        status: data.error?.status,
        error: data.error?.body,
      });
    }
    listeners[key]?.forEach((cb) => cb(data));
  });
};

const addListener = (
  client: Redis,
  listeners: Record<string, Array<(data: any) => void>>,
  key: string,
  listener: (data: any) => void,
) => {
  if (!listeners[key]) {
    addListenerGroup(client, listeners, key);
  }
  listeners[key].push(listener);
};

const removeListener = (
  listeners: Record<string, Array<(data: any) => void>>,
  key: string,
  listener: (data: any) => void,
) => {
  if (!listeners[key]) {
    return;
  }
  const i = listeners[key].indexOf(listener);
  if (i >= 0) {
    listeners[key].splice(i, 1);
  }
};

export const makeSubscribe = <E extends SubscribeBase>(
  redis: Redis,
): SubscribeType<E> => {
  const client = redis.duplicate();
  client.connect();
  const listeners: Record<string, Array<(data: any) => void>> = {};

  return (...args: any[]) => {
    // The first arg is always key
    const key = args.shift();
    // The last arg is always callback
    const callback: (data: any) => any = args.pop();

    // Now we need to work out the args inbetween
    let filter: (data: any) => boolean = null;
    let name: string = key;

    while (args.length) {
      const arg = args.pop();
      if (typeof arg === 'function') {
        filter = arg;
      } else if (typeof arg === 'string') {
        name = arg;
      }
    }

    console.debug(`Subscriber for [${String(key)}]`);

    const listener = makeListener(filter, name, key, callback);

    addListener(client, listeners, key, listener);

    return () => {
      removeListener(listeners, key, listener);
    };
  };
};
