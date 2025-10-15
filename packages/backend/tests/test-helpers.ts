/**
 * Test helper functions
 * Shared utilities for creating mocks and test fixtures
 */

import { vi } from 'vitest';

/**
 * Helper to create mock plugin registry for tests
 */
export function createMockPluginRegistry() {
  return {
    get: vi.fn().mockReturnValue({
      createFromBugReport: vi.fn().mockResolvedValue({
        externalId: 'JIRA-123',
        externalUrl: 'https://jira.example.com/browse/JIRA-123',
        platform: 'jira',
      }),
    }),
    listPlugins: vi.fn().mockReturnValue([{ platform: 'jira' }]),
    getSupportedPlatforms: vi.fn().mockReturnValue(['jira']),
  } as any;
}

/**
 * Helper to create mock storage service for tests
 */
export function createMockStorage() {
  return {
    uploadScreenshot: vi.fn().mockResolvedValue({ key: 'test-key', size: 1024 }),
    uploadReplay: vi.fn().mockResolvedValue({ key: 'test-key', size: 2048 }),
    uploadAttachment: vi.fn().mockResolvedValue({ key: 'test-key', size: 512 }),
  } as any;
}
