# Sanitizer Pattern Configuration Guide

## Overview

With the extracted pattern configuration, you can now:
- ✅ Use predefined pattern presets
- ✅ Mix and match individual patterns
- ✅ Create custom patterns with metadata
- ✅ Validate patterns before use
- ✅ Merge multiple pattern configs

---

## 📦 Pattern Presets

### Using Presets

```typescript
import { BugSpotter, PATTERN_PRESETS } from '@bugspotter/sdk';

// Use preset name directly
BugSpotter.init({
  sanitize: {
    enabled: true,
    patterns: 'minimal',  // Only critical PII
  }
});

// Available presets:
// - 'all'           → All patterns (default)
// - 'minimal'       → email, creditcard, ssn
// - 'financial'     → creditcard, ssn
// - 'contact'       → email, phone
// - 'identification'→ ssn, iin
// - 'kazakhstan'    → email, phone, iin
// - 'gdpr'          → email, phone, ip
// - 'pci'           → creditcard
```

### Preset Examples

```typescript
// GDPR compliance
BugSpotter.init({
  sanitize: { patterns: 'gdpr' }
});

// PCI DSS compliance
BugSpotter.init({
  sanitize: { patterns: 'pci' }
});

// Kazakhstan-specific app
BugSpotter.init({
  sanitize: { patterns: 'kazakhstan' }
});

// Financial application
BugSpotter.init({
  sanitize: { patterns: 'financial' }
});
```

---

## 🎯 Individual Pattern Selection

```typescript
// Select specific patterns
BugSpotter.init({
  sanitize: {
    enabled: true,
    patterns: ['email', 'phone', 'ip'],
  }
});

// Only sanitize emails
BugSpotter.init({
  sanitize: {
    patterns: ['email']
  }
});
```

---

## 🔧 Custom Patterns

### Simple Custom Pattern

```typescript
import { BugSpotter } from '@bugspotter/sdk';

BugSpotter.init({
  sanitize: {
    enabled: true,
    patterns: 'minimal',
    customPatterns: [
      {
        name: 'api-key',
        regex: /API[-_]KEY:\s*[\w-]{20,}/gi,
        description: 'API keys in format API_KEY: xxx',
        examples: ['API_KEY: abcd1234efgh5678ijkl'],
        priority: 1,  // High priority
      }
    ]
  }
});
```

### Advanced Custom Pattern with Builder

```typescript
import { PatternBuilder } from '@bugspotter/sdk';

const sessionTokenPattern = new PatternBuilder()
  .name('session-token')
  .regex(/sess_[a-zA-Z0-9]{32,}/gi)
  .description('Session tokens with sess_ prefix')
  .examples(['sess_abc123def456...'])
  .priority(2)
  .build();

BugSpotter.init({
  sanitize: {
    patterns: 'all',
    customPatterns: [sessionTokenPattern]
  }
});
```

---

## 📚 Accessing Pattern Metadata

### Get Pattern Information

```typescript
import { getPattern, DEFAULT_PATTERNS } from '@bugspotter/sdk';

// Get specific pattern
const emailPattern = getPattern('email');
console.log(emailPattern.description);  // "Email addresses"
console.log(emailPattern.examples);     // ["user@example.com", ...]
console.log(emailPattern.priority);     // 1

// List all patterns
Object.values(DEFAULT_PATTERNS).forEach(pattern => {
  console.log(`${pattern.name}: ${pattern.description}`);
});
```

### Get Patterns by Category

```typescript
import { getPatternsByCategory } from '@bugspotter/sdk';

// Get financial patterns
const financialPatterns = getPatternsByCategory('financial');
// Returns: [creditcard, ssn]

// Get contact patterns
const contactPatterns = getPatternsByCategory('contact');
// Returns: [email, phone]

// Available categories:
// - 'financial'
// - 'contact'
// - 'identification'
// - 'network'
// - 'kazakhstan'
```

---

## ✅ Pattern Validation

### Validate Custom Patterns

```typescript
import { validatePattern, PatternBuilder } from '@bugspotter/sdk';

const customPattern = new PatternBuilder()
  .name('weak-pattern')
  .regex(/.*@.*/)  // Missing global flag!
  .build();

const validation = validatePattern(customPattern);

if (!validation.valid) {
  console.error('Pattern errors:', validation.errors);
  // ["Pattern regex must have global flag"]
}
```

