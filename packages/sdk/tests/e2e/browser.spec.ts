/**
 * Playwright E2E Browser Tests for BugSpotter SDK
 * Tests real browser environments with actual DOM manipulation
 *
 * Run with: pnpm test:playwright
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const LARGE_DOM_FIXTURE = path.join(__dirname, '../fixtures/large-dom-e2e.html');

/**
 * Helper to inject BugSpotter SDK into the page
 */
async function injectSDK(page: Page, config: Record<string, unknown> = {}) {
  // In a real scenario, you'd load the built SDK file
  // For now, we'll inject minimal SDK setup
  await page
    .addScriptTag({
      path: path.join(__dirname, '../../dist/bugspotter.min.js'),
    })
    .catch(() => {
      // If dist doesn't exist, skip - this is expected in development
      console.warn('SDK bundle not found, skipping injection');
    });

  await page.evaluate((cfg) => {
    // @ts-expect-error - BugSpotter is injected
    if (typeof BugSpotter !== 'undefined') {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      window.bugspotterInstance = BugSpotter.BugSpotter.init(cfg);
    }
  }, config);
}

test.describe('BugSpotter SDK - Real Browser Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console log capture
    page.on('console', (msg) => {
      console.log(`[Browser ${msg.type()}]:`, msg.text());
    });

    // Set up page error handling
    page.on('pageerror', (error) => {
      console.error('[Browser Error]:', error);
    });
  });

  test('should load and initialize SDK in browser', async ({ page }) => {
    await page.goto('about:blank');

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>BugSpotter Test</title></head>
        <body>
          <h1>Test Page</h1>
          <script>
            window.testData = { initialized: false };
          </script>
        </body>
      </html>
    `);

    await injectSDK(page, {
      showWidget: false,
      replay: { enabled: true },
    });

    const isInitialized = await page.evaluate(() => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      return typeof window.bugspotterInstance !== 'undefined';
    });

    expect(isInitialized).toBe(true);
  });

  test('should capture screenshot in real browser', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <h1>Screenshot Test</h1>
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px; color: white;">
            <p>This content should be captured in screenshot</p>
          </div>
        </body>
      </html>
    `);

    await injectSDK(page, { showWidget: false });

    const screenshot = await page.evaluate(async () => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      if (!window.bugspotterInstance) {
        return null;
      }
      // @ts-expect-error - Playwright types not fully compatible with test setup
      const report = await window.bugspotterInstance.capture();
      return report.screenshot;
    });

    expect(screenshot).toBeTruthy();
    expect(screenshot).toContain('data:image/');
  });

  test('should capture console logs in real browser', async ({ page }) => {
    await page.setContent('<html><body><h1>Console Test</h1></body></html>');

    await injectSDK(page, { showWidget: false });

    await page.evaluate(() => {
      console.log('Test log message');
      console.error('Test error message');
      console.warn('Test warning message');
    });

    await page.waitForTimeout(200);

    const consoleLogs = await page.evaluate(async () => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      if (!window.bugspotterInstance) {
        return [];
      }
      // @ts-expect-error - Playwright types not fully compatible with test setup
      const report = await window.bugspotterInstance.capture();
      return report.console;
    });

    expect(consoleLogs.length).toBeGreaterThan(0);

    const messages = consoleLogs.map((log: any) => {
      return log.message;
    });
    expect(
      messages.some((msg: string) => {
        return msg.includes('Test log message');
      })
    ).toBe(true);
    expect(
      messages.some((msg: string) => {
        return msg.includes('Test error message');
      })
    ).toBe(true);
  });

  test('should capture network requests in real browser', async ({ page }) => {
    await page.setContent('<html><body><h1>Network Test</h1></body></html>');

    await injectSDK(page, { showWidget: false });

    // Make a fetch request
    await page.evaluate(async () => {
      await fetch('https://jsonplaceholder.typicode.com/todos/1').catch(() => {});
    });

    await page.waitForTimeout(500);

    const networkRequests = await page.evaluate(async () => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      if (!window.bugspotterInstance) {
        return [];
      }
      // @ts-expect-error - Playwright types not fully compatible with test setup
      const report = await window.bugspotterInstance.capture();
      return report.network;
    });

    expect(networkRequests.length).toBeGreaterThan(0);
    const urls = networkRequests.map((req: any) => {
      return req.url;
    });
    expect(
      urls.some((url: string) => {
        return url.includes('jsonplaceholder');
      })
    ).toBe(true);
  });

  test('should handle large DOM efficiently', async ({ page }) => {
    await page.goto(`file://${LARGE_DOM_FIXTURE}`).catch(() => {
      // File might not exist in CI, skip
      test.skip();
    });

    await injectSDK(page, {
      showWidget: false,
      replay: { enabled: true, duration: 15 },
    });

    const startTime = Date.now();

    const report = await page.evaluate(async () => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      if (!window.bugspotterInstance) {
        return null;
      }
      // @ts-expect-error - Playwright types not fully compatible with test setup
      return await window.bugspotterInstance.capture();
    });

    const captureTime = Date.now() - startTime;

    expect(report).toBeTruthy();
    expect(captureTime).toBeLessThan(2000); // Should capture large DOM in <2s

    console.log(`Large DOM captured in ${captureTime}ms`);
  });

  test('should sanitize PII in real browser', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <h1>PII Test</h1>
          <div id="content">
            <p>Email: john.doe@example.com</p>
            <p>Phone: +1-555-123-4567</p>
            <p>Card: 4532-1234-5678-9010</p>
          </div>
        </body>
      </html>
    `);

    await injectSDK(page, {
      showWidget: false,
      sanitize: { enabled: true, patterns: 'all' },
    });

    await page.evaluate(() => {
      console.log('User email: john.doe@example.com');
      console.log('User phone: +1-555-123-4567');
      console.log('Payment card: 4532-1234-5678-9010');
    });

    await page.waitForTimeout(200);

    const consoleLogs = await page.evaluate(async () => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      if (!window.bugspotterInstance) {
        return [];
      }
      // @ts-expect-error - Playwright types not fully compatible with test setup
      const report = await window.bugspotterInstance.capture();
      return report.console;
    });

    const messages = consoleLogs
      .map((log: any) => {
        return log.message;
      })
      .join(' ');

    // Should not contain actual PII
    expect(messages).not.toContain('john.doe@example.com');
    expect(messages).not.toContain('+1-555-123-4567');
    expect(messages).not.toContain('4532-1234-5678-9010');

    // Should contain redaction markers
    expect(messages).toContain('[REDACTED');
  });

  test('should handle Shadow DOM', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="shadow-host"></div>
          <script>
            const host = document.getElementById('shadow-host');
            const shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = '<p>Shadow content with email: shadow@example.com</p>';
          </script>
        </body>
      </html>
    `);

    await injectSDK(page, {
      showWidget: false,
      replay: { enabled: true },
      sanitize: { enabled: true },
    });

    await page.waitForTimeout(200);

    const report = await page.evaluate(async () => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      if (!window.bugspotterInstance) {
        return null;
      }
      // @ts-expect-error - Playwright types not fully compatible with test setup
      return await window.bugspotterInstance.capture();
    });

    expect(report).toBeTruthy();
    expect(report.replay).toBeDefined();
    expect(report.replay.length).toBeGreaterThan(0);
  });

  test('should display widget when enabled', async ({ page }) => {
    await page.setContent('<html><body><h1>Widget Test</h1></body></html>');

    await injectSDK(page, {
      showWidget: true,
      widgetOptions: {
        position: 'bottom-right',
        icon: '🐛',
      },
    });

    const hasWidget = await page.evaluate(() => {
      const button = document.querySelector('button[style*="position: fixed"]');
      return button !== null;
    });

    expect(hasWidget).toBe(true);

    // Check widget text
    const widgetText = await page.evaluate(() => {
      const button = document.querySelector('button[style*="position: fixed"]');
      return button?.textContent || '';
    });

    expect(widgetText).toContain('🐛');
  });

  test('should handle responsive viewport', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.setContent('<html><body><h1>Responsive Test</h1></body></html>');

    await injectSDK(page, { showWidget: false });

    const desktopReport = await page.evaluate(async () => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      if (!window.bugspotterInstance) {
        return null;
      }
      // @ts-expect-error - Playwright types not fully compatible with test setup
      return await window.bugspotterInstance.capture();
    });

    expect(desktopReport.metadata.viewport.width).toBe(1920);
    expect(desktopReport.metadata.viewport.height).toBe(1080);

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const mobileReport = await page.evaluate(async () => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      if (!window.bugspotterInstance) {
        return null;
      }
      // @ts-expect-error - Playwright types not fully compatible with test setup
      return await window.bugspotterInstance.capture();
    });

    expect(mobileReport.metadata.viewport.width).toBe(375);
    expect(mobileReport.metadata.viewport.height).toBe(667);
  });

  test('should measure SDK performance in real browser', async ({ page }) => {
    await page.setContent('<html><body><h1>Performance Test</h1></body></html>');

    const metrics = await page.evaluate(async () => {
      const results = {
        initTime: 0,
        captureTime: 0,
      };

      // Measure initialization
      const initStart = performance.now();
      // @ts-expect-error - Will be injected
      if (typeof BugSpotter !== 'undefined') {
        // @ts-expect-error - Playwright types not fully compatible with test setup
        window.bugspotterInstance = BugSpotter.BugSpotter.init({
          showWidget: false,
          replay: { enabled: true },
        });
        results.initTime = performance.now() - initStart;

        // Add some logs
        console.log('Test log 1');
        console.log('Test log 2');

        await new Promise((resolve) => {
          return setTimeout(resolve, 100);
        });

        // Measure capture
        const captureStart = performance.now();
        // @ts-expect-error - Playwright types not fully compatible with test setup
        await window.bugspotterInstance.capture();
        results.captureTime = performance.now() - captureStart;
      }

      return results;
    });

    console.log(
      `Browser Performance: Init ${metrics.initTime.toFixed(2)}ms, Capture ${metrics.captureTime.toFixed(2)}ms`
    );

    expect(metrics.initTime).toBeLessThan(100); // More lenient in real browser
    expect(metrics.captureTime).toBeLessThan(1000);
  });
});

