# @bugspotter/api

Production-ready API server for BugSpotter with Supabase integration.

## Quick Start

### 1. Install Dependencies

```bash
cd packages/api
pnpm install
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your Supabase credentials
```

### 3. Run Development Server

```bash
pnpm dev
```

Server starts on `http://localhost:4000`

## Project Structure

```
api/
├── src/
│   ├── server.ts              # Main server file
│   ├── config/
│   │   └── supabase.ts        # Supabase client
│   ├── routes/                # API routes
│   ├── controllers/           # Request handlers
│   ├── services/              # Business logic
│   ├── middleware/            # Custom middleware
│   └── types/                 # TypeScript types
├── dist/                      # Build output
├── .env.example               # Environment template
├── tsconfig.json              # TypeScript config
└── package.json
```

## Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm test` - Run tests (TODO)

## Environment Variables

Required variables in `.env`:

```env
# Server
PORT=4000
NODE_ENV=development

# Supabase
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Keys
VALID_API_KEYS=demo-api-key-12345,another-key

# CORS
CORS_ORIGIN=http://localhost:3000
```

## API Endpoints

### Health Check

```
GET /health
```

Returns server status.

### Bug Reports (Coming Soon)

```
POST /api/bugs
GET /api/bugs
GET /api/bugs/:id
```

## Technology Stack

- **TypeScript** - Type-safe development
- **Express** - Web framework
- **Supabase** - Database and authentication
- **tsx** - Fast TypeScript execution
- **CORS** - Cross-origin support
- **dotenv** - Environment management

## Development

### Adding New Routes

1. Create route file in `src/routes/`
2. Create controller in `src/controllers/`
3. Create service in `src/services/`
4. Import route in `src/server.ts`

Example:

```typescript
// src/routes/bugs.ts
import { Router } from 'express';
import { createBug } from '../controllers/bugController';

const router = Router();
router.post('/', createBug);

export default router;
```

### Database Schema

See `docs/DATABASE_SCHEMA.md` for Supabase table definitions.

## Production Deployment

1. Build the project:

```bash
pnpm build
```

2. Set production environment variables

3. Start server:

```bash
NODE_ENV=production pnpm start
```

## License

MIT
