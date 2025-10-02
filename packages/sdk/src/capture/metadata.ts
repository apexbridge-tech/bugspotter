export interface BrowserMetadata {
  userAgent: string;
  viewport: { width: number; height: number };
  browser: string;
  os: string;
  url: string;
  timestamp: number;
}

export class MetadataCapture {
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
    if (ua.includes('Edg')) {
      return 'Edge';
    } // Check Edge before Chrome
    if (ua.includes('Chrome') && !ua.includes('Edge')) {
      return 'Chrome';
    }
    if (ua.includes('Firefox')) {
      return 'Firefox';
    }
    if (ua.includes('Safari') && !ua.includes('Chrome')) {
      return 'Safari';
    }
    return 'Unknown';
  }

  private detectOS(): string {
    const ua = navigator.userAgent;
    if (ua.includes('iPhone') || ua.includes('iPad')) {
      return 'iOS';
    } // Check iOS before Mac
    if (ua.includes('Android')) {
      return 'Android';
    } // Check Android before Linux
    if (ua.includes('Win')) {
      return 'Windows';
    }
    if (ua.includes('Mac')) {
      return 'macOS';
    }
    if (ua.includes('Linux')) {
      return 'Linux';
    }
    return 'Unknown';
  }
}
