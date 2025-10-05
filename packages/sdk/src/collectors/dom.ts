import { record } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';
import { CircularBuffer } from '../core/buffer';
import type { Sanitizer } from '../utils/sanitize';

export interface DOMCollectorConfig {
  /** Duration in seconds to keep replay events (default: 15) */
  duration?: number;
  /** Sampling configuration for performance optimization */
  sampling?: {
    /** Throttle mousemove events (ms, default: 50) */
    mousemove?: number;
    /** Throttle scroll events (ms, default: 100) */
    scroll?: number;
  };
  /** Whether to record canvas elements (default: false) */
  recordCanvas?: boolean;
  /** Whether to record cross-origin iframes (default: false) */
  recordCrossOriginIframes?: boolean;
  /** Sanitizer for PII protection */
  sanitizer?: Sanitizer;
}

/**
 * DOM Collector using rrweb to record DOM mutations, mouse movements, clicks, and scrolls.
 * Maintains a circular buffer with the last 15-30 seconds of events.
 */
export class DOMCollector {
  private buffer: CircularBuffer;
  private stopRecordingFn?: () => void;
  private isRecording = false;
  private config: DOMCollectorConfig & { duration: number; sampling: Required<DOMCollectorConfig['sampling']>; recordCanvas: boolean; recordCrossOriginIframes: boolean };
  private sanitizer?: Sanitizer;

  constructor(config: DOMCollectorConfig = {}) {
    this.sanitizer = config.sanitizer;
    this.config = {
      duration: config.duration ?? 15,
      sampling: {
        mousemove: config.sampling?.mousemove ?? 50,
        scroll: config.sampling?.scroll ?? 100,
      },
      recordCanvas: config.recordCanvas ?? false,
      recordCrossOriginIframes: config.recordCrossOriginIframes ?? false,
      sanitizer: config.sanitizer,
    };

    this.buffer = new CircularBuffer({
      duration: this.config.duration,
    });
  }

  /**
   * Start recording DOM events
   */
  startRecording(): void {
    if (this.isRecording) {
      console.warn('DOMCollector: Recording already in progress');
      return;
    }

    try {
      const recordConfig = {
        emit: (event: eventWithTime) => {
          this.buffer.add(event);
        },
        sampling: {
          mousemove: this.config.sampling?.mousemove ?? 50,
          scroll: this.config.sampling?.scroll ?? 100,
          // Also throttle mouse interactions slightly for better performance
          mouseInteraction: {
            MouseUp: false,
            MouseDown: false,
            Click: false,
            ContextMenu: false,
            DblClick: false,
            Focus: false,
            Blur: false,
            TouchStart: false,
            TouchEnd: false,
          },
        },
        recordCanvas: this.config.recordCanvas,
        recordCrossOriginIframes: this.config.recordCrossOriginIframes,
        // PII sanitization for text content
        maskTextFn: this.sanitizer ? (text: string, element?: HTMLElement) => {
          return this.sanitizer!.sanitizeTextNode(text, element);
        } : undefined,
        // Performance optimizations
        slimDOMOptions: {
          script: true, // Don't record script tags
          comment: true, // Don't record comments
          headFavicon: true, // Don't record favicon
          headWhitespace: true, // Don't record whitespace in head
          headMetaSocial: true, // Don't record social media meta tags
          headMetaRobots: true, // Don't record robots meta tags
          headMetaHttpEquiv: true, // Don't record http-equiv meta tags
          headMetaAuthorship: true, // Don't record authorship meta tags
          headMetaVerification: true, // Don't record verification meta tags
        },
        // Don't inline images to keep payload size down
        inlineImages: false,
        // Collect fonts for proper replay
        collectFonts: false,
      };

      this.stopRecordingFn = record(recordConfig);
      this.isRecording = true;
      console.debug('DOMCollector: Started recording');
    } catch (error) {
      console.error('DOMCollector: Failed to start recording', error);
      this.isRecording = false;
    }
  }

  /**
   * Stop recording DOM events
   */
  stopRecording(): void {
    if (!this.isRecording) {
      console.warn('DOMCollector: No recording in progress');
      return;
    }

    if (this.stopRecordingFn) {
      try {
        this.stopRecordingFn();
        this.isRecording = false;
        console.debug('DOMCollector: Stopped recording');
      } catch (error) {
        console.error('DOMCollector: Failed to stop recording', error);
      }
    }
  }

  /**
   * Get all events from the buffer
   */
  getEvents(): eventWithTime[] {
    return this.buffer.getEvents();
  }

  /**
   * Get compressed events from the buffer
   */
  getCompressedEvents(): eventWithTime[] {
    return this.buffer.getCompressedEvents();
  }

  /**
   * Clear all events from the buffer
   */
  clearBuffer(): void {
    this.buffer.clear();
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get the current buffer size
   */
  getBufferSize(): number {
    return this.buffer.size();
  }

  /**
   * Update the buffer duration
   */
  setDuration(seconds: number): void {
    this.config.duration = seconds;
    this.buffer.setDuration(seconds);
  }

  /**
   * Get the buffer duration
   */
  getDuration(): number {
    return this.config.duration;
  }

  /**
   * Destroy the collector and clean up resources
   */
  destroy(): void {
    this.stopRecording();
    this.clearBuffer();
  }
}
