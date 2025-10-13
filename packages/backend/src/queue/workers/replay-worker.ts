/**
 * Replay Worker
 *
 * Processes session replay jobs with chunking and compression.
 * Downloads replay data, chunks into manageable segments, compresses each chunk,
 * uploads to storage, and updates database with metadata.
 *
 * Processing Pipeline:
 * 1. Download/parse replay data (string or object)
 * 2. Chunk replay events into time-based segments (30-second chunks)
 * 3. Compress each chunk with gzip
 * 4. Upload compressed chunks to storage
 * 5. Create and upload manifest file with chunk metadata
 * 6. Update bug_reports.metadata with replay URLs
 *
 * Dependencies:
 * - DatabaseClient: For updating bug report metadata
 * - BaseStorageService: For uploading chunks and manifest
 * - zlib: For gzip compression
 */

import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { promisify } from 'util';
import { gzip } from 'zlib';
import { getLogger } from '../../logger.js';
import { buildReplayChunkUrl, buildReplayManifestUrl } from '../../storage/storage-url-builder.js';

const logger = getLogger();
import { DatabaseClient } from '../../db/client.js';
import type { BaseStorageService } from '../../storage/base-storage-service.js';
import {
  REPLAY_JOB_NAME,
  validateReplayJobData,
  createReplayJobResult,
} from '../jobs/replay-job.js';
import type { ReplayJobData, ReplayJobResult } from '../types.js';
import type { BaseWorker } from './base-worker.js';
import { createBaseWorkerWrapper } from './base-worker.js';
import { attachStandardEventHandlers } from './worker-events.js';
import { ProgressTracker } from './progress-tracker.js';
import { createWorker } from './worker-factory.js';

const gzipAsync = promisify(gzip);

// Chunk configuration (30-second segments)
const CHUNK_DURATION_MS = 30_000;
const COMPRESSION_RATIO_DECIMALS = 2;

/**
 * Replay chunk with compressed data
 */
interface ReplayChunk {
  chunkIndex: number;
  startTime: number;
  endTime: number;
  eventCount: number;
  compressedData: Buffer;
  compressedSize: number;
  originalSize: number;
  compressionRatio: number;
}

/**
 * Manifest file structure for replay chunks
 */
interface ReplayManifest extends Record<string, unknown> {
  version: '1.0';
  bugReportId: string;
  projectId: string;
  totalDuration: number;
  totalEvents: number;
  totalChunks: number;
  chunks: Array<{
    chunkIndex: number;
    startTime: number;
    endTime: number;
    eventCount: number;
    url: string;
    compressedSize: number;
    compressionRatio: number;
  }>;
  createdAt: string;
}

/**
 * Parse replay data from string or object
 */
