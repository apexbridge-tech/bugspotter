# BugSpotter Documentation

Welcome to the BugSpotter documentation! This guide will help you get started and make the most of the SDK.

## 📚 Table of Contents

### Getting Started
- 🚀 **[Quick Start Guide](./QUICK_START.md)** - Get up and running in 5 minutes
- 📖 **[Main README](../README.md)** - Project overview and features
- 🎮 **[Demo Guide](../apps/demo/REPLAY_DEMO.md)** - Interactive demo with replay player

### Core Features
- 🎥 **[Session Replay](../packages/sdk/docs/SESSION_REPLAY.md)** - Record and replay user interactions
- 📸 **Screenshot Capture** - CSP-safe visual capture (covered in SDK docs)
- 📝 **Console Logging** - Capture all console output (covered in SDK docs)
- 🌐 **Network Monitoring** - Track API requests and responses (covered in SDK docs)

### SDK Documentation
- 📦 **[SDK API Reference](../packages/sdk/README.md)** - Complete API documentation
- 🔧 **[Implementation Summary](../packages/sdk/IMPLEMENTATION_SUMMARY.md)** - Technical implementation details
- 📋 **[Type Definitions](../packages/types/README.md)** - TypeScript types and interfaces

### Backend & Testing
- 🧪 **[API Testing Guide](./API_TESTING.md)** - Test backend integration
- 📊 **[Enhanced Logging](./ENHANCED_LOGGING.md)** - Backend logging features
- 🗄️ **[Backend Mock](../packages/backend-mock/README.md)** - Mock API server for testing
- 🌐 **[Production API](../packages/api/README.md)** - Supabase-based production server

### Technical
- 🛠️ **[Tech Stack](./TECH_STACK.md)** - Technologies and dependencies
- 📝 **[Type Guide](../TYPE_GUIDE.md)** - TypeScript type system
- 🔒 **[Type Safety](../packages/api/docs/TYPE_SAFETY.md)** - Type safety patterns
- 🗺️ **[Type Mapping](../packages/api/docs/TYPE_MAPPING.md)** - API type mappings

### Project
- 📋 **[Project Summary](./PROJECT_SUMMARY.md)** - High-level project overview
- 🔄 **[Changelog](../CHANGELOG.md)** - Version history and updates
- 🤝 **[Contributing](../CONTRIBUTING.md)** - How to contribute

## 🎯 Quick Navigation

### I want to...

#### Get Started
- **Install BugSpotter** → [Quick Start Guide](./QUICK_START.md)
- **See it in action** → [Demo Guide](../apps/demo/REPLAY_DEMO.md)
- **Understand the project** → [Main README](../README.md)

