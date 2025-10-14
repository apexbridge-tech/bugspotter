/**
 * Plugin-based Integration Registry
 * Manages integration plugins with auto-discovery
 */

import type { DatabaseClient } from '../db/client.js';
import type { IStorageService } from '../storage/types.js';
import type { IntegrationService } from './base-integration.service.js';
import type {
  IntegrationPlugin,
  AdvancedIntegrationPlugin,
  PluginContext,
} from './plugin.types.js';
import { getLogger } from '../logger.js';

const logger = getLogger();

/**
 * Plugin Registry
 * Discovers, loads, and manages integration plugins
 */
export class PluginRegistry {
  private plugins: Map<string, AdvancedIntegrationPlugin> = new Map();
  private services: Map<string, IntegrationService> = new Map();
  private context: PluginContext;

  constructor(db: DatabaseClient, storage: IStorageService) {
    this.context = { db, storage };
  }

  /**
   * Register a plugin
   * @param plugin - Plugin to register
   */
  async register(plugin: IntegrationPlugin | AdvancedIntegrationPlugin): Promise<void> {
    const platform = plugin.metadata.platform.toLowerCase();

    // Check if already registered
    if (this.plugins.has(platform)) {
      logger.warn('Plugin already registered, skipping', {
        platform,
        name: plugin.metadata.name,
      });
      return;
    }

    // Validate plugin metadata
    if (!plugin.metadata.name || !plugin.metadata.platform || !plugin.metadata.version) {
      throw new Error(
        `Invalid plugin metadata: missing required fields (name, platform, or version)`
      );
    }

    // Check required environment variables
    if (plugin.metadata.requiredEnvVars) {
      const missing = plugin.metadata.requiredEnvVars.filter((envVar) => !process.env[envVar]);
      if (missing.length > 0) {
        logger.warn('Plugin missing required environment variables', {
          platform,
          missing,
        });
      }
    }

    // Cast to advanced plugin
    const advancedPlugin = plugin as AdvancedIntegrationPlugin;

    // Call lifecycle hook: onLoad
    if (advancedPlugin.lifecycle?.onLoad) {
      try {
        await advancedPlugin.lifecycle.onLoad();
      } catch (error) {
        logger.error('Plugin onLoad hook failed', {
          platform,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    // Validate plugin
    if (advancedPlugin.lifecycle?.validate) {
      const isValid = await advancedPlugin.lifecycle.validate();
      if (!isValid) {
        throw new Error(`Plugin validation failed: ${platform}`);
      }
    }

    // Store plugin
    this.plugins.set(platform, advancedPlugin);

    // Create service instance
    try {
      const service = plugin.factory(this.context);
      this.services.set(platform, service);

      logger.info('Registered integration plugin', {
        name: plugin.metadata.name,
        platform,
        version: plugin.metadata.version,
      });
    } catch (error) {
      // Cleanup on failure
      this.plugins.delete(platform);
      logger.error('Failed to instantiate plugin service', {
        platform,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Unregister a plugin
   * @param platform - Platform identifier
   */
  async unregister(platform: string): Promise<void> {
    const normalizedPlatform = platform.toLowerCase();
    const plugin = this.plugins.get(normalizedPlatform);

    if (!plugin) {
      logger.warn('Plugin not found for unregistration', { platform });
      return;
    }

    // Call lifecycle hook: onUnload
    if (plugin.lifecycle?.onUnload) {
      try {
        await plugin.lifecycle.onUnload();
      } catch (error) {
        logger.error('Plugin onUnload hook failed', {
          platform,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Remove from registry
    this.plugins.delete(normalizedPlatform);
    this.services.delete(normalizedPlatform);

    logger.info('Unregistered integration plugin', { platform });
  }

  /**
   * Get integration service by platform
   * @param platform - Platform identifier
   * @returns Integration service or null if not found
   */
  get(platform: string): IntegrationService | null {
    return this.services.get(platform.toLowerCase()) || null;
  }

  /**
   * Check if platform is supported
   * @param platform - Platform identifier
   */
  isSupported(platform: string): boolean {
    return this.services.has(platform.toLowerCase());
  }

  /**
   * Get all registered platform identifiers
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

  /**
   * Get plugin metadata
   * @param platform - Platform identifier
   */
  getPluginMetadata(platform: string) {
    const plugin = this.plugins.get(platform.toLowerCase());
    return plugin?.metadata || null;
  }

  /**
   * Get all plugin metadata
   */
  getAllPluginMetadata() {
    return Array.from(this.plugins.values()).map((p) => p.metadata);
  }

  /**
   * List all registered plugins with metadata
   * Alias for getAllPluginMetadata() for cleaner API
   */
  listPlugins() {
    return this.getAllPluginMetadata();
  }
}
