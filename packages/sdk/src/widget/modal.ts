import { StyleManager } from './components/styleManager';
import { TemplateManager } from './components/templateManager';
import { DOMElementCache } from './components/domElementCache';
import { FormValidator, type FormData } from './components/formValidator';
import { PIIDetectionDisplay } from './components/piiDetectionDisplay';
import { RedactionCanvas } from './components/redactionCanvas';
import { ScreenshotProcessor } from './components/screenshotProcessor';
import { createSanitizer } from '../utils/sanitize';
import { getLogger } from '../utils/logger';

const logger = getLogger();

export interface BugReportData {
  title: string;
  description: string;
}

export interface PIIDetection {
  type: string;
  count: number;
}

export interface BugReportModalOptions {
  onSubmit: (data: BugReportData) => void | Promise<void>;
  onClose?: () => void;
}

/**
 * BugReportModal
 * 
 * Refactored to follow SOLID principles
 * Acts as a lightweight coordinator for specialized components
 */
export class BugReportModal {
  private container: HTMLDivElement;
  private shadow: ShadowRoot;
  private options: BugReportModalOptions;
  
  // Component instances
  private styleManager: StyleManager;
  private templateManager: TemplateManager;
  private domCache: DOMElementCache;
  private validator: FormValidator;
  private piiDisplay: PIIDetectionDisplay;
  private redactionCanvas: RedactionCanvas | null = null;
  private screenshotProcessor: ScreenshotProcessor;
  
  // State
  private originalScreenshot: string = '';
  private styleElement: HTMLStyleElement | null = null;
  private piiDetections: PIIDetection[] = [];
  
  // Event handler (bound to this for proper removal)
  private handleEscapeKey: (e: KeyboardEvent) => void;

  constructor(options: BugReportModalOptions) {
    this.options = options;
    this.container = document.createElement('div');
    this.shadow = this.container.attachShadow({ mode: 'open' });
    
    // Initialize components
    this.styleManager = new StyleManager();
    this.templateManager = new TemplateManager();
    this.domCache = new DOMElementCache();
    this.validator = new FormValidator();
    this.piiDisplay = new PIIDetectionDisplay();
    this.screenshotProcessor = new ScreenshotProcessor();
    
    // Bind event handler
    this.handleEscapeKey = this.onEscapeKey.bind(this);
  }

  /**
   * Show the modal with optional screenshot
   */
  show(screenshotDataUrl?: string): void {
    if (screenshotDataUrl) {
      this.originalScreenshot = screenshotDataUrl;
    }

    // Generate and inject HTML (includes inline styles in shadow DOM)
    this.shadow.innerHTML = `
      <style>
        ${this.styleManager.generateStyles()}
      </style>
      ${this.templateManager.generateModalHTML(this.originalScreenshot)}
    `;
    
    // Cache DOM elements
    this.domCache.initialize(this.shadow);
    
    // Initialize error display states
    const elements = this.domCache.get();
    elements.titleError.style.display = 'none';
    elements.descriptionError.style.display = 'none';
    
    // Setup components
    this.setupRedactionCanvas();
    this.attachEventListeners();
    
    // Add to DOM
    document.body.appendChild(this.container);

    // Focus first input
    elements.titleInput.focus();
  }

