/* eslint-disable @typescript-eslint/no-use-before-define */
import { UnknownError } from '@stop-n-swop/abyss';
import { nanoid } from 'nanoid';
import type { SubscribeType } from './subscribe';
import type { EmitType } from './emit';

type EventBase = { rayId: string; [key: string]: any };

export type WatchEmitType<E extends EventBase> = <
  T extends keyof E,
  U extends keyof E,
  V extends keyof E,
>(
  signal: T,
  payload: Omit<E[T], 'rayId'>,
  success: U,
  failure?: V,
) => Promise<E[U]>;

export const makeWatchEmit =
  <E extends EventBase>(
    subscribe: SubscribeType<E>,
    emit: EmitType<E>,
  ): WatchEmitType<E> =>
  (signal, payload, success, failure) => {
    return new Promise((res, rej) => {
      const rayId = nanoid();
      const name = `watchEmit(${String(signal)} -> ${String(success)}/${String(
        failure,
      )}) (${rayId})`;
      const cancel = () => {
        u1?.();
        u2();
        clearTimeout(h);
      };
      const u1 = failure
        ? subscribe(
            failure,
            name,
            (data) => data.rayId === rayId,
            (data) => {
              cancel();
              rej(data);
            },
          )
        : null;
      const u2 = subscribe(
        success,
        name,
        (data) => data.rayId === rayId,
        (data) => {
          cancel();
          res(data);
        },
      );
      const h = setTimeout(() => {
        cancel();
        rej(
          new UnknownError(
            `No success/failure message received. [${String(
              signal,
            )}] -> [${String(success)}]/[${String(failure)}] (rayId: ${rayId})`,
          ),
        );
      }, 10000);

      setTimeout(() => {
        emit(signal, { ...payload, rayId } as any);
      }, 50);
    });
  };
