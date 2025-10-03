export interface BugReportData {
  title: string;
  description: string;
}

export interface BugReportModalOptions {
  onSubmit: (data: BugReportData) => void | Promise<void>;
  onClose?: () => void;
}

export class BugReportModal {
  private container: HTMLDivElement;
  private shadow: ShadowRoot;
  private options: BugReportModalOptions;

  constructor(options: BugReportModalOptions) {
    this.options = options;
    this.container = document.createElement('div');
    this.shadow = this.container.attachShadow({ mode: 'open' }); // Changed to 'open' for testability
    this.render();
  }

  private render(): void {
    this.shadow.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 2147483646;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
        }
        .modal {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.2s ease-out;
        }
        @keyframes slideIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .header {
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header h2 {
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }
        .close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .close:hover {
          background: #f3f4f6;
          color: #111827;
        }
        .content {
          padding: 20px;
        }
        label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
        }
        input,
        textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          margin-bottom: 16px;
          font-family: inherit;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        input:focus,
        textarea:focus {
          outline: none;
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }
        textarea {
          min-height: 100px;
          resize: vertical;
        }
        .screenshot-container {
          margin-bottom: 16px;
        }
        .screenshot {
          max-width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          display: block;
        }
        button.submit {
          background: #ef4444;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          cursor: pointer;
          width: 100%;
          font-size: 14px;
          font-weight: 600;
          transition: background 0.2s;
        }
        button.submit:hover {
          background: #dc2626;
        }
        button.submit:active {
          background: #b91c1c;
        }
        button.submit:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        .error {
          color: #dc2626;
          font-size: 12px;
          margin-top: -12px;
          margin-bottom: 16px;
        }
      </style>
      <div class="overlay">
        <div class="modal">
          <div class="header">
            <h2>Report Bug</h2>
            <button class="close" aria-label="Close modal">×</button>
          </div>
          <div class="content">
            <label for="title">Title *</label>
            <input 
              type="text" 
              placeholder="Brief description of the issue" 
              id="title"
              required
            />
            <div class="error" id="title-error" style="display: none;"></div>
            
            <label for="description">Description *</label>
            <textarea 
              placeholder="Provide detailed steps to reproduce the bug..." 
              id="description"
              required
            ></textarea>
            <div class="error" id="description-error" style="display: none;"></div>
            
            <div class="screenshot-container">
              <label>Screenshot</label>
              <img class="screenshot" id="screenshot" alt="Bug screenshot" />
            </div>
            
            <button class="submit">Submit Bug Report</button>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const closeButton = this.shadow.querySelector('.close');
    const submitButton = this.shadow.querySelector('.submit');

    if (closeButton) {
      closeButton.addEventListener('click', () => this.close());
    }

    // Removed click-outside-to-close behavior to prevent accidental data loss
    // Users can only close via the X button or Escape key

    if (submitButton) {
      submitButton.addEventListener('click', () => this.handleSubmit());
    }

    // Handle escape key
    document.addEventListener('keydown', this.handleEscapeKey);
  }

  private handleEscapeKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  show(screenshot: string): void {
    const img = this.shadow.querySelector('#screenshot') as HTMLImageElement;
    if (img) {
      img.src = screenshot;
    }

    if (document.body) {
      document.body.appendChild(this.container);
      // Focus the title input
      const titleInput = this.shadow.querySelector('#title') as HTMLInputElement;
      if (titleInput) {
        setTimeout(() => titleInput.focus(), 100);
      }
    }
  }

  private validateForm(): boolean {
    const titleInput = this.shadow.querySelector('#title') as HTMLInputElement;
    const descriptionInput = this.shadow.querySelector(
      '#description'
    ) as HTMLTextAreaElement;
    const titleError = this.shadow.querySelector('#title-error') as HTMLDivElement;
    const descriptionError = this.shadow.querySelector(
      '#description-error'
    ) as HTMLDivElement;

    let isValid = true;

    // Validate title
    if (!titleInput.value.trim()) {
      titleError.textContent = 'Title is required';
      titleError.style.display = 'block';
      isValid = false;
    } else {
      titleError.style.display = 'none';
    }

    // Validate description
    if (!descriptionInput.value.trim()) {
      descriptionError.textContent = 'Description is required';
      descriptionError.style.display = 'block';
      isValid = false;
    } else {
      descriptionError.style.display = 'none';
    }

    return isValid;
  }

  private async handleSubmit(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    const titleInput = this.shadow.querySelector('#title') as HTMLInputElement;
    const descriptionInput = this.shadow.querySelector(
      '#description'
    ) as HTMLTextAreaElement;
    const submitButton = this.shadow.querySelector('.submit') as HTMLButtonElement;

    const data: BugReportData = {
      title: titleInput.value.trim(),
      description: descriptionInput.value.trim(),
    };

    // Disable submit button and show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    try {
      await this.options.onSubmit(data);
      this.close();
    } catch (error) {
      // Re-enable submit button on error
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Bug Report';
      console.error('Failed to submit bug report:', error);
      alert('Failed to submit bug report. Please try again.');
    }
  }

  close(): void {
    document.removeEventListener('keydown', this.handleEscapeKey);
    this.container.remove();
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  destroy(): void {
    this.close();
  }
}
