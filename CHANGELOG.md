# Changelog

All notable changes to the BugSpotter project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🎨 Admin Panel

- **Full-featured web control panel** built with React 18 + TypeScript
- **5 core pages**: Setup wizard, Login, Health monitoring, Projects, Settings
- **Bug Report Dashboard**: Filters, list view, detail modal with session replay player
- **JWT authentication** with automatic token refresh
- **Professional UI** with Tailwind CSS and responsive design
- **Docker integration** with Nginx and multi-stage builds
- **Test coverage**: 33 tests (25 passing, 8 in progress for accessibility)

### 🔐 Security Enhancements

- **httpOnly Cookie Authentication** (XSS protection)
  - Refresh tokens stored in httpOnly cookies (JavaScript-inaccessible)
  - Access tokens in memory only (React state)
  - Cookie options: `httpOnly: true`, `secure: true` (production), `sameSite: 'strict'`
  - Automatic cookie rotation on token refresh
  - Logout endpoint clears cookies properly
- **Modern CSP headers** replacing deprecated X-XSS-Protection
- **114 auth integration tests** ensuring cookie security

### 📧 Email Integration

- **Comprehensive email provider guide** with 5 production-ready options:
  - SendGrid (recommended for quick start)
  - AWS SES (best for scale)
  - Postmark (best deliverability)
  - Resend (modern choice)
  - Nodemailer + SMTP (self-hosted)
- Complete implementation examples for each provider
- Environment variable configuration templates

### 🔔 Notification System

- **Strategy Pattern implementation** for notifications
- **Registry Pattern** for dynamic notifier discovery
- **3 notification types**: Webhook, Slack, Email (structure ready)
- Queue-based notification processing with BullMQ
- Decentralized config: each notifier manages its own configuration

### 📚 Documentation

- Created comprehensive SYSTEM_SUMMARY.md (2000-word overview)
- Updated README.md with latest features (httpOnly, admin panel, email)
- Added EMAIL_INTEGRATION.md with provider comparisons
- Added SECURITY.md for admin panel (httpOnly cookies, CSP)
- Added REACT_PATTERNS.md for React best practices
- Removed obsolete ADMIN_PANEL_SUMMARY.md (consolidated)
- Removed obsolete httpOnly-implementation.md (in SECURITY.md)
- Updated test counts: 1,608 tests (1,575 passing)

## [0.3.0] - 2025-10-05

### 🔒 PII Detection & Sanitization

Major security update adding comprehensive PII detection and sanitization.

### ✨ Added

#### PII Sanitization

- **Automatic PII detection** and masking before sending bug reports
- **Built-in patterns** for sensitive data:
  - Email addresses (`user@example.com` → `[REDACTED-EMAIL]`)
  - Phone numbers - international formats (`+1-555-1234` → `[REDACTED-PHONE]`)
  - Credit cards - all major formats (`4532-1488-0343-6467` → `[REDACTED-CREDITCARD]`)
  - Social Security Numbers (`123-45-6789` → `[REDACTED-SSN]`)
  - Kazakhstan IIN/BIN numbers with date validation (`950315300123` → `[REDACTED-IIN]`)
  - IP addresses - IPv4 and IPv6 (`192.168.1.1` → `[REDACTED-IP]`)
- **Custom regex patterns** support for app-specific sensitive data
- **Exclude selectors** to preserve public data (e.g., support emails)
- **Cyrillic text support** for Russian and Kazakh content
- **Performance optimized** - <10ms overhead per bug report

#### Sanitization Coverage

- Console logs and error messages
- Network request/response data (URLs, headers, bodies)
- Error stack traces
- DOM text content in session replays
- Metadata (URLs, user agents)

#### Configuration

- Enable/disable sanitization globally
- Select specific PII patterns to detect
- Define custom patterns with regex
- Exclude DOM elements from sanitization

#### Testing

- 52 comprehensive sanitization tests
- **Total SDK tests: 226** (up from 174)

### 📝 Changed

- All capture modules accept optional `Sanitizer` instance
- DOM collector uses rrweb's `maskTextFn` for text sanitization
- Default: sanitization **enabled** with all built-in patterns

See [packages/sdk/README.md](./packages/sdk/README.md) for configuration details.

## [0.2.0] - 2025-10-04

### 🎥 Session Replay Feature

Major update adding comprehensive session replay functionality.

### ✨ Added

#### Session Replay

- **rrweb integration** for DOM recording and playback
- **Circular buffer** with time-based event management (15-30s configurable)
- **DOMCollector class** for recording user interactions
- **Event types** captured:
  - DOM mutations (additions, removals, attribute changes)
  - Mouse movements (throttled to 50ms)
  - Mouse interactions (clicks, double-clicks)
  - Scroll events (throttled to 100ms)
  - Form inputs
  - Viewport changes
- **Performance optimizations**:
  - Sampling rates for mousemove and scroll
  - Slim DOM options to reduce payload
  - Automatic pruning of old events
- **Interactive replay player** in demo using rrweb-player
- **Persistent database** for backend-mock (JSON file storage)

#### Documentation

- Session replay guide: [packages/sdk/docs/SESSION_REPLAY.md](./packages/sdk/docs/SESSION_REPLAY.md)
- Demo guide: [apps/demo/README.md](./apps/demo/README.md)

#### Testing

- 17 tests for CircularBuffer
- 13 tests for DOMCollector
- 3 integration tests for replay
- **Total SDK tests: 174** (up from 129)

### 📝 Changed

- Bundle size increased to ~99 KB (from 29.2 KB) due to rrweb
- Memory usage increased to ~15 MB (from ~10 MB) with 30s buffer
- Demo now includes replay player with controls
- Backend logs now show replay event breakdown

### 🔧 Dependencies

