FROM node:24-alpine@sha256:4eefa1bfce4197942661ef9148247d779ddf1bb0ee006d3294a467609de60724

ENV NODE_ENV=production
ENV PORT=3000
ENV HOME_FOLDER=/home/bbbuser

RUN addgroup -S -g 10001 bbbuser \
    && adduser -S -u 10001 -G bbbuser bbbuser \
    && mkdir -p "${HOME_FOLDER}/app" \
    && chown -R 10001:10001 "${HOME_FOLDER}"

WORKDIR $HOME_FOLDER/app

RUN apk add --no-cache \
    "curl=8.23.0-r0" \
    "rsvg-convert=2.62.3-r0" \
    "poppler-utils=25.12.0-r1"

COPY --chown=10001:10001 package*.json ./

USER 10001:10001

RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=10001:10001 public/ public/
COPY --chown=10001:10001 server.js ./

EXPOSE ${PORT}

HEALTHCHECK --interval=10s --timeout=2s --start-period=5s --retries=3 \
    CMD ["/bin/sh", "-c", "curl -f \"http://localhost:${PORT}/\" || exit 1"]

CMD ["node", "server.js"]
