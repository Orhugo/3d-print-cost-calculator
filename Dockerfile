# Imagen mínima y multi-arch (arm64/armv7 -> Raspberry Pi). alpine-slim
# quita módulos que no usamos (njs, geoip, xslt...). Solo sirve estáticos.
FROM nginx:alpine-slim

# Config ligera (1 worker, sin access log) + la app estática
COPY nginx.conf /etc/nginx/nginx.conf
COPY index.html styles.css core.js app.js /usr/share/nginx/html/

EXPOSE 80

# Chequeo de salud usando el wget de busybox (ya incluido en alpine)
HEALTHCHECK --interval=60s --timeout=3s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