#### Use Features
- **Enable session replay** → [Session Replay Docs](../packages/sdk/docs/SESSION_REPLAY.md)
- **Customize the widget** → [SDK API Reference](../packages/sdk/README.md#-widget-customization)
- **Submit bug reports** → [SDK API Reference](../packages/sdk/README.md#api-submission)

#### Develop & Test
- **Run tests** → [Quick Start - Testing](./QUICK_START.md#-run-tests)
- **Test the API** → [API Testing Guide](./API_TESTING.md)
- **Build the SDK** → [Quick Start - Build](./QUICK_START.md#step-2-build-the-sdk)

#### Deploy
- **Set up backend** → [Backend Mock](../packages/backend-mock/README.md) or [Production API](../packages/api/README.md)
- **Understand logging** → [Enhanced Logging](./ENHANCED_LOGGING.md)
- **Review tech stack** → [Tech Stack](./TECH_STACK.md)

#### Contribute
- **Submit a PR** → [Contributing Guide](../CONTRIBUTING.md)
- **Report a bug** → [GitHub Issues](https://github.com/apexbridge-tech/bugspotter/issues)
- **Ask questions** → [GitHub Discussions](https://github.com/apexbridge-tech/bugspotter/discussions)

## 🌟 Highlighted Features

### 🎥 Session Replay (NEW!)
Record user interactions and play them back to see exactly what happened:
```javascript
BugSpotter.init({
  replay: {
    enabled: true,
    duration: 30  // Keep last 30 seconds
  }
});
```
[Learn more →](../packages/sdk/docs/SESSION_REPLAY.md)

### 📸 Screenshot Capture
CSP-safe screenshots without external dependencies:
```javascript
const report = await bugSpotter.capture();
// report.screenshot contains base64 PNG
```
[Learn more →](../packages/sdk/README.md)

### 🎨 Customizable Widget
Professional UI with full customization:
```javascript
new BugSpotter.FloatingButton({
  position: 'bottom-right',
  icon: '⚡',
  backgroundColor: '#1a365d'
});
```
[Learn more →](../packages/sdk/README.md#-widget-customization)

## 📊 Documentation Stats

- **10 documentation files**
- **5 quick start sections**
- **162 tests** with full coverage
- **4 major feature areas**

## 🔍 Search by Topic

### Types & TypeScript
- [Type Guide](../TYPE_GUIDE.md)
- [Type Safety](../packages/api/docs/TYPE_SAFETY.md)
- [Type Mapping](../packages/api/docs/TYPE_MAPPING.md)
- [Type Definitions](../packages/types/README.md)

### Backend
- [Backend Mock](../packages/backend-mock/README.md)
- [Production API](../packages/api/README.md)
- [Enhanced Logging](./ENHANCED_LOGGING.md)
- [API Testing](./API_TESTING.md)

### Frontend/SDK
- [SDK README](../packages/sdk/README.md)
- [Session Replay](../packages/sdk/docs/SESSION_REPLAY.md)
- [Implementation Summary](../packages/sdk/IMPLEMENTATION_SUMMARY.md)

### Guides
- [Quick Start](./QUICK_START.md)
- [Demo Guide](../apps/demo/REPLAY_DEMO.md)
- [Tech Stack](./TECH_STACK.md)
- [Contributing](../CONTRIBUTING.md)

## 🆘 Getting Help

### Common Issues

**Build errors?**
- Check [Quick Start - Troubleshooting](./QUICK_START.md#-troubleshooting)

**API not working?**
- See [API Testing Guide](./API_TESTING.md)

**Replay not displaying?**
- Read [Session Replay Troubleshooting](../packages/sdk/docs/SESSION_REPLAY.md#troubleshooting)

**Type errors?**
- Review [Type Safety Guide](../packages/api/docs/TYPE_SAFETY.md)

### Support Channels

- 📧 **Email:** support@apexbridge.tech
- 🐛 **Issues:** [GitHub Issues](https://github.com/apexbridge-tech/bugspotter/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/apexbridge-tech/bugspotter/discussions)
- 📚 **Documentation:** You're here!

## 🎓 Learning Path

### Beginner
1. Start with [Quick Start Guide](./QUICK_START.md)
2. Try the [Demo](../apps/demo/REPLAY_DEMO.md)
3. Read [Main README](../README.md)

### Intermediate
1. Explore [SDK API Reference](../packages/sdk/README.md)
2. Learn [Session Replay](../packages/sdk/docs/SESSION_REPLAY.md)
3. Test with [API Testing Guide](./API_TESTING.md)

### Advanced
1. Review [Implementation Summary](../packages/sdk/IMPLEMENTATION_SUMMARY.md)
2. Study [Type Safety](../packages/api/docs/TYPE_SAFETY.md)
3. Contribute via [Contributing Guide](../CONTRIBUTING.md)

## 📝 Documentation Standards

All our documentation follows these principles:

- ✅ **Clear examples** - Every feature has code samples
- ✅ **Step-by-step guides** - Easy to follow instructions
- ✅ **Visual aids** - Screenshots and diagrams where helpful
- ✅ **Up-to-date** - Synchronized with latest code
- ✅ **Searchable** - Organized topics and index
- ✅ **Tested** - All code examples are tested

## 🔄 Recent Updates

- **Oct 2025** - Added session replay feature and documentation
- **Oct 2025** - Enhanced backend logging and persistent storage
- **Oct 2025** - Added interactive replay player to demo
- **Oct 2025** - Comprehensive documentation reorganization

See [Changelog](../CHANGELOG.md) for full history.

---

**Happy Building! 🚀**

*Last updated: October 4, 2025*
