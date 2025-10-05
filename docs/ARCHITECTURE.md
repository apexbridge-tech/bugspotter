# BugSpotter Architecture

## Overview

BugSpotter is a modular bug reporting SDK built with TypeScript, designed to capture comprehensive debugging information from web applications. The architecture follows SOLID principles and component-based design patterns for maintainability and extensibility.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      BugSpotter SDK                         │
│                    (Main Facade)                            │
└────────────┬────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐     ┌──────────┐
│ Capture │     │  Widget  │
│ System  │     │  System  │
└────┬────┘     └─────┬────┘
     │                │
     ├─ Console       ├─ Button
     ├─ Network       ├─ Modal (8 components)
     ├─ Screenshot    └─ Event Handlers
     ├─ Metadata
     └─ DOM Replay
```

## Technology Stack

- **Language**: TypeScript 5.x
- **Build**: Webpack 5
- **Testing**: Vitest with jsdom
- **UI**: Shadow DOM (Web Components pattern)
- **Styling**: CSS Custom Properties

## Design Principles

### 1. Single Responsibility Principle (SRP)
Each class has one clear responsibility:
- `ConsoleCapture` - captures console messages only
- `NetworkCapture` - intercepts network requests only
- `FormValidator` - validates form inputs only

### 2. Component-Based Architecture
Large modules are decomposed into focused components:
- **Modal System**: 8 specialized components (see [Modal Refactoring](./architecture/MODAL_REFACTORING.md))
- **Sanitization System**: 5 focused classes (see [Sanitizer Refactoring](./architecture/SANITIZER_REFACTORING.md))

### 3. Dependency Injection
Components receive dependencies through constructors:
```typescript
class BugReportModal {
  constructor(
    private validator: FormValidator,
    private piiDisplay: PIIDetectionDisplay,
    private redactionCanvas: RedactionCanvas
  ) {}
}
```

### 4. Facade Pattern
The main `BugSpotter` class provides a simple API while coordinating complex subsystems.

## Key Architectural Decisions

### Modal System Refactoring

**Problem**: 580+ line monolithic class with 6 responsibilities  
**Solution**: 8 focused components with clear separation of concerns

**Key Components**:
- `StyleManager` - CSS generation and theming
- `TemplateManager` - HTML template composition
- `DOMElementCache` - Optimized element access
- `FormValidator` - Pure validation logic
- `PIIDetectionDisplay` - PII warning UI
- `RedactionCanvas` - Canvas drawing and interaction
- `ScreenshotProcessor` - Image manipulation
- `BugReportModal` - Lightweight coordinator

**Results**:
- 79% reduction in main class size
- 60% fewer methods
- Significantly improved testability

📖 **Full Details**: [Modal Refactoring Analysis](./architecture/MODAL_REFACTORING.md)

---

### Sanitization System Refactoring

**Problem**: Single class with 4 mixed responsibilities, high code duplication  
**Solution**: 5 specialized classes following SOLID principles

**Key Components**:
- `PatternManager` - PII pattern configuration
- `StringSanitizer` - Regex-based string redaction
- `ValueSanitizer` - Recursive value traversal
- `ElementMatcher` - DOM exclusion logic
- `Sanitizer` - Coordination facade

**Results**:
- 40% reduction in code duplication
- 55% reduction in cyclomatic complexity
- Each component independently testable

📖 **Full Details**: [Sanitizer Refactoring Analysis](./architecture/SANITIZER_REFACTORING.md)

---

### Enhanced Logging System

Comprehensive logging infrastructure for development and debugging.

📖 **Details**: [Enhanced Logging](./architecture/ENHANCED_LOGGING.md)

## Module Organization

```
packages/sdk/src/
├── index.ts                    # Main SDK entry point
├── capture/                    # Data capture modules
│   ├── console.ts             # Console message capture
│   ├── metadata.ts            # Browser/environment metadata
│   ├── network.ts             # Network request interception
│   └── screenshot.ts          # Screenshot capture
├── widget/                     # UI components
│   ├── button.ts              # Floating widget button
│   ├── modal.ts               # Bug report modal coordinator
│   └── components/            # Modal sub-components
│       ├── domElementCache.ts
│       ├── formValidator.ts
│       ├── piiDetectionDisplay.ts
│       ├── redactionCanvas.ts
│       ├── screenshotProcessor.ts
│       ├── styleManager.ts
│       └── templateManager.ts
├── utils/                      # Utility functions
│   ├── sanitize.ts            # PII sanitization
│   └── sanitize-patterns.ts   # Pattern definitions
└── types/                      # Type definitions
    └── html-to-image.d.ts
