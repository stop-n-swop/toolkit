import mongoose from 'mongoose';

export type Database = mongoose.Connection;

export const connectDatabase = async (config: {
  db: { url: string };
}): Promise<Database> => {
  const { connection } = await mongoose.connect(config.db.url, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useFindAndModify: false,
  });

  return connection;
};
