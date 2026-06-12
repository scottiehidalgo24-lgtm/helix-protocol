# Bridge Docker image — Bun + Hono monorepo
FROM oven/bun:1.3 AS base
WORKDIR /app

# Dependencies — copy all workspace package.json files
COPY package.json ./
COPY packages/bridge/package.json packages/bridge/
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
RUN bun install --frozen-lockfile || bun install

# Source
COPY packages/bridge/src packages/bridge/src
COPY packages/bridge/tsconfig.json packages/bridge/
COPY packages/shared/src packages/shared/src
COPY tsconfig.base.json ./

# Typecheck
WORKDIR /app/packages/bridge
RUN bun run lint

FROM oven/bun:1.3-slim AS runner
WORKDIR /app

COPY --from=base /app/node_modules /app/node_modules
COPY --from=base /app/packages /app/packages
COPY --from=base /app/package.json /app/
COPY --from=base /app/tsconfig.base.json /app/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER bun

WORKDIR /app/packages/bridge
CMD ["bun", "run", "src/index.ts"]
