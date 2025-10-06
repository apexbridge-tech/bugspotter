# BugSpotter

> Professional bug reporting SDK with session replay

Capture screenshots, console logs, network requests, **session replays**, and metadata - helping developers reproduce bugs faster.

[![Tests](https://img.shields.io/badge/tests-226%20passing-brightgreen)]() [![Bundle](https://img.shields.io/badge/bundle-99KB-blue)]() [![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)]()

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

\`\`\`bash

# Install & Build

pnpm install
cd packages/sdk && pnpm run build

# Try Demo

cd ../../apps/demo
npx browser-sync start --server --port 3000
\`\`\`

### Basic Integration

\`\`\`html

<script src="bugspotter.min.js"></script>
<script>
  BugSpotter.BugSpotter.init({
    apiKey: 'your-api-key',
    endpoint: 'https://your-api.com/api/bugs',
    showWidget: true,
    replay: { enabled: true, duration: 30 },
    sanitize: { enabled: true, patterns: ['email', 'phone'] }
  });
</script>

\`\`\`

## 📖 Documentation

| Resource            | Link                                                                         |
| ------------------- | ---------------------------------------------------------------------------- |
| **Detailed README** | [DETAILED_README.md](./DETAILED_README.md)                                   |
| **Quick Start**     | [docs/QUICK_START.md](./docs/QUICK_START.md)                                 |
| **Session Replay**  | [packages/sdk/docs/SESSION_REPLAY.md](./packages/sdk/docs/SESSION_REPLAY.md) |
| **SDK API**         | [packages/sdk/README.md](./packages/sdk/README.md)                           |
| **Demo Guide**      | [apps/demo/README.md](./apps/demo/README.md)                                 |
| **API Testing**     | [docs/API_TESTING.md](./docs/API_TESTING.md)                                 |

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

This is a **pnpm workspace monorepo** with the following structure:

\`\`\`
bugspotter/
├── .github/
│ └── workflows/
│ └── ci.yml # CI/CD pipeline
├── packages/
│ ├── sdk/ # @bugspotter/sdk - Core SDK + Session Replay
│ ├── types/ # @bugspotter/types - Shared TypeScript types
│ ├── backend-mock/ # @bugspotter/backend-mock - Mock API server
│ └── api/ # @bugspotter/api - Production API (Supabase)
├── apps/
│ └── demo/ # Interactive demo application
├── docs/ # Documentation
├── pnpm-workspace.yaml # Workspace configuration
└── package.json # Root package.json
\`\`\`

### Workspace Commands

\`\`\`bash

# Install all dependencies

pnpm install

# Run commands across all packages

pnpm run build # Build all packages
pnpm run test # Test all packages
pnpm run lint # Lint all packages

# Run commands for specific package

pnpm --filter @bugspotter/sdk run build
pnpm --filter @bugspotter/api run test

# Run commands for all packages in a directory

pnpm --recursive --filter "./packages/\*\*" run test
\`\`\`

## 📖 API Reference

### Initialize

\`\`\`javascript
const bugSpotter = BugSpotter.BugSpotter.init(config);
\`\`\`

### Capture

\`\`\`javascript
const report = await bugSpotter.capture();
// { screenshot, console, network, metadata, replay }
\`\`\`

### Custom Widget

\`\`\`javascript
const button = new BugSpotter.FloatingButton({
position: 'bottom-right',
icon: '⚡',
backgroundColor: '#1a365d'
});

button.onClick(async () => {
const report = await bugSpotter.capture();
// Handle submission
});
\`\`\`

[Full API docs →](./packages/sdk/README.md)

## 🧪 Testing

\`\`\`bash
cd packages/sdk
pnpm test # 226 tests
pnpm test --watch # Watch mode
pnpm test --ui # Visual UI
\`\`\`

## 🏗️ Tech Stack

**SDK:** TypeScript, Webpack, rrweb, html-to-image  
**Testing:** Vitest (226 tests)  
**Backend:** Node.js, Express, Supabase  
**Dev:** pnpm, ESLint, Prettier

## 📊 Performance

- **Bundle:** ~99 KB minified
- **Load:** <100ms
- **Screenshot:** ~500ms
- **PII:** <10ms overhead
- **Memory:** <15 MB (30s buffer)

## 🛣️ Roadmap

✅ **Completed:** Core SDK, Session Replay, PII Sanitization, 226 Tests  
🚧 **In Progress:** Documentation, Performance  
⏳ **Planned:** NPM Package, React/Vue/Angular, Cloud Storage, Analytics

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
