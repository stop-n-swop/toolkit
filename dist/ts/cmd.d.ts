import type { CmdModel } from '@stop-n-swop/models';
export type Cmd = <F extends (...args: any[]) => Promise<any>>(fn: F) => F;
export declare const makeCmd: (Cmd: CmdModel) => Cmd;
