export class ConsoleCapture {
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private originalMethods: Map<string, (...args: unknown[]) => void> = new Map();

  constructor() {
    this.interceptConsole();
  }

  private interceptConsole() {
    (['log', 'warn', 'error', 'info', 'debug'] as const).forEach((method) => {
      const original = console[method];
      this.originalMethods.set(method, original);

      console[method] = (...args: unknown[]) => {
        const log: LogEntry = {
          level: method,
          message: args
            .map((a) => {
              if (typeof a === 'object') {
                try {
                  return JSON.stringify(a);
                } catch {
                  return String(a);
                }
              }
              return String(a);
            })
            .join(' '),
          timestamp: Date.now(),
        };

        // Add stack for errors
        if (method === 'error') {
          log.stack = new Error().stack;
        }

        this.logs.push(log);
        if (this.logs.length > this.maxLogs) {
          this.logs.shift();
        }
        original.apply(console, args);
      };
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  destroy(): void {
    this.originalMethods.forEach((original, method) => {
      // Restore original console methods
      type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | 'debug';
      (console[method as ConsoleMethod] as typeof original) = original;
    });
  }
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: number;
  stack?: string;
}
