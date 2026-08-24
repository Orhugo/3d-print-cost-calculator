# =========================================================
#  Multi-stage build: compile Astro with Node and serve the
#  static result with nginx. The final image has NO Node and
#  no node_modules -> it stays tiny (ideal for the Pi).
# =========================================================

# --- Stage 1: build (discarded, never reaches the final image) ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY astro.config.mjs tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Stage 2: minimal runtime, only nginx serving dist/ ---
# alpine-slim drops modules we don't use (njs, geoip, xslt...).
FROM nginx:alpine-slim
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Health check using busybox's wget (already bundled in alpine)
HEALTHCHECK --interval=60s --timeout=3s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
