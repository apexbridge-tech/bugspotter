/**
 * Polyfill for File and Blob globals required by undici in Node 18
 * https://github.com/nodejs/undici/issues/1650
 */

// @ts-ignore - File may not be defined in Node 18
if (typeof File === 'undefined') {
  // @ts-ignore
  globalThis.File = class File extends Blob {
    constructor(chunks: BlobPart[], name: string, options?: FilePropertyBag) {
      super(chunks, options);
      // @ts-ignore
      this.name = name;
      // @ts-ignore
      this.lastModified = options?.lastModified ?? Date.now();
    }
  };
}
