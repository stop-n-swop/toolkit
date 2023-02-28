import { format, createLogger, transports } from 'winston';
import 'winston-daily-rotate-file';

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
            ({ level, message }) =>
              `${service}: ${level}: ${JSON.stringify(message)}`,
          ),
        ),
      }),
    ];

    const logger = createLogger({
      level: 'verbose',
      defaultMeta: { service },
      transports: logTransports,
    });

    logger.add(
      new transports.DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        level: 'error',
        format: logFormat,
      }),
    );
    logger.add(
      new transports.DailyRotateFile({
        filename: 'logs/all-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        format: logFormat,
      }),
    );

    console.debug = logger.verbose.bind(logger);
    console.info = logger.info.bind(logger);
    console.warn = logger.warn.bind(logger);
    console.error = logger.error.bind(logger);
  }
};
