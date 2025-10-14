/**
 * Integration Service Registry
 * Factory for creating and managing integration services
 */

import type { DatabaseClient } from '../db/client.js';
import type { IStorageService } from '../storage/types.js';
import type { IntegrationService } from './base-integration.service.js';
import { JiraIntegrationService } from './jira/service.js';
import { getLogger } from '../logger.js';

const logger = getLogger();

/**
 * Integration Service Registry
 * Manages all available integration services and provides factory methods
 */
export class IntegrationServiceRegistry {
  private services: Map<string, IntegrationService> = new Map();
  private db: DatabaseClient;
  private storage: IStorageService;

  constructor(db: DatabaseClient, storage: IStorageService) {
    this.db = db;
    this.storage = storage;
    this.registerDefaultServices();
  }

  /**
   * Register default integration services
   */
  private registerDefaultServices(): void {
    // Register Jira integration
    this.register(new JiraIntegrationService(this.db, this.storage));

    // TODO: Register other integrations as they are implemented
    // this.register(new GitHubIntegrationService(this.db, this.storage));
    // this.register(new LinearIntegrationService(this.db, this.storage));
    // this.register(new SlackIntegrationService(this.db, this.storage));

    logger.info('Registered integration services', {
      platforms: Array.from(this.services.keys()),
    });
  }

  /**
   * Register a new integration service
   */
  register(service: IntegrationService): void {
    this.services.set(service.platform.toLowerCase(), service);
    logger.debug('Registered integration service', { platform: service.platform });
  }

  /**
   * Get integration service by platform name
   * @param platform - Platform name (jira, github, linear, slack)
   * @returns Integration service or null if not found
   */
  get(platform: string): IntegrationService | null {
    return this.services.get(platform.toLowerCase()) || null;
  }

  /**
   * Check if platform is supported
   */
  isSupported(platform: string): boolean {
    return this.services.has(platform.toLowerCase());
  }

  /**
   * Get list of supported platforms
   */
  getSupportedPlatforms(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get all registered services
   */
  getAll(): IntegrationService[] {
    return Array.from(this.services.values());
  }
}
