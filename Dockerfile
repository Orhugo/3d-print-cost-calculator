# =========================================================
#  Build multi-stage: compila Astro con Node y sirve el
#  resultado estático con nginx. La imagen final NO lleva
#  Node ni node_modules -> sigue siendo minúscula (ideal Pi).
# =========================================================

# --- Etapa 1: build (se descarta, no llega a la imagen final) ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY astro.config.mjs tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Etapa 2: runtime mínimo, solo nginx sirviendo dist/ ---
# alpine-slim quita módulos que no usamos (njs, geoip, xslt...).
FROM nginx:alpine-slim
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Chequeo de salud usando el wget de busybox (ya incluido en alpine)
HEALTHCHECK --interval=60s --timeout=3s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
