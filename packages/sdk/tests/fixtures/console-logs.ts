/**
 * Test fixture: Console logs containing various PII types
 * Used for testing sanitization in console capture
 */

export const CONSOLE_LOGS_WITH_PII = [
  {
    level: 'log',
    message: 'User logged in: john.doe@example.com',
    timestamp: 1696608000000,
  },
  {
    level: 'log',
    message: 'Processing payment for card: 4532-1234-5678-9010',
    timestamp: 1696608001000,
  },
  {
    level: 'warn',
    message: 'Invalid SSN format: 123-45-6789',
    timestamp: 1696608002000,
  },
  {
    level: 'error',
    message: 'API Error: Failed to validate phone number +1-555-123-4567',
    timestamp: 1696608003000,
    stack: `Error: API validation failed
    at validatePhone (app.js:123)
    at processForm (app.js:456)
    User: alice.smith@company.com
    IP: 192.168.1.100`,
  },
  {
    level: 'log',
    message:
      'User object: {"email":"bob.jones@example.org","phone":"+44-20-7123-4567","ssn":"987-65-4321"}',
    timestamp: 1696608004000,
  },
  {
    level: 'log',
    message: 'Kazakhstan IIN detected: 123456789012',
    timestamp: 1696608005000,
  },
  {
    level: 'info',
    message: 'Payment successful! Card ending in 9010, CVV verified',
    timestamp: 1696608006000,
  },
  {
    level: 'debug',
    message:
      'Auth token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    timestamp: 1696608007000,
  },
  {
    level: 'error',
    message: 'Database connection failed for user_12345 at IP 10.0.0.42',
    timestamp: 1696608008000,
  },
  {
    level: 'log',
    message: 'Multiple contacts: john@test.com, alice@company.com, support@example.org',
    timestamp: 1696608009000,
  },
];

/**
 * Expected sanitized console logs
 */
export const SANITIZED_CONSOLE_LOGS = [
  {
    level: 'log',
    message: 'User logged in: [REDACTED]',
    timestamp: 1696608000000,
  },
  {
    level: 'log',
    message: 'Processing payment for card: [REDACTED]',
    timestamp: 1696608001000,
  },
  {
    level: 'warn',
    message: 'Invalid SSN format: [REDACTED]',
    timestamp: 1696608002000,
  },
  {
    level: 'error',
    message: 'API Error: Failed to validate phone number [REDACTED]',
    timestamp: 1696608003000,
    stack: `Error: API validation failed
    at validatePhone (app.js:123)
    at processForm (app.js:456)
    User: [REDACTED]
    IP: [REDACTED]`,
  },
  {
    level: 'log',
    message: 'User object: {"email":"[REDACTED]","phone":"[REDACTED]","ssn":"[REDACTED]"}',
    timestamp: 1696608004000,
  },
  {
    level: 'log',
    message: 'Kazakhstan IIN detected: [REDACTED]',
    timestamp: 1696608005000,
  },
  {
    level: 'info',
    message: 'Payment successful! Card ending in 9010, CVV verified',
    timestamp: 1696608006000,
  },
  {
    level: 'debug',
    message: 'Auth token: [REDACTED]',
    timestamp: 1696608007000,
  },
  {
    level: 'error',
    message: 'Database connection failed for user_12345 at IP [REDACTED]',
    timestamp: 1696608008000,
  },
  {
    level: 'log',
    message: 'Multiple contacts: [REDACTED], [REDACTED], [REDACTED]',
    timestamp: 1696608009000,
  },
];
