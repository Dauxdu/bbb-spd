# Stage 1: Build
FROM node:23-alpine AS builder

WORKDIR /build

COPY package*.json ./

RUN npm ci --only=production --cache .npm --prefer-offline

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

COPY public/ public/
COPY server.js .
COPY --from=builder /build/node_modules ./node_modules

RUN chown -R bbbuser:bbbuser $HOME_FOLDER/app

USER bbbuser

EXPOSE ${PORT}

# Start the app
CMD [ "node", "server.js" ]