  /**
   * Close and cleanup the modal
   */
  close(): void {
    // Remove keyboard listener
    document.removeEventListener('keydown', this.handleEscapeKey);
    
    // Cleanup components
    if (this.redactionCanvas) {
      this.redactionCanvas.destroy();
      this.redactionCanvas = null;
    }

    // Remove from DOM
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    // Clear cache
    this.domCache.clear();

    // Call onClose callback
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  /**
   * Destroy the modal (alias for close for backward compatibility)
   */
  destroy(): void {
    this.close();
  }

  // Private helper methods

  private setupRedactionCanvas(): void {
    const elements = this.domCache.get();
    
    if (!elements.redactionCanvas || !elements.screenshotImg) {
      return;
    }

    try {
      this.redactionCanvas = new RedactionCanvas(elements.redactionCanvas);
      this.redactionCanvas.initializeCanvas(elements.screenshotImg);
    } catch (error) {
      // Canvas 2D context not available (e.g., in test environment)
      // Redaction features will be disabled
      getLogger().warn('Canvas redaction not available:', error);
      this.redactionCanvas = null;
    }
  }

  private attachEventListeners(): void {
    const elements = this.domCache.get();

    // Close button
    elements.closeButton.addEventListener('click', () => this.close());
    
    // Escape key to close
    document.addEventListener('keydown', this.handleEscapeKey);
    
    // Note: Overlay click does NOT close modal (improved UX to prevent accidental data loss)
    
    // Form submission
    elements.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Submit button click (manually trigger form submit for test compatibility)
    elements.submitButton.addEventListener('click', () => {
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      elements.form.dispatchEvent(submitEvent);
    });

    // Cancel button
    elements.cancelButton.addEventListener('click', () => this.close());

    // Real-time validation
    elements.titleInput.addEventListener('input', () => this.validateField('title'));
    elements.descriptionTextarea.addEventListener('input', () => {
      this.validateField('description');
      this.checkForPII();
    });

    // Redaction controls
    if (elements.redactButton && this.redactionCanvas) {
      elements.redactButton.addEventListener('click', () => this.toggleRedactionMode());
    }

    if (elements.clearButton && this.redactionCanvas) {
      elements.clearButton.addEventListener('click', () => this.clearRedactions());
    }

    // PII confirmation
    elements.piiConfirmCheckbox.addEventListener('change', () => this.updateSubmitButton());
  }

  private validateField(fieldName: keyof FormData): void {
    const elements = this.domCache.get();
    const value = fieldName === 'title' ? elements.titleInput.value : elements.descriptionTextarea.value;
    const error = this.validator.validateField(fieldName, value);

    const errorElement = fieldName === 'title' ? elements.titleError : elements.descriptionError;
    
    if (error) {
      errorElement.textContent = error;
      errorElement.style.display = 'block';
    } else {
      errorElement.textContent = '';
      errorElement.style.display = 'none';
    }
  }

  private checkForPII(): void {
    const elements = this.domCache.get();
    const text = `${elements.titleInput.value} ${elements.descriptionTextarea.value}`;
    
    // Create temporary sanitizer to detect PII
    const sanitizer = createSanitizer({ enabled: true });
    const detections = sanitizer.detectPII(text);

    // Convert to PIIDetection array
    this.piiDetections = Array.from(detections.entries()).map(([type, count]) => ({
      type,
      count,
    }));

    if (this.piiDetections.length > 0) {
      elements.piiSection.style.display = 'block';
      this.piiDisplay.render(this.piiDetections, elements.piiContent);
    } else {
      elements.piiSection.style.display = 'none';
      elements.piiConfirmCheckbox.checked = false;
    }

    this.updateSubmitButton();
  }

  private updateSubmitButton(): void {
    const elements = this.domCache.get();
    const hasPII = this.piiDetections.length > 0;
    const piiConfirmed = elements.piiConfirmCheckbox.checked;
    
    elements.submitButton.disabled = hasPII && !piiConfirmed;
  }

  private toggleRedactionMode(): void {
    const elements = this.domCache.get();
    
    if (!this.redactionCanvas || !elements.redactButton) {
      return;
    }

    const isActive = this.redactionCanvas.toggleRedactionMode();
    
    if (isActive) {
      elements.redactButton.classList.add('active');
      elements.redactButton.textContent = '✓ Redacting...';
    } else {
      elements.redactButton.classList.remove('active');
      elements.redactButton.textContent = '✏️ Redact Area';
    }
  }

  private clearRedactions(): void {
    if (this.redactionCanvas) {
      this.redactionCanvas.clearRedactions();
    }
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const elements = this.domCache.get();
    
    const formData: FormData = {
      title: elements.titleInput.value,
      description: elements.descriptionTextarea.value,
      piiDetected: this.piiDetections.length > 0,
      piiConfirmed: elements.piiConfirmCheckbox.checked,
    };

    const validation = this.validator.validate(formData);

    if (!validation.isValid) {
      // Display errors
      if (validation.errors.title) {
        elements.titleError.textContent = validation.errors.title;
        elements.titleError.style.display = 'block';
      } else {
        elements.titleError.textContent = '';
        elements.titleError.style.display = 'none';
      }
      
      if (validation.errors.description) {
        elements.descriptionError.textContent = validation.errors.description;
        elements.descriptionError.style.display = 'block';
      } else {
        elements.descriptionError.textContent = '';
        elements.descriptionError.style.display = 'none';
      }
      
      if (validation.errors.piiConfirmation) {
        alert(validation.errors.piiConfirmation);
      }
      
      return;
    }

    // Clear any previous error messages on successful validation
    elements.titleError.style.display = 'none';
    elements.descriptionError.style.display = 'none';

    // Prepare screenshot with redactions
    let finalScreenshot = this.originalScreenshot;
    
    if (this.redactionCanvas && this.redactionCanvas.getRedactions().length > 0) {
      try {
        finalScreenshot = await this.screenshotProcessor.mergeRedactions(this.originalScreenshot, this.redactionCanvas.getCanvas());
      } catch (mergeError) {
        logger.error('Failed to merge redactions:', mergeError);
        finalScreenshot = this.originalScreenshot;
      }
    }

    // Update original screenshot for submission
    this.originalScreenshot = finalScreenshot;

    // Submit
    const bugReportData: BugReportData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
    };

    try {
      await this.options.onSubmit(bugReportData);
      this.close();
    } catch (error) {
      getLogger().error('Error submitting bug report:', error);
      alert('Failed to submit bug report. Please try again.');
    }
  }

  /**
   * Get the final screenshot (with redactions applied)
   */
  getScreenshot(): string {
    return this.originalScreenshot;
  }

  /**
   * Handle Escape key press to close modal
   */
  private onEscapeKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close();
    }
  }
}
