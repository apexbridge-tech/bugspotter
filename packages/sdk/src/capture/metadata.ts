export interface BrowserMetadata {
  userAgent: string;
  viewport: { width: number; height: number };
  browser: string;
  os: string;
  url: string;
  timestamp: number;
}

interface BrowserPattern {
  pattern: string;
  exclude?: string;
  name: string;
}

interface OSPattern {
  patterns: string[];
  name: string;
}

export class MetadataCapture {
  private readonly browserPatterns: readonly BrowserPattern[] = [
    { pattern: 'Edg', name: 'Edge' }, // Check Edge before Chrome
    { pattern: 'Chrome', exclude: 'Edge', name: 'Chrome' },
    { pattern: 'Firefox', name: 'Firefox' },
    { pattern: 'Safari', exclude: 'Chrome', name: 'Safari' },
  ];

  private readonly osPatterns: readonly OSPattern[] = [
    { patterns: ['iPhone', 'iPad'], name: 'iOS' }, // Check iOS before Mac
    { patterns: ['Android'], name: 'Android' }, // Check Android before Linux
    { patterns: ['Win'], name: 'Windows' },
    { patterns: ['Mac'], name: 'macOS' },
    { patterns: ['Linux'], name: 'Linux' },
  ];

  capture(): BrowserMetadata {
    return {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      browser: this.detectBrowser(),
      os: this.detectOS(),
      url: window.location.href,
      timestamp: Date.now(),
    };
  }

  private detectBrowser(): string {
    const ua = navigator.userAgent;
    for (const { pattern, exclude, name } of this.browserPatterns) {
      if (ua.includes(pattern) && (!exclude || !ua.includes(exclude))) {
        return name;
      }
    }
    return 'Unknown';
  }

  private detectOS(): string {
    const ua = navigator.userAgent;
    for (const { patterns, name } of this.osPatterns) {
      if (
        patterns.some((pattern) => {
          return ua.includes(pattern);
        })
      ) {
        return name;
      }
    }
    return 'Unknown';
  }
}
