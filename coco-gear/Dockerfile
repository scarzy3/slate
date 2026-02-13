# ─── Stage 1: Build frontend ───
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY client ./client
RUN npm run build

# ─── Stage 2: Production ───
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY server ./server
COPY --from=builder /app/client/dist ./client/dist

# Create uploads directory
RUN mkdir -p /app/uploads

# SEC-009 fix: Run as non-root user
RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads

EXPOSE 3000

CMD ["node", "server/index.js"]
