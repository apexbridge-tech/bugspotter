# BugSpotter

> Professional bug reporting SDK with session replay

Capture screenshots, console logs, network requests, **session replays**, and metadata - helping developers reproduce bugs faster.

[![Tests](https://img.shields.io/badge/tests-1095%20passing-brightgreen)]() [![Bundle](https://img.shields.io/badge/bundle-99KB-blue)]() [![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)]() [![Status](https://img.shields.io/badge/status-pre--release-orange)]()

## ✨ Features

| Feature                   | Description                                   |
| ------------------------- | --------------------------------------------- |
| �� **Session Replay**     | Record and replay user interactions (rrweb)   |
| 🔒 **PII Sanitization**   | Auto-redact emails, phones, cards, SSNs, etc. |
| 📸 **Screenshots**        | CSP-safe visual capture                       |
| 📝 **Console Logs**       | Track all console output                      |
| 🌐 **Network Monitoring** | Capture fetch/XHR with timing                 |
| 🎨 **Professional UI**    | Customizable button + modal                   |
| ⚡ **Lightweight**        | ~99 KB minified                               |

## 🚀 Quick Start

> **Note**: BugSpotter is in active development and not yet released to npm.

### Installation (Development)

```bash
# Clone repository
git clone https://github.com/apexbridge-tech/bugspotter.git
cd bugspotter

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Try the Demo

```bash
# Terminal 1: Start backend server
cd packages/backend-mock
node server.js

# Terminal 2: Start demo
cd apps/demo
npx browser-sync start --config bs-config.json
# Visit http://localhost:3000/apps/demo/index.html
```

### Basic Integration

```html
<script src="bugspotter.min.js"></script>
<script>
  BugSpotter.init({
    apiKey: 'your-api-key',
    endpoint: 'https://your-api.com/api/bugs',
    showWidget: true,
    replay: { enabled: true, duration: 30 },
    sanitize: { enabled: true, patterns: ['email', 'phone'] },
  });
</script>
```

## 📖 Documentation

| Resource           | Link                                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| **SDK API**        | [packages/sdk/README.md](./packages/sdk/README.md)                           |
| **Session Replay** | [packages/sdk/docs/SESSION_REPLAY.md](./packages/sdk/docs/SESSION_REPLAY.md) |
| **Demo Guide**     | [apps/demo/README.md](./apps/demo/README.md)                                 |
| **Contributing**   | [CONTRIBUTING.md](./CONTRIBUTING.md)                                         |

## 🎬 Session Replay

\`\`\`javascript
replay: {
enabled: true,
duration: 30, // Keep last 30 seconds
sampling: {
mousemove: 50, // Throttle to 50ms
scroll: 100 // Throttle to 100ms
}
}
\`\`\`

[Learn more →](./packages/sdk/docs/SESSION_REPLAY.md)

## 🔒 PII Sanitization

Auto-redact sensitive data before submission:

\`\`\`javascript
sanitize: {
enabled: true,
patterns: ['email', 'phone', 'creditcard', 'ssn', 'iin', 'ip'],
customPatterns: [
{ name: 'api-key', regex: /API[-_]KEY:\s\*[\w-]{20,}/gi }
]
}
\`\`\`

**Supported:** Emails, phones, credit cards, SSNs, Kazakhstan IIN/BIN, IP addresses, custom patterns

## 📦 Project Structure

**pnpm workspace monorepo:**

- `packages/sdk` - Core TypeScript SDK (~99KB)
- `packages/backend` - Fastify REST API with PostgreSQL
- `packages/types` - Shared TypeScript definitions
- `packages/backend-mock` - Mock API server
- `apps/demo` - Interactive demo

## 🧪 Testing

**SDK:** 345 tests (unit + E2E + Playwright)  
**Backend:** 750 tests (unit + integration + load + storage)  
**Total:** 1,095 tests - all passing ✅

```bash
pnpm test              # All tests (requires Docker)
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

## 🏗️ Tech Stack

**SDK:** TypeScript, Webpack, rrweb  
**Backend:** Fastify 5.6.1, PostgreSQL 16, S3-compatible storage  
**Testing:** Vitest, Testcontainers  
**Dev:** pnpm, ESLint, Prettier

## 📊 Performance

- **Bundle:** ~99 KB minified
- **Load:** <100ms
- **Memory:** <15 MB (30s buffer)
- **Tests:** 1,095 total (100% passing ✅)

## 🛣️ Roadmap

✅ **Completed:**

- Core SDK with session replay (rrweb)
- PII sanitization (10+ patterns)
- Backend API with PostgreSQL & S3 storage
- Comprehensive testing (1,095 tests)

🚧 **In Progress (Pre-Release):**

- Production deployment guides
- API documentation finalization
- Performance optimization

⏳ **Planned for v1.0:**

- NPM package release
- Framework integrations (React, Vue, Angular)
- Hosted backend service
- Analytics dashboard

## 🤝 Contributing

\`\`\`bash
git checkout -b feature/amazing-feature
pnpm test
git commit -m "feat: add amazing feature"
\`\`\`

## 📄 License

MIT License - see [LICENSE](./LICENSE)

## 📞 Support

- 📧 Email: support@apexbridge.tech
- 🐛 Issues: [GitHub Issues](https://github.com/apexbridge-tech/bugspotter/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/apexbridge-tech/bugspotter/discussions)

---

Made with ⚡ by [ApexBridge](https://apexbridge.tech)