```

## Testing Strategy

### Test Coverage
- **226 total tests** across 11 test files
- **100% passing** rate
- Tests organized by module:
  - Capture: Console (13), Network (12), Screenshot (5), Metadata (16)
  - Widget: Button (19), Modal (25)
  - Utils: Sanitization (52)
  - Core: Buffer (17), DOM Collector (25)
  - Integration: Index (30)

### Test Approach
- **Unit Tests**: Individual components in isolation
- **Integration Tests**: Component interaction flows
- **Contract Tests**: SDK compatibility with consumers

### Testing Tools
- **Vitest**: Fast unit test runner
- **jsdom**: DOM simulation for browser APIs
- **Test Doubles**: Mocks, stubs, and spies

## Data Flow

### Bug Report Submission Flow

```
User Click
    ↓
Widget Button
    ↓
Capture System (parallel):
├─ Screenshot → PII Detection
├─ Console Logs
├─ Network Requests
├─ DOM State
└─ Metadata
    ↓
Modal Display:
├─ Show Screenshot
├─ PII Warnings
└─ Redaction Tools
    ↓
Form Validation
    ↓
Sanitization
    ↓
API Submission
```

## Security & Privacy

### PII Protection
- **9 Pattern Types**: email, phone, credit card, SSN, IIN, IP, API keys, tokens, passwords
- **8 Presets**: all, minimal, financial, contact, credentials, gdpr, pci, security
- **Detection Categories**: financial, contact, identification, network, credentials, Kazakhstan-specific

### Sanitization Strategy
1. **Pattern-based detection** via regex
2. **Configurable exclusions** for known safe elements
3. **Screenshot redaction** with canvas-based drawing
4. **Custom patterns** for domain-specific PII

📖 **Details**: [PII Sanitization](./features/PII_SANITIZATION.md)

## Performance Considerations

### Optimization Techniques
1. **Element Caching**: DOMElementCache reduces repeated queries
2. **Singleton Pattern**: Shared instances for captures (Console, Network)
3. **Lazy Initialization**: Components created only when needed
4. **Event Debouncing**: DOM mutations batched for replay

### Bundle Size
- **Production build**: ~125KB minified
- **gzip compressed**: ~35KB (estimated)

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 12+)
- **Modern browsers**: ES2015+ required

## Extension Points

### Custom PII Patterns
```typescript
bugSpotter.configure({
  sanitization: {
    customPatterns: [
      { name: 'custom-id', pattern: /ID-\d{6}/g }
    ]
  }
});
```

### Custom Widget Styling
Shadow DOM with CSS custom properties allows theming:
```css
:host {
  --bs-primary-color: #ef4444;
  --bs-button-size: 60px;
}
```

### API Integration
Flexible submission handler:
```typescript
const bugSpotter = new BugSpotter({
  apiUrl: 'https://api.example.com/bugs',
  onSubmit: async (data) => {
    // Custom submission logic
  }
});
```

## Future Architectural Considerations

### Potential Enhancements
1. **Plugin System**: Allow third-party extensions
2. **Web Worker Support**: Offload processing for large captures
3. **Streaming API**: Send data progressively for large reports
4. **Compression**: Reduce payload size for network efficiency
5. **Offline Support**: Queue reports when network unavailable

### Scalability
- Current architecture supports extending to:
  - Mobile SDK variants (React Native, Flutter)
  - Backend error tracking integration
  - Custom capture modules (performance metrics, user behavior)

## Related Documentation

### Architecture & Design
- [Modal Refactoring Analysis](./architecture/MODAL_REFACTORING.md) - Detailed modal system design
- [Sanitizer Refactoring Analysis](./architecture/SANITIZER_REFACTORING.md) - PII protection architecture
- [Enhanced Logging](./architecture/ENHANCED_LOGGING.md) - Logging infrastructure

### Features
- [PII Sanitization](./features/PII_SANITIZATION.md) - Privacy protection features
- [Pattern Configuration](./features/PATTERN_CONFIGURATION.md) - Pattern system usage
- [Modal PII Features](./features/MODAL_PII_FEATURES.md) - Modal PII detection UI

### Guides
- [Quick Start](./guides/QUICK_START.md) - Getting started guide
- [API Testing](./guides/API_TESTING.md) - Testing the SDK

## Contributing

When contributing to the architecture:

1. **Follow SOLID principles** - Keep classes focused
2. **Write tests first** - TDD approach preferred
3. **Document decisions** - Update this file for major changes
4. **Maintain backward compatibility** - Use deprecation warnings
5. **Consider performance** - Profile before optimizing

## Changelog

For a detailed history of architectural changes, see [CHANGELOG.md](../CHANGELOG.md).

---

**Last Updated**: October 5, 2025  
**Architecture Version**: 2.0 (Post-refactoring)
