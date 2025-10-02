import { ScreenshotCapture } from './capture/screenshot';
import { ConsoleCapture } from './capture/console';
import { NetworkCapture } from './capture/network';

export class BugSpotter {
  private static instance: BugSpotter;
  private config: BugSpotterConfig;
  private screenshot: ScreenshotCapture;
  private console: ConsoleCapture;
  private network: NetworkCapture;

  constructor(config: BugSpotterConfig) {
    this.config = config;
    this.screenshot = new ScreenshotCapture();
    this.console = new ConsoleCapture();
    this.network = new NetworkCapture();
  }

  static init(config: BugSpotterConfig): BugSpotter {
    if (!BugSpotter.instance) {
      BugSpotter.instance = new BugSpotter(config);
    }
    return BugSpotter.instance;
  }

  async capture() {
    return {
      screenshot: await this.screenshot.capture(),
      console: this.console.getLogs(),
      network: this.network.getRequests(),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
  }
}

export interface BugSpotterConfig {
  apiKey: string;
  endpoint?: string;
}
