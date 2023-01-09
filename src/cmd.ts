/* eslint-disable no-await-in-loop */
import { Document, Model, Schema } from 'mongoose';
import { after, t } from '@stop-n-swop/contracts';
import { nanoid } from 'nanoid';
import { Database } from './connectDatabase';

export type CmdRecord = { id: string };
export type CmdDoc = CmdRecord & Document;
export type CmdModel = Model<CmdRecord>;

export type Cmd = <F extends (...args: any[]) => Promise<any>>(fn: F) => F;

const POLL_INTERVAL = 200; // 200ms
const MAX_WAIT_TIME = 1000 * 30; // 30s
const MAX_TRIES = Math.ceil(MAX_WAIT_TIME / POLL_INTERVAL);

// Wrap a command function in a queue system
// Essentially when you call the command function
// You're given a ticket number
// The ticket number is added to a queue of tickets in the db
// Then we poll until our ticket number is at the top of the list
// We allow the command function to run, then remove our ticket from the list
export const makeCmd =
  (model: CmdModel): Cmd =>
  (fn) => {
    return (async (...args: any[]) => {
      // This call's ticket
      const ticket = nanoid(6);
      // Add the ticket to the queue
      await model.create({ id: ticket, stack: new Error(ticket).stack });
      let tries = 0;
      // Get the first item in the queue
      let current = (await model.findOne().sort({ createdAt: 1 }))?.id;

      // Poll until we're at the top of the list
      while (current !== ticket) {
        // console.log(`${current} != ${ticket}`);
        // We've been polling for ages now!
        if (tries >= MAX_TRIES) {
          console.warn(
            `${ticket}: max tries (${MAX_TRIES}) exceeded, stuck on ticket ${current}`,
          );
          // If current is null then something's gone wrong and the queue is somehow empty!
          if (current == null) {
            await model.create({ id: ticket });
            // If a request has taken this long, it's probably crashed or died or the server was stopped
            // Delete the ticket from the queue. Sorry ticket.
          } else {
            await model.deleteOne({ id: current });
          }
          // After attempting to recover, reset the try counter
          tries = 0;
        }
        tries += 1;

        await after(POLL_INTERVAL);
        // Check what's now at the top of the list
        current = (await model.findOne().sort({ createdAt: 1 }))?.id;
      }

      // If we get here we've made it to the top of the queue huzzah!
      // We want to try/catch the result because either way, we need to remove the queue item
      const [err, result] = await t(fn(...args));
      await model.deleteOne({ id: ticket });

      // Pass the result through to the caller
      if (err) {
        throw err;
      }
      return result;
    }) as any;
  };

export const makeCmdModel = (db: Database) => {
  const schema = new Schema<CmdRecord>(
    { id: String, stack: String },
    { timestamps: true },
  );
  return db.model('cmd', schema);
};
