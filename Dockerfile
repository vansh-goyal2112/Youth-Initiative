# syntax=docker/dockerfile:1

# ==========================================
# Dependencies
# ==========================================

FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci


# ==========================================
# Build
# ==========================================

FROM node:22-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules

COPY . .

#
# The application currently requires
# Firebase Admin credentials during
# `next build`.
#
# Mount .env.local as a Docker BuildKit
# secret instead of copying secrets into
# the Docker image.
#

RUN --mount=type=secret,id=env_local,target=/app/.env.local \
    npm run build


# ==========================================
# Production
# ==========================================

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs

RUN adduser \
    --system \
    --uid 1001 \
    nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next

RUN chown nextjs:nodejs .next

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/.next/standalone ./

COPY --from=builder \
    --chown=nextjs:nodejs \
    /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]