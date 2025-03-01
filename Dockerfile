# Stage 1: Build
FROM node:23-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production --cache .npm --prefer-offline

COPY . .

# Stage 2: Production
FROM node:23-alpine AS production

RUN apk update && apk add --no-cache \
    curl \
    rsvg-convert \
    poppler-utils

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./

# Environments
EXPOSE 3000
ENV NODE_ENV production
ENV PORT=3000

HEALTHCHECK \
    CMD curl -f http://localhost:3000/ || exit 0

# Start the app
CMD [ "node", "server.js" ]
