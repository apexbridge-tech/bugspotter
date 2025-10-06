import { ScreenshotCapture } from './capture/screenshot';
import { ConsoleCapture } from './capture/console';
import { NetworkCapture } from './capture/network';
import { MetadataCapture } from './capture/metadata';
import { compressData, estimateSize, getCompressionRatio } from './core/compress';
import type { BrowserMetadata } from './capture/metadata';
import { FloatingButton, type FloatingButtonOptions } from './widget/button';
import { BugReportModal } from './widget/modal';
import { DOMCollector } from './collectors';
import type { eventWithTime } from '@rrweb/types';
import { createSanitizer, type Sanitizer, type SanitizeConfig } from './utils/sanitize';
import { getLogger } from './utils/logger';
import { submitWithAuth, type AuthConfig, type RetryConfig, type TransportOptions } from './core/transport';
import type { OfflineConfig } from './core/offline-queue';

const logger = getLogger();

export class BugSpotter {
  private static instance: BugSpotter | undefined;
  private config: BugSpotterConfig;
  private screenshot: ScreenshotCapture;
  private console: ConsoleCapture;
  private network: NetworkCapture;
  private metadata: MetadataCapture;
  private domCollector?: DOMCollector;
  private widget?: FloatingButton;
  private sanitizer?: Sanitizer;

  constructor(config: BugSpotterConfig) {
    this.config = config;
    
    // Initialize sanitizer if enabled
    if (config.sanitize?.enabled !== false) {
      this.sanitizer = createSanitizer({
        enabled: config.sanitize?.enabled ?? true,
        patterns: config.sanitize?.patterns,
        customPatterns: config.sanitize?.customPatterns,
        excludeSelectors: config.sanitize?.excludeSelectors,
      });
    }
    
    this.screenshot = new ScreenshotCapture();
    this.console = new ConsoleCapture({ sanitizer: this.sanitizer });
    this.network = new NetworkCapture({ sanitizer: this.sanitizer });
    this.metadata = new MetadataCapture({ sanitizer: this.sanitizer });

    // Initialize DOM collector if replay is enabled
    if (config.replay?.enabled !== false) {
      this.domCollector = new DOMCollector({
        duration: config.replay?.duration ?? 15,
        sampling: config.replay?.sampling,
        sanitizer: this.sanitizer,
      });
      this.domCollector.startRecording();
    }

    // Initialize widget if enabled
    if (config.showWidget !== false) {
      this.widget = new FloatingButton(config.widgetOptions);
      this.widget.onClick(async () => {
        await this.handleBugReport();
      });
    }
  }

  static init(config: BugSpotterConfig): BugSpotter {
    if (!BugSpotter.instance) {
      BugSpotter.instance = new BugSpotter(config);
    }
    return BugSpotter.instance;
  }

  static getInstance(): BugSpotter | null {
    return BugSpotter.instance || null;
  }

  async capture(): Promise<BugReport> {
    return {
      screenshot: await this.screenshot.capture(),
      console: this.console.getLogs(),
      network: this.network.getRequests(),
      metadata: this.metadata.capture(),
      replay: this.domCollector?.getEvents() ?? [],
    };
  }

  private async handleBugReport(): Promise<void> {
    const report = await this.capture();
    const modal = new BugReportModal({
      onSubmit: async (data) => {
        logger.log('Submitting bug:', { ...data, report });
        
        // Send to endpoint if configured
        if (this.config.endpoint) {
          try {
            await this.submitBugReport({ ...data, report });
            logger.log('Bug report submitted successfully');
          } catch (error) {
            logger.error('Failed to submit bug report:', error);
            // Re-throw to allow UI to handle errors if needed
            throw error;
          }
        }
      },
    });
    modal.show(report.screenshot);
  }

