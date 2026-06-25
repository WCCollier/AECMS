# ============================================================================
# Multi-stage Dockerfile for Next.js Frontend
# ============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Development
# -----------------------------------------------------------------------------
FROM node:20-alpine AS development

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json .npmrc ./
RUN npm ci

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Development command (overridden by docker-compose)
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Stage 2: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies
COPY package*.json .npmrc ./
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 3: Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build-time backend URL (must be known at next build time for rewrites + NEXT_PUBLIC_ vars)
ARG BACKEND_URL=http://localhost:4000
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ENV BACKEND_URL=$BACKEND_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY

# Build application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 4: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Production command
CMD ["node", "server.js"]
