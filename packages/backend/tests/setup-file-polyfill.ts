/**
 * Polyfill for File and Blob globals required by undici in Node 18
 * https://github.com/nodejs/undici/issues/1650
 */

import { Blob as NodeBlob } from 'buffer';

// Ensure Blob is available (should be in Node 18+)
if (typeof Blob === 'undefined') {
  // @ts-ignore
  globalThis.Blob = NodeBlob;
}

// Add File polyfill for Node 18
if (typeof File === 'undefined') {
  const BlobClass = globalThis.Blob || NodeBlob;
  
  // @ts-ignore - File may not be defined in Node 18
  globalThis.File = class File extends BlobClass {
    name: string;
    lastModified: number;

    constructor(chunks: BlobPart[], name: string, options?: FilePropertyBag) {
      super(chunks, options);
      this.name = name;
      this.lastModified = options?.lastModified ?? Date.now();
    }
  };
}

export {};
