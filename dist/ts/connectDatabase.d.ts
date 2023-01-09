import mongoose from 'mongoose';
export type Database = mongoose.Connection;
export declare const connectDatabase: (config: {
    db: {
        url: string;
    };
}) => Promise<Database>;
