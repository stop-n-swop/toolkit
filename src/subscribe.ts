import { Redis } from './cache';

type SubscribeBase = Record<string, any>;

export type Unsubscribe = () => void;

export interface SubscribeType<E extends SubscribeBase> {
  <K extends keyof E>(
    key: K,
    name: string,
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
        `Triggering subscriber [${name}] for event [${String(key)}]`,
      );
      await callback(data);
    } catch (e) {
      console.error(e);
    }
  };

const addListener = (
  client: Redis,
  listeners: Record<string, Array<(data: any) => void>>,
  key: string,
  listener: (data: any) => void,
) => {
  if (!listeners[key]) {
    // eslint-disable-next-line no-param-reassign
    listeners[key] = [listener];
    client.subscribe(key, (message) => {
      const data = JSON.parse(message);
      listeners[key]?.forEach((cb) => cb(data));
    });
  } else {
    listeners[key].push(listener);
  }
};
const removeListener = (
  client: Redis,
  listeners: Record<string, Array<(data: any) => void>>,
  key: string,
  listener: (data: any) => void,
) => {
  if (!listeners[key]) {
    return;
  }
  const i = listeners[key].indexOf(listener);
  if (i >= 0) {
    listeners[key].splice(i);
  }
  if (listeners[key].length === 0) {
    client.unsubscribe(key);
  }
};

export const makeSubscribe = <E extends SubscribeBase>(
  redis: Redis,
): SubscribeType<E> => {
  const client = redis.duplicate();
  client.connect();
  const listeners: Record<string, Array<(data: any) => void>> = {};

  return (key: string, name: string, ...rest: any[]) => {
    console.debug(`Subscriber for [${String(key)}]`);
    const callback = rest.pop();
    const filter = rest.pop();

    const listener = makeListener(filter, name, key, callback);

    addListener(client, listeners, key, listener);

    return () => {
      removeListener(client, listeners, key, listener);
    };
  };
};
