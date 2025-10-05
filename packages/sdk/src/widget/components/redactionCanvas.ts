/**
 * RedactionCanvas
 * 
 * Responsibility: Handle canvas drawing and redaction rectangle management
 * Follows SRP: Only handles canvas-based redaction interactions
 */

export interface RedactionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactionCanvasConfig {
  redactionColor?: string;
  cursorStyle?: string;
}

export class RedactionCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing: boolean = false;
  private isRedactionMode: boolean = false;
  private startX: number = 0;
  private startY: number = 0;
  private redactionRects: RedactionRect[] = [];
  private config: Required<RedactionCanvasConfig>;

  // Event handlers (bound to this)
  private handleMouseDown: (e: MouseEvent) => void;
  private handleMouseMove: (e: MouseEvent) => void;
  private handleMouseUp: (e: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement, config: RedactionCanvasConfig = {}) {
    this.canvas = canvas;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = context;

    this.config = {
      redactionColor: config.redactionColor || '#000000',
      cursorStyle: config.cursorStyle || 'crosshair',
    };

    // Bind event handlers
    this.handleMouseDown = this.onMouseDown.bind(this);
    this.handleMouseMove = this.onMouseMove.bind(this);
    this.handleMouseUp = this.onMouseUp.bind(this);
  }

  /**
   * Initialize canvas with image dimensions
   */
  initializeCanvas(img: HTMLImageElement): void {
    // Wait for image to load to get accurate dimensions
    const initDimensions = () => {
      // Get the actual rendered dimensions of the image
      const rect = img.getBoundingClientRect();
      const displayWidth = rect.width || img.width;
      const displayHeight = rect.height || img.height;
      
      // Set canvas internal dimensions to match natural image size for high resolution
      this.canvas.width = img.naturalWidth || img.width;
      this.canvas.height = img.naturalHeight || img.height;
      
      // Set canvas display size to match the rendered image size
      this.canvas.style.width = `${displayWidth}px`;
      this.canvas.style.height = `${displayHeight}px`;
    };

    if (img.complete && img.naturalWidth > 0) {
      initDimensions();
    } else {
      img.addEventListener('load', initDimensions, { once: true });
    }
  }

  /**
   * Enable redaction mode
   */
  enableRedactionMode(): void {
    if (this.isRedactionMode) return;

    this.isRedactionMode = true;
    this.canvas.style.display = 'block';
    this.canvas.style.cursor = this.config.cursorStyle;

    // Attach event listeners
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);

    this.redraw();
  }

  /**
   * Disable redaction mode
   */
  disableRedactionMode(): void {
    if (!this.isRedactionMode) return;

    this.isRedactionMode = false;
    this.isDrawing = false;

    // Remove event listeners
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);

    this.canvas.style.cursor = 'default';
  }

  /**
   * Toggle redaction mode
   */
  toggleRedactionMode(): boolean {
    if (this.isRedactionMode) {
      this.disableRedactionMode();
    } else {
      this.enableRedactionMode();
    }
    return this.isRedactionMode;
  }

  /**
   * Clear all redaction rectangles
   */
  clearRedactions(): void {
    this.redactionRects = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Get all redaction rectangles
   */
  getRedactions(): ReadonlyArray<RedactionRect> {
    return [...this.redactionRects];
  }

  /**
   * Set redaction rectangles (useful for restoring state)
   */
  setRedactions(rects: RedactionRect[]): void {
    this.redactionRects = [...rects];
    this.redraw();
  }

  /**
   * Check if currently in redaction mode
   */
  isActive(): boolean {
    return this.isRedactionMode;
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get canvas as data URL
   */
  toDataURL(type: string = 'image/png', quality?: number): string {
    return this.canvas.toDataURL(type, quality);
  }

  /**
   * Hide the canvas
   */
  hide(): void {
    this.canvas.style.display = 'none';
  }

  /**
   * Show the canvas
   */
  show(): void {
    this.canvas.style.display = 'block';
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.disableRedactionMode();
    this.clearRedactions();
  }

  // Private event handlers

  private onMouseDown(e: MouseEvent): void {
    if (!this.isRedactionMode) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    this.startX = (e.clientX - rect.left) * scaleX;
    this.startY = (e.clientY - rect.top) * scaleY;
    this.isDrawing = true;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDrawing || !this.isRedactionMode) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    this.redraw();
    this.drawRect(this.startX, this.startY, currentX - this.startX, currentY - this.startY);
  }

  private onMouseUp(e: MouseEvent): void {
    if (!this.isDrawing || !this.isRedactionMode) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const endX = (e.clientX - rect.left) * scaleX;
    const endY = (e.clientY - rect.top) * scaleY;

    const width = endX - this.startX;
    const height = endY - this.startY;

    // Only add rectangle if it has meaningful size
    if (Math.abs(width) > 5 && Math.abs(height) > 5) {
      this.redactionRects.push({
        x: this.startX,
        y: this.startY,
        width,
        height,
      });
    }

    this.isDrawing = false;
    this.redraw();
  }

  // Private drawing methods

  private redraw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    for (const rect of this.redactionRects) {
      this.drawRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  private drawRect(x: number, y: number, width: number, height: number): void {
    this.ctx.fillStyle = this.config.redactionColor;
    this.ctx.fillRect(x, y, width, height);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RedactionCanvasConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.isRedactionMode) {
      this.canvas.style.cursor = this.config.cursorStyle;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<RedactionCanvasConfig> {
    return { ...this.config };
  }
}
