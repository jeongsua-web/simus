# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY web/package.json web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM dependencies AS builder
# .dockerignore only admits application source/config and public files.
# No DATABASE_URL, JWT keys, or other runtime secrets are needed to build.
COPY web/ ./
RUN node scripts/unity-artifact.mjs verify
# Generated Unity JavaScript is verified by hash, not linted as app source.
RUN npm run lint -- src next.config.ts && npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/unity-build.lock.json ./unity-build.lock.json
COPY --from=builder --chown=node:node /app/scripts/unity-artifact.mjs ./scripts/unity-artifact.mjs
RUN node scripts/unity-artifact.mjs verify
USER node
EXPOSE 3000
CMD ["node", "server.js"]
