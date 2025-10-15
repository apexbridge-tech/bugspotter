# ============================================================================
# BugSpotter Backend - Multi-Stage Docker Build
# ============================================================================
# Stage 1: Dependencies - Install all dependencies including dev dependencies
# Stage 2: Builder - Build TypeScript code
# Stage 3: Production - Minimal runtime image with only production dependencies
# ============================================================================

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:20-alpine AS dependencies

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for all packages
COPY packages/backend/package.json ./packages/backend/
COPY packages/types/package.json ./packages/types/

# Install all dependencies (including dev dependencies for build)
RUN pnpm install --frozen-lockfile

# ============================================================================
# Stage 2: Builder
# ============================================================================
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@9.0.0

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages

# Copy source code and TypeScript configurations
COPY tsconfig.json ./
COPY packages/backend/tsconfig.json ./packages/backend/
COPY packages/backend/src ./packages/backend/src
COPY packages/types/tsconfig.json ./packages/types/
COPY packages/types/src ./packages/types/src

# Build both packages (types first, then backend)
RUN pnpm --filter @bugspotter/types build
RUN pnpm --filter @bugspotter/backend build

# ============================================================================
# Stage 3: Production
# ============================================================================
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm@9.0.0

# Install dumb-init for proper signal handling, curl for health checks, netcat for wait-for scripts
RUN apk add --no-cache dumb-init curl netcat-openbsd

# Create non-root user
RUN addgroup -g 1001 -S bugspotter && \
    adduser -S -u 1001 -G bugspotter bugspotter

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files
COPY packages/backend/package.json ./packages/backend/
COPY packages/types/package.json ./packages/types/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder stage (includes SQL files from build step)
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Copy entrypoint script
COPY packages/backend/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create data directory for local storage (if used)
RUN mkdir -p /app/data/uploads && \
    chown -R bugspotter:bugspotter /app

# Switch to non-root user
USER bugspotter

# Expose API port
EXPOSE 3000

# Health check - uses /ready endpoint to verify database connectivity
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/ready || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command (can be overridden to 'worker')
CMD ["docker-entrypoint.sh", "api"]
