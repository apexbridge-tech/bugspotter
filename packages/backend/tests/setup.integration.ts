/**
 * Integration Test Setup
 * Sets up test containers and environment for integration tests
 */

// CRITICAL: Polyfill File/Blob BEFORE importing testcontainers/undici
import './setup-file-polyfill.js';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DatabaseClient } from '../src/db/client.js';

const execAsync = promisify(exec);

let postgresContainer: StartedPostgreSqlContainer;

/**
 * Global setup for integration tests
 * Starts PostgreSQL container and runs migrations
 * Note: This runs in a separate context from tests
 */
export async function setup() {
  console.log('🚀 Starting integration test setup...');

  // Start PostgreSQL container
  console.log('Starting PostgreSQL container...');
  postgresContainer = await new PostgreSqlContainer('postgres:16')
    .withDatabase('bugspotter_integration_test')
    .withUsername('postgres')
    .withPassword('testpass')
    .withExposedPorts(5432)
    .start();

  const connectionUri = postgresContainer.getConnectionUri();
  process.env.DATABASE_URL = connectionUri;
  process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests-min-32-chars-required-here';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

  console.log('✅ PostgreSQL container started');
  console.log('📍 Database:', connectionUri.replace(/:[^:@]+@/, ':***@'));

  // Run migrations
  console.log('🔄 Running migrations...');
  try {
    await execAsync('pnpm migrate', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: connectionUri },
    });
    console.log('✅ Migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }

  // Create a temporary client just to verify the connection
  const testDb = new DatabaseClient({
    connectionString: connectionUri,
  });

  const isConnected = await testDb.testConnection();
  if (!isConnected) {
    await testDb.close();
    throw new Error('Failed to connect to test database');
  }
  await testDb.close();
  console.log('✅ Database connection verified');

  console.log('✅ Integration test setup complete\n');
}

/**
 * Global teardown for integration tests
 * Stops container and closes connections
 */
export async function teardown() {
  console.log('\n🧹 Starting integration test teardown...');

  // Stop PostgreSQL container
  if (postgresContainer) {
    console.log('Stopping PostgreSQL container...');
    try {
      await postgresContainer.stop();
      console.log('✅ Container stopped');
    } catch (error) {
      console.error('Error stopping container:', error);
    }
  }

  console.log('✅ Integration test teardown complete');
}

/**
 * Create a fresh database client for testing
 * Each test suite should create its own client
 */
export function createTestDatabase(): DatabaseClient {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set. Make sure globalSetup has run.');
  }

  return new DatabaseClient({
    connectionString: process.env.DATABASE_URL,
  });
}

/**
 * Create a test server with database
 * Returns both server and database for cleanup
 */
export async function createTestServerWithDb() {
  // Verify JWT_SECRET is set before creating server
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not set when creating test server!');
    console.warn('Setting it now...');
    process.env.JWT_SECRET =
      'test-jwt-secret-for-integration-tests-min-32-chars-required-here';
  }

  // Lazy import to avoid loading Fastify until needed after env vars are set
  const { createServer } = await import('../src/api/server.js');

  const db = createTestDatabase();
  const server = await createServer({ db });

  return { server, db };
}

// Legacy functions - DO NOT USE
// These were for a different approach and are no longer supported
// Use createTestDatabase() and createTestServerWithDb() instead
export function getTestDatabase(): never {
  throw new Error('getTestDatabase() is deprecated. Use createTestDatabase() instead.');
}

export function getTestServer(): never {
  throw new Error('getTestServer() is deprecated. Use createTestServerWithDb() instead.');
}
