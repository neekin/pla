# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-alpine AS builder

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

WORKDIR /app

# Copy workspace manifest and lockfile first (better layer caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all dependencies (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY server ./server
COPY client ./client

# Build client → output goes to server/static (configured in vite.config.ts)
RUN pnpm --filter client build

# Build NestJS server
RUN pnpm --filter server build

# ============================================================
# Stage 2: Production image
# ============================================================
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

WORKDIR /app

# Copy workspace manifest and lockfile for production install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY server/package.json ./server/

# Install only server production dependencies
RUN pnpm --filter server install --prod --frozen-lockfile

# Copy compiled server code
COPY --from=builder /app/server/dist ./server/dist

# Copy built frontend static files
COPY --from=builder /app/server/static ./server/static

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server/dist/main.js"]
