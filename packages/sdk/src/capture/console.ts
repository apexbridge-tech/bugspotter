import { BaseCapture, type CaptureOptions } from './base-capture';
import { CircularBuffer } from '../core/circular-buffer';

type ConsoleLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';
const CONSOLE_METHODS: readonly ConsoleLevel[] = ['log', 'warn', 'error', 'info', 'debug'] as const;

export interface ConsoleCaptureOptions extends CaptureOptions {
  maxLogs?: number;
  captureStackTrace?: boolean;
  levels?: readonly ConsoleLevel[];
}

export class ConsoleCapture extends BaseCapture<LogEntry[], ConsoleCaptureOptions> {
  private buffer: CircularBuffer<LogEntry>;
  private captureStackTrace: boolean;
  private originalMethods: Map<string, (...args: unknown[]) => void> = new Map();

  constructor(options: ConsoleCaptureOptions = {}) {
    super(options);
    const maxLogs = options.maxLogs ?? 100;
    this.buffer = new CircularBuffer<LogEntry>(maxLogs);
    this.captureStackTrace = options.captureStackTrace ?? true;
    this.interceptConsole(options.levels ?? CONSOLE_METHODS);
  }

  capture(): LogEntry[] {
    return this.getLogs();
  }

  private formatMessage(args: unknown[]): string {
    if (!args || args.length === 0) {
      return '';
    }

    // Sanitize args if sanitizer is enabled
    const sanitizedArgs = this.sanitizer ? this.sanitizer.sanitizeConsoleArgs(args) : args;

    return sanitizedArgs
      .map((arg) => {
        if (arg === null) {
          return 'null';
        }
        if (arg === undefined) {
          return 'undefined';
        }
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return `[${arg.constructor?.name || 'Object'}]`;
          }
        }
        return String(arg);
      })
      .join(' ');
  }

  private createLogEntry(method: ConsoleLevel, args: unknown[]): LogEntry {
    const log: LogEntry = {
      level: method,
      message: this.formatMessage(args),
      timestamp: Date.now(),
    };

    if (this.captureStackTrace && method === 'error') {
      const stack = this.captureStack();
      log.stack = this.sanitizer && stack ? (this.sanitizer.sanitize(stack) as string) : stack;
    }

    return log;
  }

  private captureStack(): string | undefined {
    const stack = new Error().stack;
    // Remove first 3 lines (Error, captureStack, createLogEntry)
    return stack?.split('\n').slice(3).join('\n');
  }

  private addLog(log: LogEntry): void {
    this.buffer.add(log);
  }

  private interceptConsole(levels: readonly ConsoleLevel[] = CONSOLE_METHODS): void {
    levels.forEach((method) => {
      try {
        const original = console[method];
        this.originalMethods.set(method, original);

        console[method] = (...args: unknown[]) => {
          try {
            const log = this.createLogEntry(method, args);
            this.addLog(log);
          } catch (error) {
            this.handleError('creating log entry', error);
          }
          original.apply(console, args);
        };
      } catch (error) {
        this.handleError(`intercepting console.${method}`, error);
      }
    });
  }

  getLogs(): LogEntry[] {
    return this.buffer.getAll();
  }

  clear(): void {
    this.buffer.clear();
  }

  destroy(): void {
    try {
      this.originalMethods.forEach((original, method) => {
        const consoleMethod = method as ConsoleLevel;
        console[consoleMethod] = original as Console[typeof consoleMethod];
      });
      this.originalMethods.clear();
    } catch (error) {
      this.handleError('destroying console capture', error);
    }
  }
}

export interface LogEntry {
  level: ConsoleLevel;
  message: string;
  timestamp: number;
  stack?: string;
}
