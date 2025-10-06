/**
 * Transport layer for bug report submission with flexible authentication,
 * exponential backoff retry, and offline queue support
 */

import { getLogger, type Logger } from '../utils/logger';

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

export interface OfflineConfig {
  /** Enable offline queue (default: false) */
  enabled: boolean;
  /** Maximum number of requests to queue (default: 10) */
  maxQueueSize?: number;
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

/** Queued request for offline retry */
interface QueuedRequest {
  id: string;
  endpoint: string;
  body: string; // Serialized body
  headers: Record<string, string>;
  timestamp: number;
  attempts: number;
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

const QUEUE_STORAGE_KEY = 'bugspotter_offline_queue';
const QUEUE_EXPIRY_DAYS = 7;

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
  let auth: AuthConfig | string | undefined;
  let logger: Logger = getLogger();
  let enableRetry = true;
  let retryConfig: Required<RetryConfig> = DEFAULT_RETRY_CONFIG;
  let offlineConfig: Required<OfflineConfig> = DEFAULT_OFFLINE_CONFIG;
  
  if (authOrOptions && typeof authOrOptions === 'object' && 
      ('auth' in authOrOptions || 'retry' in authOrOptions || 'offline' in authOrOptions || 'logger' in authOrOptions || 'enableRetry' in authOrOptions)) {
    // New options-based API
    const options = authOrOptions as TransportOptions;
    auth = options.auth;
    logger = options.logger || getLogger();
    enableRetry = options.enableRetry ?? true;
    retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retry };
    offlineConfig = { ...DEFAULT_OFFLINE_CONFIG, ...options.offline };
  } else {
    // Legacy API: direct auth parameter
    auth = authOrOptions as AuthConfig | string | undefined;
  }
  
  // Process offline queue on each request (don't await - run in background)
  if (offlineConfig.enabled) {
    processOfflineQueue(auth, logger, retryConfig).catch((error: unknown) => {
      logger.warn('Failed to process offline queue:', error);
    });
  }
  
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
    if (offlineConfig.enabled && isNetworkError(error)) {
      logger.warn('Network error detected, queueing request for offline retry');
      await queueOfflineRequest(endpoint, body, contentHeaders, auth, logger, offlineConfig);
    }
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
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Make the request
      const response = await makeRequest(endpoint, body, contentHeaders, auth);
      
      // Check for 401 and retry with token refresh if applicable
      if (response.status === 401 && enableTokenRetry && shouldRetryWithRefresh(auth) && attempt === 0) {
        const refreshedResponse = await retryWithTokenRefresh(
          endpoint,
          body,
          contentHeaders,
          auth as TokenBasedAuth,
          logger
        );
        
        // If refresh succeeded, return the response
        if (refreshedResponse.status !== 401) {
          return refreshedResponse;
        }
        // If still 401, don't retry further
        return refreshedResponse;
      }
      
      // Check if we should retry based on status code
      if (retryConfig.retryOn.includes(response.status) && attempt < retryConfig.maxRetries) {
        const delay = calculateRetryDelay(attempt, retryConfig, response);
        logger.warn(`Request failed with status ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxRetries})`);
        await sleep(delay);
        continue;
      }
      
      // Success or non-retryable status
      return response;
      
    } catch (error) {
      lastError = error as Error;
      
      // Retry on network errors
      if (attempt < retryConfig.maxRetries) {
        const delay = calculateRetryDelay(attempt, retryConfig);
        logger.warn(`Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxRetries}):`, error);
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
function calculateRetryDelay(
  attempt: number,
  config: Required<RetryConfig>,
  response?: Response
): number {
  // Check for Retry-After header
  if (response?.headers?.has?.('Retry-After')) {
    const retryAfter = response.headers.get('Retry-After')!;
    const retryAfterSeconds = parseInt(retryAfter, 10);
    
    if (!isNaN(retryAfterSeconds)) {
      return Math.min(retryAfterSeconds * 1000, config.maxDelay);
    }
  }
  
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
  
  // Add jitter: ±10% randomization
  const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);
  const delayWithJitter = exponentialDelay + jitter;
  
  // Cap at maxDelay
  return Math.min(delayWithJitter, config.maxDelay);
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
    return new Response(null, { status: 401, statusText: 'Unauthorized' });
  }
}

