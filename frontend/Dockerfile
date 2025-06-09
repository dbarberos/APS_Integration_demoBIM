# Multi-stage Dockerfile para Frontend React - Optimizado para Producción

# ===========================
# Stage 1: Builder
# ===========================
FROM node:18-alpine as builder

# Metadatos del container
LABEL maintainer="APS Team" \
      version="1.0" \
      description="APS Frontend Build Stage"

# Establecer variables de entorno
ENV NODE_ENV=production \
    CI=true \
    GENERATE_SOURCEMAP=false

# Instalar dependencias del sistema
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./

# Instalar dependencias (incluyendo devDependencies para build)
RUN npm ci --include=dev && npm cache clean --force

# Copiar código fuente
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./

# Build de la aplicación
RUN npm run build && \
    npm run build:analyze || true

# ===========================
# Stage 2: Production Server
# ===========================
FROM nginx:1.25-alpine as production

# Metadatos del container
LABEL maintainer="APS Team" \
      version="1.0" \
      description="APS Frontend Production Server"

# Instalar dependencias adicionales
RUN apk add --no-cache \
    curl \
    dumb-init \
    tzdata

# Copiar archivos construidos del builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Crear configuración optimizada de Nginx
RUN cat > /etc/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Performance optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Brotli compression (if available)
    # brotli on;
    # brotli_comp_level 6;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://developer.api.autodesk.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://developer.api.autodesk.com wss:; frame-ancestors 'self';" always;

    server {
        listen 80;
        listen [::]:80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, no-transform";
            add_header Vary "Accept-Encoding";
        }

        # Cache HTML with shorter duration
        location ~* \.(html)$ {
            expires 1h;
            add_header Cache-Control "public, no-cache";
        }

        # Handle SPA routing
        location / {
            try_files $uri $uri/ /index.html;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # Robots.txt
        location = /robots.txt {
            log_not_found off;
            access_log off;
        }

        # Favicon
        location = /favicon.ico {
            log_not_found off;
            access_log off;
        }
    }
}
EOF

# Crear script de entrypoint
RUN cat > /docker-entrypoint.sh << 'EOF'
#!/bin/sh
set -e

# Replace environment variables in static files if needed
if [ "$REACT_APP_API_URL" ]; then
    echo "Configuring API URL: $REACT_APP_API_URL"
    find /usr/share/nginx/html -name "*.js" -exec sed -i "s|__API_URL__|$REACT_APP_API_URL|g" {} +
fi

# Start nginx
exec nginx -g 'daemon off;'
EOF

RUN chmod +x /docker-entrypoint.sh

# Crear usuario no-root
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 -G nginx

# Ajustar permisos
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

USER nginx

# Exponer puerto
EXPOSE 80

# Entrypoint
ENTRYPOINT ["/usr/bin/dumb-init", "--", "/docker-entrypoint.sh"]

# ===========================
# Stage 3: Development
# ===========================
FROM node:18-alpine as development

# Variables de entorno para desarrollo
ENV NODE_ENV=development

# Instalar dependencias del sistema
RUN apk add --no-cache git

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S reactjs -u 1001 -G nodejs

# Crear directorio de trabajo
WORKDIR /app

# Cambiar a usuario no-root
USER reactjs

# Exponer puerto para desarrollo
EXPOSE 3000

# Comando para desarrollo con hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]