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

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.medusa ./.medusa
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/static ./static
# The Medusa CLI (db:migrate + start) always looks for medusa-config
# at the project root. It uses @cspotcode/source-map-support to load
# .ts files at runtime. tsconfig.json is needed for path resolution.
COPY --from=builder /app/medusa-config.ts ./medusa-config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 9000 7001

CMD ["sh", "-c", "set -e && node_modules/.bin/medusa db:migrate && bun run start"]
