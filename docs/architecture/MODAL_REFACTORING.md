# BugReportModal Refactoring Analysis

## Current Issues

### 1. **Single Responsibility Principle (SRP) Violations** ⚠️

The `BugReportModal` class currently has **6 distinct responsibilities**:

1. **DOM Management** - Creating, rendering, and managing shadow DOM
2. **Form Validation** - Validating title and description fields
3. **PII Detection Display** - Showing PII warnings and badges
4. **Redaction Canvas** - Managing canvas drawing and mouse events
5. **Screenshot Processing** - Merging redactions with screenshots
6. **Event Coordination** - Handling all user interactions

**Problem**: Changes to one responsibility (e.g., validation logic) require touching a class that does everything.

### 2. **Large Monolithic Class** 📏

- **Current**: 580+ lines in a single class
- **Methods**: 20+ methods handling different concerns
- **Cohesion**: Low - methods group into distinct functional areas

### 3. **Hard-Coded HTML/CSS** 🎨

```typescript
private render(): void {
  this.shadow.innerHTML = `
    <style>
      /* 250+ lines of CSS */
    </style>
    <div class="overlay">
      /* 100+ lines of HTML */
    </div>
  `;
}
```

**Problems**:
- CSS and HTML mixed with business logic
- Hard to maintain and test
- No reusability
- Difficult to theme or customize

### 4. **Tight Coupling** 🔗

- Form validation tightly coupled to DOM queries
- Redaction logic tightly coupled to canvas element access
- Event handlers directly manipulate DOM

### 5. **Duplication** 🔄

```typescript
// Repeated pattern for getting elements
const titleInput = this.shadow.querySelector('#title') as HTMLInputElement;
const descriptionInput = this.shadow.querySelector('#description') as HTMLTextAreaElement;
const titleError = this.shadow.querySelector('#title-error') as HTMLDivElement;
// ... repeated in multiple methods
```

### 6. **Missing Abstractions** 🏗️

- No `RedactionRect` type (just inline object)
- No `ValidationResult` type
- No `FormData` abstraction beyond interface
- Canvas scaling logic duplicated

---

## 🎯 Proposed Refactoring

### Architecture: **Component-Based Design**

```
BugReportModal (Facade/Coordinator)
├── StyleManager (CSS management)
├── TemplateManager (HTML templates)
├── FormValidator (Form validation logic)
├── PIIDetectionDisplay (PII badges & warnings)
├── RedactionCanvas (Canvas drawing & management)
├── ScreenshotProcessor (Image processing)
└── DOMElementCache (Cached element references)
```

---

## 📦 Refactored Components

### 1. **StyleManager** - CSS Management

```typescript
/**
 * Manages modal styles - SRP: Style generation
 */
class StyleManager {
  private static readonly STYLES = {
    colors: {
      primary: '#ef4444',
      primaryHover: '#dc2626',
      primaryActive: '#b91c1c',
      warning: '#fef3c7',
      warningBorder: '#fbbf24',
      error: '#dc2626',
      // ... theme tokens
    },
    spacing: {
      sm: '8px',
      md: '16px',
      lg: '20px',
    },
  };

  static generateStyles(): string {
    return `
      <style>
        ${this.baseStyles()}
        ${this.layoutStyles()}
        ${this.formStyles()}
        ${this.piiStyles()}
        ${this.redactionStyles()}
      </style>
    `;
  }

  private static baseStyles(): string { /* ... */ }
  private static layoutStyles(): string { /* ... */ }
  private static formStyles(): string { /* ... */ }
  private static piiStyles(): string { /* ... */ }
  private static redactionStyles(): string { /* ... */ }
}
```

**Benefits**:
- ✅ Centralized style management
- ✅ Easy theming via tokens
- ✅ Can be replaced with CSS-in-JS library
- ✅ Testable style generation

---

### 2. **TemplateManager** - HTML Templates

