# BugSpotter Admin Panel

Professional web-based admin control panel for managing BugSpotter self-hosted instances.

## Features

### 🚀 Setup Wizard

- One-time initialization flow for new installations
- Create admin account
- Configure storage (MinIO/AWS S3)
- Test storage connections before saving
- Set instance name and URL

### ⚙️ Settings Management

- **Instance Configuration**: Name, URL, support email
- **Storage Settings**: S3/MinIO credentials, bucket configuration
- **Security Settings**: JWT token expiry, rate limits, CORS origins
- **Retention Policies**: Data retention days, max reports per project
- **Feature Flags**: Toggle session replay on/off

### 🐛 Bug Reports Management

- **Browse & Filter**: List all bug reports with advanced filtering (project, status, priority, date range)
- **Detailed View**: Full bug report details with metadata, screenshots, console logs
- **Session Replay**: View rrweb session recordings with timeline controls
- **Status Management**: Update bug status (open → in_progress → resolved → closed)
- **Priority Control**: Set priority levels (low, medium, high, critical)
- **Network Analysis**: View network requests with timing and payload details
- **Browser Metadata**: Inspect user agent, viewport, and environment info
- **Bulk Operations**: Delete multiple reports at once

###  Project Management

- List all projects with API keys
- Create new projects
- Regenerate API keys
- Delete projects (with confirmation)
- View project statistics (report count, creation date)

### 🏥 System Health

- Real-time health monitoring (auto-refresh every 30s)
- Database, Redis, and Storage status
- System metrics (disk space, worker queue depth, uptime)
- Color-coded status indicators

## Tech Stack

- **Frontend**: React 18.3.1 + TypeScript
- **Build Tool**: Vite 5.2.8
- **Styling**: Tailwind CSS 3.4.3
- **UI Components**: Custom components with Lucide React 0.363.0 icons
- **State Management**: TanStack Query 5.28.4 (React Query)
- **HTTP Client**: Axios 1.6.8 with auto token refresh
- **Routing**: React Router 6.22.3
- **Session Replay**: rrweb-player 1.0.0-alpha.4
- **Notifications**: Sonner 1.4.41 toast library
- **Testing**: Vitest 3.2.4 + Playwright 1.56.0 + Testing Library
- **Production**: Nginx Alpine for static file serving

## Development

### Prerequisites

- Node.js 20+
- pnpm 8+

### Install Dependencies

```bash
cd apps/admin
pnpm install
```

### Development Server

```bash
pnpm dev
```

The dev server runs on `http://localhost:3001` with API proxy to `http://localhost:3000`.

### Build

```bash
pnpm build
```

Output in `dist/` directory.

### Code Quality

```bash
pnpm lint    # ESLint
pnpm format  # Prettier
```

## Docker Deployment

### Build Image

```bash
# Production build (strict CSP)
docker build -t bugspotter-admin:latest apps/admin

# Development build (relaxed CSP for Vite HMR)
docker build -t bugspotter-admin:dev \
  --build-arg NGINX_CONFIG=nginx.dev.conf \
  apps/admin
```

### Run Container

```bash
docker run -d \
  --name bugspotter-admin \
  -p 3001:80 \
  -e VITE_API_URL=/api \
  bugspotter-admin:latest
```

### With Docker Compose

```bash
# Production (default - strict CSP)
docker-compose up -d admin

# Development (relaxed CSP for Vite HMR)
ADMIN_NGINX_CONFIG=nginx.dev.conf docker-compose up -d admin
```

Access at `http://localhost:3001`

## Configuration

### Environment Variables

- `VITE_API_URL`: Backend API base URL (default: `/api` for proxying)
- `ADMIN_NGINX_CONFIG`: Nginx config file (default: `nginx.conf`, dev: `nginx.dev.conf`)

### Nginx Configuration

Two configurations available:

**Production (`nginx.conf` - default)**:

