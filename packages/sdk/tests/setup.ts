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
    if (
      message.includes('Not implemented: window.getComputedStyle') ||
      message.includes('Not implemented: HTMLCanvasElement.prototype.getContext') ||
      message.includes('Not implemented: HTMLCanvasElement.prototype.toDataURL') ||
      message.includes('Error: Not implemented: window.getComputedStyle') ||
      message.includes('ReferenceError: SVGImageElement is not defined') ||
      message.includes('[BugSpotter] ScreenshotCapture capturing screenshot') ||
      message.includes('[BugSpotter] Canvas redaction not available') ||
      message.includes('[BugSpotter] Image compression failed')
    ) {
      return; // Suppress this warning
    }
    originalError.apply(console, args);
  };
});
