#!/bin/bash

# Script de inicialización del proyecto APS Integration
# Este script configura el entorno de desarrollo completo

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_message() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Función para verificar dependencias
check_dependencies() {
    print_message "Verificando dependencias del sistema..."
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado. Por favor instala Docker Desktop."
        exit 1
    fi
    
    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose no está instalado."
        exit 1
    fi
    
    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        print_warning "Node.js no está instalado. Se usará Docker para el frontend."
    fi
    
    # Verificar Python
    if ! command -v python3 &> /dev/null; then
        print_warning "Python 3 no está instalado. Se usará Docker para el backend."
    fi
    
    print_success "Verificación de dependencias completada"
}

# Función para configurar variables de entorno
setup_environment() {
    print_message "Configurando variables de entorno..."
    
    # Backend environment
    if [ ! -f "./backend/.env" ]; then
        cp "./backend/.env.template" "./backend/.env"
        print_message "Archivo .env creado para el backend. Por favor configura las variables de APS."
    fi
    
    # Frontend environment
    if [ ! -f "./frontend/.env" ]; then
        cat > "./frontend/.env" << EOF
REACT_APP_API_URL=http://localhost:8000
REACT_APP_APS_CLIENT_ID=\${APS_CLIENT_ID}
REACT_APP_VIEWER_VERSION=7.87.0
GENERATE_SOURCEMAP=false
EOF
        print_message "Archivo .env creado para el frontend."
    fi
    
    print_success "Variables de entorno configuradas"
}

# Función para crear directorios necesarios
create_directories() {
    print_message "Creando directorios necesarios..."
    
    mkdir -p ./uploads
    mkdir -p ./logs
    mkdir -p ./data/postgres
    mkdir -p ./data/redis
    mkdir -p ./infra/nginx
    
    print_success "Directorios creados"
}

# Función para configurar base de datos
setup_database() {
    print_message "Configurando scripts de base de datos..."
    
    # Crear script de inicialización de BD
    cat > "./backend/scripts/init_db.sql" << EOF
-- Script de inicialización de base de datos APS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de proyectos
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    bucket_key VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de archivos
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    urn TEXT UNIQUE NOT NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'uploaded',
    size BIGINT,
    content_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    translated_at TIMESTAMP
);

-- Crear tabla de sesiones de viewer
CREATE TABLE IF NOT EXISTS viewer_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    duration_minutes INTEGER
);

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_user_id ON viewer_sessions(user_id);

-- Insertar usuario de prueba (password: admin)
INSERT INTO users (email, hashed_password, full_name, is_active) 
VALUES (
    'admin@aps-integration.com', 
    '\$2b\$12\$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 
    'Administrador', 
    true
) ON CONFLICT (email) DO NOTHING;
EOF

    print_success "Scripts de base de datos configurados"
}

# Función para configurar Nginx
setup_nginx() {
    print_message "Configurando Nginx..."
    
    cat > "./infra/nginx/nginx.conf" << EOF
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8000;
    }
    
    upstream frontend {
        server frontend:3000;
    }
    
    # Configuración para desarrollo
    server {
        listen 80;
        server_name localhost;
        
        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            # WebSocket support para React hot reload
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
        }
        
        # Backend API
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        # Documentación de API
        location /docs {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
        
        location /redoc {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
    }
}
EOF

    print_success "Nginx configurado"
}

# Función para configurar Docker
setup_docker() {
    print_message "Configurando Docker..."
    
    # Crear .dockerignore para backend
    cat > "./backend/.dockerignore" << EOF
__pycache__
*.pyc
*.pyo
*.pyd
.Python
env
pip-log.txt
pip-delete-this-directory.txt
.tox
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.log
.git
.mypy_cache
.pytest_cache
.hypothesis
.venv
.env
EOF

    # Crear .dockerignore para frontend
    cat > "./frontend/.dockerignore" << EOF
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.git
.gitignore
README.md
.env
.nyc_output
coverage
.cache
.DS_Store
build
EOF

    print_success "Docker configurado"
}

# Función para instalar dependencias locales (opcional)
install_dependencies() {
    print_message "¿Deseas instalar dependencias localmente? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        # Backend dependencies
        if command -v python3 &> /dev/null && command -v pip &> /dev/null; then
            print_message "Instalando dependencias de Python..."
            cd ./backend
            python3 -m venv venv
            source venv/bin/activate
            pip install -r requirements.txt
            cd ..
            print_success "Dependencias de Python instaladas"
        fi
        
        # Frontend dependencies
        if command -v npm &> /dev/null; then
            print_message "Instalando dependencias de Node.js..."
            cd ./frontend
            npm install
            cd ..
            print_success "Dependencias de Node.js instaladas"
        fi
    fi
}

# Función para crear scripts útiles
create_utility_scripts() {
    print_message "Creando scripts útiles..."
    
    # Script para iniciar desarrollo
    cat > "./scripts/dev-start.sh" << EOF
#!/bin/bash
echo "Iniciando entorno de desarrollo APS Integration..."
docker-compose up -d postgres redis
sleep 5
docker-compose up backend frontend
EOF
    
    # Script para parar desarrollo
    cat > "./scripts/dev-stop.sh" << EOF
#!/bin/bash
echo "Deteniendo entorno de desarrollo..."
docker-compose down
EOF
    
    # Script para logs
    cat > "./scripts/logs.sh" << EOF
#!/bin/bash
docker-compose logs -f \${1:-backend}
EOF
    
    # Script para reset de BD
    cat > "./scripts/reset-db.sh" << EOF
#!/bin/bash
echo "¿Estás seguro de que quieres resetear la base de datos? (y/N)"
read -r response
if [[ "\$response" =~ ^([yY][eE][sS]|[yY])\$ ]]; then
    docker-compose down
    docker volume rm \$(docker volume ls -q | grep postgres) 2>/dev/null || true
    docker-compose up -d postgres
    echo "Base de datos reseteada"
fi
EOF
    
    # Hacer scripts ejecutables
    chmod +x ./scripts/*.sh
    
    print_success "Scripts útiles creados"
}

# Función para mostrar información final
show_final_info() {
    print_success "¡Proyecto APS Integration inicializado exitosamente!"
    echo ""
    echo -e "${YELLOW}Próximos pasos:${NC}"
    echo "1. Configura las variables de APS en backend/.env:"
    echo "   - APS_CLIENT_ID"
    echo "   - APS_CLIENT_SECRET"
    echo ""
    echo "2. Inicia el entorno de desarrollo:"
    echo "   ./scripts/dev-start.sh"
    echo ""
    echo "3. Accede a la aplicación:"
    echo "   - Frontend: http://localhost:3000"
    echo "   - Backend API: http://localhost:8000"
    echo "   - Documentación: http://localhost:8000/docs"
    echo "   - Celery Monitor: http://localhost:5555"
    echo ""
    echo "4. Usuario de prueba:"
    echo "   - Email: admin@aps-integration.com"
    echo "   - Password: admin"
    echo ""
    echo -e "${YELLOW}Scripts útiles:${NC}"
    echo "   ./scripts/dev-start.sh  - Iniciar desarrollo"
    echo "   ./scripts/dev-stop.sh   - Detener desarrollo"
    echo "   ./scripts/logs.sh       - Ver logs"
    echo "   ./scripts/reset-db.sh   - Resetear base de datos"
}

# Función principal
main() {
    print_message "Iniciando configuración del proyecto APS Integration..."
    
    check_dependencies
    setup_environment
    create_directories
    setup_database
    setup_nginx
    setup_docker
    install_dependencies
    create_utility_scripts
    show_final_info
}

# Ejecutar función principal
main