- ✅ Strict CSP - No `unsafe-inline`, no `unsafe-eval`
- ✅ HTTPS enforcement - `upgrade-insecure-requests`
- ✅ External scripts blocked
- SPA routing, API proxy, static caching, gzip, security headers

**Development (`nginx.dev.conf`)**:

- ⚠️ Relaxed CSP - Allows `unsafe-inline`, `unsafe-eval` for Vite HMR
- ⚠️ WebSocket support for hot reloading
- Same features as production config

### Content Security Policy (CSP)

| Feature         | Production  | Development                  |
| --------------- | ----------- | ---------------------------- |
| Inline scripts  | ❌ Blocked  | ✅ Allowed (`unsafe-inline`) |
| Eval            | ❌ Blocked  | ✅ Allowed (`unsafe-eval`)   |
| External images | ❌ Blocked  | ❌ Blocked                   |
| WebSocket       | ❌ Blocked  | ✅ Allowed (HMR)             |
| HTTPS upgrade   | ✅ Enforced | ❌ Disabled                  |

**Why separate configs?**

- Vite dev builds use inline scripts for HMR (hot module replacement)
- Production Vite builds use external hashed scripts (no inline needed)
- Strict CSP in production prevents XSS attacks

## API Integration

### Authentication

The admin panel uses JWT-based authentication with automatic token refresh:

1. User logs in with email/password
2. Receives `access_token` (1h) in response body, `refresh_token` (7d) in httpOnly cookie
3. **Access token stored in memory** (React state) - XSS protection
4. **Refresh token stored in httpOnly cookie** (backend-managed) - Maximum security
5. API client uses accessor functions to get tokens from auth context
6. Automatically refreshes expired tokens via interceptor using httpOnly cookie
7. On refresh failure, clears all tokens and redirects to login

**Security Note**: Refresh tokens are never exposed to JavaScript. The backend sets them as httpOnly cookies, preventing XSS token theft entirely.

### API Endpoints Used

**Authentication:**
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh` - Token refresh

**Setup:**
- `GET /api/v1/setup/status` - Check if system initialized
- `POST /api/v1/setup/initialize` - Initialize system
- `POST /api/v1/setup/test-storage` - Test storage connection

**Admin:**
- `GET /api/v1/admin/health` - System health status
- `GET /api/v1/admin/settings` - Get instance settings
- `PATCH /api/v1/admin/settings` - Update settings

**Projects:**
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `DELETE /api/v1/projects/:id` - Delete project
- `POST /api/v1/projects/:id/regenerate-key` - Regenerate API key

**Bug Reports:**
- `GET /api/v1/reports` - List bug reports (with filters, pagination, sorting)
- `GET /api/v1/reports/:id` - Get bug report by ID
- `PATCH /api/v1/reports/:id` - Update bug report (status, priority, description)
- `DELETE /api/v1/reports/:id` - Delete bug report
- `POST /api/v1/reports/bulk-delete` - Bulk delete bug reports
- `GET /api/v1/reports/:id/sessions` - Get session replays for bug report

## Project Structure

```
apps/admin/
├── src/
│   ├── components/
│   │   ├── ui/                           # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── badge.tsx
│   │   │   └── spinner.tsx
│   │   ├── settings/                     # Settings feature components
│   │   │   ├── settings-section.tsx      # Reusable settings wrapper
│   │   │   ├── instance-settings.tsx     # Instance config section
│   │   │   ├── storage-settings.tsx      # Storage config section
│   │   │   ├── security-settings.tsx     # Security settings section
│   │   │   ├── retention-settings.tsx    # Retention policy section
│   │   │   └── feature-settings.tsx      # Feature flags section
│   │   ├── bug-reports/                  # Bug reports feature components
│   │   │   ├── bug-report-list.tsx             # Bug report table
│   │   │   ├── bug-report-detail.tsx           # Full bug report view
│   │   │   ├── bug-report-filters.tsx          # Filter controls
│   │   │   ├── bug-report-status-controls.tsx  # Status/priority UI
│   │   │   ├── bug-report-browser-metadata.tsx # Browser info display
│   │   │   ├── bug-report-console-logs.tsx     # Console logs viewer
│   │   │   ├── bug-report-network-table.tsx    # Network requests table
│   │   │   └── session-replay-player.tsx       # rrweb player wrapper
│   │   ├── dashboard-layout.tsx
│   │   └── protected-route.tsx
│   ├── contexts/
│   │   └── auth-context.tsx              # Auth state (memory-only tokens)
│   ├── lib/
│   │   └── api-client.ts                 # Axios with token accessors
│   ├── pages/
│   │   ├── bug-reports.tsx               # Bug reports management (NEW)
│   │   ├── health.tsx                    # System health dashboard
│   │   ├── login.tsx                     # Login page
│   │   ├── projects.tsx                  # Project management
│   │   ├── settings.tsx                  # Settings page (refactored)
│   │   └── setup.tsx                     # Setup wizard
│   ├── services/
│   │   └── api.ts                        # API service functions
│   ├── types/
│   │   └── index.ts                      # TypeScript interfaces
│   ├── tests/
│   │   ├── lib/
│   │   │   └── api-client.test.ts
│   │   └── pages/
│   │       ├── login.test.tsx
│   │       ├── setup.test.tsx
│   │       └── health.test.tsx
│   ├── App.tsx                           # Root component with routing
│   ├── index.css                         # Tailwind styles
│   └── main.tsx                          # React entry point
├── Dockerfile                            # Multi-stage build
├── nginx.conf                            # Production nginx with strict CSP
├── nginx.dev.conf                        # Development nginx with relaxed CSP
├── SECURITY.md                           # Security documentation
├── REACT_PATTERNS.md                     # React best practices
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

