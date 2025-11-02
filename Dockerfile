# Multi-stage Dockerfile for building and running the Kore-back TypeScript app
# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install app dependencies
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy rest of sources
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
# COPY .env* ./

# Generate Prisma client (if prisma is used) and build TS
RUN npx prisma generate
RUN npm run build

# Remove dev dependencies to keep node_modules small
RUN npm prune --production

# Runtime stage
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy production node_modules and built files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

EXPOSE 3000

CMD ["node", "dist/server.js"]
