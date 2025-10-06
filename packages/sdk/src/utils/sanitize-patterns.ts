/**
 * PII Pattern Definitions
 * Configurable regex patterns for detecting sensitive data (PII + credentials)
 */

export type PIIPatternName =
  // Personal Identifiable Information
  | 'email'
  | 'phone'
  | 'creditcard'
  | 'ssn'
  | 'iin'
  | 'ip'
  // Credentials and Secrets
  | 'apikey'
  | 'token'
  | 'password';

/**
 * Pattern definition with metadata
 */
export interface PatternDefinition {
  /** Pattern name/identifier */
  name: PIIPatternName;
  /** Regular expression for detection */
  regex: RegExp;
  /** Human-readable description */
  description: string;
  /** Examples of data this pattern matches */
  examples: string[];
  /** Priority order (lower = higher priority, checked first) */
  priority: number;
}

/**
 * Default built-in patterns
 */
export const DEFAULT_PATTERNS: Record<PIIPatternName, PatternDefinition> = {
  email: {
    name: 'email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    description: 'Email addresses',
    examples: ['user@example.com', 'john.doe+tag@company.co.uk', 'test_user@sub.domain.com'],
    priority: 1, // Highest priority - most specific
  },

  creditcard: {
    name: 'creditcard',
    regex: /\b(?:\d{4}[-\s]){3}\d{4}\b|\b\d{4}[-\s]\d{6}[-\s]\d{5}\b|\b\d{13,19}\b/g,
    description: 'Credit card numbers (Visa, MC, Amex, Discover, etc.)',
    examples: [
      '4532-1488-0343-6467',
      '4532148803436467',
      '5425 2334 3010 9903',
      '3782 822463 10005',
    ],
    priority: 2,
  },

  ssn: {
    name: 'ssn',
    regex: /\b\d{3}-\d{2}-\d{4}\b|\b(?<!\d)\d{9}(?!\d)\b/g,
    description: 'US Social Security Numbers',
    examples: ['123-45-6789', '987654321'],
    priority: 3,
  },

  iin: {
    name: 'iin',
    regex: /\b[0-9]{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12][0-9]|3[01])\d{6}\b/g,
    description: 'Kazakhstan IIN/BIN (12 digits with date validation)',
    examples: ['950315300123', '880612500456', '021225123456'],
    priority: 4,
  },

  ip: {
    name: 'ip',
    regex:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    description: 'IPv4 and IPv6 addresses',
    examples: ['192.168.1.100', '127.0.0.1', '2001:0db8:85a3:0000:0000:8a2e:0370:7334'],
    priority: 5,
  },

  phone: {
    name: 'phone',
    regex:
      /\+\d{1,3}[-.\s]\d{3}[-.\s]\d{4}\b|\+\d{1,3}[-.\s]\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\(\d{3}\)\s*\d{3}[-.\s]\d{4}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,
    description: 'International phone numbers',
    examples: [
      '+1-555-1234',
      '+1-555-123-4567',
      '(555) 123-4567',
      '555-123-4567',
      '+7 777 123 4567',
    ],
    priority: 6,
  },

  apikey: {
    name: 'apikey',
    regex:
      /\b(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]{24,}\b|AIza[a-zA-Z0-9_-]{35}|ya29\.[a-zA-Z0-9_-]+|AKIA[a-zA-Z0-9]{16}\b/g,
    description: 'API keys (Stripe, Google, AWS, etc.)',
    examples: [
      'sk_live_abc123def456ghi789jkl',
      'pk_test_xyz789abc123def456',
      'AIzaSyD1234567890abcdefghijklmnopqrst',
      'AKIAIOSFODNN7EXAMPLE',
    ],
    priority: 7,
  },

  token: {
    name: 'token',
    regex:
      /\b(?:Bearer\s+)?[a-zA-Z0-9_-]{32,}\b|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}/g,
    description: 'Authentication tokens (Bearer, GitHub, JWT-like)',
    examples: [
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'ghp_abc123def456ghi789jkl012mno345pqr',
      'gho_xyz789abc123def456ghi789jkl012mno',
    ],
    priority: 8,
  },

  password: {
    name: 'password',
    regex:
      /(?:password|passwd|pwd)[\s:=]+[^\s]{6,}|(?:password|passwd|pwd)["']?\s*[:=]\s*["']?[^\s"']{6,}/gi,
    description: 'Password fields in text (password=..., pwd:...)',
    examples: ['password: MySecret123!', 'passwd=SecurePass456', 'pwd: "MyP@ssw0rd"'],
    priority: 9,
  },
};

/**
 * Pattern categories for grouping
 */
export const PATTERN_CATEGORIES = {
  financial: ['creditcard', 'ssn'] as PIIPatternName[],
  contact: ['email', 'phone'] as PIIPatternName[],
  identification: ['ssn', 'iin'] as PIIPatternName[],
  network: ['ip', 'email'] as PIIPatternName[],
  credentials: ['apikey', 'token', 'password'] as PIIPatternName[],
  kazakhstan: ['iin'] as PIIPatternName[],
} as const;

