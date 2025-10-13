/**
 * Storage URL Builder
 * Single Responsibility: Build API URLs for accessing stored resources
 *
 * Separates URL/routing concerns from business logic (workers, services).
 * All API route structures for storage resources are centralized here.
 */

const API_BASE = '/api/v1/storage';
const CHUNK_INDEX_PADDING = 4;

/**
 * Build API URL for replay chunk
 */
export function buildReplayChunkUrl(
  projectId: string,
  bugReportId: string,
  chunkIndex: number
): string {
  const paddedIndex = chunkIndex.toString().padStart(CHUNK_INDEX_PADDING, '0');
  return `${API_BASE}/replays/${projectId}/${bugReportId}/chunk-${paddedIndex}.json.gz`;
}

/**
 * Build API URL for replay manifest
 */
export function buildReplayManifestUrl(projectId: string, bugReportId: string): string {
  return `${API_BASE}/replays/${projectId}/${bugReportId}/manifest.json`;
}

/**
 * Build API URL for screenshot (original or thumbnail)
 */
export function buildScreenshotUrl(
  projectId: string,
  bugReportId: string,
  variant: 'original' | 'thumbnail' = 'original'
): string {
  const filename = variant === 'thumbnail' ? 'thumbnail.jpg' : 'original.png';
  return `${API_BASE}/screenshots/${projectId}/${bugReportId}/${filename}`;
}

/**
 * Build API URL for attachment
 */
export function buildAttachmentUrl(
  projectId: string,
  bugReportId: string,
  filename: string
): string {
  return `${API_BASE}/attachments/${projectId}/${bugReportId}/${filename}`;
}
