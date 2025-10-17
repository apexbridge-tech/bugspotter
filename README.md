# BugSpotter

> Professional bug reporting SDK with session replay

Capture screenshots, console logs, network requests, **session replays**, and metadata - helping developers reproduce bugs faster.

[![Tests](https://img.shields.io/badge/tests-1261%20passing-brightgreen)]() [![Bundle](https://img.shields.io/badge/bundle-99KB-blue)]() [![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)]() [![Status](https://img.shields.io/badge/status-pre--release-orange)]()

## ✨ Features

| Feature                   | Description                                       |
| ------------------------- | ------------------------------------------------- |
| 📹 **Session Replay**     | Record and replay user interactions (rrweb)       |
| 🔒 **PII Sanitization**   | Auto-redact emails, phones, cards, SSNs, etc.     |
| 📸 **Screenshots**        | CSP-safe visual capture                           |
| 📝 **Console Logs**       | Track all console output                          |
| 🌐 **Network Monitoring** | Capture fetch/XHR with timing                     |
| 👨‍💼 **Admin Panel**        | Full web-based control panel (React + TypeScript) |
| 🎨 **Professional UI**    | Customizable button + modal                       |
| 🔐 **httpOnly Cookies**   | Secure refresh token storage (XSS protection)     |
| 📧 **Email Integration**  | 5 email provider options (SendGrid, SES, etc.)    |
| ⚡ **Lightweight**        | ~99 KB minified                                   |

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

### Docker Deployment (Recommended)

```bash
# Copy environment template
cp .env.example .env

# Generate secure secrets
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env

# Start all services (API, worker, PostgreSQL, Redis, MinIO)
pnpm docker:up

# API available at http://localhost:3000
# MinIO Console at http://localhost:9001
```

[Full Docker documentation →](./DOCKER.md)

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

| Resource           | Link                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **System Summary** | [SYSTEM_SUMMARY.md](./SYSTEM_SUMMARY.md) (comprehensive 2000-word overview)                                |
| **Docker Setup**   | [DOCKER.md](./DOCKER.md) (deployment, scaling, troubleshooting)                                            |
| **Admin Panel**    | [apps/admin/README.md](./apps/admin/README.md)                                                             |
| **SDK API**        | [packages/sdk/README.md](./packages/sdk/README.md)                                                         |
| **Backend API**    | [packages/backend/README.md](./packages/backend/README.md)                                                 |
| **Session Replay** | [packages/sdk/docs/SESSION_REPLAY.md](./packages/sdk/docs/SESSION_REPLAY.md)                               |
| **Email Setup**    | [packages/backend/docs/EMAIL_INTEGRATION.md](./packages/backend/docs/EMAIL_INTEGRATION.md)                 |
| **Plugin System**  | [packages/backend/src/integrations/PLUGIN_SYSTEM.md](./packages/backend/src/integrations/PLUGIN_SYSTEM.md) |
| **Security**       | [packages/backend/SECURITY.md](./packages/backend/SECURITY.md)                                             |
| **Admin Security** | [apps/admin/SECURITY.md](./apps/admin/SECURITY.md) (httpOnly cookies, CSP)                                 |
| **Testing**        | [packages/backend/TESTING.md](./packages/backend/TESTING.md)                                               |
| **Contributing**   | [CONTRIBUTING.md](./CONTRIBUTING.md)                                                                       |

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
**Backend:** 1,230 tests (unit + integration + queue + load + storage)  
**Admin:** 33 tests (unit + E2E with Playwright)  
**Total:** 1,608 tests - 1,575 passing ✅ (33 failing due to accessibility fixes in progress)

Testing uses Testcontainers for zero-setup database and Redis testing.

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

- **SDK Bundle:** ~99 KB minified
- **Admin Bundle:** ~308 KB (JS) + ~15 KB (CSS) gzipped
- **Load Time:** <100ms (SDK), <2s (Admin)
- **Memory:** <15 MB (30s replay buffer)
- **API Response:** <200ms (p95)
- **Tests:** 1,608 total (1,575 passing ✅)

## 🛣️ Roadmap

✅ **Completed:**

- Core SDK with session replay (rrweb)
- PII sanitization (10+ patterns)
- Backend API with PostgreSQL & S3 storage
- Admin control panel (React + TypeScript)
- httpOnly cookie authentication (XSS protection)
- Email integration guide (5 provider options)
- Comprehensive testing (1,608 tests)

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

## 📚 Documentation Structure

BugSpotter maintains a clean documentation hierarchy:

**Root Level** (Essential docs only):

- `README.md` - Project overview, quick start, feature highlights
- `SYSTEM_SUMMARY.md` - Comprehensive 2000-word system documentation
- `CHANGELOG.md` - Version history and release notes
- `CONTRIBUTING.md` - Contribution guidelines and workflow

**Package Level**:

- `apps/admin/` - Admin panel docs (README, SECURITY, REACT_PATTERNS)
- `packages/backend/` - Backend API docs (README, SECURITY, TESTING, EMAIL_INTEGRATION)
- `packages/sdk/` - SDK usage guide and session replay docs
- `packages/types/` - Shared type definitions
- `packages/backend-mock/` - Mock API server for development

**Module Level**:

- `packages/backend/src/queue/` - Queue system documentation
- `packages/backend/src/storage/` - Storage layer documentation
- `packages/backend/src/retention/` - Retention policy documentation
- `packages/backend/src/integrations/` - Plugin system and integration docs

**Archived** (`.archive/docs/`):

- Historical refactoring notes, architecture decisions, detailed technical guides

---

Made with ⚡ by [ApexBridge](https://apexbridge.tech)