## Security

### Authentication & Token Storage

**⚠️ IMPORTANT**: Tokens are stored securely to prevent XSS attacks:

- **Access Tokens**: Stored in **memory only** (React state) - NOT in localStorage
- **Refresh Tokens**: Stored in **httpOnly cookies** (backend-managed) - NOT accessible to JavaScript
- **User Data**: Stored in sessionStorage (non-sensitive profile data only)

**Why this matters**: `localStorage` is vulnerable to XSS attacks. Any malicious script can steal tokens. Memory-only storage provides strong XSS protection.

**Token Accessor Pattern**: The API client uses accessor functions to get tokens from auth context, keeping auth logic decoupled from HTTP client.

### Security Headers

- **Content Security Policy (CSP)**: Modern XSS protection (replaces deprecated X-XSS-Protection)
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Referrer-Policy**: Controls referrer information
- **HTTPS Ready**: Nginx configured for TLS termination

### Other Security Measures

- **JWT Authentication**: All admin routes require valid JWT token
- **Token Refresh**: Automatic token refresh on expiry
- **Input Validation**: Client-side form validation with min/max constraints
- **API Key Masking**: Sensitive data handled securely
- **Error Handling**: Distinguishes expected vs unexpected errors, logs appropriately

## Browser Support

- Chrome 60+ (ES2017)
- Firefox 55+ (ES2017)
- Safari 11+ (ES2017)
- Edge 79+ (Chromium-based)

**Note**: Modern JavaScript features (async/await, Object.entries, etc.) are used without transpilation.

## Code Quality & Best Practices

### React Patterns (See REACT_PATTERNS.md for details)

**Critical Anti-Patterns to Avoid:**

1. ❌ **Never setState during render** - Use `useEffect` for side effects
2. ❌ **Don't create functions in JSX** - Use `useCallback` to memoize
3. ❌ **Don't silently ignore errors** - Always log and handle appropriately
4. ❌ **Don't forget form reset after mutations** - Sync with server values

**Best Practices:**