// ============================================================================
// OFFLINE QUEUE MANAGEMENT
// ============================================================================

/**
 * Queue request for offline retry
 */
async function queueOfflineRequest(
  endpoint: string,
  body: BodyInit,
  headers: Record<string, string>,
  auth: AuthConfig | string | undefined,
  logger: Logger,
  config: Required<OfflineConfig>
): Promise<void> {
  try {
    // Serialize body
    let serializedBody: string;
    if (typeof body === 'string') {
      serializedBody = body;
    } else if (body instanceof Blob) {
      logger.warn('Cannot queue Blob for offline retry, skipping');
      return;
    } else {
      serializedBody = JSON.stringify(body);
    }
    
    // Get existing queue
    const queue = getOfflineQueue();
    
    // Check queue size limit
    if (queue.length >= config.maxQueueSize) {
      logger.warn(`Offline queue is full (${config.maxQueueSize}), removing oldest request`);
      queue.shift();
    }
    
    // Create queued request
    const authHeaders = getAuthHeaders(auth);
    const queuedRequest: QueuedRequest = {
      id: generateRequestId(),
      endpoint,
      body: serializedBody,
      headers: { ...headers, ...authHeaders },
      timestamp: Date.now(),
      attempts: 0,
    };
    
    // Add to queue
    queue.push(queuedRequest);
    
    // Save to localStorage
    saveOfflineQueue(queue);
    
    logger.log(`Request queued for offline retry (queue size: ${queue.length})`);
  } catch (error) {
    logger.error('Failed to queue request for offline retry:', error);
  }
}

/**
 * Process offline queue
 */
async function processOfflineQueue(
  auth: AuthConfig | string | undefined,
  logger: Logger,
  retryConfig: Required<RetryConfig>
): Promise<void> {
  const queue = getOfflineQueue();
  
  if (queue.length === 0) {
    return;
  }
  
  logger.log(`Processing offline queue (${queue.length} requests)`);
  
  const successfulIds: string[] = [];
  const failedRequests: QueuedRequest[] = [];
  
  for (const request of queue) {
    // Check if request has expired (7 days)
    const age = Date.now() - request.timestamp;
    const maxAge = QUEUE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    if (age > maxAge) {
      logger.warn(`Removing expired queued request (id: ${request.id})`);
      continue;
    }
    
    try {
      // Attempt to send
      const response = await fetch(request.endpoint, {
        method: 'POST',
        headers: request.headers,
        body: request.body,
      });
      
      if (response.ok) {
        logger.log(`Successfully sent queued request (id: ${request.id})`);
        successfulIds.push(request.id);
      } else if (retryConfig.retryOn.includes(response.status)) {
        // Keep in queue for next attempt
        request.attempts++;
        failedRequests.push(request);
        logger.warn(`Queued request failed with status ${response.status}, will retry later (id: ${request.id})`);
      } else {
        // Non-retryable error, remove from queue
        logger.warn(`Queued request failed with non-retryable status ${response.status}, removing (id: ${request.id})`);
      }
    } catch (error) {
      // Network error, keep in queue
      request.attempts++;
      failedRequests.push(request);
      logger.warn(`Queued request failed with network error, will retry later (id: ${request.id}):`, error);
    }
  }
  
  // Update queue (remove successful and expired, keep failed)
  saveOfflineQueue(failedRequests);
  
  if (successfulIds.length > 0 || failedRequests.length < queue.length) {
    logger.log(`Offline queue processed: ${successfulIds.length} successful, ${failedRequests.length} remaining`);
  }
}

/**
 * Get offline queue from localStorage
 */
function getOfflineQueue(): QueuedRequest[] {
  try {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    
    return JSON.parse(stored) as QueuedRequest[];
  } catch (error) {
    return [];
  }
}

/**
 * Save offline queue to localStorage
 */
function saveOfflineQueue(queue: QueuedRequest[]): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    // Ignore storage errors
  }
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Clear offline queue (useful for testing or manual cleanup)
 */
export function clearOfflineQueue(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
    }
  } catch (error) {
    // Ignore storage errors
  }
}
