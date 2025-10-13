/**
 * Screenshot Job Definition
 * Processes screenshot uploads: download, optimize, create thumbnail
 */

import type { ScreenshotJobData, ScreenshotJobResult } from '../types.js';

export const SCREENSHOT_JOB_NAME = 'process-screenshot';

export interface ScreenshotJob {
  name: typeof SCREENSHOT_JOB_NAME;
  data: ScreenshotJobData;
}

/**
 * Validate screenshot job data
 */
export function validateScreenshotJobData(data: unknown): data is ScreenshotJobData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const d = data as Partial<ScreenshotJobData>;

  return !!(
    d.bugReportId &&
    typeof d.bugReportId === 'string' &&
    d.projectId &&
    typeof d.projectId === 'string' &&
    d.screenshotUrl &&
    typeof d.screenshotUrl === 'string'
  );
}

/**
 * Create screenshot job result
 */
export function createScreenshotJobResult(
  originalUrl: string,
  thumbnailUrl: string,
  metadata: {
    originalSize: number;
    thumbnailSize: number;
    width: number;
    height: number;
    processingTimeMs: number;
  }
): ScreenshotJobResult {
  return {
    originalUrl,
    thumbnailUrl,
    ...metadata,
  };
}
