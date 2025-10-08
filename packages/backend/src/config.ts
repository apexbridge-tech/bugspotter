/**
 * Application configuration
 * Reads environment variables and provides typed config
 *
 * Note: Call dotenv.config() before importing this module if you need to load .env files
 */

// Configuration constants
const MIN_JWT_SECRET_LENGTH = 32;
const MIN_PORT = 1;
const MAX_PORT = 65535;
const MIN_TIMEOUT_MS = 1000;
const MIN_RATE_LIMIT_WINDOW_MS = 1000;

export const config = {
  database: {
    url: process.env.DATABASE_URL ?? '',
    poolMax: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
    poolMin: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS ?? '30000', 10),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? '30000', 10),
    retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS ?? '3', 10),
    retryDelayMs: parseInt(process.env.DB_RETRY_DELAY_MS ?? '1000', 10),
  },
  server: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    env: process.env.NODE_ENV ?? 'development',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
  },
} as const;

/**
 * Helper to validate a numeric config value
 * @returns Error message if validation fails, null otherwise
 */
function validateNumber(value: number, name: string, min?: number, max?: number): string | null {
  if (Number.isNaN(value)) {
    return `${name} must be a valid number`;
  }
  if (min !== undefined && value < min) {
    return `${name} must be at least ${min}`;
  }
  if (max !== undefined && value > max) {
    return `${name} must be at most ${max}`;
  }
  return null;
}

// Validate required config
export function validateConfig(): void {
  const errors: string[] = [];

  // Database URL validation
  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  } else if (
    !config.database.url.startsWith('postgres://') &&
    !config.database.url.startsWith('postgresql://')
  ) {
    errors.push(
      'DATABASE_URL must be a valid PostgreSQL connection string (postgres:// or postgresql://)'
    );
  }

  // Numeric validations
  const numericChecks = [
    validateNumber(config.database.poolMin, 'DB_POOL_MIN', 0),
    validateNumber(config.database.poolMax, 'DB_POOL_MAX', 1),
    validateNumber(config.database.connectionTimeout, 'DB_CONNECTION_TIMEOUT_MS', MIN_TIMEOUT_MS),
    validateNumber(config.database.idleTimeout, 'DB_IDLE_TIMEOUT_MS', MIN_TIMEOUT_MS),
    validateNumber(config.database.retryAttempts, 'DB_RETRY_ATTEMPTS', 0),
    validateNumber(config.database.retryDelayMs, 'DB_RETRY_DELAY_MS', 0),
    validateNumber(config.server.port, 'PORT', MIN_PORT, MAX_PORT),
    validateNumber(config.rateLimit.windowMs, 'RATE_LIMIT_WINDOW_MS', MIN_RATE_LIMIT_WINDOW_MS),
    validateNumber(config.rateLimit.maxRequests, 'RATE_LIMIT_MAX_REQUESTS', 1),
  ];

  errors.push(
    ...numericChecks.filter((error): error is string => {
      return error !== null;
    })
  );

  // Pool size relationship (only check if both values are valid numbers)
  if (config.database.poolMin > config.database.poolMax) {
    errors.push('DB_POOL_MIN cannot be greater than DB_POOL_MAX');
  }

  // JWT validation
  if (!config.jwt.secret && config.server.env === 'production') {
    errors.push('JWT_SECRET is required in production');
  } else if (config.jwt.secret && config.jwt.secret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters for security`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors
        .map((e) => {
          return `  - ${e}`;
        })
        .join('\n')}`
    );
  }
}
