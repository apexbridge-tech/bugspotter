// Extend XMLHttpRequest to include our custom tracking properties
interface TrackedXMLHttpRequest extends XMLHttpRequest {
  _method?: string;
  _url?: string;
  _startTime?: number;
}

export class NetworkCapture {
  private static instance: NetworkCapture | null = null;
  private requests: NetworkRequest[] = [];
  private maxRequests = 50;
  private originalFetch!: typeof fetch; // Definite assignment - set in constructor or returned instance
  private originalXHR!: {
    open: typeof XMLHttpRequest.prototype.open;
    send: typeof XMLHttpRequest.prototype.send;
  };

  constructor() {
    // Implement singleton pattern - only one NetworkCapture instance per page
    if (NetworkCapture.instance) {
      return NetworkCapture.instance;
    }
    NetworkCapture.instance = this;

    this.originalFetch = window.fetch;
    this.originalXHR = {
      open: XMLHttpRequest.prototype.open,
      send: XMLHttpRequest.prototype.send,
    };
    this.interceptFetch();
    this.interceptXHR();
  }

  private interceptFetch() {
    const originalFetch = this.originalFetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      try {
        const response = await originalFetch(...args);
        this.requests.push({
          url: args[0] as string,
          method: 'GET',
          status: response.status,
          duration: Date.now() - startTime,
          timestamp: startTime,
        });
        if (this.requests.length > this.maxRequests) {
          this.requests.shift();
        }
        return response;
      } catch (error) {
        this.requests.push({
          url: args[0] as string,
          method: 'GET',
          status: 0,
          duration: Date.now() - startTime,
          timestamp: startTime,
          error: (error as Error).message,
        });
        throw error;
      }
    };
  }

  private interceptXHR() {
    const XHR = XMLHttpRequest.prototype;
    const originalOpen = XHR.open;
    const originalSend = XHR.send;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const captureInstance = this; // Capture the NetworkCapture instance

    XHR.open = function (
      this: TrackedXMLHttpRequest,
      method: string,
      url: string,
      ...args: unknown[]
    ) {
      this._method = method;
      this._url = url;
      this._startTime = Date.now();
      // Type assertion needed for rest params compatibility
      return originalOpen.apply(this, [method, url, ...args] as Parameters<typeof originalOpen>);
    };

    XHR.send = function (this: TrackedXMLHttpRequest, ...args: unknown[]) {
      this.addEventListener('load', () => {
        captureInstance.requests.push({
          url: this._url || '',
          method: this._method || 'GET',
          status: this.status,
          duration: Date.now() - (this._startTime || Date.now()),
          timestamp: this._startTime || Date.now(),
        });
        if (captureInstance.requests.length > captureInstance.maxRequests) {
          captureInstance.requests.shift();
        }
      });
      // Type assertion needed for rest params compatibility
      return originalSend.apply(this, args as Parameters<typeof originalSend>);
    };
  }

  getRequests(): NetworkRequest[] {
    return [...this.requests];
  }

  // Clear requests (useful for testing)
  clear(): void {
    this.requests = [];
  }

  destroy() {
    window.fetch = this.originalFetch;
    XMLHttpRequest.prototype.open = this.originalXHR.open;
    XMLHttpRequest.prototype.send = this.originalXHR.send;
    NetworkCapture.instance = null; // Clear singleton instance
  }
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
  error?: string;
}