test.describe('Multi-Browser Compatibility', () => {
  test('should work in Chromium', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium-specific test');

    await page.setContent('<html><body><h1>Chromium Test</h1></body></html>');
    await injectSDK(page, { showWidget: false });

    const report = await page.evaluate(async () => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      if (!window.bugspotterInstance) {
        return null;
      }
      // @ts-expect-error - Playwright types not fully compatible with test setup
      return await window.bugspotterInstance.capture();
    });

    expect(report).toBeTruthy();
    expect(report.metadata.browser).toContain('Chrome');
  });

  test('should work in Firefox', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');

    await page.setContent('<html><body><h1>Firefox Test</h1></body></html>');
    await injectSDK(page, { showWidget: false });

    const report = await page.evaluate(async () => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      if (!window.bugspotterInstance) {
        return null;
      }
      // @ts-expect-error - Playwright types not fully compatible with test setup
      return await window.bugspotterInstance.capture();
    });

    expect(report).toBeTruthy();
    expect(report.metadata.browser).toContain('Firefox');
  });

  test('should work in WebKit/Safari', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit-specific test');

    await page.setContent('<html><body><h1>Safari Test</h1></body></html>');
    await injectSDK(page, { showWidget: false });

    const report = await page.evaluate(async () => {
      // @ts-expect-error - Playwright types not fully compatible with test setup
      if (!window.bugspotterInstance) {
        return null;
      }
      // @ts-expect-error - Playwright types not fully compatible with test setup
      return await window.bugspotterInstance.capture();
    });

    expect(report).toBeTruthy();
    expect(report.metadata.browser).toContain('Safari');
  });
});