/**
 * Get patterns sorted by priority
 */
export function getPatternsByPriority(patterns: PatternDefinition[]): PatternDefinition[] {
  return [...patterns].sort((a, b) => {
    return a.priority - b.priority;
  });
}

/**
 * Get pattern by name
 */
export function getPattern(name: PIIPatternName): PatternDefinition {
  return DEFAULT_PATTERNS[name];
}

/**
 * Get patterns by category
 */
export function getPatternsByCategory(
  category: keyof typeof PATTERN_CATEGORIES
): PatternDefinition[] {
  return PATTERN_CATEGORIES[category].map((name) => {
    return DEFAULT_PATTERNS[name];
  });
}

/**
 * Get all pattern names
 */
export function getAllPatternNames(): PIIPatternName[] {
  return Object.keys(DEFAULT_PATTERNS) as PIIPatternName[];
}

/**
 * Custom pattern builder for advanced use cases
 */
export class PatternBuilder {
  private pattern: Partial<PatternDefinition> = {};

  name(name: string): this {
    this.pattern.name = name as PIIPatternName;
    return this;
  }

  regex(regex: RegExp): this {
    // Ensure global flag
    if (!regex.global) {
      const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
      this.pattern.regex = new RegExp(regex.source, flags);
    } else {
      this.pattern.regex = regex;
    }
    return this;
  }

  description(description: string): this {
    this.pattern.description = description;
    return this;
  }

  examples(examples: string[]): this {
    this.pattern.examples = examples;
    return this;
  }

  priority(priority: number): this {
    this.pattern.priority = priority;
    return this;
  }

  build(): PatternDefinition {
    if (!this.pattern.name || !this.pattern.regex) {
      throw new Error('Pattern must have at least name and regex');
    }

    return {
      name: this.pattern.name,
      regex: this.pattern.regex,
      description: this.pattern.description || this.pattern.name,
      examples: this.pattern.examples || [],
      priority: this.pattern.priority ?? 99,
    };
  }
}

/**
 * Pre-configured pattern sets for common use cases
 */
export const PATTERN_PRESETS = {
  /** All patterns enabled (PII + credentials) - default */
  all: getAllPatternNames(),

  /** Minimal - only most critical PII */
  minimal: ['email', 'creditcard', 'ssn'] as PIIPatternName[],

  /** Financial data only */
  financial: PATTERN_CATEGORIES.financial,

  /** Contact information only */
  contact: PATTERN_CATEGORIES.contact,

  /** Identification numbers only */
  identification: PATTERN_CATEGORIES.identification,

  /** Credentials and secrets only */
  credentials: PATTERN_CATEGORIES.credentials,

  /** Kazakhstan-specific patterns */
  kazakhstan: ['email', 'phone', 'iin'] as PIIPatternName[],

  /** GDPR compliance recommended set */
  gdpr: ['email', 'phone', 'ip'] as PIIPatternName[],

  /** PCI DSS compliance required */
  pci: ['creditcard'] as PIIPatternName[],

  /** Security-focused: PII + credentials */
  security: [
    'email',
    'phone',
    'creditcard',
    'ssn',
    'apikey',
    'token',
    'password',
  ] as PIIPatternName[],
} as const;

/**
 * Create custom pattern configuration
 */
export function createPatternConfig(
  preset: keyof typeof PATTERN_PRESETS | PIIPatternName[]
): PatternDefinition[] {
  const names = typeof preset === 'string' ? PATTERN_PRESETS[preset] : preset;
  return names.map((name) => {
    return DEFAULT_PATTERNS[name];
  });
}

/**
 * Validate pattern regex
 */
export function validatePattern(pattern: PatternDefinition): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!pattern.name) {
    errors.push('Pattern must have a name');
  }

  if (!pattern.regex) {
    errors.push('Pattern must have a regex');
  } else {
    if (!pattern.regex.global) {
      errors.push('Pattern regex must have global flag');
    }

    // Test regex doesn't cause catastrophic backtracking
    try {
      const testString = 'a'.repeat(1000);
      const start = Date.now();
      testString.match(pattern.regex);
      const duration = Date.now() - start;

      if (duration > 100) {
        errors.push(`Pattern regex may cause performance issues (took ${duration}ms on test)`);
      }
    } catch (error) {
      errors.push(`Pattern regex error: ${(error as Error).message}`);
    }
  }

  if (pattern.priority < 0) {
    errors.push('Pattern priority must be non-negative');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Merge pattern configurations
 */
export function mergePatternConfigs(...configs: PatternDefinition[][]): PatternDefinition[] {
  const merged = new Map<string, PatternDefinition>();

  configs.forEach((config) => {
    config.forEach((pattern) => {
      // Later configs override earlier ones
      merged.set(pattern.name, pattern);
    });
  });

  return getPatternsByPriority([...merged.values()]);
}
