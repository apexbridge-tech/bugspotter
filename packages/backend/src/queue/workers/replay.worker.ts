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

import { Worker, type Job, type WorkerOptions } from 'bullmq';
import { promisify } from 'util';
import { gzip } from 'zlib';
import { getLogger } from '../../logger.js';

const logger = getLogger();
import { DatabaseClient } from '../../db/client.js';
import type { BaseStorageService } from '../../storage/base-storage-service.js';
import { getQueueConfig } from '../../config/queue.config.js';
import {
  REPLAY_JOB_NAME,
  validateReplayJobData,
  createReplayJobResult,
} from '../jobs/replay.job.js';
import type { ReplayJobData, ReplayJobResult } from '../types.js';

const gzipAsync = promisify(gzip);

// Chunk configuration (30-second segments)
const CHUNK_DURATION_MS = 30_000;

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

  // Step 1: Parse replay data (10%)
  await job.updateProgress(10);
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

  // Step 2: Chunk events (20%)
  await job.updateProgress(20);
  const eventChunks = chunkReplayEvents(events, CHUNK_DURATION_MS);
  const totalChunks = eventChunks.length;

  logger.debug('Chunked replay events', {
    totalChunks,
    chunkDuration: CHUNK_DURATION_MS,
    jobId: job.id,
  });

  // Step 3: Compress and upload chunks (20% → 80%, divided by chunk count)
  const chunks: ReplayChunk[] = [];
  const progressPerChunk = 60 / totalChunks; // 60% total for compression/upload

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
      compressionRatio: compressedChunk.compressionRatio.toFixed(2),
      jobId: job.id,
    });

    // Update progress
    const progress = 20 + (i + 1) * progressPerChunk;
    await job.updateProgress(Math.min(progress, 80));
  }

  // Step 4: Create and upload manifest (90%)
  await job.updateProgress(90);
  const manifest: ReplayManifest = {
    version: '1.0',
    bugReportId,
    projectId,
    totalDuration,
    totalEvents,
    totalChunks,
    chunks: chunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      eventCount: chunk.eventCount,
      url: `/api/v1/storage/replays/${projectId}/${bugReportId}/chunk-${chunk.chunkIndex.toString().padStart(4, '0')}.json.gz`,
      compressedSize: chunk.compressedSize,
      compressionRatio: parseFloat(chunk.compressionRatio.toFixed(2)),
    })),
    createdAt: new Date().toISOString(),
  };

  await storage.uploadReplayMetadata(projectId, bugReportId, manifest);

  // Step 5: Update bug_reports metadata (100%)
  const manifestUrl = `/api/v1/storage/replays/${projectId}/${bugReportId}/manifest.json`;
  await db.query(
    `UPDATE bug_reports 
     SET metadata = jsonb_set(
       COALESCE(metadata, '{}'::jsonb),
       '{replayManifestUrl}',
       $1::jsonb
     )
     WHERE id = $2`,
    [JSON.stringify(manifestUrl), bugReportId]
  );

  await job.updateProgress(100);

  const processingTime = Date.now() - startTime;
  const totalCompressedSize = chunks.reduce((sum, c) => sum + c.compressedSize, 0);
  const totalOriginalSize = chunks.reduce((sum, c) => sum + c.originalSize, 0);
  const overallCompressionRatio = totalOriginalSize / totalCompressedSize;

  logger.info('Replay job completed', {
    jobId: job.id,
    bugReportId,
    totalChunks,
    totalEvents,
    totalDuration,
    totalCompressedSize,
    overallCompressionRatio: overallCompressionRatio.toFixed(2),
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
 */
export function createReplayWorker(
  db: DatabaseClient,
  storage: BaseStorageService,
  connection: any
): Worker<ReplayJobData, ReplayJobResult> {
  const config = getQueueConfig();

  const workerOptions: WorkerOptions = {
    connection,
    concurrency: config.workers.replay.concurrency,
  };

  const worker = new Worker<ReplayJobData, ReplayJobResult>(
    REPLAY_JOB_NAME,
    async (job) => processReplayJob(job, db, storage),
    workerOptions
  );

  // Event: Job completed
  worker.on('completed', (job, result) => {
    logger.info('Replay job completed', {
      jobId: job.id,
      bugReportId: job.data.bugReportId,
      replayUrl: result.replayUrl,
      chunkCount: result.chunkCount,
      duration: result.duration,
    });
  });

  // Event: Job failed
  worker.on('failed', (job, error) => {
    logger.error('Replay job failed', {
      jobId: job?.id,
      bugReportId: job?.data.bugReportId,
      error: error.message,
      stack: error.stack,
    });
  });

  logger.info('Replay worker started', {
    concurrency: config.workers.replay.concurrency,
  });

  return worker;
}
