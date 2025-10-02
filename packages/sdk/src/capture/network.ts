type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// Extend XMLHttpRequest to include our custom tracking properties
interface TrackedXMLHttpRequest extends XMLHttpRequest {
  _method?: string;
  _url?: string;
  _startTime?: number;
}

export interface NetworkCaptureOptions {
  maxRequests?: number;
  filterUrls?: (url: string) => boolean;
}

export class NetworkCapture {
  private static instance: NetworkCapture | null = null;
  private requests: NetworkRequest[] = [];
  private maxRequests = 50;
  private requestIndex = 0;
  private requestCount = 0;
  private filterUrls?: (url: string) => boolean;
  private originalFetch!: typeof fetch; // Definite assignment - set in constructor or returned instance
  private originalXHR!: {
    open: typeof XMLHttpRequest.prototype.open;
    send: typeof XMLHttpRequest.prototype.send;
  };
  private isIntercepting = false;

  constructor(options: NetworkCaptureOptions = {}) {
    // Implement singleton pattern - only one NetworkCapture instance per page
    if (NetworkCapture.instance) {
      console.warn('NetworkCapture already exists, returning existing instance');
      return NetworkCapture.instance;
    }
    NetworkCapture.instance = this;

    this.maxRequests = options.maxRequests ?? 50;
    this.filterUrls = options.filterUrls;

    this.originalFetch = window.fetch;
    this.originalXHR = {
      open: XMLHttpRequest.prototype.open,
      send: XMLHttpRequest.prototype.send,
    };
    this.interceptFetch();
    this.interceptXHR();
    this.isIntercepting = true;
  }

  private parseFetchArgs(args: Parameters<typeof fetch>): { url: string; method: HttpMethod } {
    const [input, init] = args;
    
    let url: string;
    let method: HttpMethod = 'GET';
    
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof Request) {
      url = input.url;
      method = (input.method.toUpperCase() as HttpMethod) || 'GET';
    } else {
      url = input.toString();
    }
    
    if (init?.method) {
      method = init.method.toUpperCase() as HttpMethod;
    }
    
    return { url, method };
  }

  private createNetworkRequest(
    url: string,
    method: HttpMethod,
    status: number,
    startTime: number,
    error?: string
  ): NetworkRequest {
    return {
      url,
      method,
      status,
      duration: Date.now() - startTime,
      timestamp: startTime,
      ...(error && { error }),
    };
  }

  private addRequest(request: NetworkRequest): void {
    if (this.filterUrls && !this.filterUrls(request.url)) {
      return; // Skip filtered URLs
    }
    
    if (this.requestCount < this.maxRequests) {
      this.requests.push(request);
      this.requestCount++;
    } else {
      this.requests[this.requestIndex] = request;
    }
    this.requestIndex = (this.requestIndex + 1) % this.maxRequests;
  }

  private interceptFetch() {
    const originalFetch = this.originalFetch;
    
    window.fetch = async (...args) => {
      const startTime = Date.now();
      const { url, method } = this.parseFetchArgs(args);
      
      try {
        const response = await originalFetch(...args);
        const request = this.createNetworkRequest(
          url,
          method,
          response.status,
          startTime
        );
        this.addRequest(request);
        return response;
      } catch (error) {
        const request = this.createNetworkRequest(
          url,
          method,
          0,
          startTime,
          (error as Error).message
        );
        this.addRequest(request);
        throw error;
      }
    };
  }

  private interceptXHR() {
    const originalOpen = this.originalXHR.open;
    const originalSend = this.originalXHR.send;
    const captureInstance = this;

    XMLHttpRequest.prototype.open = function (
      this: TrackedXMLHttpRequest,
      method: string,
      url: string | URL,
      ...args: unknown[]
    ) {
      this._method = method.toUpperCase();
      this._url = url.toString();
      this._startTime = Date.now();
      // Type assertion needed for rest params compatibility
      return originalOpen.apply(this, [method, url, ...args] as Parameters<typeof originalOpen>);
    };

    XMLHttpRequest.prototype.send = function (this: TrackedXMLHttpRequest, ...args: unknown[]) {
      const onLoad = () => {
        const request = captureInstance.createNetworkRequest(
          this._url || '',
          (this._method as HttpMethod) || 'GET',
          this.status,
          this._startTime || Date.now()
        );
        captureInstance.addRequest(request);
      };
      
      const onError = () => {
        const request = captureInstance.createNetworkRequest(
          this._url || '',
          (this._method as HttpMethod) || 'GET',
          0,
          this._startTime || Date.now(),
          'XMLHttpRequest failed'
        );
        captureInstance.addRequest(request);
      };
      
      this.addEventListener('load', onLoad);
      this.addEventListener('error', onError);
      
      // Type assertion needed for rest params compatibility
      return originalSend.apply(this, args as Parameters<typeof originalSend>);
    };
  }

  getRequests(): NetworkRequest[] {
    if (this.requestCount < this.maxRequests) {
      return [...this.requests];
    }
    // Return requests in chronological order
    return [
      ...this.requests.slice(this.requestIndex),
      ...this.requests.slice(0, this.requestIndex)
    ];
  }

  clear(): void {
    this.requests = [];
    this.requestIndex = 0;
    this.requestCount = 0;
  }

  destroy() {
    if (!this.isIntercepting) return;
    
    window.fetch = this.originalFetch;
    XMLHttpRequest.prototype.open = this.originalXHR.open;
    XMLHttpRequest.prototype.send = this.originalXHR.send;
    NetworkCapture.instance = null;
    this.isIntercepting = false;
  }
}

export interface NetworkRequest {
  url: string;
  method: HttpMethod;
  status: number;
  duration: number;
  timestamp: number;
  error?: string;
}
