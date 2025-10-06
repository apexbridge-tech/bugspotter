/**
 * Centralized logging utility for BugSpotter SDK
 * Provides configurable logging with support for different log levels
 */

export type LogLevel = 'debug' | 'log' | 'warn' | 'error' | 'none';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  log(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface LoggerConfig {
  enabled?: boolean;
  level?: LogLevel;
  prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  log: 1,
  warn: 2,
  error: 3,
  none: 4,
};

class BugSpotterLogger implements Logger {
  private enabled: boolean;
  private level: LogLevel;
  private prefix: string;

  constructor(config: LoggerConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.level = config.level ?? 'log';
    this.prefix = config.prefix ?? '[BugSpotter]';
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(message: string): string {
    return this.prefix ? `${this.prefix} ${message}` : message;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  log(message: string, ...args: unknown[]): void {
    if (this.shouldLog('log')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  configure(config: LoggerConfig): void {
    if (config.enabled !== undefined) this.enabled = config.enabled;
    if (config.level !== undefined) this.level = config.level;
    if (config.prefix !== undefined) this.prefix = config.prefix;
  }
}

// Default logger instance
let defaultLogger = new BugSpotterLogger();

/**
 * Get the default logger instance
 */
export function getLogger(): Logger {
  return defaultLogger;
}

/**
 * Configure the default logger
 */
export function configureLogger(config: LoggerConfig): void {
  defaultLogger.configure(config);
}

/**
 * Create a new logger instance with custom configuration
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new BugSpotterLogger(config);
}
