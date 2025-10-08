/**
 * Main entry point for the backend package
 * Exports the database client and types
 */

export { DatabaseClient, createDatabaseClient, type DatabaseConfig } from './db/client.js';
export * from './db/types.js';
export { config, validateConfig } from './config.js';
export { runMigrations } from './db/migrations/migrate.js';
