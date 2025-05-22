# Stage 1: Build
FROM node:23-alpine AS builder

WORKDIR /build

COPY package*.json ./

RUN npm ci --only=production --cache .npm --prefer-offline

COPY public/ public/
COPY server.js .

# Stage 2: App
FROM node:23-alpine AS app

ARG PORT=3000

ENV NODE_ENV=production
ENV HOME_FOLDER=/home/bbbuser

RUN addgroup -S bbbuser && \
    adduser -S bbbuser -G bbbuser

WORKDIR $HOME_FOLDER/app

RUN apk update && apk add --no-cache --virtual .build-deps \
    curl \
    rsvg-convert \
    poppler-utils \
    && rm -rf /var/cache/apk/*

COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/public ./public
COPY --from=builder /build/server.js ./

RUN chown -R bbbuser:bbbuser $HOME_FOLDER/app

HEALTHCHECK CMD \
    curl -f localhost:${PORT} || exit 1

USER bbbuser

EXPOSE ${PORT}

# Start the app
CMD [ "node", "server.js" ]
