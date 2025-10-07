/**
 * Mock screenshot data with visible PII for testing sanitization
 * This simulates a screenshot that contains sensitive information
 */

export const PII_SCREENSHOT_BASE64 = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;

/**
 * Simulated OCR text that would be extracted from a screenshot
 * Contains various PII types for testing
 */
export const SCREENSHOT_OCR_TEXT = `
  User Dashboard
  
  Welcome back, john.doe@example.com
  
  Your Account Information:
  Name: John Doe
  Email: john.doe@example.com
  Phone: +1-555-123-4567
  SSN: 123-45-6789
  
  Payment Methods:
  Credit Card: 4532-1234-5678-9010
  Expires: 12/25
  CVV: 123
  
  Billing Address:
  123 Main Street
  IP: 192.168.1.100
  
  Recent Transactions:
  - $49.99 on 2025-10-01
  - $125.00 on 2025-10-03
`;

/**
 * Expected sanitized OCR text after PII redaction
 */
export const SANITIZED_OCR_TEXT = `
  User Dashboard
  
  Welcome back, [REDACTED]
  
  Your Account Information:
  Name: John Doe
  Email: [REDACTED]
  Phone: [REDACTED]
  SSN: [REDACTED]
  
  Payment Methods:
  Credit Card: [REDACTED]
  Expires: 12/25
  CVV: [REDACTED]
  
  Billing Address:
  123 Main Street
  IP: [REDACTED]
  
  Recent Transactions:
  - $49.99 on 2025-10-01
  - $125.00 on 2025-10-03
`;
