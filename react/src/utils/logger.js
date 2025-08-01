// react/src/utils/logger.js

/**
 * Log levels enum
 */
export const LogLevel = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  LOG: 4,
  DEBUG: 5
};

/**
 * Logger utility for consistent logging throughout the application
 * Can be easily configured for different environments
 */
class Logger {
  constructor(prefix = '[App]', options = {}) {
    this.prefix = prefix;
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    // Set log level from environment variable or options
    // Default to INFO for all environments
    const envLogLevel = process.env.REACT_APP_LOG_LEVEL?.toUpperCase();
    const defaultLevel = LogLevel.DEBUG;
    
    this.logLevel = options.logLevel || 
                    (envLogLevel && LogLevel[envLogLevel]) || 
                    defaultLevel;
  }

  _shouldLog(level) {
    return level <= this.logLevel;
  }

  _formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    return [`${timestamp} ${this.prefix} [${level}]`, message, ...args];
  }

  log(message, ...args) {
    if (this._shouldLog(LogLevel.LOG)) {
      console.log(...this._formatMessage('LOG', message, ...args));
    }
  }

  info(message, ...args) {
    if (this._shouldLog(LogLevel.INFO)) {
      console.info(...this._formatMessage('INFO', message, ...args));
    }
  }

  warn(message, ...args) {
    if (this._shouldLog(LogLevel.WARN)) {
      console.warn(...this._formatMessage('WARN', message, ...args));
    }
  }

  error(message, ...args) {
    if (this._shouldLog(LogLevel.ERROR)) {
      console.error(...this._formatMessage('ERROR', message, ...args));
    }
  }

  debug(message, ...args) {
    if (this._shouldLog(LogLevel.DEBUG)) {
      console.debug(...this._formatMessage('DEBUG', message, ...args));
    }
  }

  // Create a child logger with a new prefix
  createChild(childPrefix, options = {}) {
    return new Logger(`${this.prefix}${childPrefix}`, {
      logLevel: options.logLevel || this.logLevel
    });
  }

  // Set log level dynamically
  setLogLevel(level) {
    this.logLevel = level;
  }
}

// Export singleton instance and class
export const logger = new Logger();
export default Logger;