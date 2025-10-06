/**
 * Transport layer for bug report submission with flexible authentication,
 * exponential backoff retry, and offline queue support
 */

import { getLogger, type Logger } from '../utils/logger';
import { OfflineQueue, type OfflineConfig } from './offline-queue';

// ============================================================================
// CONSTANTS
// ============================================================================

const TOKEN_REFRESH_STATUS = 401;
const JITTER_PERCENTAGE = 0.1;
const DEFAULT_ENABLE_RETRY = true;

// ============================================================================
// CUSTOM ERROR TYPES
// ============================================================================

export class TransportError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

export class TokenRefreshError extends TransportError {
  constructor(endpoint: string, cause?: Error) {
    super('Failed to refresh authentication token', endpoint, cause);
    this.name = 'TokenRefreshError';
  }
}

// ============================================================================
// TYPE DEFINITIONS - Flexible auth config with runtime validation
// ============================================================================

export type AuthConfig =
  | { type: 'api-key'; apiKey?: string }
  | { type: 'jwt'; token?: string; onTokenExpired?: () => Promise<string> }
  | { type: 'bearer'; token?: string; onTokenExpired?: () => Promise<string> }
  | { type: 'custom'; customHeader?: { name: string; value: string } }
  | { type: 'none' };

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** HTTP status codes to retry on (default: [502, 503, 504, 429]) */
  retryOn?: number[];
}

export interface TransportOptions {
  /** Authentication configuration */
  auth?: AuthConfig | string;
  /** Optional logger for debugging */
  logger?: Logger;
  /** Enable retry on token expiration (default: true) */
  enableRetry?: boolean;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Offline queue configuration */
  offline?: OfflineConfig;
}

// Default configurations
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  retryOn: [502, 503, 504, 429],
};

const DEFAULT_OFFLINE_CONFIG: Required<OfflineConfig> = {
  enabled: false,
  maxQueueSize: 10,
};

// ============================================================================
// AUTHENTICATION STRATEGIES - Strategy Pattern
// ============================================================================

type AuthHeaderStrategy = (config: AuthConfig) => Record<string, string>;

const authStrategies: Record<AuthConfig['type'], AuthHeaderStrategy> = {
  'api-key': (config): Record<string, string> => {
    const apiKey = (config as Extract<AuthConfig, { type: 'api-key' }>).apiKey;
    return apiKey ? { 'X-API-Key': apiKey } : {};
  },
  
  'jwt': (config): Record<string, string> => {
    const token = (config as Extract<AuthConfig, { type: 'jwt' }>).token;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },
  
  'bearer': (config): Record<string, string> => {
    const token = (config as Extract<AuthConfig, { type: 'bearer' }>).token;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },
  
  'custom': (config): Record<string, string> => {
    const customHeader = (config as Extract<AuthConfig, { type: 'custom' }>).customHeader;
    if (!customHeader) return {};
    const { name, value } = customHeader;
    return name && value ? { [name]: value } : {};
  },
  
  'none': (): Record<string, string> => ({}),
};

// ============================================================================
// RETRY HANDLER - Exponential Backoff Logic
// ============================================================================

class RetryHandler {
  constructor(
    private config: Required<RetryConfig>,
    private logger: Logger
  ) {}

  /**
   * Execute operation with exponential backoff retry
   */
  async executeWithRetry(
    operation: () => Promise<Response>,
    shouldRetryStatus: (status: number) => boolean
  ): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await operation();
        
        // Check if we should retry based on status code
        if (shouldRetryStatus(response.status) && attempt < this.config.maxRetries) {
          const delay = this.calculateDelay(attempt, response);
          this.logger.warn(`Request failed with status ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries})`);
          await sleep(delay);
          continue;
        }
        
