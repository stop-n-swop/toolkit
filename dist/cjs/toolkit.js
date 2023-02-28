'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var redis = require('redis');
var contracts = require('@stop-n-swop/contracts');
var nanoid = require('nanoid');
var mongoose = require('mongoose');
var abyss = require('@stop-n-swop/abyss');
var winston = require('winston');
require('winston-daily-rotate-file');
var crypto = require('crypto');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var mongoose__default = /*#__PURE__*/_interopDefaultLegacy(mongoose);
var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);

const CACHE_BUFFER = 60;
const TTL = 60;
const createKey = function () {
  for (var _len = arguments.length, deps = new Array(_len), _key = 0; _key < _len; _key++) {
    deps[_key] = arguments[_key];
  }
  return deps.map(x => {
    if (typeof x === 'string') {
      return x;
    }
    return JSON.stringify(x);
  }).join('__');
};
const makeCache = redis => {
  const cache = {
    async get(key, args) {
      const cacheKey = createKey(key, args);
      const str = await redis.get(cacheKey);
      if (str == null) {
        return [undefined, -1];
      }
      const result = JSON.parse(str);
      const ttl = (await redis.ttl(cacheKey)) - CACHE_BUFFER;
      return [result, ttl];
    },
    async set(key, args, value) {
      const cacheKey = createKey(key, args);
      const expires = TTL + CACHE_BUFFER;
      await redis.setEx(cacheKey, expires, JSON.stringify(value));
    },
    async flush(key) {
      for (var _len2 = arguments.length, search = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        search[_key2 - 1] = arguments[_key2];
      }
      const allKeys = await redis.keys(`*${createKey(key)}*`);
      const keys = allKeys.filter(key => {
        const parts = key.split('__');
        return search.every(s => parts.some(p => p.includes(s)));
      });
      if (keys.length) {
        await redis.del(keys);
      }
    },
    async withCache(key, args, fn) {
      const cacheKey = createKey(key, args);
      const callAndCache = async () => {
        const result = await fn();
        cache.set(cacheKey, args, result);
        return result;
      };
      const [value, ttl] = await cache.get(cacheKey, args);
      if (value === undefined) {
        return callAndCache();
      }
      if (ttl < TTL) {
        callAndCache();
        return value;
      }
      return value;
    }
  };
  return cache;
};
const makeRedis = () => {
  return redis.createClient();
};

const POLL_INTERVAL = 200;
const MAX_WAIT_TIME = 1000 * 30;
const MAX_TRIES = Math.ceil(MAX_WAIT_TIME / POLL_INTERVAL);
const makeCmd = Cmd => fn => {
  return async function () {
    var _await$Cmd$findOne$so;
    const ticket = nanoid.nanoid(6);
    await Cmd.create({
      id: ticket,
      stack: new Error(ticket).stack
    });
    let tries = 0;
    let current = (_await$Cmd$findOne$so = await Cmd.findOne().sort({
      createdAt: 1
    })) == null ? void 0 : _await$Cmd$findOne$so.id;
    while (current !== ticket) {
      var _await$Cmd$findOne$so2;
      if (tries >= MAX_TRIES) {
        console.warn(`${ticket}: max tries (${MAX_TRIES}) exceeded, stuck on ticket ${current}`);
        if (current == null) {
          await Cmd.create({
            id: ticket
          });
        } else {
          await Cmd.deleteOne({
            id: current
          });
        }
        tries = 0;
      }
      tries += 1;
      await contracts.after(POLL_INTERVAL);
      current = (_await$Cmd$findOne$so2 = await Cmd.findOne().sort({
        createdAt: 1
      })) == null ? void 0 : _await$Cmd$findOne$so2.id;
    }
    const [err, result] = await contracts.t(fn(...arguments));
    await Cmd.deleteOne({
      id: ticket
    });
    if (err) {
      throw err;
    }
    return result;
  };
};

const connectDatabase = async config => {
  const {
    connection
  } = await mongoose__default["default"].connect(config.db.url, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useFindAndModify: false
  });
  return connection;
};

const normalizeError = e => {
  var _e$details, _e$details$;
  if (e != null && (_e$details = e.details) != null && (_e$details$ = _e$details[0]) != null && _e$details$.message) {
    const errors = e.details.reduce((acc, e) => {
      const key = e.path.join('.');
      return {
        ...acc,
        [key]: e.message
      };
    }, {});
    return new abyss.ValidationError(errors);
  }
  if (e instanceof abyss.BaseError) {
    return e;
  }
  console.warn(e);
  return new abyss.UnknownError(e.message);
};
const makeEmit = redis => {
  const client = redis.duplicate();
  client.connect();
  return (key, _data) => {
    const data = {
      ..._data
    };
    if (data != null && data.error) {
      data.error = normalizeError(data.error).toHttpResponse();
    }
    if (!data.rayId) {
      data.rayId = nanoid.nanoid(7);
    }
    console.debug(`Event [${String(key)}] (rayId ${data.rayId})`);
    client.publish(key, JSON.stringify(data));
  };
};

