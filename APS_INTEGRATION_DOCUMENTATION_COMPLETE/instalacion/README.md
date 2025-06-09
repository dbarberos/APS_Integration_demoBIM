# Guía de Instalación - Plataforma de Integración APS

Esta guía detalla los pasos para instalar, configurar y desplegar la Plataforma de Integración APS en diferentes entornos.

## Índice de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Instalación en Entorno de Desarrollo](#instalación-en-entorno-de-desarrollo)
3. [Configuración del Entorno](#configuración-del-entorno)
4. [Despliegue en Entorno de Producción](#despliegue-en-entorno-de-producción)
5. [Configuración de Autodesk Platform Services (APS)](#configuración-de-autodesk-platform-services-aps)
6. [Verificación de la Instalación](#verificación-de-la-instalación)
7. [Solución de Problemas Comunes](#solución-de-problemas-comunes)

## Requisitos Previos

### Software Necesario

- **Docker y Docker Compose** (versión 20.10+)
- **Git** (versión 2.30+)
- **Node.js** (versión 18+) y npm/yarn (para desarrollo local)
- **Python** (versión 3.11+) (para desarrollo local)
- **Terraform** (versión 1.0+) (para despliegue en producción)
- **AWS CLI** o **Azure CLI** (para despliegue en cloud)

### Recursos de Autodesk

- **Cuenta de Autodesk Developer**
  - Regístrese en [Autodesk Developer Portal](https://forge.autodesk.com/)
  - Cree una aplicación para obtener Client ID y Client Secret

### Requisitos de Hardware (Recomendados)

#### Desarrollo Local
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Almacenamiento**: 20GB+ libre

#### Producción (Por Servicio)
- **CPU**: 2-4 vCPUs
- **RAM**: 4-8GB
- **Almacenamiento**: SSD 100GB+

## Instalación en Entorno de Desarrollo

### Método 1: Script Automatizado

Este método utiliza nuestro script de inicialización para configurar todo el entorno de desarrollo automáticamente.

```bash
# Clonar el repositorio
git clone https://github.com/su-empresa/aps-integration-platform.git
cd aps-integration-platform

# Copiar y configurar variables de entorno
cp .env.template .env
# Editar .env con las credenciales de APS y otras configuraciones

# Ejecutar script de inicialización
./scripts/init-project.sh
```

El script realizará las siguientes acciones:
1. Verificar requisitos previos
2. Configurar variables de entorno
3. Construir imágenes Docker
4. Iniciar servicios con Docker Compose
5. Ejecutar migraciones de base de datos
6. Cargar datos iniciales (si se especifica)

### Método 2: Instalación Manual

Si prefiere configurar manualmente o necesita personalizar algún componente:

```bash
# Clonar el repositorio
git clone https://github.com/su-empresa/aps-integration-platform.git
cd aps-integration-platform

# Copiar y configurar variables de entorno
cp .env.template .env
# Editar .env con sus credenciales

# Construir e iniciar servicios
docker-compose build
docker-compose up -d

# Ejecutar migraciones (una vez que los servicios estén activos)
docker-compose exec backend python -m alembic upgrade head

# Cargar datos iniciales (opcional)
docker-compose exec backend python init_db.py
```

### Desarrollo Frontend (opcional)

Para desarrollo activo del frontend, puede ejecutarlo localmente en lugar de usar el contenedor:

```bash
# Navegar al directorio frontend
cd frontend

# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run dev
```

El frontend se ejecutará en http://localhost:3000 y se comunicará con la API en http://localhost:8000.

### Desarrollo Backend (opcional)

Para desarrollo activo del backend:

```bash
# Navegar al directorio backend
cd backend

# Crear y activar entorno virtual
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Iniciar en modo desarrollo
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Configuración del Entorno

### Variables de Entorno Esenciales

El archivo `.env` contiene todas las configuraciones necesarias. A continuación se detallan las variables más importantes:

#### Configuración General
```
# General
PROJECT_NAME=APS Integration Platform
ENVIRONMENT=development  # development, staging, production

# Aplicación
API_V1_STR=/api/v1
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]
SECRET_KEY=your-secret-key-here  # Generar una clave segura
```

#### Autodesk Platform Services
```
# APS Credentials
APS_CLIENT_ID=your-client-id
APS_CLIENT_SECRET=your-client-secret
APS_CALLBACK_URL=http://localhost:3000/api/auth/callback
```

#### Base de Datos
```
# PostgreSQL
POSTGRES_SERVER=db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=app
POSTGRES_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis
```

#### Almacenamiento
```
# Storage (S3 compatible)
STORAGE_TYPE=s3  # s3, local, azure
S3_BUCKET_NAME=aps-integration-files
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-west-1
```

### Configuración por Entorno

El sistema incluye configuraciones predefinidas para diferentes entornos:

- **Development**: Optimizado para desarrollo local (`infra/config/development.env`)
- **Staging**: Configuración similar a producción con recursos reducidos (`infra/config/staging.env`)
- **Production**: Alta disponibilidad y seguridad (`infra/config/production.env`)

Para cambiar entre entornos:

```bash
# Copiar configuración específica
cp infra/config/[entorno].env .env

# O especificar en el arranque
ENVIRONMENT=staging docker-compose up -d
```

## Despliegue en Entorno de Producción

### Despliegue en AWS

El proyecto incluye configuración Terraform para despliegue en AWS:

```bash
# Navegar al directorio de infraestructura
cd infra/terraform/aws

# Inicializar Terraform
terraform init

# Aplicar configuración (plan previo)
terraform plan -var-file=environments/production.tfvars
terraform apply -var-file=environments/production.tfvars
```

#### Componentes AWS desplegados:

- **Networking**: VPC, subnets, security groups
- **Compute**: ECS Fargate para contenedores
- **Database**: RDS PostgreSQL con alta disponibilidad
- **Cache**: ElastiCache Redis cluster
- **Storage**: S3 para almacenamiento de archivos
- **CDN**: CloudFront para distribución de contenido
- **Security**: WAF, IAM roles, KMS

### Despliegue en Azure

Para despliegue en Azure:

```bash
# Navegar al directorio de infraestructura
cd infra/terraform/azure

# Inicializar Terraform
terraform init

# Aplicar configuración
terraform plan -var-file=environments/production.tfvars
terraform apply -var-file=environments/production.tfvars
```

### Despliegue Manual

Si prefiere un despliegue personalizado, utilice el script de despliegue:

```bash
./scripts/deploy.sh --environment production
```

Este script:
1. Construye imágenes Docker
2. Las publica en un registro (ECR, ACR, etc.)
3. Aplica configuraciones Terraform
4. Ejecuta migraciones de base de datos
5. Configura CDN y dominios

## Configuración de Autodesk Platform Services (APS)

### Creación de Aplicación APS

1. Visite [Autodesk Developer Portal](https://forge.autodesk.com/)
2. Inicie sesión o cree una cuenta
3. Vaya a "My Apps" y haga clic en "Create App"
4. Complete la información:
   - **App Name**: Nombre de su aplicación
   - **App Description**: Descripción breve
   - **Callback URL**: URL de callback de su aplicación (ej: https://su-dominio.com/api/v1/auth/aps/callback)
   - **API**: Seleccione APIs requeridas:
     - Authentication
     - Data Management
     - Model Derivative
     - Viewer
5. Guarde Client ID y Client Secret

### Configuración de Callback URL

Es importante configurar correctamente la URL de callback en su aplicación APS:

- **Desarrollo**: http://localhost:3000/api/v1/auth/aps/callback
- **Producción**: https://su-dominio.com/api/v1/auth/aps/callback

Puede añadir múltiples URLs separadas por comas en el Developer Portal.

### Configuración de APS en la Aplicación

Asegúrese de actualizar las variables de entorno con sus credenciales APS:

```
APS_CLIENT_ID=your-client-id
APS_CLIENT_SECRET=your-client-secret
APS_CALLBACK_URL=https://su-dominio.com/api/v1/auth/aps/callback
```

## Verificación de la Instalación

### Comprobaciones Básicas

Una vez instalado, verifique que todo funcione correctamente:

1. **API Backend**:
   ```bash
   curl http://localhost:8000/api/v1/health
   # Debería devolver: {"status":"healthy"}
   ```

2. **Frontend**:
   - Acceda a http://localhost:3000
   - Debería cargar la página de inicio de sesión

3. **Servicios Docker**:
   ```bash
   docker-compose ps
   # Todos los servicios deben estar en estado "Up"
   ```

4. **Logs**:
   ```bash
   docker-compose logs -f backend
   # Verifique que no haya errores críticos
   ```

### Verificación Completa

Para una verificación más exhaustiva, ejecute el script de verificación:

```bash
./scripts/check-system.sh
```

Este script verifica:
1. Conexiones a base de datos
2. Autenticación con APS
3. Operaciones de almacenamiento
4. Conectividad entre servicios
5. Funcionamiento de WebSockets

## Solución de Problemas Comunes

### Error de Conexión a Base de Datos

```
ERROR: Database connection failed: connection refused
```

**Solución**:
- Verifique que PostgreSQL esté en ejecución: `docker-compose ps db`
- Compruebe las credenciales en `.env`
- Verifique la red Docker: `docker network inspect aps-integration-network`

### Error de Autenticación APS

```
ERROR: Failed to authenticate with APS: invalid_client
```

**Solución**:
- Verifique que APS_CLIENT_ID y APS_CLIENT_SECRET sean correctos
- Compruebe que la aplicación APS tenga los permisos necesarios
- Verifique que la URL de callback sea correcta

### Problemas con Docker Compose

```
ERROR: Version in "./docker-compose.yml" is unsupported
```

**Solución**:
- Actualice Docker Compose: `pip install docker-compose --upgrade`
- Use la sintaxis correcta para su versión: `docker compose` (sin guión) para Docker Compose V2

### Recursos Adicionales

- [FAQ de Instalación](./faq-instalacion.md)
- [Configuración Avanzada](./configuracion-avanzada.md)
- [Gestión de Secretos](./gestion-secretos.md)
- [Migración de Datos](./migracion-datos.md)