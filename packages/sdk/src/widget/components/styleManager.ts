/**
 * StyleManager
 *
 * Responsibility: Generate and manage CSS styles for the bug report modal
 * Follows SRP: Only handles style generation and theming
 */

export interface StyleConfig {
  primaryColor?: string;
  dangerColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  zIndex?: number;
}

export class StyleManager {
  private config: Required<StyleConfig>;

  constructor(config: StyleConfig = {}) {
    this.config = {
      primaryColor: config.primaryColor || '#007bff',
      dangerColor: config.dangerColor || '#dc3545',
      borderRadius: config.borderRadius || '4px',
      fontFamily:
        config.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      zIndex: config.zIndex || 999999,
    };
  }

  /**
   * Generate complete CSS stylesheet for the modal
   */
  generateStyles(): string {
    return `
      .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: ${this.config.zIndex};
        font-family: ${this.config.fontFamily};
      }
      
      .modal {
        background: white;
        border-radius: 8px;
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      
      .header {
        padding: 20px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .header h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }
      
      .close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: ${this.config.borderRadius};
      }
      
      .close:hover {
        background: #f0f0f0;
      }
      
      .body {
        padding: 20px;
      }
      
      .form-group {
        margin-bottom: 20px;
      }
      
      .label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        font-size: 14px;
      }
      
      .input,
      .textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: ${this.config.borderRadius};
        font-size: 14px;
        font-family: ${this.config.fontFamily};
        box-sizing: border-box;
      }
      
      .input:focus,
      .textarea:focus {
        outline: none;
        border-color: ${this.config.primaryColor};
      }
      
      .textarea {
        min-height: 100px;
        resize: vertical;
      }
      
      .screenshot-container {
        margin-top: 10px;
        position: relative;
      }
      
      .screenshot {
        max-width: 100%;
        border: 1px solid #ddd;
        border-radius: ${this.config.borderRadius};
      }
      
      .redaction-canvas {
        position: absolute;
        top: 0;
        left: 0;
        cursor: crosshair;
        border: 2px solid ${this.config.primaryColor};
        border-radius: ${this.config.borderRadius};
      }
      
      .redaction-controls {
        margin-top: 10px;
        display: flex;
        gap: 10px;
      }
      
      .btn-redact,
      .btn-clear {
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: ${this.config.borderRadius};
        background: white;
        cursor: pointer;
        font-size: 14px;
      }
      
      .btn-redact:hover,
      .btn-clear:hover {
        background: #f5f5f5;
      }
      
      .btn-redact.active {
        background: ${this.config.primaryColor};
        color: white;
        border-color: ${this.config.primaryColor};
      }
      
      .pii-section {
        margin-top: 20px;
        padding: 15px;
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: ${this.config.borderRadius};
      }
      
      .pii-title {
        margin: 0 0 10px 0;
        font-size: 14px;
        font-weight: 600;
        color: #856404;
      }
      
      .pii-list {
        margin: 0;
        padding-left: 20px;
        font-size: 13px;
        color: #856404;
      }
      
      .pii-badge {
        display: inline-block;
        padding: 2px 8px;
        margin: 2px;
        background: #ffc107;
        color: #856404;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }
      
      .checkbox-group {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 15px;
      }
      
      .checkbox {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }
      
      .checkbox-label {
        margin: 0;
        font-size: 14px;
        cursor: pointer;
        user-select: none;
      }
      
      .footer {
        padding: 20px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      
      .btn {
        padding: 10px 20px;
        border: none;
        border-radius: ${this.config.borderRadius};
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      
      .btn-primary {
        background: ${this.config.primaryColor};
        color: white;
      }
      
      .btn-primary:hover {
        opacity: 0.9;
      }
      
      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .btn-secondary {
        background: #6c757d;
        color: white;
      }
      
      .btn-secondary:hover {
        opacity: 0.9;
      }
      
      .error {
        color: ${this.config.dangerColor};
        font-size: 12px;
        margin-top: 4px;
      }
    `;
  }

  /**
   * Inject styles into document head
   */
  injectStyles(): HTMLStyleElement {
    const styleElement = document.createElement('style');
    styleElement.textContent = this.generateStyles();
    document.head.appendChild(styleElement);
    return styleElement;
  }

  /**
   * Remove injected styles
   */
  removeStyles(styleElement: HTMLStyleElement): void {
    if (styleElement && styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement);
    }
  }

  /**
   * Update configuration and regenerate styles
   */
  updateConfig(config: Partial<StyleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<StyleConfig> {
    return { ...this.config };
  }
}
