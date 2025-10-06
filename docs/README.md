# BugSpotter Documentation

Welcome to the BugSpotter documentation! This guide will help you get started and make the most of the SDK.

## 📚 Table of Contents

### Getting Started
- 🚀 **[Quick Start Guide](./guides/QUICK_START.md)** - Get up and running in 5 minutes
- 📖 **[Main README](../README.md)** - Project overview and features

### Architecture & Design
- �️ **[Architecture Overview](./ARCHITECTURE.md)** - **Start here** for architectural understanding
- 📐 **[Modal Refactoring](./architecture/MODAL_REFACTORING.md)** - Modal system design and refactoring
- 🧹 **[Sanitizer Refactoring](./architecture/SANITIZER_REFACTORING.md)** - PII sanitization architecture
- � **[Enhanced Logging](./architecture/ENHANCED_LOGGING.md)** - Logging infrastructure

### Features
- 🔒 **[PII Sanitization](./features/PII_SANITIZATION.md)** - Privacy protection system
- ⚙️ **[Pattern Configuration](./features/PATTERN_CONFIGURATION.md)** - Configure custom PII patterns
- 🎯 **[Modal PII Features](./features/MODAL_PII_FEATURES.md)** - PII detection in the modal UI
- 🗜️ **[Data Compression](./features/COMPRESSION.md)** - Gzip compression with 70-90% reduction

### SDK Documentation
- 📦 **[SDK API Reference](../packages/sdk/README.md)** - Complete API documentation
- 🔧 **[Implementation Summary](../packages/sdk/IMPLEMENTATION_SUMMARY.md)** - Technical implementation details
- 📋 **[Type Definitions](../packages/types/README.md)** - TypeScript types and interfaces

### Testing & Development
- 🧪 **[API Testing Guide](./guides/API_TESTING.md)** - Test backend integration
- 🗄️ **[Backend Mock](../packages/backend-mock/README.md)** - Mock API server for testing

### Technical
- 🛠️ **[Tech Stack](./TECH_STACK.md)** - Technologies and dependencies
- 📝 **[Type Guide](../TYPE_GUIDE.md)** - TypeScript type system

### Project
- 📋 **[Project Summary](./PROJECT_SUMMARY.md)** - High-level project overview
- 🔄 **[Changelog](../CHANGELOG.md)** - Version history and updates
- 🤝 **[Contributing](../CONTRIBUTING.md)** - How to contribute

## 🎯 Quick Navigation

### I want to...

#### Understand the Architecture
- **Get the big picture** → [Architecture Overview](./ARCHITECTURE.md) ⭐
- **Learn about modal design** → [Modal Refactoring](./architecture/MODAL_REFACTORING.md)
- **Understand PII protection** → [PII Sanitization](./features/PII_SANITIZATION.md)
- **See sanitization internals** → [Sanitizer Refactoring](./architecture/SANITIZER_REFACTORING.md)

#### Get Started
- **Install BugSpotter** → [Quick Start Guide](./guides/QUICK_START.md)
- **Understand the project** → [Main README](../README.md)
- **Configure PII patterns** → [Pattern Configuration](./features/PATTERN_CONFIGURATION.md)

#### Develop & Test
- **Run tests** → [Quick Start - Testing](./guides/QUICK_START.md)
- **Test the API** → [API Testing Guide](./guides/API_TESTING.md)
- **Review tech stack** → [Tech Stack](./TECH_STACK.md)

