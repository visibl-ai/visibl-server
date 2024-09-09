const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.DEBUG;

const logger = {
  debug: (...args) => currentLogLevel <= LOG_LEVELS.DEBUG && console.debug(...args),
  log: (...args) => currentLogLevel <= LOG_LEVELS.DEBUG && console.log(...args),
  info: (...args) => currentLogLevel <= LOG_LEVELS.INFO && console.info(...args),
  warn: (...args) => currentLogLevel <= LOG_LEVELS.WARN && console.warn(...args),
  error: (...args) => currentLogLevel <= LOG_LEVELS.ERROR && console.error(...args),
};

export default logger;
