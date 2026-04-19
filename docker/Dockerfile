# Stage 1: Build
FROM node:24-alpine AS builder

WORKDIR /build

COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: App
FROM node:24-alpine AS app

ARG PORT=3000

ENV NODE_ENV=production
ENV HOME_FOLDER=/home/bbbuser

RUN addgroup -S bbbuser && adduser -S bbbuser -G bbbuser

WORKDIR $HOME_FOLDER/app

RUN apk update && apk add --no-cache \
    curl=8.17.0-r1 \
    rsvg-convert=2.61.2-r0 \
    poppler-utils=25.12.0-r0

COPY public/ public/
COPY server.js .
COPY --from=builder /build/node_modules ./node_modules

RUN chown -R bbbuser:bbbuser $HOME_FOLDER/app

USER bbbuser
EXPOSE ${PORT}

HEALTHCHECK --interval=10s --timeout=2s --retries=3 \
    CMD curl -f http://localhost:${PORT} || exit 1

CMD ["node", "server.js"]