### Performance Testing

```typescript
import { validatePattern } from '@bugspotter/sdk';

// Pattern validation includes performance check
const pattern = {
  name: 'complex',
  regex: /(a+)+b/g,  // Potentially slow
  description: 'Complex pattern',
  examples: [],
  priority: 10
};

const result = validatePattern(pattern);
// May warn: "Pattern regex may cause performance issues"
```

---

## 🔀 Merging Patterns

### Combine Multiple Configurations

```typescript
import { 
  createPatternConfig, 
  mergePatternConfigs,
  DEFAULT_PATTERNS 
} from '@bugspotter/sdk';

// Create base config from preset
const basePatterns = createPatternConfig('minimal');

// Create additional patterns
const additionalPatterns = createPatternConfig(['ip', 'phone']);

// Create custom pattern
const customPattern = {
  name: 'custom',
  regex: /CUSTOM:\s*\w+/g,
  description: 'Custom data',
  examples: ['CUSTOM: data'],
  priority: 5
};

// Merge all together
const mergedPatterns = mergePatternConfigs(
  basePatterns,
  additionalPatterns,
  [customPattern]
);

// Use merged config
// (Note: BugSpotter.init uses preset/array, this is for advanced use)
```

---

## 🌍 Region-Specific Configurations

### Kazakhstan Configuration

```typescript
import { BugSpotter } from '@bugspotter/sdk';

BugSpotter.init({
  sanitize: {
    patterns: 'kazakhstan',  // email, phone, iin
    customPatterns: [
      {
        name: 'kz-license',
        regex: /[A-Z]{3}\s*\d{3}\s*[A-Z]{2}/gi,
        description: 'Kazakhstan vehicle license plates',
        examples: ['ABC 123 KZ', 'XYZ456AB'],
      }
    ]
  }
});
```

### European GDPR Configuration

```typescript
BugSpotter.init({
  sanitize: {
    patterns: 'gdpr',  // email, phone, ip
    customPatterns: [
      {
        name: 'eu-vat',
        regex: /[A-Z]{2}\d{9,12}/g,
        description: 'EU VAT numbers',
        examples: ['GB123456789', 'DE987654321'],
      }
    ]
  }
});
```

### US Configuration

```typescript
BugSpotter.init({
  sanitize: {
    patterns: ['email', 'phone', 'ssn', 'creditcard', 'ip'],
    customPatterns: [
      {
        name: 'drivers-license',
        regex: /[A-Z]\d{7}/g,
        description: 'US drivers license',
        examples: ['A1234567'],
      }
    ]
  }
});
```

---

## 🎨 Pattern Customization Examples

### Override Default Pattern

```typescript
import { DEFAULT_PATTERNS } from '@bugspotter/sdk';

// Get default email pattern
const defaultEmail = DEFAULT_PATTERNS.email;

// Create stricter version
const strictEmailPattern = {
  ...defaultEmail,
  name: 'strict-email',
  regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(com|org|net)\b/gi,
  description: 'Email addresses (only .com, .org, .net)',
};

BugSpotter.init({
  sanitize: {
    patterns: ['phone', 'ip'],  // Don't use default email
    customPatterns: [strictEmailPattern],  // Use custom instead
  }
});
```

### Domain-Specific Patterns

```typescript
// Healthcare application
BugSpotter.init({
  sanitize: {
    patterns: 'all',
    customPatterns: [
      {
        name: 'mrn',
        regex: /MRN[-:]?\s*\d{7,10}/gi,
        description: 'Medical Record Numbers',
        examples: ['MRN: 1234567', 'MRN-9876543210'],
        priority: 1,  // High priority
      },
      {
        name: 'npi',
        regex: /NPI[-:]?\s*\d{10}/gi,
        description: 'National Provider Identifier',
        examples: ['NPI: 1234567890'],
        priority: 2,
      }
    ]
  }
});

// E-commerce application
BugSpotter.init({
  sanitize: {
    patterns: 'financial',
    customPatterns: [
      {
        name: 'order-id',
        regex: /ORD-\d{10}/gi,
        description: 'Order IDs',
        examples: ['ORD-1234567890'],
      },
      {
        name: 'promo-code',
        regex: /PROMO[-:]?\s*[A-Z0-9]{6,12}/gi,
        description: 'Promotional codes',
        examples: ['PROMO: SUMMER2025'],
      }
    ]
  }
});
```

