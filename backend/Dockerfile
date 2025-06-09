# Multi-stage Dockerfile para Backend FastAPI - Optimizado para Producción

# ===========================
# Stage 1: Builder
# ===========================
FROM python:3.11-slim as builder

# Establecer variables de entorno para optimización
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Instalar dependencias del sistema necesarias para compilación
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Crear y usar directorio virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copiar requirements e instalar dependencias Python
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# ===========================
# Stage 2: Production
# ===========================
FROM python:3.11-slim as production

# Metadatos del container
LABEL maintainer="APS Team" \
      version="1.0" \
      description="APS Backend API Service"

# Variables de entorno para producción
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_ENV=production

# Instalar solo dependencias runtime necesarias
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    dumb-init \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copiar virtual environment del builder stage
COPY --from=builder /opt/venv /opt/venv

# Crear usuario no-root para seguridad
RUN groupadd -r appgroup && \
    useradd -r -g appgroup -u 1001 -m -s /bin/bash appuser

# Crear directorios necesarios
RUN mkdir -p /app/logs /app/uploads /app/temp && \
    chown -R appuser:appgroup /app

# Establecer directorio de trabajo
WORKDIR /app

# Copiar código de la aplicación
COPY --chown=appuser:appgroup . .

# Crear script de entrypoint con health check
RUN cat > /app/entrypoint.sh << 'EOF'
#!/bin/bash
set -e

# Wait for database
echo "Waiting for database..."
while ! pg_isready -h ${POSTGRES_SERVER:-localhost} -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-postgres}; do
    sleep 1
done
echo "Database is ready!"

# Run database migrations if needed
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    python init_db.py
fi

# Start the application
exec "$@"
EOF

RUN chmod +x /app/entrypoint.sh && \
    chown appuser:appgroup /app/entrypoint.sh

# Cambiar a usuario no-root
USER appuser

# Health check para container
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Exponer puerto
EXPOSE 8000

# Configurar entrypoint
ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/entrypoint.sh"]

# Comando por defecto (puede ser sobrescrito)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--access-log"]

# ===========================
# Stage 3: Development (opcional)
# ===========================
FROM production as development

USER root

# Instalar dependencias adicionales para desarrollo
RUN apt-get update && apt-get install -y \
    vim \
    git \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de desarrollo
COPY requirements-dev.txt* ./
RUN if [ -f requirements-dev.txt ]; then pip install -r requirements-dev.txt; fi

USER appuser

# Override command para desarrollo con hot reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--log-level", "debug"]