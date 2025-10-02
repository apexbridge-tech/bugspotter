declare module 'html-to-image' {
  export interface Options {
    quality?: number;
    backgroundColor?: string;
    width?: number;
    height?: number;
    cacheBust?: boolean;
    pixelRatio?: number;
    filter?: (node: Element) => boolean;
  }

  export function toPng(node: HTMLElement, options?: Options): Promise<string>;
  export function toJpeg(node: HTMLElement, options?: Options): Promise<string>;
  export function toBlob(node: HTMLElement, options?: Options): Promise<Blob>;
  export function toCanvas(node: HTMLElement, options?: Options): Promise<HTMLCanvasElement>;
  export function toPixelData(node: HTMLElement, options?: Options): Promise<Uint8ClampedArray>;
  export function toSvg(node: HTMLElement, options?: Options): Promise<string>;
}
