import { ScreenshotCapture } from './capture/screenshot';
import { ConsoleCapture } from './capture/console';
import { NetworkCapture } from './capture/network';
import { MetadataCapture } from './capture/metadata';
import type { BrowserMetadata } from './capture/metadata';

export class BugSpotter {
  private static instance: BugSpotter | undefined;
  private config: BugSpotterConfig;
  private screenshot: ScreenshotCapture;
  private console: ConsoleCapture;
  private network: NetworkCapture;
  private metadata: MetadataCapture;

  constructor(config: BugSpotterConfig) {
    this.config = config;
    this.screenshot = new ScreenshotCapture();
    this.console = new ConsoleCapture();
    this.network = new NetworkCapture();
    this.metadata = new MetadataCapture();
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
    };
  }

  getConfig(): Readonly<BugSpotterConfig> {
    return { ...this.config };
  }

  destroy(): void {
    this.console.destroy();
    this.network.destroy();
    BugSpotter.instance = undefined;
  }
}

export interface BugSpotterConfig {
  apiKey?: string;
  endpoint?: string;
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
}

// Export capture module types for advanced usage
export type { BrowserMetadata } from './capture/metadata';
export { ScreenshotCapture } from './capture/screenshot';
export { ConsoleCapture } from './capture/console';
export { NetworkCapture } from './capture/network';
export { MetadataCapture } from './capture/metadata';

// Export widget components
export { FloatingButton } from './widget/button';
export type { FloatingButtonOptions } from './widget/button';
