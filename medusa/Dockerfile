FROM node:20-alpine AS base
WORKDIR /app

# System deps needed for native modules
RUN apk update && apk add --no-cache python3 make g++ curl

# Install Bun globally
RUN npm install -g bun

# ── Install dependencies ─────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ── Build ────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
# 'medusa build' compiles everything into .medusa/server/
RUN bun run build

# ── Production image ─────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only copy what medusa needs to run in production:
# - node_modules  → CLI + runtime deps
# - .medusa/      → compiled server (from 'medusa build')
# - package.json  → for 'bun run start' script lookup
# - static/       → file uploads served by medusa
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.medusa ./.medusa
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/static ./static

EXPOSE 9000 7001

# Diagnostic CMD — prints each step so we can see what fails in logs
CMD ["sh", "-c", "echo '=== Starting Medusa ===' && echo '=== DATABASE_URL prefix ===' && echo $DATABASE_URL | cut -c1-30 && echo '=== Running db:migrate ===' && node_modules/.bin/medusa db:migrate && echo '=== Migration done, starting server ===' && bun run start && echo '=== Server exited ==='"]
