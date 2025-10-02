import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConsoleCapture } from '../src/capture/console';

describe('ConsoleCapture', () => {
  let consoleCapture: ConsoleCapture;
  let _originalConsole: any;

  beforeEach(() => {
    // Store original console methods
    _originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };

    consoleCapture = new ConsoleCapture();
  });

  afterEach(() => {
    // Restore original console methods
    consoleCapture.destroy();
  });

  it('should capture console.log messages', () => {
    console.log('Test log message');

    const logs = consoleCapture.getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('log');
    expect(logs[0].message).toBe('Test log message');
    expect(logs[0].timestamp).toBeGreaterThan(0);
  });

  it('should capture console.warn messages', () => {
    console.warn('Test warning');

    const logs = consoleCapture.getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('warn');
    expect(logs[0].message).toBe('Test warning');
  });

  it('should capture console.error messages with stack', () => {
    console.error('Test error');

    const logs = consoleCapture.getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('error');
    expect(logs[0].message).toBe('Test error');
    expect(logs[0].stack).toBeDefined();
  });

  it('should capture console.info and console.debug messages', () => {
    console.info('Info message');
    console.debug('Debug message');

    const logs = consoleCapture.getLogs();

    expect(logs).toHaveLength(2);
    expect(logs[0].level).toBe('info');
    expect(logs[1].level).toBe('debug');
  });

  it('should handle multiple arguments', () => {
    console.log('Message with', 'multiple', 'arguments');

    const logs = consoleCapture.getLogs();

    expect(logs[0].message).toBe('Message with multiple arguments');
  });

  it('should stringify object arguments', () => {
    const obj = { key: 'value', nested: { data: 123 } };
    console.log('Object:', obj);

    const logs = consoleCapture.getLogs();

    expect(logs[0].message).toContain('Object:');
    expect(logs[0].message).toContain('"key":"value"');
    expect(logs[0].message).toContain('"nested"');
  });

  it('should handle circular references in objects', () => {
    const circularObj: any = { name: 'test' };
    circularObj.self = circularObj;

    console.log(circularObj);

    const logs = consoleCapture.getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBeTruthy();
  });

  it('should respect maxLogs limit', () => {
    // Capture 150 logs (more than default maxLogs of 100)
    for (let i = 0; i < 150; i++) {
      console.log(`Log ${i}`);
    }

    const logs = consoleCapture.getLogs();

    expect(logs).toHaveLength(100);
    expect(logs[0].message).toBe('Log 50'); // First 50 should be removed
    expect(logs[99].message).toBe('Log 149');
  });

  it('should return a copy of logs array', () => {
    console.log('Test message');

    const logs1 = consoleCapture.getLogs();
    const logs2 = consoleCapture.getLogs();

    expect(logs1).not.toBe(logs2); // Different array instances
    expect(logs1).toEqual(logs2); // But same content
  });

  it('should still call original console methods', () => {
    const logSpy = vi.fn();
    const originalLog = console.log;
    console.log = logSpy;

    // Create new instance after mocking
    const capture = new ConsoleCapture();
    console.log('Test');

    expect(logSpy).toHaveBeenCalled();

    capture.destroy();
    console.log = originalLog;
  });

  it('should restore original console methods on destroy', () => {
    const originalLog = console.log;
    const testCapture = new ConsoleCapture();

    testCapture.destroy();

    // After destroy, console.log should be restored to original
    expect(console.log).toBe(originalLog);
  });

  it('should handle null and undefined values', () => {
    console.log('Value:', null, undefined);

    const logs = consoleCapture.getLogs();

    expect(logs[0].message).toBe('Value: null undefined');
  });

  it('should handle numeric and boolean values', () => {
    console.log(42, true, false, 3.14);

    const logs = consoleCapture.getLogs();

    expect(logs[0].message).toBe('42 true false 3.14');
  });
});
