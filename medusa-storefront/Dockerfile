FROM node:20-alpine AS base
WORKDIR /app
RUN apk update && apk add --no-cache curl python3 make g++
RUN npm install -g bun

# ── Install dependencies ─────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ── Build ────────────────────────────────────────────────────
FROM deps AS builder
COPY . .

# Skip strict env check — publishable key is only available after first Medusa deploy
ENV SKIP_ENV_CHECK=true
# Disable Next.js telemetry prompt during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time public vars (baked into the JS bundle)
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_DEFAULT_REGION
# Publishable key: provide a safe ASCII placeholder during build.
# The REAL key is injected at runtime via the container environment.
# Using a placeholder prevents "Cannot convert to ByteString" from the Medusa SDK.
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_placeholder_replace_after_first_deploy

ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION

RUN bun run build

# ── Production image ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed to run
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8000

CMD ["node", "server.js"]
