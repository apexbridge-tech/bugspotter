type ConsoleLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';
const CONSOLE_METHODS: readonly ConsoleLevel[] = ['log', 'warn', 'error', 'info', 'debug'] as const;

export interface ConsoleCaptureOptions {
  maxLogs?: number;
  captureStackTrace?: boolean;
  levels?: readonly ConsoleLevel[];
}

export class ConsoleCapture {
  private logs: LogEntry[] = [];
  private maxLogs: number;
  private logIndex = 0;
  private logCount = 0;
  private captureStackTrace: boolean;
  private originalMethods: Map<string, (...args: unknown[]) => void> = new Map();

  constructor(options: ConsoleCaptureOptions = {}) {
    this.maxLogs = options.maxLogs ?? 100;
    this.captureStackTrace = options.captureStackTrace ?? true;
    this.interceptConsole(options.levels ?? CONSOLE_METHODS);
  }

  private formatMessage(args: unknown[]): string {
    if (!args || args.length === 0) return '';
    
    return args
      .map((arg) => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch (error) {
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
      log.stack = this.captureStack();
    }

    return log;
  }

  private captureStack(): string | undefined {
    const stack = new Error().stack;
    // Remove first 3 lines (Error, captureStack, createLogEntry)
    return stack?.split('\n').slice(3).join('\n');
  }

  private addLog(log: LogEntry): void {
    if (this.logCount < this.maxLogs) {
      this.logs.push(log);
      this.logCount++;
    } else {
      this.logs[this.logIndex] = log;
    }
    this.logIndex = (this.logIndex + 1) % this.maxLogs;
  }

  private interceptConsole(levels: readonly ConsoleLevel[] = CONSOLE_METHODS): void {
    levels.forEach((method) => {
      const original = console[method];
      this.originalMethods.set(method, original);

      console[method] = (...args: unknown[]) => {
        const log = this.createLogEntry(method, args);
        this.addLog(log);
        original.apply(console, args);
      };
    });
  }

  getLogs(): LogEntry[] {
    if (this.logCount < this.maxLogs) {
      return [...this.logs];
    }
    // Return logs in chronological order
    return [
      ...this.logs.slice(this.logIndex),
      ...this.logs.slice(0, this.logIndex)
    ];
  }

  clear(): void {
    this.logs = [];
    this.logIndex = 0;
    this.logCount = 0;
  }

  destroy(): void {
    this.originalMethods.forEach((original, method) => {
      const consoleMethod = method as ConsoleLevel;
      console[consoleMethod] = original as Console[typeof consoleMethod];
    });
    this.originalMethods.clear();
  }
}

export interface LogEntry {
  level: ConsoleLevel;
  message: string;
  timestamp: number;
  stack?: string;
}
