/**
 * Application configuration
 * Reads environment variables and provides typed config
 *
 * Note: Call dotenv.config() before importing this module if you need to load .env files
 */

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

// Validate required config
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  }

  if (!config.jwt.secret && config.server.env === 'production') {
    errors.push('JWT_SECRET is required in production');
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
