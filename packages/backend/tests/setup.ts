/**
 * Test setup file with Testcontainers
 * Automatically starts and manages PostgreSQL container for tests
 */

// CRITICAL: Polyfill File/Blob BEFORE importing testcontainers/undici
// This MUST be the first import to avoid "File is not defined" errors
import './setup-file-polyfill.js';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let postgresContainer: StartedPostgreSqlContainer;

/**
 * Global setup - starts PostgreSQL container before all tests
 */
export async function setup() {
  console.log('🚀 Starting PostgreSQL container...');

  postgresContainer = await new PostgreSqlContainer('postgres:16')
    .withDatabase('bugspotter_test')
    .withUsername('postgres')
    .withPassword('testpass')
    .withExposedPorts(5432)
    .start();

  const connectionUri = postgresContainer.getConnectionUri();
  process.env.DATABASE_URL = connectionUri;
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-not-production';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';

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
}

/**
 * Global teardown - stops PostgreSQL container after all tests
 */
export async function teardown() {
  if (postgresContainer) {
    console.log('🧹 Stopping PostgreSQL container...');
    await postgresContainer.stop();
    console.log('✅ Container stopped');
  }
}
