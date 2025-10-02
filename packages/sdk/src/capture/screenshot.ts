import { toPng } from 'html-to-image';

export interface ScreenshotCaptureOptions {
  quality?: number;
  pixelRatio?: number;
  backgroundColor?: string;
  cacheBust?: boolean;
  targetElement?: HTMLElement;
  excludeAttribute?: string;
  width?: number;
  height?: number;
  errorPlaceholder?: string;
}

const DEFAULT_SCREENSHOT_OPTIONS = {
  quality: 0.8,
  cacheBust: true,
  backgroundColor: '#ffffff',
  excludeAttribute: 'data-bugspotter-exclude',
  errorPlaceholder: 'SCREENSHOT_FAILED',
} as const;

export class ScreenshotCapture {
  constructor(private options: ScreenshotCaptureOptions = {}) {}

  private shouldIncludeNode(node: Node): boolean {
    if (!('hasAttribute' in node)) {
      return true;
    }
    
    const element = node as Element;
    const excludeAttr = this.options.excludeAttribute || 
                        DEFAULT_SCREENSHOT_OPTIONS.excludeAttribute;
    
    return !element.hasAttribute(excludeAttr);
  }

  private buildCaptureOptions() {
    return {
      quality: this.options.quality ?? DEFAULT_SCREENSHOT_OPTIONS.quality,
      cacheBust: this.options.cacheBust ?? DEFAULT_SCREENSHOT_OPTIONS.cacheBust,
      pixelRatio: this.options.pixelRatio ?? window.devicePixelRatio,
      backgroundColor: this.options.backgroundColor ?? DEFAULT_SCREENSHOT_OPTIONS.backgroundColor,
      ...(this.options.width && { width: this.options.width }),
      ...(this.options.height && { height: this.options.height }),
      filter: (node: Node) => this.shouldIncludeNode(node),
    };
  }

  private async handleError(error: unknown): Promise<string> {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Screenshot capture failed:', err);
    return this.options.errorPlaceholder ?? DEFAULT_SCREENSHOT_OPTIONS.errorPlaceholder;
  }

  async capture(targetElement?: HTMLElement): Promise<string> {
    const element = targetElement || 
                    this.options.targetElement || 
                    document.body;
    
    try {
      const options = this.buildCaptureOptions();
      const dataUrl = await toPng(element, options);
      return dataUrl;
    } catch (error) {
      return this.handleError(error);
    }
  }
}
