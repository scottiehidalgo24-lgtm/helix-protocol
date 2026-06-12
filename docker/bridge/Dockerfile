# Bridge Docker image — Bun + Hono monorepo
FROM oven/bun:1.3 AS base
WORKDIR /app

# Dependencies
COPY package.json bun.lockb* ./
COPY packages/bridge/package.json packages/bridge/
RUN if [ -f packages/shared/package.json ]; then       cp packages/shared/package.json packages/shared/;     fi
RUN bun install --frozen-lockfile || bun install

# Source
COPY packages/bridge/src packages/bridge/src
COPY packages/bridge/tsconfig.json packages/bridge/
RUN if [ -d packages/shared/src ]; then       cp -r packages/shared/src packages/shared/src;     fi
COPY tsconfig.base.json ./

# Build typecheck
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
