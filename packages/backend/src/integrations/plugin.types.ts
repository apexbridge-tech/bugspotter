/**
 * Integration Plugin System
 * Defines interfaces for creating pluggable integrations
 */

import type { DatabaseClient } from '../db/client.js';
import type { IStorageService } from '../storage/types.js';
import type { IntegrationService } from './base-integration.service.js';

/**
 * Plugin context - dependencies injected into each plugin
 */
export interface PluginContext {
  db: DatabaseClient;
  storage: IStorageService;
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  name: string; // Plugin name (e.g., 'Jira Integration')
  platform: string; // Platform identifier (e.g., 'jira')
  version: string; // Semver version (e.g., '1.0.0')
  description?: string; // Optional description
  author?: string; // Plugin author
  requiredEnvVars?: string[]; // Required environment variables
}

/**
 * Plugin factory function
 * Takes context and returns an integration service instance
 */
export type PluginFactory = (context: PluginContext) => IntegrationService;

/**
 * Complete plugin definition
 */
export interface IntegrationPlugin {
  metadata: PluginMetadata;
  factory: PluginFactory;
}

/**
 * Plugin lifecycle hooks (optional for advanced plugins)
 */
export interface PluginLifecycle {
  /**
   * Called when plugin is loaded
   */
  onLoad?(): Promise<void> | void;

  /**
   * Called when plugin is unloaded
   */
  onUnload?(): Promise<void> | void;

  /**
   * Called to validate plugin configuration
   */
  validate?(): Promise<boolean> | boolean;
}

/**
 * Extended plugin with lifecycle hooks
 */
export interface AdvancedIntegrationPlugin extends IntegrationPlugin {
  lifecycle?: PluginLifecycle;
}
