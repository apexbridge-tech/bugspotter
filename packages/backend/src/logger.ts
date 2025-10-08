/**
 * Logger interface and default implementation
 * Users can provide their own logger implementation (pino, winston, etc.)
 */

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Default console-based logger
 * Provides basic logging functionality with optional metadata
 */
class ConsoleLogger implements Logger {
  private formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatMessage('error', message, meta));
  }
}

/**
 * Global logger instance
 * Can be replaced by users with their own logger
 */
let globalLogger: Logger = new ConsoleLogger();

/**
 * Set a custom logger implementation
 * @example
 * import pino from 'pino';
 * setLogger(pino());
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger;
}

/**
 * Get the current logger instance
 */
export function getLogger(): Logger {
  return globalLogger;
}
