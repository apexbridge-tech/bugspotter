/**
 * Transport layer for bug report submission with flexible authentication
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

export interface TransportOptions {
  /** Authentication configuration */
  auth?: AuthConfig | string;
  /** Optional logger for debugging */
  logger?: Logger;
  /** Enable retry on token expiration (default: true) */
  enableRetry?: boolean;
}

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
 * Submit request with authentication and automatic retry on 401
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
  // Determine if using legacy or new API
  // Parse options (support both old signature and new options-based API)
  let auth: AuthConfig | string | undefined;
  let logger: Logger = getLogger();
  let enableRetry = true;
  
  if (authOrOptions && typeof authOrOptions === 'object' && 'auth' in authOrOptions) {
    // New options-based API
    const options = authOrOptions as TransportOptions;
    auth = options.auth;
    logger = options.logger || getLogger();
    enableRetry = options.enableRetry ?? true;
  } else {
    // Legacy API: direct auth parameter
    auth = authOrOptions as AuthConfig | string | undefined;
  }
  
  // Initial request
  const response = await makeRequest(endpoint, body, contentHeaders, auth);
  
  // Check for 401 and retry if applicable
  if (response.status === 401 && enableRetry && shouldRetryWithRefresh(auth)) {
    return await retryWithTokenRefresh(
      endpoint,
      body,
      contentHeaders,
      auth as TokenBasedAuth,
      logger
    );
  }
  
  return response;
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
