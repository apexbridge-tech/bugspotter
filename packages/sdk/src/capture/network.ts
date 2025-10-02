export class NetworkCapture {
  private requests: NetworkRequest[] = [];
  private maxRequests = 50;

  constructor() {
    this.interceptFetch();
    this.interceptXHR();
  }

  private interceptFetch() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      try {
        const response = await originalFetch(...args);
        this.requests.push({
          url: args[0] as string,
          method: 'GET',
          status: response.status,
          duration: Date.now() - startTime
        });
        if (this.requests.length > this.maxRequests) this.requests.shift();
        return response;
      } catch (error) {
        this.requests.push({
          url: args[0] as string,
          method: 'GET',
          status: 0,
          duration: Date.now() - startTime,
          error: (error as Error).message
        });
        throw error;
      }
    };
  }

  private interceptXHR() {
    const XHR = XMLHttpRequest.prototype;
    const originalOpen = XHR.open;
    const originalSend = XHR.send;

    XHR.open = function(method: string, url: string) {
      (this as any)._method = method;
      (this as any)._url = url;
      (this as any)._startTime = Date.now();
      return originalOpen.apply(this, arguments as any);
    };

    XHR.send = function() {
      this.addEventListener('load', () => {
        const request = this as any;
        NetworkCapture.prototype.requests.push({
          url: request._url,
          method: request._method,
          status: this.status,
          duration: Date.now() - request._startTime
        });
      });
      return originalSend.apply(this, arguments as any);
    };
  }

  getRequests(): NetworkRequest[] {
    return [...this.requests];
  }
}

export interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  duration: number;
  error?: string;
}