  private async submitBugReport(payload: BugReportPayload): Promise<void> {
    if (!this.config.endpoint) {
      throw new Error('No endpoint configured for bug report submission');
    }

    const contentHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    logger.warn(`Submitting bug report to ${this.config.endpoint}`);

    let body: BodyInit;

    try {
      // Try to compress the payload
      const originalSize = estimateSize(payload);
      const compressed = await compressData(payload);
      const compressedSize = compressed.byteLength;
      const ratio = getCompressionRatio(originalSize, compressedSize);

      logger.log(`Payload compression: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${ratio}% reduction)`);

      // Use compression if it actually reduces size
      if (compressedSize < originalSize) {
        // Create a Blob from the compressed Uint8Array for proper binary upload
        // Use Uint8Array constructor to ensure clean ArrayBuffer (no extra padding bytes)
        body = new Blob([new Uint8Array(compressed)], { type: 'application/gzip' });
        contentHeaders['Content-Encoding'] = 'gzip';
        contentHeaders['Content-Type'] = 'application/gzip';
      } else {
        body = JSON.stringify(payload);
      }
    } catch (error) {
      // Fallback to uncompressed if compression fails
      logger.warn('Compression failed, sending uncompressed payload:', error);
      body = JSON.stringify(payload);
    }

    // Determine auth configuration
    const auth = this.config.auth;

    // Submit with authentication, retry logic, and offline queue
    const response = await submitWithAuth(
      this.config.endpoint,
      body,
      contentHeaders,
      {
        auth,
        retry: this.config.retry,
        offline: this.config.offline,
      }
    );

    logger.warn(`${JSON.stringify(response)}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to submit bug report: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    return response.json().catch(() => undefined);
  }

  getConfig(): Readonly<BugSpotterConfig> {
    return { ...this.config };
  }

  destroy(): void {
    this.console.destroy();
    this.network.destroy();
    this.domCollector?.destroy();
    this.widget?.destroy();
    BugSpotter.instance = undefined;
  }
}

export interface BugSpotterConfig {
  endpoint?: string;
  showWidget?: boolean;
  widgetOptions?: FloatingButtonOptions;
  
  /** Authentication configuration */
  auth?: AuthConfig;
  
  /** Retry configuration for failed requests */
  retry?: RetryConfig;
  
  /** Offline queue configuration */
  offline?: OfflineConfig;
  
  replay?: {
    /** Enable session replay recording (default: true) */
    enabled?: boolean;
    /** Duration in seconds to keep replay events (default: 15, max recommended: 30) */
    duration?: number;
    /** Sampling configuration for performance optimization */
    sampling?: {
      /** Throttle mousemove events in milliseconds (default: 50) */
      mousemove?: number;
      /** Throttle scroll events in milliseconds (default: 100) */
      scroll?: number;
    };
  };
  sanitize?: {
    /** Enable PII sanitization (default: true) */
    enabled?: boolean;
    /** 
     * PII patterns to detect and mask
     * - Can be a preset name: 'all', 'minimal', 'financial', 'contact', 'gdpr', 'pci', etc.
     * - Or an array of pattern names: ['email', 'phone', 'ip']
     */
    patterns?: 
      | 'all' 
      | 'minimal' 
      | 'financial' 
      | 'contact' 
      | 'identification' 
      | 'kazakhstan' 
      | 'gdpr' 
      | 'pci'
      | Array<'email' | 'phone' | 'creditcard' | 'ssn' | 'iin' | 'ip' | 'custom'>;
    /** Custom regex patterns for PII detection */
    customPatterns?: Array<{ 
      name: string; 
      regex: RegExp;
      description?: string;
      examples?: string[];
      priority?: number;
    }>;
    /** CSS selectors to exclude from sanitization */
    excludeSelectors?: string[];
  };
}

export interface BugReportPayload {
  title: string;
  description: string;
  report: BugReport;
}

export interface BugReport {
  screenshot: string;
  console: Array<{
    level: string;
    message: string;
    timestamp: number;
    stack?: string;
  }>;
  network: Array<{
    url: string;
    method: string;
    status: number;
    duration: number;
    timestamp: number;
    error?: string;
  }>;
  metadata: BrowserMetadata;
  replay: eventWithTime[];
}

// Export capture module types for advanced usage
export type { BrowserMetadata } from './capture/metadata';
export { ScreenshotCapture } from './capture/screenshot';
export { ConsoleCapture } from './capture/console';
export { NetworkCapture } from './capture/network';
export { MetadataCapture } from './capture/metadata';

// Export collector modules
export { DOMCollector } from './collectors';
export type { DOMCollectorConfig } from './collectors';

// Export core utilities
export { CircularBuffer } from './core/buffer';
export type { CircularBufferConfig } from './core/buffer';

// Export compression utilities
export { compressData, decompressData, compressImage, estimateSize, getCompressionRatio } from './core/compress';

// Export transport and authentication
export { submitWithAuth, getAuthHeaders, clearOfflineQueue } from './core/transport';
export type { AuthConfig, TransportOptions, RetryConfig } from './core/transport';
export type { OfflineConfig } from './core/offline-queue';
export type { Logger, LogLevel, LoggerConfig } from './utils/logger';
export { getLogger, configureLogger, createLogger } from './utils/logger';

// Export sanitization utilities
export { createSanitizer, Sanitizer } from './utils/sanitize';
export type { PIIPattern, CustomPattern, SanitizeConfig } from './utils/sanitize';

// Export pattern configuration utilities
export {
  DEFAULT_PATTERNS,
  PATTERN_PRESETS,
  PATTERN_CATEGORIES,
  PatternBuilder,
  createPatternConfig,
  getPattern,
  getPatternsByCategory,
  validatePattern,
} from './utils/sanitize';
export type { PIIPatternName, PatternDefinition } from './utils/sanitize';

// Export widget components
export { FloatingButton } from './widget/button';
export type { FloatingButtonOptions } from './widget/button';
export { BugReportModal } from './widget/modal';
export type { BugReportData, BugReportModalOptions, PIIDetection } from './widget/modal';

// Re-export rrweb types for convenience
export type { eventWithTime } from '@rrweb/types';

/**
 * Convenience function to sanitize text with default PII patterns
 * Useful for quick sanitization without creating a Sanitizer instance
 * 
 * @param text - Text to sanitize
 * @returns Sanitized text with PII redacted
 * 
 * @example
 * ```typescript
 * const sanitized = sanitize('Email: user@example.com');
 * // Returns: 'Email: [REDACTED]'
 * ```
 */
export function sanitize(text: string): string {
  const sanitizer = createSanitizer({
    enabled: true,
    patterns: 'all',
    customPatterns: [],
    excludeSelectors: [],
  });
  return sanitizer.sanitize(text) as string;
}
