FROM node:22-alpine AS base

FROM base AS builder
WORKDIR /app

# Install dependencies
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Copy workspace files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/ai/package.json ./packages/ai/
COPY packages/shared/package.json ./packages/shared/
COPY tooling ./tooling

RUN yarn install --immutable

# Copy source code
COPY apps/server ./apps/server
COPY packages ./packages

# Build
RUN yarn workspace @home/db build
RUN yarn workspace @home/shared build
RUN yarn workspace @home/ai build
RUN yarn workspace @home/server build

FROM base AS runner
WORKDIR /app

RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Copy built files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/.yarnrc.yml ./
COPY --from=builder /app/.yarn ./.yarn
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/tooling ./tooling

RUN yarn workspaces focus @home/server --production

ENV NODE_ENV=production
ENV PORT=8080
ENV NODE_OPTIONS=--experimental-specifier-resolution=node

EXPOSE 8080

CMD ["node", "apps/server/dist/index.js"]
