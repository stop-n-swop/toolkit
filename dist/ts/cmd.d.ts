import { Document, Model } from 'mongoose';
import { Database } from './connectDatabase';
export type CmdRecord = {
    id: string;
};
export type CmdDoc = CmdRecord & Document;
export type CmdModel = Model<CmdRecord>;
export type Cmd = <F extends (...args: any[]) => Promise<any>>(fn: F) => F;
export declare const makeCmd: (model: CmdModel) => Cmd;
export declare const makeCmdModel: (db: Database) => Model<CmdRecord, any, any>;