---

## 🧪 Testing Custom Patterns

```typescript
import { validatePattern, PatternBuilder } from '@bugspotter/sdk';

// Create and test pattern
const testPattern = new PatternBuilder()
  .name('test-pattern')
  .regex(/TEST-\d{6}/gi)
  .description('Test pattern')
  .examples(['TEST-123456'])
  .priority(10)
  .build();

// Validate
const validation = validatePattern(testPattern);
console.log('Valid:', validation.valid);
console.log('Errors:', validation.errors);

// Test against sample data
const sampleData = 'This contains TEST-123456 and TEST-789012';
const matches = sampleData.match(testPattern.regex);
console.log('Matches:', matches);
// ["TEST-123456", "TEST-789012"]
```

---

## 📊 Pattern Priority Explained

Patterns are applied in priority order (lower number = higher priority):

```typescript
import { DEFAULT_PATTERNS } from '@bugspotter/sdk';

Object.values(DEFAULT_PATTERNS).forEach(p => {
  console.log(`${p.priority}: ${p.name} - ${p.description}`);
});

// Output:
// 1: email - Email addresses
// 2: creditcard - Credit card numbers
// 3: ssn - US Social Security Numbers
// 4: iin - Kazakhstan IIN/BIN
// 5: ip - IPv4 and IPv6 addresses
// 6: phone - International phone numbers
```

**Why priority matters:**
- Email detected before phone (both contain `@` and digits)
- Credit cards detected before generic digit patterns
- Specific patterns checked before general ones

---

## 🔍 Dynamic Pattern Loading

### Load Patterns from Configuration File

```typescript
// patterns-config.json
{
  "preset": "financial",
  "custom": [
    {
      "name": "account-number",
      "regex": "ACC-\\d{10}",
      "description": "Bank account numbers"
    }
  ]
}

// Load and apply
const config = await fetch('/patterns-config.json').then(r => r.json());

BugSpotter.init({
  sanitize: {
    patterns: config.preset,
    customPatterns: config.custom.map(p => ({
      ...p,
      regex: new RegExp(p.regex, 'gi')
    }))
  }
});
```

---

## 📈 Best Practices

### 1. **Start with Preset, Add Custom**

```typescript
// ✅ Good
BugSpotter.init({
  sanitize: {
    patterns: 'all',  // Cover standard cases
    customPatterns: [/* app-specific */]
  }
});

// ❌ Avoid
BugSpotter.init({
  sanitize: {
    patterns: [],  // Missing standard patterns
    customPatterns: [/* only custom */]
  }
});
```

### 2. **Use Categories for Related Patterns**

```typescript
import { getPatternsByCategory } from '@bugspotter/sdk';

// ✅ Good - get all financial patterns
const patterns = getPatternsByCategory('financial')
  .map(p => p.name);
```

### 3. **Validate Custom Patterns**

```typescript
// ✅ Good
const pattern = buildCustomPattern();
const validation = validatePattern(pattern);
if (!validation.valid) {
  console.error('Invalid pattern:', validation.errors);
}
```

### 4. **Set Appropriate Priorities**

```typescript
// ✅ Good - specific patterns get higher priority
customPatterns: [
  { name: 'specific', regex: /.../, priority: 1 },
  { name: 'general', regex: /.../, priority: 10 }
]

// ❌ Avoid - general pattern might match first
customPatterns: [
  { name: 'general', regex: /.../, priority: 1 },
  { name: 'specific', regex: /.../, priority: 10 }
]
```

---

## 🔗 Pattern Configuration Reference

See the following files for more details:
- `sanitize-patterns.ts` - Pattern definitions and utilities
- `sanitize.refactored.ts` - Sanitizer implementation
- `PII_SANITIZATION.md` - Complete sanitization guide

---

**Version:** 1.0  
**Last Updated:** October 5, 2025