- ✅ Memoize callbacks with `useCallback`
- ✅ Use `useEffect` for side effects
- ✅ Extract large components into smaller, focused ones
- ✅ Validate number inputs with min/max constraints
- ✅ Reset forms to server values after successful updates

### Component Architecture

### Settings Page Refactoring** (250+ lines → 115 lines + 6 focused components):

- Components extracted into `components/settings/` directory
- Each section is self-contained and testable
- Eliminated ~200 lines of duplicated Card/CardContent boilerplate
- Improved maintainability through Single Responsibility Principle

**Bug Reports Feature** (New in 2025):

- 8 specialized components in `components/bug-reports/`
- Full CRUD operations with filtering, sorting, pagination
- Session replay integration with rrweb-player
- Network analysis and console log viewers
- Responsive design with mobile support

### Security Checklist

Before deploying admin panel changes:

- [ ] No tokens in `localStorage` (use memory or `sessionStorage`)
- [ ] Errors logged appropriately (not silently ignored)
- [ ] Network errors show user feedback
- [ ] No setState during render
- [ ] Callbacks memoized where appropriate
- [ ] Forms reset after successful mutations
- [ ] Input validation in place (min/max, type checking)
- [ ] TypeScript compiles without errors (`pnpm build`)
- [ ] Tests pass (`pnpm test`)
- [ ] CSP headers don't block functionality
- [ ] Vite production build succeeds without warnings

## Troubleshooting

### Admin panel shows blank page

Check browser console for errors. Common issues:

- API URL not configured correctly
- CORS issues (ensure admin domain in `CORS_ORIGINS`)
- CSP headers blocking resources (check nginx.conf)

### Cannot login

- Verify backend is running and accessible
- Check admin user exists in database
- Verify JWT_SECRET is set correctly
- Check browser console for authentication errors

### Setup wizard redirects to login

System already initialized. Admin user already exists.

### "Unable to connect to server" error

Network connectivity issue. Check:

1. Backend is running at correct URL
2. Admin panel can reach backend (test with `curl`)
3. CORS origins include admin panel URL
4. Firewall/network policies allow connection

### Tokens not persisting across page refresh

**This is expected behavior** - Access tokens are stored in memory for security. On page reload:

- Access token is cleared (requires automatic token refresh)
- Refresh token in httpOnly cookie is automatically sent to backend
- Backend validates cookie and issues new access token
- User data restored from sessionStorage

If automatic refresh fails (invalid/expired cookie), user is redirected to login (expected).

### Settings changes not saving

Check:

1. Form validation passes (check console for errors)
2. API returns 200 OK (check Network tab)
3. Form resets to server values after success
4. No React errors in console (setState during render, etc.)

### Bug reports not loading or filtering not working

Check:

1. Backend API is running and accessible
2. Projects exist in the database
3. Bug reports exist for selected filters
4. Network tab shows successful API responses
5. Console shows no CORS or authentication errors

### Session replay player not working

Check:

1. Session replay is enabled in settings (feature flags)
2. Bug report has associated session data
3. rrweb-player CSS is loaded correctly
4. Browser console shows no errors from player
5. Storage service is accessible and serving replay files

## Common Development Tasks

### Adding a New Page

1. Create page component in `src/pages/new-page.tsx`
2. Add route in `src/App.tsx`
3. Add navigation link in `src/components/dashboard-layout.tsx`
4. Create API service functions in `src/services/api.ts`
5. Add TypeScript types in `src/types/index.ts`
6. Write tests in `src/tests/pages/new-page.test.tsx`

### Adding a New API Endpoint

1. Add service function in `src/services/api.ts`
2. Add TypeScript types in `src/types/index.ts`
3. Use TanStack Query hooks in components:
   - `useQuery` for GET requests
   - `useMutation` for POST/PATCH/DELETE
4. Handle loading/error states
5. Add toast notifications for success/error feedback

## License

MIT