function parseReplayData(data: string | Record<string, unknown>): {
  events: Array<{ timestamp: number; [key: string]: unknown }>;
  duration?: number;
} {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to parse replay data JSON: ${error}`);
    }
  }
  return data as {
    events: Array<{ timestamp: number; [key: string]: unknown }>;
    duration?: number;
  };
}

/**
 * Chunk replay events by time segments
 */
function chunkReplayEvents(
  events: Array<{ timestamp: number; [key: string]: unknown }>,
  chunkDurationMs: number
): Array<Array<{ timestamp: number; [key: string]: unknown }>> {
  if (events.length === 0) {
    return [];
  }

  const chunks: Array<Array<{ timestamp: number; [key: string]: unknown }>> = [];
  const startTime = events[0].timestamp;

  let currentChunk: Array<{ timestamp: number; [key: string]: unknown }> = [];
  let currentChunkStart = startTime;

  for (const event of events) {
    const timeSinceChunkStart = event.timestamp - currentChunkStart;

    if (timeSinceChunkStart >= chunkDurationMs && currentChunk.length > 0) {
      // Start new chunk
      chunks.push(currentChunk);
      currentChunk = [event];
      currentChunkStart = event.timestamp;
    } else {
      currentChunk.push(event);
    }
  }

  // Add last chunk if not empty
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Compress replay chunk with gzip
 */
async function compressChunk(
  events: Array<{ timestamp: number; [key: string]: unknown }>,
  chunkIndex: number
): Promise<ReplayChunk> {
  const jsonData = JSON.stringify({ events });
  const originalSize = Buffer.byteLength(jsonData, 'utf8');

  const compressedData = await gzipAsync(jsonData);
  const compressedSize = compressedData.length;
  const compressionRatio = originalSize / compressedSize;

  const startTime = events[0].timestamp;
  const endTime = events[events.length - 1].timestamp;

  return {
    chunkIndex,
    startTime,
    endTime,
    eventCount: events.length,
    compressedData,
    compressedSize,
    originalSize,
    compressionRatio,
  };
}

/**
 * Format compression ratio to fixed decimals
 */
function formatCompressionRatio(ratio: number): number {
  return parseFloat(ratio.toFixed(COMPRESSION_RATIO_DECIMALS));
}

/**
 * Calculate totals from chunks
 */
function calculateChunkTotals(chunks: Array<ReplayChunk>): {
  totalCompressedSize: number;
  totalOriginalSize: number;
  overallCompressionRatio: number;
} {
  const totalCompressedSize = chunks.reduce((sum, c) => sum + c.compressedSize, 0);
  const totalOriginalSize = chunks.reduce((sum, c) => sum + c.originalSize, 0);
  const overallCompressionRatio = totalOriginalSize / totalCompressedSize;

  return { totalCompressedSize, totalOriginalSize, overallCompressionRatio };
}

/**
 * Process and upload all replay chunks
 */
async function processAndUploadChunks(
  eventChunks: Array<Array<{ timestamp: number; [key: string]: unknown }>>,
  projectId: string,
  bugReportId: string,
  storage: BaseStorageService,
  jobId: string | undefined
): Promise<Array<ReplayChunk>> {
  const chunks: Array<ReplayChunk> = [];

  for (let i = 0; i < eventChunks.length; i++) {
    const eventChunk = eventChunks[i];

    // Compress chunk
    const compressedChunk = await compressChunk(eventChunk, i);
    chunks.push(compressedChunk);

    // Upload chunk
    await storage.uploadReplayChunk(projectId, bugReportId, i, compressedChunk.compressedData);

    logger.debug('Uploaded replay chunk', {
      chunkIndex: i,
      compressedSize: compressedChunk.compressedSize,
      compressionRatio: formatCompressionRatio(compressedChunk.compressionRatio),
      jobId,
    });
  }

  return chunks;
}

/**
 * Build replay manifest from chunks
 */
function buildReplayManifest(
  chunks: Array<ReplayChunk>,
  bugReportId: string,
  projectId: string,
  totalDuration: number,
  totalEvents: number
): ReplayManifest {
  return {
    version: '1.0',
    bugReportId,
    projectId,
    totalDuration,
    totalEvents,
    totalChunks: chunks.length,
    chunks: chunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      eventCount: chunk.eventCount,
      url: buildReplayChunkUrl(projectId, bugReportId, chunk.chunkIndex),
      compressedSize: chunk.compressedSize,
      compressionRatio: formatCompressionRatio(chunk.compressionRatio),
    })),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Process replay job: chunk, compress, upload
 */
async function processReplayJob(
  job: Job<ReplayJobData, ReplayJobResult>,
  db: DatabaseClient,
  storage: BaseStorageService
): Promise<ReplayJobResult> {
  const startTime = Date.now();

  // Validate job data
  validateReplayJobData(job.data);
  const { bugReportId, projectId, replayData } = job.data;

  logger.info('Processing replay job', {
    jobId: job.id,
    bugReportId,
    projectId,
  });

  const progress = new ProgressTracker(job, 5);

  // Step 1: Parse replay data
  await progress.update(1, 'Parsing replay data');
  const parsed = parseReplayData(replayData as string | Record<string, unknown>);
  const { events } = parsed;
  const totalEvents = events.length;
  const totalDuration =
    events.length > 0 ? events[events.length - 1].timestamp - events[0].timestamp : 0;

  logger.debug('Parsed replay data', {
    totalEvents,
    totalDuration,
    jobId: job.id,
  });

  // Step 2: Chunk events
  await progress.update(2, 'Chunking events');
  const eventChunks = chunkReplayEvents(events, CHUNK_DURATION_MS);
  const totalChunks = eventChunks.length;

  logger.debug('Chunked replay events', {
    totalChunks,
    chunkDuration: CHUNK_DURATION_MS,
    jobId: job.id,
  });

  // Step 3: Compress and upload chunks
  await progress.update(3, 'Compressing and uploading chunks');
  const chunks = await processAndUploadChunks(eventChunks, projectId, bugReportId, storage, job.id);

  // Step 4: Create and upload manifest
  await progress.update(4, 'Creating manifest');
  const manifest = buildReplayManifest(chunks, bugReportId, projectId, totalDuration, totalEvents);

  await storage.uploadReplayMetadata(projectId, bugReportId, manifest);

  // Step 5: Update bug_reports metadata
  const manifestUrl = buildReplayManifestUrl(projectId, bugReportId);
  await db.bugReports.updateReplayManifestUrl(bugReportId, manifestUrl);

  await progress.complete('Done');

  const processingTime = Date.now() - startTime;
  const { totalCompressedSize, overallCompressionRatio } = calculateChunkTotals(chunks);

  logger.info('Replay job completed', {
    jobId: job.id,
    bugReportId,
    totalChunks,
    totalEvents,
    totalDuration,
    totalCompressedSize,
    overallCompressionRatio: formatCompressionRatio(overallCompressionRatio),
    processingTime,
  });

  return createReplayJobResult(
    manifestUrl,
    manifestUrl, // metadataUrl same as manifestUrl
    {
      chunkCount: totalChunks,
      totalSize: totalCompressedSize,
      duration: totalDuration,
      eventCount: totalEvents,
      processingTimeMs: processingTime,
    }
  );
}

/**
 * Create replay worker with concurrency and event handlers
 * Returns a BaseWorker wrapper for consistent interface with other workers
 */
export function createReplayWorker(
  db: DatabaseClient,
  storage: BaseStorageService,
  connection: Redis
): BaseWorker<ReplayJobData, ReplayJobResult> {
  const worker = createWorker<ReplayJobData, ReplayJobResult>({
    name: REPLAY_JOB_NAME,
    processor: async (job) => processReplayJob(job, db, storage),
    connection,
    workerType: 'replay',
  });

  // Attach standard event handlers with job-specific context
  attachStandardEventHandlers(worker, 'Replay', (data, result) => ({
    bugReportId: data.bugReportId,
    replayUrl: result?.replayUrl,
    chunkCount: result?.chunkCount,
    duration: result?.duration,
  }));

  logger.info('Replay worker started');

  // Return wrapped worker that implements BaseWorker interface
  return createBaseWorkerWrapper(worker, 'Replay');
}
