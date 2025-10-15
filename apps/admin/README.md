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
docker build -t bugspotter-admin:latest apps/admin
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

The admin panel is included in the main `docker-compose.yml`:

```bash
docker-compose up -d admin
```

Access at `http://localhost:3001`

## Configuration

### Environment Variables

- `VITE_API_URL`: Backend API base URL (default: `/api` for proxying)

### Nginx Configuration

The production build uses Nginx with:
- SPA routing (fallback to index.html)
- API proxy to backend service
- Static asset caching (1 year)
- Gzip compression
- Security headers (X-Frame-Options, CSP, etc.)

## API Integration

### Authentication

The admin panel uses JWT-based authentication with automatic token refresh:

1. User logs in with email/password
2. Receives `access_token` (1h) and `refresh_token` (7d)
3. Tokens stored in `localStorage`
4. API client automatically refreshes expired tokens
5. On refresh failure, redirects to login

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
│   │   ├── ui/              # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── input.tsx
│   │   ├── dashboard-layout.tsx
│   │   └── protected-route.tsx
│   ├── contexts/
│   │   └── auth-context.tsx # Auth state management
│   ├── lib/
│   │   └── api-client.ts    # Axios instance with interceptors
│   ├── pages/
│   │   ├── health.tsx       # System health dashboard
│   │   ├── login.tsx        # Login page
│   │   ├── projects.tsx     # Project management
│   │   ├── settings.tsx     # Settings page
│   │   └── setup.tsx        # Setup wizard
│   ├── services/
│   │   └── api.ts           # API service functions
│   ├── types/
│   │   └── index.ts         # TypeScript interfaces
│   ├── App.tsx              # Root component with routing
│   ├── index.css            # Tailwind styles
│   └── main.tsx             # React entry point
├── Dockerfile               # Multi-stage build
├── nginx.conf               # Nginx configuration
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Security

- **JWT Authentication**: All admin routes require valid JWT token
- **Token Refresh**: Automatic token refresh on expiry
- **HTTPS Ready**: Nginx configured for TLS termination
- **CSP Headers**: Content Security Policy headers enabled
- **XSS Protection**: X-XSS-Protection and X-Content-Type-Options
- **Input Validation**: Client-side form validation
- **API Key Masking**: Sensitive data handled securely

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Troubleshooting

### Admin panel shows blank page

Check browser console for errors. Common issues:
- API URL not configured correctly
- CORS issues (ensure admin domain in `CORS_ORIGINS`)

### Cannot login

- Verify backend is running and accessible
- Check admin user exists in database
- Verify JWT_SECRET is set correctly

### Setup wizard redirects to login

System already initialized. Admin user already exists.

### API calls failing

Check:
1. Backend is running at correct URL
2. Admin panel can reach backend (network connectivity)
3. CORS origins include admin panel URL

## License

MIT
