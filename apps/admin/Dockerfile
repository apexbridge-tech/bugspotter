# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types ./packages/types

# Copy admin app files
COPY apps/admin/package.json ./apps/admin/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy admin source code
COPY apps/admin ./apps/admin

# Build the application
RUN pnpm --filter @bugspotter/admin build

# Production stage
FROM nginx:alpine

# Copy custom nginx config (use nginx.dev.conf for development builds)
ARG NGINX_CONFIG=nginx.conf
COPY apps/admin/${NGINX_CONFIG} /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html

# Install curl for healthcheck
RUN apk add --no-cache curl

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl --fail --silent --show-error http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