```typescript
/**
 * Generates HTML templates - SRP: Template generation
 */
class TemplateManager {
  static getMainTemplate(): string {
    return `
      <div class="overlay">
        <div class="modal">
          ${this.getHeaderTemplate()}
          ${this.getContentTemplate()}
        </div>
      </div>
    `;
  }

  static getHeaderTemplate(): string {
    return `
      <div class="header">
        <h2>Report Bug</h2>
        <button class="close" aria-label="Close modal">×</button>
      </div>
    `;
  }

  static getContentTemplate(): string {
    return `
      <div class="content">
        ${this.getFormFieldsTemplate()}
        ${this.getScreenshotTemplate()}
        ${this.getPIIDetectionTemplate()}
        ${this.getSubmitButtonTemplate()}
      </div>
    `;
  }

  static getFormFieldsTemplate(): string { /* ... */ }
  static getScreenshotTemplate(): string { /* ... */ }
  static getPIIDetectionTemplate(): string { /* ... */ }
  static getSubmitButtonTemplate(): string { /* ... */ }
}
```

**Benefits**:
- ✅ Modular template composition
- ✅ Easier to test individual sections
- ✅ Can use template literals or template engine
- ✅ Reusable template parts

---

### 3. **DOMElementCache** - Element Reference Cache

```typescript
/**
 * Caches DOM element references - SRP: Element access optimization
 */
class DOMElementCache {
  private cache = new Map<string, HTMLElement>();

  constructor(private shadow: ShadowRoot) {}

  get<T extends HTMLElement>(selector: string): T | null {
    if (!this.cache.has(selector)) {
      const element = this.shadow.querySelector(selector) as T | null;
      if (element) {
        this.cache.set(selector, element);
      }
      return element;
    }
    return this.cache.get(selector) as T;
  }

  clear(): void {
    this.cache.clear();
  }

  // Typed getters for common elements
  get titleInput(): HTMLInputElement | null {
    return this.get<HTMLInputElement>('#title');
  }

  get descriptionInput(): HTMLTextAreaElement | null {
    return this.get<HTMLTextAreaElement>('#description');
  }

  get titleError(): HTMLDivElement | null {
    return this.get<HTMLDivElement>('#title-error');
  }

  get descriptionError(): HTMLDivElement | null {
    return this.get<HTMLDivElement>('#description-error');
  }

  get submitButton(): HTMLButtonElement | null {
    return this.get<HTMLButtonElement>('.submit');
  }

  get piiCheckbox(): HTMLInputElement | null {
    return this.get<HTMLInputElement>('#confirm-no-pii');
  }

  get piiList(): HTMLDivElement | null {
    return this.get<HTMLDivElement>('#pii-list');
  }

  get screenshot(): HTMLImageElement | null {
    return this.get<HTMLImageElement>('#screenshot');
  }

  get redactionCanvas(): HTMLCanvasElement | null {
    return this.get<HTMLCanvasElement>('#redaction-canvas');
  }
}
```

**Benefits**:
- ✅ Eliminates repetitive `querySelector` calls
- ✅ Type-safe element access
- ✅ Performance optimization (caching)
- ✅ Single source of truth for selectors

---

### 4. **FormValidator** - Validation Logic

```typescript
/**
 * Validation result with detailed error info
 */
interface ValidationResult {
  isValid: boolean;
  errors: {
    title?: string;
    description?: string;
    pii?: string;
  };
}

/**
 * Form validation - SRP: Validation logic only
 */
class FormValidator {
  validate(
    title: string,
    description: string,
    hasPIIDetections: boolean,
    piiConfirmed: boolean
  ): ValidationResult {
    const errors: ValidationResult['errors'] = {};
    let isValid = true;

    if (!title.trim()) {
      errors.title = 'Title is required';
      isValid = false;
    }

    if (!description.trim()) {
      errors.description = 'Description is required';
      isValid = false;
    }

    if (hasPIIDetections && !piiConfirmed) {
      errors.pii = 'Please confirm that no sensitive data remains visible in the screenshot.';
      isValid = false;
    }

    return { isValid, errors };
  }

  displayErrors(
    result: ValidationResult,
    elements: DOMElementCache
  ): void {
    const titleError = elements.titleError;
    const descriptionError = elements.descriptionError;

    if (titleError) {
      if (result.errors.title) {
        titleError.textContent = result.errors.title;
        titleError.style.display = 'block';
      } else {
        titleError.style.display = 'none';
      }
    }

    if (descriptionError) {
      if (result.errors.description) {
        descriptionError.textContent = result.errors.description;
        descriptionError.style.display = 'block';
      } else {
        descriptionError.style.display = 'none';
      }
    }

    if (result.errors.pii) {
      alert(result.errors.pii);
    }
  }
}
```

