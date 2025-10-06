/**
 * FormValidator
 *
 * Responsibility: Validate form input and manage error states
 * Follows SRP: Only handles validation logic (pure functions)
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
}

export interface ValidationErrors {
  title?: string;
  description?: string;
  piiConfirmation?: string;
}

export interface FormData {
  title: string;
  description: string;
  piiDetected: boolean;
  piiConfirmed: boolean;
}

export class FormValidator {
  private minTitleLength: number;
  private maxTitleLength: number;
  private minDescriptionLength: number;
  private maxDescriptionLength: number;

  constructor(
    config: {
      minTitleLength?: number;
      maxTitleLength?: number;
      minDescriptionLength?: number;
      maxDescriptionLength?: number;
    } = {}
  ) {
    this.minTitleLength = config.minTitleLength || 3;
    this.maxTitleLength = config.maxTitleLength || 200;
    this.minDescriptionLength = config.minDescriptionLength || 10;
    this.maxDescriptionLength = config.maxDescriptionLength || 5000;
  }

  /**
   * Validate complete form data
   */
  validate(data: FormData): ValidationResult {
    const errors: ValidationErrors = {};

    // Validate title
    const titleError = this.validateTitle(data.title);
    if (titleError) {
      errors.title = titleError;
    }

    // Validate description
    const descriptionError = this.validateDescription(data.description);
    if (descriptionError) {
      errors.description = descriptionError;
    }

    // Validate PII confirmation if PII detected
    if (data.piiDetected && !data.piiConfirmed) {
      errors.piiConfirmation = 'Please confirm you have reviewed sensitive information';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Validate title field
   */
  validateTitle(title: string): string | null {
    const trimmed = title.trim();

    if (!trimmed) {
      return 'Title is required';
    }

    if (trimmed.length < this.minTitleLength) {
      return `Title must be at least ${this.minTitleLength} characters`;
    }

    if (trimmed.length > this.maxTitleLength) {
      return `Title must not exceed ${this.maxTitleLength} characters`;
    }

    return null;
  }

  /**
   * Validate description field
   */
  validateDescription(description: string): string | null {
    const trimmed = description.trim();

    if (!trimmed) {
      return 'Description is required';
    }

    if (trimmed.length < this.minDescriptionLength) {
      return `Description must be at least ${this.minDescriptionLength} characters`;
    }

    if (trimmed.length > this.maxDescriptionLength) {
      return `Description must not exceed ${this.maxDescriptionLength} characters`;
    }

    return null;
  }

  /**
   * Validate single field by name
   */
  validateField(
    fieldName: keyof FormData,
    value: unknown,
    formData?: Partial<FormData>
  ): string | null {
    switch (fieldName) {
      case 'title':
        return this.validateTitle(value as string);

      case 'description':
        return this.validateDescription(value as string);

      case 'piiConfirmed':
        if (formData?.piiDetected && !value) {
          return 'Please confirm you have reviewed sensitive information';
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Check if a string is empty or whitespace only
   */
  isEmpty(value: string): boolean {
    return !value || value.trim().length === 0;
  }

  /**
   * Sanitize input (trim whitespace)
   */
  sanitizeInput(value: string): string {
    return value.trim();
  }

  /**
   * Get validation configuration
   */
  getConfig() {
    return {
      minTitleLength: this.minTitleLength,
      maxTitleLength: this.maxTitleLength,
      minDescriptionLength: this.minDescriptionLength,
      maxDescriptionLength: this.maxDescriptionLength,
    };
  }
}
