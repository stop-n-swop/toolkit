import { createClient } from 'redis';
import mongoose, { Schema } from 'mongoose';
import { after, t } from '@stop-n-swop/contracts';
import { nanoid } from 'nanoid';
import winston from 'winston';

const CACHE_BUFFER = 60;
const TTL = 60;
const makeCache = redis => {
  const cache = {
    createKey() {
      for (var _len = arguments.length, deps = new Array(_len), _key = 0; _key < _len; _key++) {
        deps[_key] = arguments[_key];
      }
      return deps.map(x => {
        if (typeof x === 'string') {
          return x;
        }
        return JSON.stringify(x);
      }).join('__');
    },
    async get(key) {
      const str = await redis.get(key);
      if (str == null) {
        return [null, -1];
      }
      const result = JSON.parse(str);
      const ttl = (await redis.ttl(key)) - CACHE_BUFFER;
      return [result, ttl];
    },
    async set(key, value) {
      await redis.setEx(key, TTL + CACHE_BUFFER, JSON.stringify(value));
    },
    async flush(key) {
      for (var _len2 = arguments.length, search = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        search[_key2 - 1] = arguments[_key2];
      }
      const allKeys = await redis.keys(`*${key}*`);
      const keys = allKeys.filter(key => {
        const parts = key.split('__');
        return search.every(s => parts.some(p => p.includes(s)));
      });
      if (keys.length) {
        await redis.del(keys);
      }
    },
    wrap(fn) {
      return async function () {
        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }
        const key = cache.createKey(...args);
        const callAndCache = async () => {
          const result = await fn(...args);
          cache.set(key, result);
          return result;
        };
        const [value, ttl] = await cache.get(key);
        if (value == null) {
          return callAndCache();
        }
        if (ttl < TTL) {
          callAndCache();
          return value;
        }
        return value;
      };
    }
  };
  return cache;
};
const makeRedis = () => {
  return createClient();
};

const POLL_INTERVAL = 200;
const MAX_WAIT_TIME = 1000 * 30;
const MAX_TRIES = Math.ceil(MAX_WAIT_TIME / POLL_INTERVAL);
const makeCmd = model => fn => {
  return async function () {
    var _await$model$findOne$;
    const ticket = nanoid(6);
    await model.create({
      id: ticket,
      stack: new Error(ticket).stack
    });
    let tries = 0;
    let current = (_await$model$findOne$ = await model.findOne().sort({
      createdAt: 1
    })) == null ? void 0 : _await$model$findOne$.id;
    while (current !== ticket) {
      var _await$model$findOne$2;
      if (tries >= MAX_TRIES) {
        console.warn(`${ticket}: max tries (${MAX_TRIES}) exceeded, stuck on ticket ${current}`);
        if (current == null) {
          await model.create({
            id: ticket
          });
        } else {
          await model.deleteOne({
            id: current
          });
        }
        tries = 0;
      }
      tries += 1;
      await after(POLL_INTERVAL);
      current = (_await$model$findOne$2 = await model.findOne().sort({
        createdAt: 1
      })) == null ? void 0 : _await$model$findOne$2.id;
    }
    const [err, result] = await t(fn(...arguments));
    await model.deleteOne({
      id: ticket
    });
    if (err) {
      throw err;
    }
    return result;
  };
};
const makeCmdModel = db => {
  const schema = new Schema({
    id: String,
    stack: String
  }, {
    timestamps: true
  });
  return db.model('cmd', schema);
};

const connectDatabase = async config => {
  const {
    connection
  } = await mongoose.connect(config.db.url, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useFindAndModify: false
  });
  return connection;
};

const makeEmit = redis => {
  const client = redis.duplicate();
  client.connect();
  return (key, data) => {
    console.debug(`Event [${String(key)}]`);
    client.publish(key, JSON.stringify(data));
  };
};

const makeLogger = () => {
  if (process.env.NODE_ENV === 'production') {
    const format = winston.format.combine(winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss:ms'
    }),
    winston.format.errors({
      stack: true
    }), winston.format.json());
    const transports = [new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.printf(_ref => {
        let {
          level,
          message
        } = _ref;
        return `user-service: ${level}: ${message}`;
      }))
    })];
    const logger = winston.createLogger({
      level: 'verbose',
      defaultMeta: {},
      transports
    });
    logger.add(new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format
    }));
    logger.add(new winston.transports.File({
      filename: 'logs/all.log',
      format
    }));
    console.debug = logger.verbose.bind(logger);
    console.info = logger.info.bind(logger);
    console.warn = logger.warn.bind(logger);
    console.error = logger.error.bind(logger);
  }
};

const makeListener = (filter, name, key, callback) => async data => {
  try {
    if (filter && filter(data) === false) {
      return;
    }
    console.debug(`Triggering subscriber [${name}] for event [${String(key)}]`);
    await callback(data);
  } catch (e) {
    console.error(e);
  }
};
const addListener = (client, listeners, key, listener) => {
  if (!listeners[key]) {
    listeners[key] = [listener];
    client.subscribe(key, message => {
      var _listeners$key;
      const data = JSON.parse(message);
      (_listeners$key = listeners[key]) == null ? void 0 : _listeners$key.forEach(cb => cb(data));
    });
  } else {
    listeners[key].push(listener);
  }
};
const removeListener = (client, listeners, key, listener) => {
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
const makeSubscribe = redis => {
  const client = redis.duplicate();
  client.connect();
  const listeners = {};
  return function (key, name) {
    console.debug(`Subscriber for [${String(key)}]`);
    for (var _len = arguments.length, rest = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      rest[_key - 2] = arguments[_key];
    }
    const callback = rest.pop();
    const filter = rest.pop();
    const listener = makeListener(filter, name, key, callback);
    addListener(client, listeners, key, listener);
    return () => {
      removeListener(client, listeners, key, listener);
    };
  };
};

export { connectDatabase, makeCache, makeCmd, makeCmdModel, makeEmit, makeLogger, makeRedis, makeSubscribe };
