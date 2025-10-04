# BugSpotter Tech Stack

## Frontend SDK

- **TypeScript 5.3.3** - Type-safe development with full type definitions
- **Webpack 5.102.0** - Module bundling and minification (~99 KB output with replay)
- **html-to-image 1.11.13** - CSP-safe screenshot capture
- **rrweb 2.0.0-alpha.4** - Session replay recording
- **rrweb-snapshot 2.0.0-alpha.4** - DOM snapshot utilities
- **@rrweb/types 2.0.0-alpha.18** - TypeScript types for rrweb
- **pako 2.1.0** - Data compression (future use)

## Widget Components

- **Shadow DOM** - Isolated styling for widgets
- **CSS3** - Modern styling with animations
- **Custom Elements** - Encapsulated button and modal components

## Development Tools

- **Node.js 22.20.0** - Runtime environment
- **pnpm 10.17.1** - Fast, disk-efficient package manager
- **Vitest 3.2.4** - Lightning-fast unit testing framework
- **JSDOM 27.0.0** - DOM testing environment
- **TypeScript Compiler** - Type checking and transpilation
- **ts-loader 9.5.1** - TypeScript loader for Webpack

## Backend (Mock API)

- **Node.js with ES Modules** - Modern JavaScript runtime
- **Express 4.21.2** - Minimal web framework
- **CORS 2.8.5** - Cross-origin resource sharing
- **File System (fs/promises)** - Async file operations for saving reports

## Testing Infrastructure

- **162 Total Tests** - Comprehensive test coverage
  - 30 Core SDK tests (with replay integration)
  - 13 Console capture tests
  - 12 Network capture tests
  - 5 Screenshot capture tests
  - 16 Metadata capture tests
  - 19 Button widget tests
  - 25 Modal widget tests
  - 17 Circular buffer tests (session replay)
  - 13 DOM collector tests (session replay)
  - 12 API submission tests
- **@vitest/ui** - Interactive test UI
- **Happy DOM** - Fast DOM testing environment

## Code Quality

- **ESLint** - Code linting and style enforcement
- **Prettier** - Code formatting
- **TypeScript Strict Mode** - Maximum type safety
- **Git** - Version control

## Build Process

- **Webpack Production Mode** - Minification and optimization
- **Source Maps** - Debugging support
- **Tree Shaking** - Dead code elimination
- **Module Federation** - Future package distribution

## Demo Infrastructure

- **Browser-sync 3.0.4** - Live reload development server
- **HTML5** - Modern markup
- **Vanilla JavaScript** - No framework dependencies

## Planned Infrastructure

- **PostgreSQL** - Production database for metadata
- **Redis** - Session cache and rate limiting
- **Docker Compose** - Containerized development
- **CloudFlare R2 / AWS S3** - Screenshot storage
- **Vercel / Railway / Fly.io** - Backend hosting
- **NPM Registry** - Package distribution
- **Sentry** - Error tracking
- **PostHog** - Analytics

## Current Status

### ✅ Completed (100%)
- ✅ SDK core architecture
- ✅ TypeScript configuration
- ✅ Console log capture with circular reference handling
- ✅ Network request monitoring (fetch + XHR)
- ✅ Screenshot capture (CSP-safe with html-to-image)
- ✅ Browser metadata detection
- ✅ **Session replay with rrweb** (NEW!)
- ✅ **Circular buffer for replay events** (NEW!)
- ✅ **Interactive replay player in demo** (NEW!)
- ✅ Floating button widget with Shadow DOM
- ✅ Professional bug report modal
- ✅ API submission with async support
- ✅ Comprehensive test suite (162 tests)
- ✅ Webpack build pipeline
- ✅ Mock API server with enhanced logging
- ✅ **Persistent JSON database** (NEW!)
- ✅ File-based report persistence
- ✅ Error handling and validation
- ✅ Comprehensive documentation

### 🚧 In Progress (0%)
- None - all planned features complete

### ⏳ Planned (Future)
- NPM package publication
- Replay event compression
- Privacy masking for sensitive data
- React/Vue/Angular framework integrations
- Production backend deployment
- Database integration (PostgreSQL/Supabase)
- Cloud storage for screenshots and replays
- Analytics dashboard
- Team collaboration features
- Mobile SDK (React Native)
- Browser extension
- Slack/Discord integrations

## Performance Metrics

- **Bundle Size**: ~99 KB (minified with session replay)
- **Load Time**: < 100ms
- **Screenshot Capture**: ~500ms average
- **Session Replay Overhead**: Minimal (throttled events)
- **Memory Footprint**: < 15 MB active (with 30s replay buffer)
- **Test Execution**: < 5 seconds (162 tests)
- **Build Time**: ~4 seconds (production)

## Browser Support

- ✅ Chrome/Chromium 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ IE11 (not tested, likely incompatible)

## Node Version Requirements

- **Development**: Node.js 18+ required
- **Recommended**: Node.js 22.20.0 (LTS)
- **Package Manager**: pnpm 10.17.1

## Security Features

- **CSP-safe** - No eval() or inline scripts
- **Shadow DOM** - Isolated component styles
- **Input validation** - Sanitized user inputs
- **Bearer authentication** - Secure API key transmission
- **CORS enabled** - Controlled cross-origin access
- **No external dependencies** - All processing local

## Accessibility

- ✅ Keyboard navigation (Escape to close modal)
- ✅ ARIA labels on buttons
- ✅ Focus management in modals
- ✅ High contrast support
- ⏳ Screen reader optimization (planned)

---

Last updated: October 3, 2025
