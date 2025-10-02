export class ConsoleCapture {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  constructor() {
    this.interceptConsole();
  }

  private interceptConsole() {
    ['log', 'warn', 'error'].forEach((method) => {
      const original = (console as any)[method];
      (console as any)[method] = (...args: any[]) => {
        this.logs.push({
          level: method,
          message: args.map(a => String(a)).join(' '),
          timestamp: Date.now()
        });
        if (this.logs.length > this.maxLogs) this.logs.shift();
        original.apply(console, args);
      };
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: number;
}
