import winston from 'winston';

export const makeLogger = () => {
  if (process.env.NODE_ENV === 'production') {
    const format = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
      // winston.format.colorize({ all: true }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    const transports = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ level, message }) => `user-service: ${level}: ${message}`,
          ),
        ),
      }),
    ];

    const logger = winston.createLogger({
      level: 'verbose',
      defaultMeta: {},
      transports,
    });

    logger.add(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format,
      }),
    );
    logger.add(
      new winston.transports.File({ filename: 'logs/all.log', format }),
    );

    console.debug = logger.verbose.bind(logger);
    console.info = logger.info.bind(logger);
    console.warn = logger.warn.bind(logger);
    console.error = logger.error.bind(logger);
  }
};
