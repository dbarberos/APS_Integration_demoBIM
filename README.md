# APS Integration Platform

Una plataforma robusta y escalable para la integración con Autodesk Platform Services (APS), diseñada para la visualización y gestión de modelos CAD/BIM.

![APS Integration](https://img.shields.io/badge/APS-Integration-blue)
![Python](https://img.shields.io/badge/Python-3.11+-green)
![React](https://img.shields.io/badge/React-18+-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-lightblue)

## 🚀 Características Principales

- **🔐 Autenticación Segura**: Sistema completo de autenticación con JWT y OAuth 2.0
- **📁 Gestión de Proyectos**: Organización eficiente de modelos CAD/BIM
- **🔄 Procesamiento Automático**: Conversión automática de archivos usando APS Model Derivative API
- **🎯 Visualización 3D**: Integración nativa con Autodesk Forge Viewer v7
- **⚡ Performance Optimizada**: Cache Redis y procesamiento asíncrono
- **📊 Monitoreo Completo**: Logging estructurado y métricas de aplicación
- **🐳 Containerización**: Despliegue completo con Docker y Docker Compose

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│              React + Redux + APS Viewer                     │
└─────────────────────────────────────────────────────────────┘
                                │
                       ┌────────┴────────┐
                       │   API Gateway   │
                       │     (Nginx)     │
                       └────────┬────────┘
                                │
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND                               │
│                   FastAPI + Python                         │
├─────────────────────┬─────────────────┬─────────────────────┤
│   Authentication    │   APS Service   │   File Service      │
│     Service         │                 │                     │
└─────────────────────┴─────────────────┴─────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
      ┌─────────┴────┐ ┌────────┴────┐ ┌───────┴────────┐
      │  PostgreSQL  │ │    Redis    │ │ Autodesk APS   │
      │   Database   │ │    Cache    │ │   Platform     │
      └──────────────┘ └─────────────┘ └────────────────┘
```

## 📋 Requisitos Previos

- **Docker** y **Docker Compose**
- **Cuenta de Autodesk Developer** con aplicación APS configurada
- **Python 3.11+** (opcional para desarrollo local)
- **Node.js 18+** (opcional para desarrollo local)

## 🛠️ Instalación Rápida

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd aps-integration
```

### 2. Ejecutar Script de Inicialización

```bash
chmod +x scripts/init-project.sh
./scripts/init-project.sh
```

### 3. Configurar Variables de APS

Edita `backend/.env` y configura:

```env
APS_CLIENT_ID=tu_client_id_aqui
APS_CLIENT_SECRET=tu_client_secret_aqui
```

### 4. Iniciar el Sistema

```bash
./scripts/dev-start.sh
```

## 🌐 Acceso a la Aplicación

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Frontend** | http://localhost:3000 | Aplicación React |
| **Backend API** | http://localhost:8000 | API FastAPI |
| **Documentación** | http://localhost:8000/docs | Swagger UI |
| **Redoc** | http://localhost:8000/redoc | Documentación alternativa |
| **Celery Monitor** | http://localhost:5555 | Monitor de tareas |

### Credenciales de Prueba

- **Email**: `admin@aps-integration.com`
- **Password**: `admin`

## 📁 Estructura del Proyecto

```
aps-integration/
├── backend/                    # Aplicación FastAPI
│   ├── app/
│   │   ├── api/               # Endpoints de la API
│   │   ├── core/              # Configuración y seguridad
│   │   ├── models/            # Modelos de base de datos
│   │   ├── schemas/           # Esquemas Pydantic
│   │   ├── services/          # Lógica de negocio
│   │   └── utils/             # Utilidades
│   ├── requirements.txt       # Dependencias Python
│   └── Dockerfile             # Imagen Docker backend
├── frontend/                   # Aplicación React
│   ├── src/
│   │   ├── components/        # Componentes reutilizables
│   │   ├── pages/             # Páginas de la aplicación
│   │   ├── hooks/             # Custom hooks
│   │   ├── services/          # Servicios de API
│   │   ├── store/             # Redux store
│   │   └── types/             # Tipos TypeScript
│   ├── package.json           # Dependencias Node.js
│   └── Dockerfile             # Imagen Docker frontend
├── infra/                      # Infraestructura
│   ├── docker/                # Configuraciones Docker
│   ├── nginx/                 # Configuración Nginx
│   └── terraform/             # Scripts Terraform (futuro)
├── docs/                       # Documentación
│   ├── architecture/          # Documentación de arquitectura
│   ├── api/                   # Especificación de API
│   └── deployment/            # Guías de despliegue
├── tests/                      # Pruebas
│   ├── e2e/                   # Pruebas end-to-end
│   ├── integration/           # Pruebas de integración
│   └── unit/                  # Pruebas unitarias
├── scripts/                    # Scripts de utilidad
├── docker-compose.yml          # Orquestación Docker
└── README.md                   # Este archivo
```

## 🔧 Desarrollo

### Comandos Útiles

```bash
# Iniciar entorno de desarrollo
./scripts/dev-start.sh

# Detener servicios
./scripts/dev-stop.sh

# Ver logs de un servicio
./scripts/logs.sh backend
./scripts/logs.sh frontend

# Resetear base de datos
./scripts/reset-db.sh

# Ejecutar pruebas
docker-compose exec backend python -m pytest
docker-compose exec frontend npm test
```

### Variables de Entorno

#### Backend (`backend/.env`)

```env
# APS Configuration
APS_CLIENT_ID=your_client_id
APS_CLIENT_SECRET=your_client_secret
APS_CALLBACK_URL=http://localhost:3000/auth/callback

# Database
POSTGRES_SERVER=postgres
POSTGRES_USER=aps_user
POSTGRES_PASSWORD=aps_password
POSTGRES_DB=aps_db

# Security
SECRET_KEY=your-super-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
```

#### Frontend (`frontend/.env`)

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_APS_CLIENT_ID=${APS_CLIENT_ID}
REACT_APP_VIEWER_VERSION=7.87.0
```

## 🔌 Integración con APS

### Configuración de Aplicación APS

1. Crea una aplicación en [Autodesk Developer Portal](https://developer.autodesk.com)
2. Configura los siguientes scopes:
   - `data:read`
   - `data:write`
   - `data:create`
   - `bucket:create`
   - `bucket:read`
3. Establece la URL de callback: `http://localhost:3000/auth/callback`

### Flujo de Trabajo

1. **Autenticación**: Usuario se autentica con APS OAuth
2. **Gestión de Proyectos**: Crear y organizar proyectos
3. **Subida de Archivos**: Subir modelos CAD/BIM (.rvt, .dwg, .ifc, etc.)
4. **Procesamiento**: Conversión automática a formato visualizable
5. **Visualización**: Ver modelos 3D en el navegador

## 🧪 Pruebas

### Ejecutar Pruebas

```bash
# Pruebas unitarias backend
docker-compose exec backend python -m pytest tests/unit/

# Pruebas de integración
docker-compose exec backend python -m pytest tests/integration/

# Pruebas frontend
docker-compose exec frontend npm test

# Pruebas E2E
docker-compose exec frontend npm run test:e2e
```

### Cobertura de Código

```bash
# Backend
docker-compose exec backend python -m pytest --cov=app tests/

# Frontend
docker-compose exec frontend npm run test:coverage
```

## 🚀 Despliegue

### Producción con Docker

```bash
# Build de imágenes de producción
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### Variables de Producción

Asegúrate de configurar las siguientes variables para producción:

- `SECRET_KEY`: Clave secreta fuerte
- `POSTGRES_PASSWORD`: Password seguro para BD
- `APS_CLIENT_SECRET`: Secret de aplicación APS
- `ALLOWED_HOSTS`: Hosts permitidos
- `BACKEND_CORS_ORIGINS`: Origins CORS permitidos

## 📊 Monitoreo

### Logs

Los logs están estructurados en formato JSON:

```bash
# Ver logs en tiempo real
docker-compose logs -f backend

# Filtrar logs por nivel
docker-compose logs backend | grep "ERROR"
```

### Métricas

- **Performance**: Tiempo de respuesta de API
- **Usage**: Archivos procesados, usuarios activos
- **Health**: Estado de servicios, uptime
- **Business**: Conversiones exitosas, errores

## 🤝 Contribución

### Proceso de Desarrollo

1. Fork el repositorio
2. Crea una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un Pull Request

### Estándares de Código

- **Python**: PEP 8, type hints, docstrings
- **TypeScript**: ESLint, Prettier
- **Commits**: Conventional Commits
- **Tests**: Cobertura mínima del 80%

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🆘 Soporte

### Documentación

- [Documentación de Arquitectura](./docs/architecture/)
- [Especificación de API](./docs/api/)
- [Guías de Despliegue](./docs/deployment/)

### Problemas Comunes

#### Error de Autenticación APS

```bash
# Verificar configuración
grep APS_CLIENT_ID backend/.env

# Verificar logs
docker-compose logs backend | grep "APS"
```

#### Problemas de Red

```bash
# Verificar conectividad
docker-compose exec backend ping forge-api.autodesk.com

# Reiniciar servicios de red
docker-compose restart nginx
```

#### Base de Datos

```bash
# Verificar conexión a BD
docker-compose exec backend python -c "from app.db.session import engine; print(engine.execute('SELECT 1').scalar())"

# Reset completo de BD
./scripts/reset-db.sh
```

## 🔗 Enlaces Útiles

- [Autodesk Platform Services](https://developer.autodesk.com/)
- [Forge Viewer Documentation](https://developer.autodesk.com/en/docs/viewer/v7/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://reactjs.org/)

---

**Desarrollado con ❤️ para la comunidad AEC**