# Backend APS Integration - FastAPI

Backend completo para integración con Autodesk Platform Services (APS) construido con FastAPI, SQLAlchemy y autenticación OAuth 2.0.

## 🚀 Características Principales

- **🔐 Autenticación OAuth 2.0**: Flujos 2-legged y 3-legged con APS
- **🗄️ Base de Datos**: SQLAlchemy con PostgreSQL
- **🔒 Seguridad**: JWT, rate limiting, validación de inputs
- **📁 Gestión de Archivos**: Upload y procesamiento de modelos CAD/BIM
- **🔄 Procesamiento Asíncrono**: Celery para tareas de traducción
- **📊 Monitoreo**: Logging estructurado y métricas
- **🧪 Testing**: Suite completa de pruebas unitarias
- **📚 Documentación**: OpenAPI/Swagger automática

## 🏗️ Arquitectura

```
backend/
├── app/
│   ├── api/v1/           # Endpoints de la API
│   │   ├── endpoints/    # Endpoints organizados por funcionalidad
│   │   └── api.py        # Router principal
│   ├── core/             # Configuración y utilidades core
│   │   ├── config.py     # Configuraciones
│   │   ├── database.py   # Configuración de BD
│   │   └── security.py   # Autenticación y seguridad
│   ├── models/           # Modelos SQLAlchemy
│   ├── schemas/          # Schemas Pydantic
│   ├── services/         # Lógica de negocio
│   ├── middleware/       # Middleware personalizado
│   └── main.py           # Aplicación principal
├── tests/                # Pruebas unitarias
├── docs/                 # Documentación generada
└── scripts/              # Scripts de utilidad
```

## 📋 Requisitos

- Python 3.11+
- PostgreSQL 13+
- Redis 6+
- Cuenta de desarrollador de Autodesk APS

## ⚡ Instalación Rápida

### 1. Clonar y Configurar

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configurar Variables de Entorno

```bash
cp .env.template .env
# Editar .env con tus credenciales APS
```

### 3. Inicializar Base de Datos

```bash
python init_db.py
```

### 4. Ejecutar Servidor

```bash
uvicorn app.main:app --reload --port 8000
```

## 🔧 Configuración Detallada

### Variables de Entorno Principales

```env
# APS Credentials
APS_CLIENT_ID=tu_client_id_aqui
APS_CLIENT_SECRET=tu_client_secret_aqui
APS_CALLBACK_URL=http://localhost:3000/auth/callback

# Database
POSTGRES_SERVER=localhost
POSTGRES_USER=aps_user
POSTGRES_PASSWORD=aps_password
POSTGRES_DB=aps_db

# Security
SECRET_KEY=tu-clave-secreta-super-segura
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Configuración de APS

1. Crea una aplicación en [Autodesk Developer Portal](https://developer.autodesk.com)
2. Configura los scopes requeridos:
   - `data:read`
   - `data:write` 
   - `data:create`
   - `bucket:create`
   - `bucket:read`
3. Establece la URL de callback en tu aplicación APS

## 🗄️ Modelos de Base de Datos

### User (Usuario)
```python
- id: Integer (PK)
- email: String (Unique)
- hashed_password: String
- full_name: String
- is_active: Boolean
- is_superuser: Boolean
- aps_user_id: String
- aps_access_token: Text
- aps_refresh_token: Text
- aps_token_expires_at: DateTime
```

### Project (Proyecto)
```python
- id: Integer (PK)
- name: String
- description: Text
- bucket_key: String (Unique)
- user_id: Integer (FK)
- aps_bucket_policy: String
```

### File (Archivo)
```python
- id: Integer (PK)
- name: String
- original_filename: String
- urn: Text (Unique)
- status: String (uploaded/translating/ready/error)
- project_id: Integer (FK)
- size: BigInteger
- metadata: JSON
```

## 🔌 API Endpoints

### Autenticación
- `POST /auth/login` - Login de usuario
- `POST /auth/register` - Registro de usuario
- `GET /auth/me` - Información del usuario actual
- `POST /auth/token` - Token de aplicación APS (2-legged)
- `GET /auth/aps/auth-url` - URL de autorización APS (3-legged)
- `POST /auth/aps/callback` - Callback de autorización APS

### Modelos CAD/BIM
- `POST /models/upload` - Subir modelo
- `GET /models/` - Listar modelos
- `GET /models/{id}` - Obtener modelo específico
- `DELETE /models/{id}` - Eliminar modelo
- `POST /models/translate` - Iniciar traducción
- `GET /models/translate/{job}/status` - Estado de traducción

### Proyectos
- `GET /projects/` - Listar proyectos
- `POST /projects/` - Crear proyecto
- `GET /projects/{id}` - Obtener proyecto
- `PUT /projects/{id}` - Actualizar proyecto
- `DELETE /projects/{id}` - Eliminar proyecto

### Viewer
- `GET /viewer/token` - Token para el viewer
- `GET /viewer/config/{urn}` - Configuración del viewer

## 🔒 Seguridad

### Middleware Implementado

1. **Rate Limiting**: 100 peticiones/minuto por usuario
2. **Security Headers**: Headers de seguridad estándar
3. **Input Sanitization**: Validación contra patrones maliciosos
4. **File Upload Security**: Validación de tipos y tamaños
5. **Request Logging**: Log de todas las peticiones

### Autenticación

#### JWT (JSON Web Tokens)
- Algoritmo: HS256
- Expiración: 7 días (configurable)
- Refresh automático disponible

#### OAuth 2.0 con APS
- Flujo 2-legged para operaciones de aplicación
- Flujo 3-legged para operaciones de usuario
- Refresh tokens para sesiones persistentes

## 🧪 Testing

### Ejecutar Todas las Pruebas

```bash
python run_tests.py
```

### Pruebas Específicas

```bash
# Solo pruebas unitarias
pytest tests/ -v

