import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BugReportModal, type BugReportData } from '../../src/widget/modal';

describe('BugReportModal', () => {
  let modal: BugReportModal;
  let onSubmit: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSubmit = vi.fn();
    onClose = vi.fn();
    modal = new BugReportModal({ onSubmit, onClose });
  });

  afterEach(() => {
    modal.destroy();
  });

  describe('Initialization', () => {
    it('should create modal with shadow DOM', () => {
      expect(modal).toBeDefined();
    });

    it('should not be visible initially', () => {
      const modalElement = document.querySelector('div[style*="position: fixed"]');
      expect(modalElement).toBeNull();
    });

    it('should accept onSubmit callback', () => {
      const customOnSubmit = vi.fn();
      const customModal = new BugReportModal({ onSubmit: customOnSubmit });
      expect(customModal).toBeDefined();
      customModal.destroy();
    });

    it('should accept optional onClose callback', () => {
      const customOnClose = vi.fn();
      const customModal = new BugReportModal({
        onSubmit: vi.fn(),
        onClose: customOnClose,
      });
      expect(customModal).toBeDefined();
      customModal.destroy();
    });
  });

  describe('Show modal', () => {
    it('should display modal when show() is called', () => {
      modal.show('data:image/png;base64,test');

      const container = document.body.lastElementChild as HTMLElement;
      expect(container).toBeTruthy();
      expect(document.body.contains(container)).toBe(true);
    });

    it('should display screenshot when provided', () => {
      const testScreenshot = 'data:image/png;base64,test123';
      modal.show(testScreenshot);

      // Access shadow root to check screenshot
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const img = shadow?.querySelector('#screenshot') as HTMLImageElement;

      expect(img).toBeTruthy();
      expect(img.src).toBe(testScreenshot);
    });

    it('should handle empty screenshot gracefully', () => {
      expect(() => {
        modal.show('');
      }).not.toThrow();
    });
  });

  describe('Close modal', () => {
    beforeEach(() => {
      modal.show('data:image/png;base64,test');
    });

    it('should close modal when close() is called', () => {
      const containerBefore = document.body.lastElementChild as HTMLElement;
      expect(document.body.contains(containerBefore)).toBe(true);

      modal.close();

      expect(document.body.contains(containerBefore)).toBe(false);
    });

    it('should call onClose callback when modal is closed', () => {
      modal.close();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should close modal when close button is clicked', () => {
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const closeButton = shadow?.querySelector('.close') as HTMLButtonElement;

      closeButton.click();

      expect(document.body.contains(container)).toBe(false);
      expect(onClose).toHaveBeenCalled();
    });

    it('should NOT close modal when clicking overlay background (improved UX)', () => {
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const overlay = shadow?.querySelector('.overlay') as HTMLElement;

      // Simulate clicking the overlay itself (not its children)
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: overlay, enumerable: true });
      Object.defineProperty(event, 'currentTarget', {
        value: overlay,
        enumerable: true,
      });
      overlay.dispatchEvent(event);

      // Modal should still be open to prevent accidental data loss
      expect(document.body.contains(container)).toBe(true);
    });

    it('should close modal when Escape key is pressed', () => {
      const container = document.body.lastElementChild as HTMLElement;

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      expect(document.body.contains(container)).toBe(false);
      expect(onClose).toHaveBeenCalled();
    });

    it('should not close when clicking inside modal content', () => {
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const modalContent = shadow?.querySelector('.modal') as HTMLElement;

      const event = new MouseEvent('click', { bubbles: true });
      modalContent.dispatchEvent(event);

      expect(document.body.contains(container)).toBe(true);
    });
  });

  describe('Form validation', () => {
    beforeEach(() => {
      modal.show('data:image/png;base64,test');
    });

    it('should not submit with empty title', () => {
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const descriptionInput = shadow?.querySelector(
        '#description'
      ) as HTMLTextAreaElement;
      const submitButton = shadow?.querySelector('.submit') as HTMLButtonElement;

      descriptionInput.value = 'Test description';
      submitButton.click();

      expect(onSubmit).not.toHaveBeenCalled();

      // Check error message is displayed
      const titleError = shadow?.querySelector('#title-error') as HTMLElement;
      expect(titleError.style.display).not.toBe('none');
      expect(titleError.textContent).toBe('Title is required');
    });

    it('should not submit with empty description', () => {
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const titleInput = shadow?.querySelector('#title') as HTMLInputElement;
      const submitButton = shadow?.querySelector('.submit') as HTMLButtonElement;

      titleInput.value = 'Test title';
      submitButton.click();

      expect(onSubmit).not.toHaveBeenCalled();

      // Check error message is displayed
      const descriptionError = shadow?.querySelector('#description-error') as HTMLElement;
      expect(descriptionError.style.display).not.toBe('none');
      expect(descriptionError.textContent).toBe('Description is required');
    });

    it('should not submit with whitespace-only title', () => {
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const titleInput = shadow?.querySelector('#title') as HTMLInputElement;
      const descriptionInput = shadow?.querySelector(
        '#description'
      ) as HTMLTextAreaElement;
      const submitButton = shadow?.querySelector('.submit') as HTMLButtonElement;

      titleInput.value = '   ';
      descriptionInput.value = 'Test description';
      submitButton.click();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should not submit with whitespace-only description', () => {
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const titleInput = shadow?.querySelector('#title') as HTMLInputElement;
      const descriptionInput = shadow?.querySelector(
        '#description'
      ) as HTMLTextAreaElement;
      const submitButton = shadow?.querySelector('.submit') as HTMLButtonElement;

      titleInput.value = 'Test title';
      descriptionInput.value = '   ';
      submitButton.click();

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('should hide error messages when valid input is provided', () => {
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const titleInput = shadow?.querySelector('#title') as HTMLInputElement;
      const descriptionInput = shadow?.querySelector(
        '#description'
      ) as HTMLTextAreaElement;
      const submitButton = shadow?.querySelector('.submit') as HTMLButtonElement;

      // First submit with empty fields to show errors
      submitButton.click();

      // Then fill in the fields
      titleInput.value = 'Valid title';
      descriptionInput.value = 'Valid description';
      submitButton.click();

      const titleError = shadow?.querySelector('#title-error') as HTMLElement;
      const descriptionError = shadow?.querySelector('#description-error') as HTMLElement;

      expect(titleError.style.display).toBe('none');
      expect(descriptionError.style.display).toBe('none');
    });
  });

  describe('Form submission', () => {
    beforeEach(() => {
      modal.show('data:image/png;base64,test');
    });

    it('should submit with valid title and description', () => {
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const titleInput = shadow?.querySelector('#title') as HTMLInputElement;
      const descriptionInput = shadow?.querySelector(
        '#description'
      ) as HTMLTextAreaElement;
      const submitButton = shadow?.querySelector('.submit') as HTMLButtonElement;

      titleInput.value = 'Test Bug Title';
      descriptionInput.value = 'Detailed bug description';
      submitButton.click();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Test Bug Title',
        description: 'Detailed bug description',
      });
    });

    it('should trim whitespace from inputs', () => {
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const titleInput = shadow?.querySelector('#title') as HTMLInputElement;
      const descriptionInput = shadow?.querySelector(
        '#description'
      ) as HTMLTextAreaElement;
      const submitButton = shadow?.querySelector('.submit') as HTMLButtonElement;

      titleInput.value = '  Test Title  ';
      descriptionInput.value = '  Test Description  ';
      submitButton.click();

      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Test Title',
        description: 'Test Description',
      });
    });

    it('should close modal after successful submission', async () => {
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const titleInput = shadow?.querySelector('#title') as HTMLInputElement;
      const descriptionInput = shadow?.querySelector(
        '#description'
      ) as HTMLTextAreaElement;
      const submitButton = shadow?.querySelector('.submit') as HTMLButtonElement;

      titleInput.value = 'Test Title';
      descriptionInput.value = 'Test Description';
      submitButton.click();

      // Wait for async submission to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(document.body.contains(container)).toBe(false);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Destroy', () => {
    it('should clean up when destroy() is called', () => {
      modal.show('data:image/png;base64,test');
      const container = document.body.lastElementChild as HTMLElement;

      modal.destroy();

      expect(document.body.contains(container)).toBe(false);
    });

    it('should remove event listeners when destroyed', () => {
      modal.show('data:image/png;base64,test');
      modal.destroy();

      // Try to trigger escape key after destroy - should not throw
      expect(() => {
        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(escapeEvent);
      }).not.toThrow();
    });

    it('should be safe to call destroy multiple times', () => {
      modal.show('data:image/png;base64,test');

      expect(() => {
        modal.destroy();
        modal.destroy();
        modal.destroy();
      }).not.toThrow();
    });
  });

  describe('BugReportData type', () => {
    it('should have correct data structure', () => {
      modal.show('data:image/png;base64,test');
      
      const container = document.body.lastElementChild as HTMLElement;
      const shadow = container.shadowRoot;
      const titleInput = shadow?.querySelector('#title') as HTMLInputElement;
      const descriptionInput = shadow?.querySelector(
        '#description'
      ) as HTMLTextAreaElement;
      const submitButton = shadow?.querySelector('.submit') as HTMLButtonElement;

      titleInput.value = 'Test';
      descriptionInput.value = 'Description';
      submitButton.click();

      const submittedData = onSubmit.mock.calls[0][0] as BugReportData;
      expect(submittedData).toHaveProperty('title');
      expect(submittedData).toHaveProperty('description');
      expect(typeof submittedData.title).toBe('string');
      expect(typeof submittedData.description).toBe('string');
    });
  });
});