const makeLogger = service => {
  if (process.env.NODE_ENV === 'production') {
    const logFormat = winston.format.combine(winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss:ms'
    }),
    winston.format.errors({
      stack: true
    }), winston.format.json());
    const logTransports = [new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.printf(_ref => {
        let {
          level,
          message
        } = _ref;
        return `${service}: ${level}: ${JSON.stringify(message)}`;
      }))
    })];
    const logger = winston.createLogger({
      level: 'verbose',
      defaultMeta: {
        service
      },
      transports: logTransports
    });
    logger.add(new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      level: 'error',
      format: logFormat
    }));
    logger.add(new winston.transports.DailyRotateFile({
      filename: 'logs/all-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      format: logFormat
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
    console.debug(`Triggering subscriber [${name}] for event [${key}] (rayId: ${data.rayId})`);
    await callback(data);
  } catch (e) {
    console.error(e);
  }
};
const addListenerGroup = (client, listeners, key) => {
  listeners[key] = [];
  client.subscribe(key, message => {
    var _listeners$key;
    const data = JSON.parse(message);
    if (data.error) {
      var _data$error, _data$error2;
      data.error = abyss.responseToError({
        status: (_data$error = data.error) == null ? void 0 : _data$error.status,
        error: (_data$error2 = data.error) == null ? void 0 : _data$error2.body
      });
    }
    (_listeners$key = listeners[key]) == null ? void 0 : _listeners$key.forEach(cb => cb(data));
  });
};
const addListener = (client, listeners, key, listener) => {
  if (!listeners[key]) {
    addListenerGroup(client, listeners, key);
  }
  listeners[key].push(listener);
};
const removeListener = (listeners, key, listener) => {
  if (!listeners[key]) {
    return;
  }
  const i = listeners[key].indexOf(listener);
  if (i >= 0) {
    listeners[key].splice(i, 1);
  }
};
const makeSubscribe = redis => {
  const client = redis.duplicate();
  client.connect();
  const listeners = {};
  return function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    const key = args.shift();
    const callback = args.pop();
    let filter = null;
    let name = key;
    while (args.length) {
      const arg = args.pop();
      if (typeof arg === 'function') {
        filter = arg;
      } else if (typeof arg === 'string') {
        name = arg;
      }
    }
    console.debug(`Subscriber for [${String(key)}]`);
    const listener = makeListener(filter, name, key, callback);
    addListener(client, listeners, key, listener);
    return () => {
      removeListener(listeners, key, listener);
    };
  };
};

const algo = 'aes-128-gcm';
const makeCrypto = config => {
  const encrypt = (text, salt) => {
    const secret = config.auth.cryptoSecret.slice(0, 8) + salt.slice(-8);
    const iv = crypto__default["default"].randomBytes(16);
    const cipher = crypto__default["default"].createCipheriv(algo, secret, iv);
    const hash = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
    const tag = cipher.getAuthTag();
    const tags = tag.toString('hex');
    const ivs = iv.toString('hex');
    const encrypted = [ivs, hash, tags].join(':');
    return encrypted;
  };
  const decrypt = (encrypted, salt) => {
    const secret = config.auth.cryptoSecret.slice(0, 8) + salt.slice(-8);
    const [ivs, hash, tags] = encrypted.split(':');
    const iv = Buffer.from(ivs, 'hex');
    const tag = Buffer.from(tags, 'hex');
    const decipher = crypto__default["default"].createDecipheriv(algo, secret, iv);
    decipher.setAuthTag(tag);
    const decrypted = decipher.update(hash, 'hex', 'utf-8') + decipher.final('utf-8');
    return decrypted.toString();
  };
  const hash = text => {
    return new Promise((res, rej) => {
      crypto__default["default"].pbkdf2(text, process.env.CRYPTO_SECRET, 1000, 64, 'sha512', (err, derived) => {
        if (err) {
          rej(err);
          return;
        }
        res(derived.toString('hex'));
      });
    });
  };
  return {
    encrypt,
    decrypt,
    hash
  };
};

const makeWatchEmit = (subscribe, emit) => (signal, payload, success, failure) => {
  return new Promise((res, rej) => {
    const rayId = nanoid.nanoid();
    const name = `watchEmit(${String(signal)} -> ${String(success)}/${String(failure)}) (${rayId})`;
    const cancel = () => {
      u1 == null ? void 0 : u1();
      u2();
      clearTimeout(h);
    };
    const u1 = failure ? subscribe(failure, name, data => data.rayId === rayId, data => {
      cancel();
      rej(data);
    }) : null;
    const u2 = subscribe(success, name, data => data.rayId === rayId, data => {
      cancel();
      res(data);
    });
    const h = setTimeout(() => {
      cancel();
      rej(new abyss.UnknownError(`No success/failure message received. [${String(signal)}] -> [${String(success)}]/[${String(failure)}] (rayId: ${rayId})`));
    }, 30000);
    setTimeout(() => {
      emit(signal, {
        ...payload,
        rayId
      });
    }, 50);
  });
};

exports.connectDatabase = connectDatabase;
exports.makeCache = makeCache;
exports.makeCmd = makeCmd;
exports.makeCrypto = makeCrypto;
exports.makeEmit = makeEmit;
exports.makeLogger = makeLogger;
exports.makeRedis = makeRedis;
exports.makeSubscribe = makeSubscribe;
exports.makeWatchEmit = makeWatchEmit;
