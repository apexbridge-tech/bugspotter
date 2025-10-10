/**
 * Configuration type definitions
 */

export const VALID_STORAGE_BACKENDS = ['local', 's3', 'minio', 'r2'] as const;
export type StorageBackend = (typeof VALID_STORAGE_BACKENDS)[number];

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DatabaseConfig {
  url: string;
  poolMax: number;
  poolMin: number;
  connectionTimeout: number;
  idleTimeout: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface ServerConfig {
  port: number;
  env: string;
  maxUploadSize: number;
  corsOrigins: string[];
  logLevel: LogLevel;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface LocalStorageConfig {
  baseDirectory: string;
  baseUrl: string;
}

export interface S3Config {
  endpoint?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  forcePathStyle: boolean;
  maxRetries: number;
  timeout: number;
}

export interface StorageConfig {
  backend: StorageBackend;
  local: LocalStorageConfig;
  s3: S3Config;
}

export interface AppConfig {
  database: DatabaseConfig;
  server: ServerConfig;
  jwt: JwtConfig;
  rateLimit: RateLimitConfig;
  storage: StorageConfig;
}