**Benefits**:
- ✅ Pure validation logic (easily testable)
- ✅ Structured error reporting
- ✅ Separated from DOM manipulation
- ✅ Can add custom validation rules easily

---

### 5. **PIIDetectionDisplay** - PII UI Management

```typescript
/**
 * PII detection display - SRP: PII UI only
 */
class PIIDetectionDisplay {
  constructor(private elements: DOMElementCache) {}

  show(detections: PIIDetection[]): void {
    const piiList = this.elements.piiList;
    if (!piiList) return;

    if (detections.length === 0) {
      piiList.innerHTML = this.getEmptyTemplate();
      return;
    }

    piiList.innerHTML = this.getDetectionsTemplate(detections);
  }

  private getEmptyTemplate(): string {
    return '<p class="pii-info">No sensitive data detected</p>';
  }

  private getDetectionsTemplate(detections: PIIDetection[]): string {
    return detections
      .map((d) => this.getBadgeTemplate(d))
      .join('');
  }

  private getBadgeTemplate(detection: PIIDetection): string {
    const plural = detection.count > 1 ? 's' : '';
    return `<span class="pii-item">${detection.count} ${detection.type}${plural}</span>`;
  }

  hasPIIDetections(): boolean {
    const piiList = this.elements.piiList;
    return piiList?.querySelector('.pii-item') !== null;
  }
}
```

**Benefits**:
- ✅ Encapsulates PII display logic
- ✅ Templating methods for reusability
- ✅ Easier to test
- ✅ Can extend with animations, icons, etc.

---

### 6. **RedactionCanvas** - Canvas Management

```typescript
/**
 * Redaction rectangle type
 */
interface RedactionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Canvas coordinate with scaling
 */
interface CanvasCoordinate {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Redaction canvas - SRP: Canvas drawing and interaction
 */
class RedactionCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private startCoord: CanvasCoordinate | null = null;
  private redactions: RedactionRect[] = [];

  constructor(private elements: DOMElementCache) {}

  initialize(img: HTMLImageElement): void {
    this.canvas = this.elements.redactionCanvas;
    if (!this.canvas) return;

    this.canvas.width = img.naturalWidth || img.width;
    this.canvas.height = img.naturalHeight || img.height;
    this.canvas.style.width = `${img.width}px`;
    this.canvas.style.height = `${img.height}px`;
    
    this.context = this.canvas.getContext('2d');
  }

  activate(): void {
    if (!this.canvas) return;
    this.canvas.style.display = 'block';
    this.attachListeners();
  }

  deactivate(): void {
    if (!this.canvas) return;
    this.canvas.style.display = 'none';
    this.removeListeners();
  }

  isActive(): boolean {
    return this.canvas?.style.display !== 'none';
  }

  clear(): void {
    this.redactions = [];
    this.redraw();
  }

  getRedactions(): RedactionRect[] {
    return [...this.redactions];
  }

  private attachListeners(): void {
    if (!this.canvas) return;
    this.canvas.addEventListener('mousedown', this.handleStart);
    this.canvas.addEventListener('mousemove', this.handleMove);
    this.canvas.addEventListener('mouseup', this.handleEnd);
    this.canvas.addEventListener('mouseleave', this.handleEnd);
  }

  private removeListeners(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener('mousedown', this.handleStart);
    this.canvas.removeEventListener('mousemove', this.handleMove);
    this.canvas.removeEventListener('mouseup', this.handleEnd);
    this.canvas.removeEventListener('mouseleave', this.handleEnd);
  }

  private handleStart = (e: MouseEvent): void => {
    if (!this.canvas) return;
    this.startCoord = this.getCanvasCoordinate(e);
    this.isDrawing = true;
  };

  private handleMove = (e: MouseEvent): void => {
    if (!this.isDrawing || !this.context || !this.startCoord) return;
    
    const current = this.getCanvasCoordinate(e);
    this.redraw();
    
    // Draw current rectangle
    this.context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.context.fillRect(
      this.startCoord.x,
      this.startCoord.y,
      current.x - this.startCoord.x,
      current.y - this.startCoord.y
    );
  };

  private handleEnd = (e: MouseEvent): void => {
    if (!this.isDrawing || !this.startCoord) return;
    
    const end = this.getCanvasCoordinate(e);
    this.redactions.push({
      x: this.startCoord.x,
      y: this.startCoord.y,
      width: end.x - this.startCoord.x,
      height: end.y - this.startCoord.y,
    });
    
    this.isDrawing = false;
    this.startCoord = null;
    this.redraw();
  };

  private getCanvasCoordinate(e: MouseEvent): CanvasCoordinate {
    if (!this.canvas) throw new Error('Canvas not initialized');
    
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      scaleX,
      scaleY,
    };
  }

  private redraw(): void {
    if (!this.canvas || !this.context) return;
    
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    
    this.redactions.forEach((rect) => {
      this.context!.fillRect(rect.x, rect.y, rect.width, rect.height);
    });
  }

  destroy(): void {
    this.removeListeners();
    this.redactions = [];
    this.canvas = null;
    this.context = null;
  }
}
```

