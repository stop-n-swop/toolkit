import { format, createLogger, transports } from 'winston';

export const makeLogger = (service: string) => {
  if (process.env.NODE_ENV === 'production') {
    const logFormat = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
      // format.colorize({ all: true }),
      format.errors({ stack: true }),
      format.json(),
    );

    const logTransports = [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.printf(
            ({ level, message }) => `${service}: ${level}: ${message}`,
          ),
        ),
      }),
    ];

    const logger = createLogger({
      level: 'verbose',
      defaultMeta: {},
      transports: logTransports,
    });

    logger.add(
      new transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: logFormat,
      }),
    );
    logger.add(
      new transports.File({ filename: 'logs/all.log', format: logFormat }),
    );

    console.debug = logger.verbose.bind(logger);
    console.info = logger.info.bind(logger);
    console.warn = logger.warn.bind(logger);
    console.error = logger.error.bind(logger);
  }
};
