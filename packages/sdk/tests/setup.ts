/**
 * Vitest setup file
 * Ensures proper jsdom initialization in CI environments
 */

import { beforeAll } from 'vitest';

// Suppress JSDOM "Not implemented" warnings for getComputedStyle
// These are expected when using html-to-image in JSDOM environment
beforeAll(() => {
  // Suppress console.log, console.info, and console.debug during tests
  const originalError = console.error;

  console.log = () => {}; // Suppress all console.log
  console.info = () => {}; // Suppress all console.info
  console.debug = () => {}; // Suppress all console.debug

  console.error = (...args: any[]) => {
    // Suppress specific JSDOM warnings that are expected in test environment
    const message = args[0]?.toString() || '';
    const suppressedMessages = [
      'Not implemented: window.getComputedStyle',
      'Not implemented: HTMLCanvasElement.prototype.getContext',
      'Not implemented: HTMLCanvasElement.prototype.toDataURL',
      'Error: Not implemented: window.getComputedStyle',
      'ReferenceError: SVGImageElement is not defined',
      '[BugSpotter] ScreenshotCapture capturing screenshot',
      '[BugSpotter] Canvas redaction not available',
      '[BugSpotter] Image compression failed',
    ];
    if (suppressedMessages.some((suppressed) => message.includes(suppressed))) {
      return; // Suppress this warning
    }
    originalError.apply(console, args);
  };
});