**Benefits**:
- ✅ Encapsulates all canvas logic
- ✅ Type-safe coordinate handling
- ✅ Clear API for activation/deactivation
- ✅ Testable in isolation

---

### 7. **ScreenshotProcessor** - Image Processing

```typescript
/**
 * Screenshot processing - SRP: Image manipulation
 */
class ScreenshotProcessor {
  static applyRedactions(
    originalScreenshot: string,
    img: HTMLImageElement,
    redactions: RedactionRect[]
  ): string {
    if (redactions.length === 0) {
      return originalScreenshot;
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return originalScreenshot;

    // Draw original image
    ctx.drawImage(img, 0, 0);
    
    // Draw redactions
    ctx.fillStyle = '#000000';
    redactions.forEach((rect) => {
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    });
    
    return canvas.toDataURL('image/png');
  }

  static loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}
```

**Benefits**:
- ✅ Pure image processing logic
- ✅ Static methods (no state)
- ✅ Easy to test
- ✅ Can add more image operations (blur, crop, etc.)

---

### 8. **BugReportModal (Refactored)** - Coordinator

```typescript
/**
 * Main modal class - now a lightweight coordinator
 * SRP: Orchestrates components, doesn't implement details
 */
export class BugReportModal {
  private container: HTMLDivElement;
  private shadow: ShadowRoot;
  private options: BugReportModalOptions;
  
  // Component dependencies
  private elements!: DOMElementCache;
  private validator: FormValidator;
  private piiDisplay!: PIIDetectionDisplay;
  private redactionCanvas!: RedactionCanvas;
  
  private originalScreenshot = '';

  constructor(options: BugReportModalOptions) {
    this.options = options;
    this.validator = new FormValidator();
    this.container = document.createElement('div');
    this.shadow = this.container.attachShadow({ mode: 'open' });
    this.render();
  }

  private render(): void {
    const html = StyleManager.generateStyles() + TemplateManager.getMainTemplate();
    this.shadow.innerHTML = html;
    
    // Initialize components after DOM is ready
    this.elements = new DOMElementCache(this.shadow);
    this.piiDisplay = new PIIDetectionDisplay(this.elements);
    this.redactionCanvas = new RedactionCanvas(this.elements);
    
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const closeBtn = this.elements.get('.close');
    const submitBtn = this.elements.submitButton;
    const redactBtn = this.elements.get('#redact-tool');
    const clearBtn = this.elements.get('#clear-redactions');

    closeBtn?.addEventListener('click', () => this.close());
    submitBtn?.addEventListener('click', () => this.handleSubmit());
    redactBtn?.addEventListener('click', () => this.toggleRedaction());
    clearBtn?.addEventListener('click', () => this.redactionCanvas.clear());

    document.addEventListener('keydown', this.handleEscapeKey);
  }

  private handleEscapeKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };

  show(screenshot: string, piiDetections?: PIIDetection[]): void {
    this.originalScreenshot = screenshot;
    
    const img = this.elements.screenshot;
    if (img) {
      img.src = screenshot;
      img.onload = () => this.redactionCanvas.initialize(img);
    }

    if (piiDetections && piiDetections.length > 0) {
      this.piiDisplay.show(piiDetections);
    }

    document.body.appendChild(this.container);
    
    const titleInput = this.elements.titleInput;
    if (titleInput) {
      setTimeout(() => titleInput.focus(), 100);
    }
  }

  private async handleSubmit(): Promise<void> {
    const titleInput = this.elements.titleInput;
    const descInput = this.elements.descriptionInput;
    const piiCheckbox = this.elements.piiCheckbox;
    const submitButton = this.elements.submitButton;

    if (!titleInput || !descInput || !submitButton) return;

    // Validate
    const result = this.validator.validate(
      titleInput.value,
      descInput.value,
      this.piiDisplay.hasPIIDetections(),
      piiCheckbox?.checked ?? false
    );

    if (!result.isValid) {
      this.validator.displayErrors(result, this.elements);
      return;
    }

    const data: BugReportData = {
      title: titleInput.value.trim(),
      description: descInput.value.trim(),
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
      await this.options.onSubmit(data);
      this.close();
    } catch (error) {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Bug Report';
      console.error('Failed to submit bug report:', error);
      alert('Failed to submit bug report. Please try again.');
    }
  }

  private toggleRedaction(): void {
    const button = this.elements.get('#redact-tool');
    if (!button) return;

    if (this.redactionCanvas.isActive()) {
      this.redactionCanvas.deactivate();
      button.classList.remove('active');
    } else {
      this.redactionCanvas.activate();
      button.classList.add('active');
    }
  }

  getRedactedScreenshot(): string {
    const img = this.elements.screenshot;
    if (!img) return this.originalScreenshot;

    return ScreenshotProcessor.applyRedactions(
      this.originalScreenshot,
      img,
      this.redactionCanvas.getRedactions()
    );
  }

  close(): void {
    this.redactionCanvas.destroy();
    document.removeEventListener('keydown', this.handleEscapeKey);
    this.container.remove();
    this.elements.clear();
    this.options.onClose?.();
  }

  destroy(): void {
    this.close();
  }
}
```