#### Contribute
- **Submit a PR** → [Contributing Guide](../CONTRIBUTING.md)
- **Understand design decisions** → [Architecture Overview](./ARCHITECTURE.md)
- **Report a bug** → [GitHub Issues](https://github.com/apexbridge-tech/bugspotter/issues)

## 🌟 Key Features

### 🔒 PII Sanitization
Automatically detect and redact sensitive data with 9 pattern types:
```javascript
const bugSpotter = new BugSpotter({
  sanitization: {
    preset: 'gdpr',  // Built-in presets: all, gdpr, pci, security, etc.
    customPatterns: [{ name: 'custom', pattern: /SECRET-\d+/g }]
  }
});
```
[Learn more →](./features/PII_SANITIZATION.md)

### 📸 Screenshot with Redaction
Capture screenshots with interactive redaction tools:
```javascript
const report = await bugSpotter.capture();
// User can draw redaction rectangles in the modal
```
[Learn more →](./architecture/MODAL_REFACTORING.md)

### �️ Component-Based Architecture
Modular design following SOLID principles:
- **8 modal components** (79% code reduction)
- **5 sanitizer classes** (40% less duplication)
- **226 tests** with 100% pass rate
[Learn more →](./ARCHITECTURE.md)

## 📊 Documentation Stats

- **14 documentation files**
- **3 architecture deep-dives**
- **4 feature guides**
- **262 tests** with 100% pass rate

## 🔍 Search by Topic

### Architecture
- [Architecture Overview](./ARCHITECTURE.md) ⭐
- [Modal Refactoring](./architecture/MODAL_REFACTORING.md)
- [Sanitizer Refactoring](./architecture/SANITIZER_REFACTORING.md)
- [Enhanced Logging](./architecture/ENHANCED_LOGGING.md)

### Features
- [PII Sanitization](./features/PII_SANITIZATION.md)
- [Pattern Configuration](./features/PATTERN_CONFIGURATION.md)
- [Modal PII Features](./features/MODAL_PII_FEATURES.md)
- [Data Compression](./features/COMPRESSION.md)

### Guides
- [Quick Start](./guides/QUICK_START.md)
- [API Testing](./guides/API_TESTING.md)
- [Tech Stack](./TECH_STACK.md)
- [Contributing](../CONTRIBUTING.md)

### Project
- [Main README](../README.md)
- [Project Summary](./PROJECT_SUMMARY.md)
- [Changelog](../CHANGELOG.md)
- [Type Guide](../TYPE_GUIDE.md)

## 🆘 Getting Help

### Common Issues

**Build errors?**
- Check [Quick Start Guide](./guides/QUICK_START.md)

**API not working?**
- See [API Testing Guide](./guides/API_TESTING.md)

**Understanding architecture?**
- Read [Architecture Overview](./ARCHITECTURE.md)

**PII detection questions?**
- Review [PII Sanitization](./features/PII_SANITIZATION.md)

### Support Channels

-  **Issues:** [GitHub Issues](https://github.com/apexbridge-tech/bugspotter/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/apexbridge-tech/bugspotter/discussions)
- 📚 **Documentation:** You're here!

## 🎓 Learning Path

### For Users
1. Start with [Quick Start Guide](./guides/QUICK_START.md)
2. Configure patterns in [Pattern Configuration](./features/PATTERN_CONFIGURATION.md)
3. Understand PII protection in [PII Sanitization](./features/PII_SANITIZATION.md)

### For Contributors
1. Read [Architecture Overview](./ARCHITECTURE.md) ⭐
2. Study [Modal Refactoring](./architecture/MODAL_REFACTORING.md)
3. Review [Sanitizer Refactoring](./architecture/SANITIZER_REFACTORING.md)
4. Follow [Contributing Guide](../CONTRIBUTING.md)

### For Architects
1. Start with [Architecture Overview](./ARCHITECTURE.md)
2. Deep dive into [Modal Refactoring](./architecture/MODAL_REFACTORING.md)
3. Understand [Sanitizer Refactoring](./architecture/SANITIZER_REFACTORING.md)
4. Review design decisions and SOLID principles

## 📝 Documentation Standards

All our documentation follows these principles:

- ✅ **Clear examples** - Every feature has code samples
- ✅ **Step-by-step guides** - Easy to follow instructions
- ✅ **Visual aids** - Screenshots and diagrams where helpful
- ✅ **Up-to-date** - Synchronized with latest code
- ✅ **Searchable** - Organized topics and index
- ✅ **Tested** - All code examples are tested

## 🔄 Recent Updates

- **Oct 2025** - Added gzip compression (70-90% payload reduction)
- **Oct 2025** - Implemented image optimization (WebP/JPEG with resizing)
- **Oct 2025** - Refactored modal system (8 components, 79% code reduction)
- **Oct 2025** - Refactored sanitizer (5 classes, SOLID principles)
- **Oct 2025** - Added PII sanitization with 9 pattern types
- **Oct 2025** - Reorganized documentation into architecture/features/guides
- **Oct 2025** - Created comprehensive Architecture Overview

See [Changelog](../CHANGELOG.md) for full history.

---

**Happy Building! 🚀**

*Last updated: October 6, 2025*
