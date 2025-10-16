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

### 📦 Project Management

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

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Lucide icons
- **State Management**: TanStack Query (React Query)
- **HTTP Client**: Axios with auto token refresh
- **Routing**: React Router v6
- **Notifications**: Sonner toast library
- **Production**: Nginx for static file serving

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

| Feature | Production | Development |
|---------|-----------|-------------|
| Inline scripts | ❌ Blocked | ✅ Allowed (`unsafe-inline`) |
| Eval | ❌ Blocked | ✅ Allowed (`unsafe-eval`) |
| External images | ❌ Blocked | ❌ Blocked |
| WebSocket | ❌ Blocked | ✅ Allowed (HMR) |
| HTTPS upgrade | ✅ Enforced | ❌ Disabled |

**Why separate configs?**
- Vite dev builds use inline scripts for HMR (hot module replacement)
- Production Vite builds use external hashed scripts (no inline needed)
- Strict CSP in production prevents XSS attacks

## API Integration

### Authentication

The admin panel uses JWT-based authentication with automatic token refresh:

1. User logs in with email/password
2. Receives `access_token` (1h) and `refresh_token` (7d)
3. **Access token stored in memory** (React state) - XSS protection
4. **Refresh token stored in sessionStorage** (temporary, until backend implements httpOnly cookies)
5. API client uses accessor functions to get tokens from auth context
6. Automatically refreshes expired tokens via interceptor
7. On refresh failure, clears all tokens and redirects to login

**Security Note**: For maximum security, backend should set refresh token in httpOnly cookie instead of sending in response body. This is documented in `apps/admin/SECURITY.md`.

### API Endpoints Used

- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `GET /api/setup/status` - Check if system initialized
- `POST /api/setup/initialize` - Initialize system
- `POST /api/setup/test-storage` - Test storage connection
- `GET /api/admin/health` - System health status
- `GET /api/admin/settings` - Get instance settings
- `PATCH /api/admin/settings` - Update settings
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/regenerate-key` - Regenerate API key

## Project Structure

```
apps/admin/
├── src/
│   ├── components/
│   │   ├── ui/                      # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── input.tsx
│   │   ├── settings/                # Feature-specific components (NEW)
│   │   │   ├── settings-section.tsx      # Reusable settings wrapper
│   │   │   ├── instance-settings.tsx     # Instance config section
│   │   │   ├── storage-settings.tsx      # Storage config section
│   │   │   ├── security-settings.tsx     # Security settings section
│   │   │   ├── retention-settings.tsx    # Retention policy section
│   │   │   └── feature-settings.tsx      # Feature flags section
│   │   ├── dashboard-layout.tsx
│   │   └── protected-route.tsx
│   ├── contexts/
│   │   └── auth-context.tsx         # Auth state (memory-only tokens)
│   ├── lib/
│   │   └── api-client.ts            # Axios with token accessors
│   ├── pages/
│   │   ├── health.tsx               # System health dashboard
│   │   ├── login.tsx                # Login page
│   │   ├── projects.tsx             # Project management
│   │   ├── settings.tsx             # Settings page (refactored)
│   │   └── setup.tsx                # Setup wizard
│   ├── services/
│   │   └── api.ts                   # API service functions
│   ├── types/
│   │   └── index.ts                 # TypeScript interfaces
│   ├── App.tsx                      # Root component with routing
│   ├── index.css                    # Tailwind styles
│   └── main.tsx                     # React entry point
├── Dockerfile                       # Multi-stage build
├── nginx.conf                       # Nginx with CSP headers
├── SECURITY.md                      # Security documentation (NEW)
├── REACT_PATTERNS.md                # React best practices (NEW)
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Security

### Authentication & Token Storage

**⚠️ IMPORTANT**: Tokens are now stored securely to prevent XSS attacks:

- **Access Tokens**: Stored in **memory only** (React state) - NOT in localStorage
- **Refresh Tokens**: Stored in **sessionStorage** (temporary) - cleared on tab close
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

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

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

**Settings Page Refactoring** (250+ lines → 115 lines + 6 focused components):

- Components extracted into `components/settings/` directory
- Each section is self-contained and testable
- Eliminated ~200 lines of duplicated Card/CardContent boilerplate
- Improved maintainability through Single Responsibility Principle

### Security Checklist

Before deploying admin panel changes:

- [ ] No tokens in `localStorage` (use memory or `sessionStorage`)
- [ ] Errors logged appropriately (not silently ignored)
- [ ] Network errors show user feedback
- [ ] No setState during render
- [ ] Callbacks memoized where appropriate
- [ ] Forms reset after successful mutations
- [ ] Input validation in place (min/max, type checking)
- [ ] TypeScript compiles without errors
- [ ] CSP headers don't block functionality

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

- Access token is cleared (requires re-login or token refresh)
- Refresh token in sessionStorage should trigger automatic token refresh
- User data restored from sessionStorage

If automatic refresh fails, user is redirected to login (expected).

### Settings changes not saving

Check:

1. Form validation passes (check console for errors)
2. API returns 200 OK (check Network tab)
3. Form resets to server values after success
4. No React errors in console (setState during render, etc.)

## License

MIT
