# Changelog

All notable changes to the BugSpotter project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-10-03

### 🎉 Initial Release

This is the first working version of BugSpotter SDK with full capture, widget, and API functionality.

### ✨ Added

#### Core SDK
- **BugSpotter class** with singleton pattern
- **Automatic capture** of screenshots, console logs, network requests, and metadata
- **Configuration system** with API key and endpoint support
- **TypeScript support** with full type definitions
- **Webpack build** producing 29.2 KB minified bundle

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
- **29.2 KB** minified bundle size
- **< 100ms** load time
- **< 10 MB** memory footprint
- **~500ms** screenshot capture
- **Zero impact** when idle

### 🐛 Bug Fixes
- Fixed duplicate floating buttons (SDK auto-widget + manual widget)
- Fixed modal closing accidentally on outside click (UX improvement)
- Fixed port conflict (backend now uses 4000, not 3001)
- Fixed async modal submission (modal now waits for Promise resolution)
- Fixed test for modal close behavior (async test)

### 🔧 Developer Experience
- **TypeScript** strict mode enabled
- **ESLint** configuration
- **Prettier** formatting
- **pnpm** workspace monorepo
- **Hot reload** in development
- **Source maps** for debugging
- **Fast build** (~4 seconds)
- **Watch mode** for development

### 📦 Build System
- **Webpack 5** configuration
- **Production optimization** with minification
- **Tree shaking** for smaller bundles
- **TypeScript compilation** with ts-loader
- **ES modules** support

### 🚀 Deployment Ready
- Mock server ready for testing
- Production-ready SDK build
- Documentation complete
- All tests passing
- Example integration provided

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