# Con cobertura
pytest tests/ --cov=app --cov-report=html

# Pruebas específicas
pytest tests/test_aps_auth.py -v
```

### Estructura de Pruebas

- `test_aps_auth.py` - Pruebas del servicio de autenticación APS
- `test_aps_storage.py` - Pruebas del servicio de almacenamiento
- `test_models.py` - Pruebas de modelos de base de datos
- `test_endpoints.py` - Pruebas de endpoints (TODO)

## 📚 Documentación

### Generar Documentación

```bash
python generate_docs.py
```

### Acceder a Documentación

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Spec**: http://localhost:8000/openapi.json

## 🔄 Servicios Principales

### APSAuthService
Maneja toda la autenticación OAuth 2.0 con APS:
- Tokens de aplicación (2-legged)
- Autorización de usuario (3-legged)
- Refresh de tokens
- Validación de tokens

### APSStorageService
Gestiona operaciones de almacenamiento:
- Creación y gestión de buckets
- Upload de archivos
- Generación de URLs firmadas
- Eliminación de objetos

### APSService
Orquesta operaciones de alto nivel:
- Traducción de modelos
- Consulta de estado de traducción
- Extracción de metadatos

## 🚀 Despliegue

### Desarrollo Local

```bash
# Con Docker Compose (recomendado)
docker-compose up -d

# O manualmente
uvicorn app.main:app --reload --port 8000
```

### Producción

```bash
# Con Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker

# Variables de entorno de producción
export DEBUG=False
export SECRET_KEY=clave-super-secreta-produccion
export POSTGRES_PASSWORD=password-seguro
```

## 📊 Monitoreo y Logging

### Logging Estructurado

Todos los logs están en formato JSON estructurado:

```python
logger.info("Usuario autenticado", 
           user_id=user.id, 
           email=user.email,
           timestamp=datetime.utcnow())
```

### Métricas Disponibles

- Tiempo de respuesta de endpoints
- Número de usuarios activos
- Archivos procesados por día
- Errores de traducción
- Rate limiting hits

## 🛠️ Scripts de Utilidad

### Inicialización

```bash
# Inicializar BD con datos de ejemplo
python init_db.py

# Reset completo de BD
python init_db.py --reset
```

### Testing y Calidad

```bash
# Suite completa de pruebas
python run_tests.py

# Solo verificación de código
python -m flake8 app
python -m black app --check
python -m mypy app
```

### Documentación

```bash
# Generar docs automáticas
python generate_docs.py
```

## 🐛 Troubleshooting

### Problemas Comunes

#### Error de Conexión a PostgreSQL
```bash
# Verificar conexión
psql -h localhost -U aps_user -d aps_db

# Crear BD si no existe
createdb -h localhost -U postgres aps_db
```

#### Error de Tokens APS
```bash
# Verificar configuración
echo $APS_CLIENT_ID
echo $APS_CLIENT_SECRET

# Test de conectividad
curl -X POST "https://developer.api.autodesk.com/authentication/v1/authenticate" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=$APS_CLIENT_ID&client_secret=$APS_CLIENT_SECRET&grant_type=client_credentials&scope=data:read"
```

#### Problemas de Rate Limiting
```bash
# Verificar Redis
redis-cli ping

# Limpiar rate limits
redis-cli FLUSHDB
```

## 📈 Performance

### Optimizaciones Implementadas

- **Connection Pooling**: PostgreSQL con pool de conexiones
- **Cache Redis**: Para tokens y datos frecuentes
- **Async Processing**: Celery para tareas pesadas
- **Request Batching**: Múltiples operaciones en una petición
- **Database Indexing**: Índices optimizados para consultas frecuentes

### Benchmarks

En una configuración estándar:
- **Login**: ~100ms
- **Upload de archivo (10MB)**: ~2-5s
- **Listado de modelos**: ~50ms
- **Traducción de modelo**: Variable (5min - 2hrs)

## 🤝 Contribución

### Estándares de Código

- **Python**: PEP 8, type hints, docstrings
- **Tests**: Cobertura mínima 80%
- **Commits**: Conventional Commits
- **Branches**: Feature branches con PR

### Proceso de Desarrollo

1. Fork y crear feature branch
2. Implementar cambios con tests
3. Ejecutar `python run_tests.py`
4. Commit y push
5. Crear Pull Request

## 📄 Licencia

MIT License - Ver archivo LICENSE para detalles.

## 🆘 Soporte

Para soporte técnico:
- Issues: GitHub Issues
- Documentación: `/docs` endpoint
- Email: dev-team@aps-integration.com

---

**Desarrollado con ❤️ para la comunidad AEC**