- rrweb@2.0.0-alpha.4, rrweb-snapshot@2.0.0-alpha.4, @rrweb/types@2.0.0-alpha.18

## [0.1.0] - 2025-10-03

### 🎉 Initial Release

This is the first working version of BugSpotter SDK with full capture, widget, and API functionality.

### ✨ Added

#### Core SDK

- **BugSpotter class** with singleton pattern
- **Automatic capture** of screenshots, console logs, network requests, and metadata
- **Configuration system** with API key and endpoint support
- **TypeScript support** with full type definitions
- **Webpack build** producing minified bundle

#### Capture Modules

- **Screenshot Capture**
  - CSP-safe using html-to-image library
  - Full page capture as Base64 PNG
  - Error handling with fallback message
  - ~500ms average capture time

- **Console Capture**
  - Captures log, warn, error, info, debug levels
  - Stack traces for errors
  - Timestamps for all entries
  - Object stringification with circular reference handling
  - Configurable max logs (default: 100)

- **Network Capture**
  - Fetch API interception
  - XMLHttpRequest monitoring
  - Request/response timing
  - HTTP status codes
  - Error tracking
  - Singleton pattern

- **Metadata Capture**
  - Browser detection (Chrome, Firefox, Safari, Edge, Opera, etc.)
  - OS detection (Windows, macOS, Linux, iOS, Android, ChromeOS)
  - Viewport dimensions
  - User agent string
  - Current URL
  - Capture timestamp

#### Widget Components

- **FloatingButton**
  - Customizable position (4 corners)
  - Custom icon support (emoji/text)
  - Configurable colors and size
  - Smooth animations
  - Shadow DOM isolation
  - Show/hide controls
  - Dynamic updates (icon, color)

- **BugReportModal**
  - Professional design with animations
  - Form validation (title and description required)
  - Screenshot preview
  - **Async submission support** (handles Promise callbacks)
  - Loading state during submission
  - Error handling with user feedback
  - Escape key to close
  - Click X button to close
  - Prevents accidental close (no click-outside)
  - Shadow DOM isolation

#### API Integration

- **HTTP submission** with fetch API
- **Bearer token authentication**
- **JSON payload** structure
- **Error handling** for 4xx/5xx responses
- **Network error** handling
- **Response parsing**

#### Backend (Mock Server)

- **Express.js server** on port 4000
- **CORS enabled** for cross-origin requests
- **POST /api/bugs** - Submit bug reports
- **GET /api/bugs** - List all reports
- **GET /api/bugs/:id** - Get specific report
- **DELETE /api/bugs** - Clear all reports
- **POST /api/bugs/error/:code** - Simulate errors (testing)
- **Enhanced logging** with formatted output:
  - Console logs display (first 10 entries)
  - Network requests display (first 5 requests)
  - Detailed metadata logging
- **File persistence** - Auto-save reports to `bug-reports/` directory
- **Timestamped filenames** for easy tracking
- **JSON formatting** with pretty-print
- **Request validation** with error messages
- **Health check** endpoint

#### Testing

- **129 comprehensive tests** - All passing ✅
  - 27 Core SDK tests
  - 13 Console capture tests
  - 12 Network capture tests
  - 5 Screenshot capture tests
  - 16 Metadata capture tests
  - 19 Button widget tests
  - 25 Modal widget tests
  - 12 API submission tests
- **Vitest** testing framework
- **JSDOM** for DOM testing
- **Mock implementations** for browser APIs
- **Integration tests** for full workflows
- **Unit tests** for individual components

#### Demo Application

- **Professional UI** with corporate blue theme (#1a365d)
- **Interactive test buttons** for console/network testing
- **Live capture** demonstration
- **API integration** example
- **Browser-sync** for live reload
- **Responsive design**

#### Documentation

- **README.md** - Project overview and quick start
- **packages/sdk/README.md** - SDK API documentation
- **docs/API_TESTING.md** - Complete API testing guide
- **docs/ENHANCED_LOGGING.md** - Backend logging features
- **docs/TECH_STACK.md** - Technology overview
- **packages/backend-mock/README.md** - Mock backend API documentation

### 🎨 Design Improvements

- **Professional color scheme** - Navy blue (#1a365d) corporate theme
- **Subtle animations** - Smooth transitions and effects
- **Clean typography** - Modern font stack
- **Shadow DOM** - Isolated styling for widgets
- **Responsive layout** - Mobile-friendly design

### 🔒 Security

- **CSP-safe** screenshot capture
- **Input validation** on all forms
- **Bearer token** authentication
- **No inline scripts** in widgets
- **Sanitized outputs** in logging

### 📊 Performance

- Bundle: 29.2 KB minified
- Load: < 100ms
- Memory: < 10 MB
- Screenshot: ~500ms

### 🐛 Bug Fixes

- Fixed duplicate floating buttons issue
- Fixed modal closing on outside click (UX improvement)
- Fixed async modal submission handling

### 🔧 Technical

- TypeScript strict mode
- Webpack 5 build system
- pnpm workspace monorepo
- 129 comprehensive tests

---

## Future Releases

### [0.2.0] - Planned

- NPM package publication
- React integration example
- Vue integration example
- Angular integration example
- Enhanced error boundary handling

### [0.3.0] - Planned

- Production backend template
- PostgreSQL integration
- Cloud storage for screenshots
- Authentication system
- Rate limiting

### [1.0.0] - Planned

- Public stable release
- Complete documentation
- Video tutorials
- Dashboard UI
- Team features
- Analytics integration

---

## Development Notes

### Breaking Changes

None - this is the initial release.

### Deprecations

None - this is the initial release.

### Migration Guide

None - this is the initial release.

---

**Contributors:** ApexBridge Team
**Released:** October 3, 2025
**License:** MIT
