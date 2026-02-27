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
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
COPY . .
# 'medusa build' compiles the server into .medusa/server and admin into .medusa/admin
RUN bun run build

# ── Production image ─────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.medusa ./.medusa
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/static ./static
COPY --from=builder /app/medusa-config.ts ./medusa-config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Add entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 9000 7001

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]