**Lines of code**: ~120 (vs 580+ original)

---

## 📊 Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Main class LOC** | 580+ | ~120 | **-79%** |
| **Methods in main class** | 20+ | 8 | **-60%** |
| **Responsibilities** | 6 | 1 | **-83%** |
| **Testability** | Low | High | ✅ |
| **Reusability** | Low | High | ✅ |
| **Maintainability** | Medium | High | ✅ |

---

## ✅ Benefits of Refactored Design

### 1. **Single Responsibility Principle**
- Each class has one reason to change
- `FormValidator` only changes for validation logic
- `RedactionCanvas` only changes for canvas features
- `StyleManager` only changes for styling

### 2. **Testability**
```typescript
// Before: Hard to test (needs DOM, shadow root, etc.)
const modal = new BugReportModal({ onSubmit: jest.fn() });
modal.show(screenshot);
// ... complex setup

// After: Easy to test individual components
const validator = new FormValidator();
const result = validator.validate('', '', false, false);
expect(result.isValid).toBe(false);
expect(result.errors.title).toBe('Title is required');
```

### 3. **Reusability**
- `FormValidator` can be used in other forms
- `StyleManager` can generate styles for other modals
- `RedactionCanvas` can be used standalone

### 4. **Extensibility**
```typescript
// Easy to add new validation rules
class CustomFormValidator extends FormValidator {
  validate(...) {
    const result = super.validate(...);
    // Add custom validation
    return result;
  }
}

// Easy to customize styles
class DarkStyleManager extends StyleManager {
  protected static colors = {
    ...super.colors,
    primary: '#3b82f6', // Override blue theme
  };
}
```

