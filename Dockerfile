# syntax=docker/dockerfile:1
# Multi-stage build: dependencies + Next.js build, then a slim non-root runtime
# that keeps the Prisma CLI and tsx for migrations and idempotent seeding.

FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build \
  && npm prune --omit=dev \
  && rm -rf .next/cache

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:./data/app.db
COPY --from=build --chown=node:node /app/package.json /app/next.config.mjs ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/scripts/container-entrypoint.sh /app/scripts/backup-db.mjs ./scripts/
# The named volume is mounted here; creating it as `node` makes a fresh volume writable.
RUN mkdir -p /app/prisma/data && chown node:node /app/prisma/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/parties').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./scripts/container-entrypoint.sh"]
