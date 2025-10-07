/**
 * Test fixture: Network requests with auth tokens and sensitive data
 * Used for testing sanitization in network capture
 */

export const NETWORK_REQUESTS_WITH_AUTH = [
  {
    url: 'https://api.example.com/auth/login',
    method: 'POST',
    status: 200,
    duration: 145,
    timestamp: 1696608000000,
    headers: {
      'Content-Type': 'application/json',
      Authorization:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      'X-API-Key': 'test_key_fake_abc123def456',
    },
    body: {
      email: 'john.doe@example.com',
      password: 'hashed_password_here',
    },
  },
  {
    url: 'https://api.example.com/users/me',
    method: 'GET',
    status: 200,
    duration: 82,
    timestamp: 1696608001000,
    headers: {
      Authorization:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
      'X-User-Email': 'alice.smith@company.com',
    },
    response: {
      id: 'user-12345',
      email: 'alice.smith@company.com',
      phone: '+1-555-123-4567',
      ssn: '123-45-6789',
    },
  },
  {
    url: 'https://api.example.com/payments',
    method: 'POST',
    status: 201,
    duration: 234,
    timestamp: 1696608002000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer token_abc_xyz_123',
      'X-Idempotency-Key': 'idempotent-key-789',
    },
    body: {
      cardNumber: '4532-1234-5678-9010',
      cvv: '123',
      expiryDate: '12/25',
      amount: 49.99,
    },
  },
  {
    url: 'https://api.example.com/admin/users?email=bob.jones@example.org&phone=+44-20-7123-4567',
    method: 'GET',
    status: 200,
    duration: 156,
    timestamp: 1696608003000,
    headers: {
      Authorization: 'Basic YWRtaW46cGFzc3dvcmQ=',
      'X-Admin-Token': 'admin_secret_token_456',
    },
  },
  {
    url: 'https://api.example.com/data/export',
    method: 'POST',
    status: 500,
    duration: 5432,
    timestamp: 1696608004000,
    error:
      'Internal server error: Failed to process PII for user john.smith@test.com (IP: 192.168.1.100)',
    headers: {
      Authorization: 'Bearer expired_token_789',
    },
  },
];

/**
 * Expected sanitized network requests
 */
export const SANITIZED_NETWORK_REQUESTS = [
  {
    url: 'https://api.example.com/auth/login',
    method: 'POST',
    status: 200,
    duration: 145,
    timestamp: 1696608000000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: '[REDACTED]',
      'X-API-Key': '[REDACTED]',
    },
    body: {
      email: '[REDACTED]',
      password: 'hashed_password_here',
    },
  },
  {
    url: 'https://api.example.com/users/me',
    method: 'GET',
    status: 200,
    duration: 82,
    timestamp: 1696608001000,
    headers: {
      Authorization: '[REDACTED]',
      'X-User-Email': '[REDACTED]',
    },
    response: {
      id: 'user-12345',
      email: '[REDACTED]',
      phone: '[REDACTED]',
      ssn: '[REDACTED]',
    },
  },
  {
    url: 'https://api.example.com/payments',
    method: 'POST',
    status: 201,
    duration: 234,
    timestamp: 1696608002000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: '[REDACTED]',
      'X-Idempotency-Key': 'idempotent-key-789',
    },
    body: {
      cardNumber: '[REDACTED]',
      cvv: '[REDACTED]',
      expiryDate: '12/25',
      amount: 49.99,
    },
  },
  {
    url: 'https://api.example.com/admin/users?email=[REDACTED]&phone=[REDACTED]',
    method: 'GET',
    status: 200,
    duration: 156,
    timestamp: 1696608003000,
    headers: {
      Authorization: '[REDACTED]',
      'X-Admin-Token': '[REDACTED]',
    },
  },
  {
    url: 'https://api.example.com/data/export',
    method: 'POST',
    status: 500,
    duration: 5432,
    timestamp: 1696608004000,
    error: 'Internal server error: Failed to process PII for user [REDACTED] (IP: [REDACTED])',
    headers: {
      Authorization: '[REDACTED]',
    },
  },
];
