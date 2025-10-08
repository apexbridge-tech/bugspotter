/**
 * Main entry point for the backend package
 * Exports the database client, repositories, and types
 */

export { DatabaseClient, createDatabaseClient, type DatabaseConfig } from './db/client.js';
export {
  ProjectRepository,
  BugReportRepository,
  UserRepository,
  SessionRepository,
  TicketRepository,
} from './db/repositories.js';
export { BaseRepository } from './db/base-repository.js';
export * from './db/types.js';
export { config, validateConfig } from './config.js';
export { runMigrations } from './db/migrations/migrate.js';
export { setLogger, getLogger, type Logger } from './logger.js';
