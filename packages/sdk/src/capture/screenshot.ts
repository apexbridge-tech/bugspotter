import { toPng } from 'html-to-image';
import { BaseCapture, type CaptureOptions } from './base-capture';

export interface ScreenshotCaptureOptions extends CaptureOptions {
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

export class ScreenshotCapture extends BaseCapture<Promise<string>, ScreenshotCaptureOptions> {
  constructor(options: ScreenshotCaptureOptions = {}) {
    super(options);
  }

  protected getErrorPlaceholder(): string {
    return this.options.errorPlaceholder ?? DEFAULT_SCREENSHOT_OPTIONS.errorPlaceholder;
  }

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

  async capture(targetElement?: HTMLElement): Promise<string> {
    try {
      const element = targetElement || 
                      this.options.targetElement || 
                      document.body;
      
      const options = this.buildCaptureOptions();
      const dataUrl = await toPng(element, options);
      return dataUrl;
    } catch (error) {
      this.handleError('capturing screenshot', error);
      return this.getErrorPlaceholder();
    }
  }
}
