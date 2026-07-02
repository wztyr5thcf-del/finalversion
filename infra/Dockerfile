# =============================================================================
# Stage 1: Builder - Install dependencies and build the monorepo
# =============================================================================
FROM node:22-slim AS builder

# Install system dependencies needed for native modules
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy the entire monorepo
COPY . .

# Install all dependencies (pnpm)
RUN pnpm install --no-frozen-lockfile --config.confirmModulesPurge=false

# Build the entire project (typecheck + all packages)
ENV PORT=5173
ENV BASE_PATH=/
ENV NODE_ENV=production
RUN pnpm run build

# =============================================================================
# Stage 2: Runtime deps - Install externalized packages with npm (flat layout)
# =============================================================================
FROM node:22-slim AS deps

WORKDIR /deps

# Copy the runtime deps manifest (subset of api-server deps that esbuild externalizes)
COPY infra/runtime-deps.json ./package.json

# Install with npm to get a flat node_modules (no pnpm symlink magic)
RUN npm install --omit=dev --ignore-scripts

# =============================================================================
# Stage 3: Production - Minimal image with built artifacts
# =============================================================================
FROM node:22-slim AS production

WORKDIR /app

# Copy the built API server bundle
COPY --from=builder /app/artifacts/api-server/dist ./dist

# Copy flat node_modules with all externalized runtime packages
COPY --from=deps /deps/node_modules ./node_modules

# Copy the built frontend static files
COPY --from=builder /app/artifacts/creatools/dist/public ./public

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start the API server
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
