# =============================================================================
# Stage 1: Builder - Install dependencies and build the monorepo
# =============================================================================
FROM node:22-slim AS builder

# Install system dependencies needed for native modules
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# Install pnpm (use version 9 which matches lockfileVersion 9.0)
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy the entire monorepo
COPY . .

# Install all dependencies
# The onlyBuiltDependencies in pnpm-workspace.yaml controls which packages can run build scripts.
# We use --config.confirmModulesPurge=false to avoid interactive prompts.
RUN pnpm install --frozen-lockfile --config.confirmModulesPurge=false || \
    pnpm install --no-frozen-lockfile --config.confirmModulesPurge=false

# Build the entire project (typecheck + all packages)
ENV PORT=5173
ENV BASE_PATH=/
ENV NODE_ENV=production
RUN pnpm run build

# =============================================================================
# Stage 2: Production - Minimal image with built artifacts
# =============================================================================
FROM node:22-slim AS production

WORKDIR /app

# Copy the built API server
COPY --from=builder /app/artifacts/api-server/dist ./dist

# Copy node_modules for externalized packages (pg, @google-cloud/storage, etc.)
COPY --from=builder /app/node_modules ./node_modules

# Copy the built frontend static files
COPY --from=builder /app/artifacts/creatools/dist/public ./public

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start the API server
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