### 5. **Type Safety**
- `RedactionRect` interface
- `ValidationResult` interface
- `CanvasCoordinate` interface
- Typed element cache accessors

### 6. **Performance**
- Element caching eliminates repeated `querySelector` calls
- Clear separation allows for lazy loading

---

## 🚀 Migration Strategy

### Phase 1: Extract CSS & HTML
1. Create `StyleManager` with current styles
2. Create `TemplateManager` with current templates
3. Update `render()` to use managers
4. **Test**: All existing tests should still pass

### Phase 2: Extract Element Access
1. Create `DOMElementCache`
2. Replace all `querySelector` calls
3. **Test**: All existing tests should still pass

### Phase 3: Extract Validation
1. Create `FormValidator`
2. Move validation logic
3. Update `validateForm()` to use validator
4. **Test**: Validation tests

### Phase 4: Extract PII Display
1. Create `PIIDetectionDisplay`
2. Move PII rendering logic
3. Update `showPIIDetections()` to use display
4. **Test**: PII display tests

### Phase 5: Extract Redaction Canvas
1. Create `RedactionCanvas`
2. Move all canvas logic
3. Update redaction methods
4. **Test**: Redaction tests

### Phase 6: Extract Screenshot Processing
1. Create `ScreenshotProcessor`
2. Move image processing logic
3. **Test**: Screenshot processing tests

### Phase 7: Simplify Main Class
1. Update `BugReportModal` to use components
2. Remove extracted logic
3. **Test**: Full integration tests

---

## 🎯 Recommended Immediate Improvements (Quick Wins)

If full refactoring is too much, start with these:

### 1. **Extract CSS to Constant** (15 minutes)
```typescript
const MODAL_STYLES = `/* CSS here */`;

private render(): void {
  this.shadow.innerHTML = MODAL_STYLES + MODAL_TEMPLATE;
}
```

### 2. **Create Element Cache** (30 minutes)
```typescript
private getElements() {
  return {
    titleInput: this.shadow.querySelector('#title') as HTMLInputElement,
    descInput: this.shadow.querySelector('#description') as HTMLTextAreaElement,
    // ... cache all elements
  };
}
```

### 3. **Extract Validation** (45 minutes)
```typescript
private validateFormData(title: string, desc: string, hasPII: boolean, confirmed: boolean) {
  const errors = {};
  if (!title.trim()) errors.title = 'Title is required';
  if (!desc.trim()) errors.description = 'Description is required';
  if (hasPII && !confirmed) errors.pii = 'Confirm no PII';
  return { isValid: Object.keys(errors).length === 0, errors };
}
```

### 4. **Type Redaction Rect** (5 minutes)
```typescript
interface RedactionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

private redactionRects: RedactionRect[] = [];
```

---

## 📚 Additional Recommendations

1. **Add JSDoc** to all public methods
2. **Extract magic numbers** to constants (z-index, timeouts, etc.)
3. **Add error boundaries** for canvas operations
4. **Consider Web Components** for better encapsulation
5. **Add accessibility** improvements (ARIA labels, keyboard navigation)
6. **Consider animation library** for smoother transitions
7. **Add loading states** component
8. **Extract event handlers** to separate methods

---

## 🧪 Testing Improvements

### Current State
- Integration tests only
- Hard to test individual behaviors

### After Refactoring
```typescript
describe('FormValidator', () => {
  it('should validate required fields', () => {
    const validator = new FormValidator();
    const result = validator.validate('', '', false, false);
    expect(result.isValid).toBe(false);
  });
});

describe('RedactionCanvas', () => {
  it('should track redaction rectangles', () => {
    const canvas = new RedactionCanvas(mockElements);
    canvas.clear();
    expect(canvas.getRedactions()).toHaveLength(0);
  });
});

describe('PIIDetectionDisplay', () => {
  it('should render PII badges', () => {
    const display = new PIIDetectionDisplay(mockElements);
    display.show([{ type: 'email', count: 3 }]);
    // Assert DOM changes
  });
});
```

---

**Conclusion**: The refactoring reduces complexity, improves testability, and follows SOLID principles while maintaining backward compatibility.
