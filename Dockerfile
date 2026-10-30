# Production Multi-Stage Dockerfile for Ultra Download Hub
# Step 1: Build Frontend and Server
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build Vite frontend
RUN npm run build

# Step 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime tools
RUN apk add --no-cache curl tzdata

COPY package*.json ./
RUN npm ci --only=production

# Copy built assets and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Persistent storage mount point
RUN mkdir -p /app/storage/incomplete /app/storage/completed /app/storage/temp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/system/stats || exit 1

CMD ["npx", "tsx", "server.ts"]
