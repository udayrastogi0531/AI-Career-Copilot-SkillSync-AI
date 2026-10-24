# syntax=docker/dockerfile:1
#
# Isolated LaTeX compiler image.
#
# Build (from the repository root):
#   docker build -t skillsync-latex-compiler ./latex-compiler
#
# The Tectonic bundle is warmed during the build so the running container can
# compile with --only-cached and no network access at all.

FROM debian:12-slim AS compiler

ARG TECTONIC_VERSION=0.17.0
ARG TECTONIC_SHA256=8533d07f9ccbd7a65824b9e0459041bca34af1eb33daba48f59215593753a3b7

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/tectonic.tar.gz \
      "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
    && echo "${TECTONIC_SHA256}  /tmp/tectonic.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/tectonic.tar.gz -C /usr/local/bin tectonic \
    && chmod 0755 /usr/local/bin/tectonic \
    && rm -f /tmp/tectonic.tar.gz

FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=8080 \
    TECTONIC_BIN=/usr/local/bin/tectonic \
    XDG_CACHE_HOME=/var/cache \
    TECTONIC_ONLY_CACHED=true \
    TIMEOUT_MS=20000 \
    MAX_SOURCE_BYTES=200000 \
    MAX_OUTPUT_BYTES=5242880 \
    MAX_CONCURRENCY=2

COPY --from=compiler /usr/local/bin/tectonic /usr/local/bin/tectonic

WORKDIR /app
COPY server.mjs verify.mjs ./

# Warm the package cache into the image. The runtime never needs the network.
RUN mkdir -p /var/cache \
    && printf '\\documentclass{article}\\begin{document}warm\\end{document}' > /tmp/warm.tex \
    && /usr/local/bin/tectonic --untrusted -o /tmp /tmp/warm.tex \
    && rm -f /tmp/warm.tex /tmp/warm.pdf /tmp/warm.log \
    && chown -R node:node /var/cache

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
