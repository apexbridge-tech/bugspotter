export class BugSpotter {
  private static instance: BugSpotter;
  private config: BugSpotterConfig;

  constructor(config: BugSpotterConfig) {
    this.config = config;
  }

  static init(config: BugSpotterConfig): BugSpotter {
    if (!BugSpotter.instance) {
      BugSpotter.instance = new BugSpotter(config);
    }
    return BugSpotter.instance;
  }

  capture() {
    console.log('Capturing bug context...');
    // Implementation will go here
  }
}

export interface BugSpotterConfig {
  apiKey: string;
  endpoint?: string;
}
