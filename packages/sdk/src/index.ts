import { ScreenshotCapture } from './capture/screenshot';
import { ConsoleCapture } from './capture/console';
import { NetworkCapture } from './capture/network';
import { MetadataCapture } from './capture/metadata';
import type { BrowserMetadata } from './capture/metadata';
import { FloatingButton, type FloatingButtonOptions } from './widget/button';
import { BugReportModal } from './widget/modal';

export class BugSpotter {
  private static instance: BugSpotter | undefined;
  private config: BugSpotterConfig;
  private screenshot: ScreenshotCapture;
  private console: ConsoleCapture;
  private network: NetworkCapture;
  private metadata: MetadataCapture;
  private widget?: FloatingButton;

  constructor(config: BugSpotterConfig) {
    this.config = config;
    this.screenshot = new ScreenshotCapture();
    this.console = new ConsoleCapture();
    this.network = new NetworkCapture();
    this.metadata = new MetadataCapture();

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
    };
  }

  private async handleBugReport(): Promise<void> {
    const report = await this.capture();
    const modal = new BugReportModal({
      onSubmit: async (data) => {
        console.log('Submitting bug:', { ...data, report });
        
        // Send to endpoint if configured
        if (this.config.endpoint) {
          try {
            await this.submitBugReport({ ...data, report });
            console.log('Bug report submitted successfully');
          } catch (error) {
            console.error('Failed to submit bug report:', error);
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key to headers if configured
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    console.warn(`Submitting bug report to ${this.config.endpoint}`);

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    console.warn(`${JSON.stringify(response)}`);

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
    this.widget?.destroy();
    BugSpotter.instance = undefined;
  }
}

export interface BugSpotterConfig {
  apiKey?: string;
  endpoint?: string;
  showWidget?: boolean;
  widgetOptions?: FloatingButtonOptions;
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
export { BugReportModal } from './widget/modal';
export type { BugReportData, BugReportModalOptions } from './widget/modal';