        // Success or non-retryable status
        return response;
        
      } catch (error) {
        lastError = error as Error;
        
        // Retry on network errors
        if (attempt < this.config.maxRetries) {
          const delay = this.calculateDelay(attempt);
          this.logger.warn(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries}):`, error);
          await sleep(delay);
          continue;
        }
      }
    }
    
    // All retries exhausted
    throw lastError || new Error('Request failed after all retry attempts');
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, response?: Response): number {
    // Check for Retry-After header
    if (response?.headers?.has?.('Retry-After')) {
      const retryAfter = response.headers.get('Retry-After')!;
      const retryAfterSeconds = parseInt(retryAfter, 10);
      
      if (!isNaN(retryAfterSeconds)) {
        return Math.min(retryAfterSeconds * 1000, this.config.maxDelay);
      }
    }
    
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = this.config.baseDelay * Math.pow(2, attempt);
    
    // Add jitter: ±10% randomization
    const jitter = exponentialDelay * JITTER_PERCENTAGE * (Math.random() * 2 - 1);
    const delayWithJitter = exponentialDelay + jitter;
    
    // Cap at maxDelay
    return Math.min(delayWithJitter, this.config.maxDelay);
  }
}

// ============================================================================
// INTERNAL HELPERS - Parameter Parsing
// ============================================================================

interface ParsedTransportParams {
  auth?: AuthConfig | string;
  logger: Logger;
  enableRetry: boolean;
  retryConfig: Required<RetryConfig>;
  offlineConfig: Required<OfflineConfig>;
}

/**
 * Type guard to check if parameter is TransportOptions
 */
function isTransportOptions(obj: unknown): obj is TransportOptions {
  return typeof obj === 'object' && obj !== null && 
    ('auth' in obj || 'retry' in obj || 'offline' in obj || 
     'logger' in obj || 'enableRetry' in obj);
}

/**
 * Parse transport parameters, supporting both legacy and new API signatures
 */
function parseTransportParams(authOrOptions?: AuthConfig | string | TransportOptions): ParsedTransportParams {
  if (isTransportOptions(authOrOptions)) {
    // Type guard ensures authOrOptions is TransportOptions
    return {
      auth: authOrOptions.auth,
      logger: authOrOptions.logger || getLogger(),
      enableRetry: authOrOptions.enableRetry ?? DEFAULT_ENABLE_RETRY,
      retryConfig: { ...DEFAULT_RETRY_CONFIG, ...authOrOptions.retry },
      offlineConfig: { ...DEFAULT_OFFLINE_CONFIG, ...authOrOptions.offline },
    };
  }
  
  return {
    auth: authOrOptions as AuthConfig | string | undefined,
    logger: getLogger(),
    enableRetry: DEFAULT_ENABLE_RETRY,
    retryConfig: DEFAULT_RETRY_CONFIG,
    offlineConfig: DEFAULT_OFFLINE_CONFIG,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Process offline queue in background
 */
async function processQueueInBackground(
  offlineConfig: Required<OfflineConfig>,
  retryConfig: Required<RetryConfig>,
  logger: Logger
): Promise<void> {
  if (!offlineConfig.enabled) return;
  
  const queue = new OfflineQueue(offlineConfig, logger);
  queue.process(retryConfig.retryOn).catch((error: unknown) => {
    logger.warn('Failed to process offline queue:', error);
  });
}

/**
 * Handle offline failure by queueing request
 */
async function handleOfflineFailure(
  error: unknown,
  endpoint: string,
  body: BodyInit,
  contentHeaders: Record<string, string>,
  auth: AuthConfig | string | undefined,
  offlineConfig: Required<OfflineConfig>,
  logger: Logger
): Promise<void> {
  if (!offlineConfig.enabled || !isNetworkError(error)) return;
  
  logger.warn('Network error detected, queueing request for offline retry');
  const queue = new OfflineQueue(offlineConfig, logger);
  const authHeaders = getAuthHeaders(auth);
  await queue.enqueue(endpoint, body, { ...contentHeaders, ...authHeaders });
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get authentication headers based on configuration
 * @param auth - Authentication configuration or legacy API key string
 * @returns HTTP headers for authentication
 */
export function getAuthHeaders(auth?: AuthConfig | string): Record<string, string> {
  // Backward compatibility: string treated as Bearer token
  if (typeof auth === 'string') {
    return { 'Authorization': `Bearer ${auth}` };
  }
  
  // No auth
  if (!auth) {
    return {};
  }
  
  // Apply strategy
  const strategy = authStrategies[auth.type];
  return strategy ? strategy(auth) : {};
}

/**
 * Submit request with authentication, exponential backoff retry, and offline queue support
 * 
 * Supports both legacy signature (4 parameters) and new options-based signature.
 * 
 * @param endpoint - API endpoint URL
 * @param body - Request body (must be serializable for retry)
 * @param contentHeaders - Content-related headers (Content-Type, etc.)
 * @param authOrOptions - Legacy: auth config/string, or new: TransportOptions
 * @returns Response from the server
 */
export async function submitWithAuth(
  endpoint: string,
  body: BodyInit,
  contentHeaders: Record<string, string>,
  authOrOptions?: AuthConfig | string | TransportOptions
): Promise<Response> {
  // Parse options (support both old signature and new options-based API)
  const { auth, logger, enableRetry, retryConfig, offlineConfig } = parseTransportParams(authOrOptions);
  
  // Process offline queue on each request (don't await - run in background)
  await processQueueInBackground(offlineConfig, retryConfig, logger);
  
  try {
    // Send with retry logic
    const response = await sendWithRetry(
      endpoint,
      body,
      contentHeaders,
      auth,
      retryConfig,
      logger,
      enableRetry
    );
    
    return response;
  } catch (error) {
    // Queue for offline retry if enabled
    await handleOfflineFailure(
      error,
      endpoint,
      body,
      contentHeaders,
      auth,
      offlineConfig,
      logger
    );
    throw error;
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

type TokenBasedAuth = Extract<AuthConfig, { type: 'jwt' | 'bearer' }>;

/**
 * Check if auth config supports token refresh
 */
function shouldRetryWithRefresh(auth?: AuthConfig | string): auth is TokenBasedAuth {
  return (
    typeof auth === 'object' &&
    (auth.type === 'jwt' || auth.type === 'bearer') &&
    typeof auth.onTokenExpired === 'function'
  );
}

/**
 * Make HTTP request with auth headers
 */
async function makeRequest(
  endpoint: string,
  body: BodyInit,
  contentHeaders: Record<string, string>,
  auth?: AuthConfig | string
): Promise<Response> {
  const authHeaders = getAuthHeaders(auth);
  const headers = { ...contentHeaders, ...authHeaders };
  
  return fetch(endpoint, {
    method: 'POST',
    headers,
    body,
  });
}

/**
 * Send request with exponential backoff retry
 */
async function sendWithRetry(
  endpoint: string,
  body: BodyInit,
  contentHeaders: Record<string, string>,
  auth: AuthConfig | string | undefined,
  retryConfig: Required<RetryConfig>,
  logger: Logger,
  enableTokenRetry: boolean
): Promise<Response> {
  const retryHandler = new RetryHandler(retryConfig, logger);
  let hasAttemptedRefresh = false;
  
  // Use retry handler with token refresh support
  return retryHandler.executeWithRetry(
    async () => {
      const response = await makeRequest(endpoint, body, contentHeaders, auth);
      
      // Check for 401 and retry with token refresh if applicable (only once)
      if (response.status === TOKEN_REFRESH_STATUS && enableTokenRetry && !hasAttemptedRefresh && shouldRetryWithRefresh(auth)) {
        hasAttemptedRefresh = true;
        const refreshedResponse = await retryWithTokenRefresh(
          endpoint,
          body,
          contentHeaders,
          auth as TokenBasedAuth,
          logger
        );
        return refreshedResponse;
      }
      
      return response;
    },
    (status) => retryConfig.retryOn.includes(status)
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is a network error
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('network') ||
      error.message.includes('fetch') ||
      error.message.includes('Failed to fetch') ||
      error.name === 'NetworkError' ||
      error.name === 'TypeError'
    );
  }
  return false;
}

/**
 * Retry request with refreshed token
 */
async function retryWithTokenRefresh(
  endpoint: string,
  body: BodyInit,
  contentHeaders: Record<string, string>,
  auth: TokenBasedAuth,
  logger: Logger
): Promise<Response> {
  try {
    logger.warn('Token expired, attempting refresh...');
    
    // Get new token
    const newToken = await auth.onTokenExpired!();
    
    // Create updated auth config
    const refreshedAuth: TokenBasedAuth = {
      ...auth,
      token: newToken,
    };
    
    // Retry request
    const response = await makeRequest(endpoint, body, contentHeaders, refreshedAuth);
    
    logger.log('Request retried with refreshed token');
    return response;
    
  } catch (error) {
    logger.error('Token refresh failed:', error);
    
    // Return original 401 - caller should handle
    return new Response(null, { status: TOKEN_REFRESH_STATUS, statusText: 'Unauthorized' });
  }
}

// Re-export for backwards compatibility
export { clearOfflineQueue, type OfflineConfig } from './offline-queue';
