/**
 * Example: Using a custom logger
 *
 * This example shows how to replace the default console logger
 * with your own logging implementation (pino, winston, custom, etc.)
 */

import { createDatabaseClient, setLogger, type Logger } from '../src/index.js';

// Example 1: Simple custom logger
class CustomLogger implements Logger {
  debug(message: string, meta?: Record<string, unknown>): void {
    console.log(`[DEBUG] ${message}`, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`[INFO] ${message}`, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, meta);
  }
}

// Example 2: Structured JSON logger for production
class StructuredLogger implements Logger {
  private log(level: string, message: string, meta?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
    console.log(JSON.stringify(entry));
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }
}

// Example 3: Silent logger for tests
class SilentLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

async function main() {
  // Use custom logger
  if (process.env.NODE_ENV === 'production') {
    setLogger(new StructuredLogger());
  } else if (process.env.NODE_ENV === 'test') {
    setLogger(new SilentLogger());
  } else {
    setLogger(new CustomLogger());
  }

  // Now all database operations will use your logger
  const db = createDatabaseClient();
  const isConnected = await db.testConnection();
  console.log('Connected:', isConnected);

  await db.close();
}

main().catch(console.error);
