# Especificación de API - Sistema de Integración APS

## Información General

**Base URL:** `http://localhost:8000/api/v1`
**Autenticación:** Bearer Token (JWT)
**Formato de datos:** JSON
**Versión:** 1.0.0

## Autenticación

### Headers Requeridos
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Obtener Token
```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=admin&password=admin
```

**Respuesta:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer"
}
```

## Endpoints de Autenticación

### 1. Login de Usuario

```http
POST /auth/login
```

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Respuesta Exitosa (200):**
```json
{
  "access_token": "string",
  "token_type": "bearer"
}
```

**Errores:**
- `401` - Credenciales inválidas
- `422` - Datos de entrada inválidos

### 2. Registro de Usuario

```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "Juan Pérez"
}
```

**Respuesta Exitosa (201):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "is_active": true,
  "full_name": "Juan Pérez"
}
```

### 3. URL de Autorización APS

```http
GET /auth/aps/auth-url
```

**Respuesta Exitosa (200):**
```json
{
  "auth_url": "https://developer.api.autodesk.com/authentication/v1/authorize?...",
  "client_id": "your_client_id",
  "scopes": ["data:read", "data:write", "data:create"]
}
```

### 4. Callback de Autorización APS

```http
POST /auth/aps/callback
```

**Request Body:**
```json
{
  "code": "authorization_code_from_autodesk"
}
```

**Respuesta Exitosa (200):**
```json
{
  "message": "Autorización de APS procesada correctamente",
  "code": "abc123..."
}
```

## Endpoints de APS

### 1. Listar Buckets

```http
GET /aps/buckets
```

**Respuesta Exitosa (200):**
```json
[
  {
    "bucket_key": "my-bucket-key",
    "bucket_owner": "user_id",
    "created_date": "2024-01-15T10:30:00Z",
    "policy": "temporary",
    "permissions": []
  }
]
```

### 2. Crear Bucket

```http
POST /aps/buckets
```

**Request Body:**
```json
{
  "bucket_key": "my-new-bucket",
  "policy": "temporary"
}
```

**Respuesta Exitosa (201):**
```json
{
  "bucket_key": "my-new-bucket",
  "bucket_owner": "user_id",
  "created_date": "2024-01-15T10:30:00Z",
  "policy": "temporary",
  "permissions": []
}
```

**Errores:**
- `409` - Bucket ya existe
- `400` - Datos inválidos

### 3. Subir Archivo

```http
POST /aps/buckets/{bucket_key}/files
```

**Request Body (multipart/form-data):**
```
file: <archivo_binario>
file_name: "modelo.rvt"
```

**Respuesta Exitosa (201):**
```json
{
  "bucket_key": "my-bucket",
  "object_id": "urn:adsk.objects:os.object:my-bucket/modelo.rvt",
  "object_key": "modelo.rvt",
  "sha1": "da39a3ee5e6b4b0d3255bfef95601890afd80709",
  "size": 1024000,
  "content_type": "application/octet-stream",
  "location": "https://developer.api.autodesk.com/oss/v2/buckets/my-bucket/objects/modelo.rvt"
}
```

### 4. Traducir Modelo

```http
POST /aps/translate
```

**Request Body:**
```json
{
  "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6bXktYnVja2V0L21vZGVsby5ydnQ"
}
```

**Respuesta Exitosa (202):**
```json
{
  "type": "manifest",
  "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6bXktYnVja2V0L21vZGVsby5ydnQ",
  "result": "success",
  "accepted_jobs": {
    "output": {
      "formats": [
        {
          "type": "svf2",
          "views": ["2d", "3d"]
        }
      ]
    }
  }
}
```

### 5. Estado de Traducción

```http
GET /aps/translate/{urn}/status
```

**Parámetros:**
- `urn` (path): URN codificado en base64

**Respuesta Exitosa (200):**
```json
{
  "type": "manifest",
  "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6bXktYnVja2V0L21vZGVsby5ydnQ",
  "region": "US",
  "version": "1.0",
  "status": "success",
  "progress": "complete"
}
```

**Estados posibles:**
- `pending` - En cola
- `inprogress` - Procesando
- `success` - Completado exitosamente
- `failed` - Error en procesamiento
- `timeout` - Tiempo de espera agotado

### 6. Metadatos de Modelo

```http
GET /aps/models/{urn}/metadata
```

**Respuesta Exitosa (200):**
```json
{
  "type": "metadata",
  "name": "Default",
  "guid": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6bXktYnVja2V0L21vZGVsby5ydnQ",
  "role": "3d",
  "status": "success",
  "progress": "complete",
  "children": [
    {
      "guid": "child-guid-1",
      "type": "object",
      "name": "Wall Basic - Interior",
      "role": "3d"
    }
  ]
}
```

## Endpoints de Proyectos

### 1. Listar Proyectos

```http
GET /projects
```

**Query Parameters:**
- `limit` (int, optional): Número de items por página (default: 20)
- `offset` (int, optional): Número de items a saltar (default: 0)
- `search` (string, optional): Término de búsqueda

**Respuesta Exitosa (200):**
```json
{
  "items": [
    {
      "id": 1,
      "name": "Edificio Corporativo",
      "description": "Proyecto de oficinas principales",
      "bucket_key": "proyecto-edificio-corp",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-16T15:45:00Z",
      "files_count": 5
    }
  ],
  "total": 1,
  "has_more": false
}
```

### 2. Crear Proyecto

```http
POST /projects
```

**Request Body:**
```json
{
  "name": "Nuevo Proyecto",
  "description": "Descripción del proyecto"
}
```

**Respuesta Exitosa (201):**
```json
{
  "id": 2,
  "name": "Nuevo Proyecto",
  "description": "Descripción del proyecto",
  "bucket_key": "nuevo-proyecto-abc123",
  "created_at": "2024-01-16T09:00:00Z",
  "updated_at": "2024-01-16T09:00:00Z",
  "files_count": 0
}
```

### 3. Obtener Proyecto

```http
GET /projects/{project_id}
```

**Respuesta Exitosa (200):**
```json
{
  "id": 1,
  "name": "Edificio Corporativo",
  "description": "Proyecto de oficinas principales",
  "bucket_key": "proyecto-edificio-corp",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-16T15:45:00Z",
  "files": [
    {
      "id": 1,
      "name": "planta-baja.rvt",
      "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6cHJveWVjdG8tZWRpZmljaW8tY29ycC9wbGFudGEtYmFqYS5ydnQ",
      "status": "ready",
      "uploaded_at": "2024-01-15T11:00:00Z"
    }
  ]
}
```

### 4. Actualizar Proyecto

```http
PUT /projects/{project_id}
```

**Request Body:**
```json
{
  "name": "Nombre Actualizado",
  "description": "Nueva descripción"
}
```

### 5. Eliminar Proyecto

```http
DELETE /projects/{project_id}
```

**Respuesta Exitosa (204):** Sin contenido

## Endpoints de Archivos

### 1. Listar Archivos

```http
GET /files
```

**Query Parameters:**
- `project_id` (int, optional): Filtrar por proyecto
- `status` (string, optional): Filtrar por estado
- `limit` (int, optional): Número de items por página
- `offset` (int, optional): Número de items a saltar

**Respuesta Exitosa (200):**
```json
{
  "items": [
    {
      "id": 1,
      "name": "modelo-arquitectonico.rvt",
      "original_filename": "Proyecto Casa - Arquitectónico.rvt",
      "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6bXktYnVja2V0L21vZGVsby5ydnQ",
      "project_id": 1,
      "status": "ready",
      "size": 15728640,
      "uploaded_at": "2024-01-15T14:30:00Z",
      "translated_at": "2024-01-15T14:35:00Z"
    }
  ],
  "total": 1,
  "has_more": false
}
```

### 2. Subir Archivo

```http
POST /files
```

**Request Body (multipart/form-data):**
```
file: <archivo_binario>
project_id: 1
```

**Respuesta Exitosa (201):**
```json
{
  "id": 2,
  "name": "nuevo-modelo.dwg",
  "original_filename": "Planos Estructurales.dwg",
  "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6bXktYnVja2V0L251ZXZvLW1vZGVsby5kd2c",
  "project_id": 1,
  "status": "uploaded",
  "size": 8388608,
  "uploaded_at": "2024-01-16T10:00:00Z"
}
```

### 3. Obtener Archivo

```http
GET /files/{file_id}
```

**Respuesta Exitosa (200):**
```json
{
  "id": 1,
  "name": "modelo-arquitectonico.rvt",
  "original_filename": "Proyecto Casa - Arquitectónico.rvt",
  "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6bXktYnVja2V0L21vZGVsby5ydnQ",
  "project_id": 1,
  "status": "ready",
  "size": 15728640,
  "uploaded_at": "2024-01-15T14:30:00Z",
  "translated_at": "2024-01-15T14:35:00Z",
  "metadata": {
    "guid": "model-guid-123",
    "type": "design",
    "name": "Casa Proyecto",
    "progress": "complete"
  }
}
```

### 4. Eliminar Archivo

```http
DELETE /files/{file_id}
```

**Respuesta Exitosa (204):** Sin contenido

## Endpoints del Viewer

### 1. Obtener Token del Viewer

```http
GET /viewer/token
```

**Respuesta Exitosa (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 2. Configuración del Viewer

```http
GET /viewer/config/{urn}
```

**Respuesta Exitosa (200):**
```json
{
  "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6bXktYnVja2V0L21vZGVsby5ydnQ",
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",
  "api": "derivativeV2",
  "env": "AutodeskProduction",
  "options": {
    "extensions": ["Autodesk.DocumentBrowser", "Autodesk.Measure"],
    "theme": "light"
  }
}
```

## Webhooks

### 1. Webhook de Estado de Traducción

```http
POST /webhooks/translation-status
```

**Request Body:**
```json
{
  "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6bXktYnVja2V0L21vZGVsby5ydnQ",
  "status": "success",
  "progress": "complete",
  "timestamp": "2024-01-15T14:35:00Z"
}
```

## Códigos de Error

### Códigos HTTP Estándar

- `200` - OK
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable

### Estructura de Error

```json
{
  "detail": "Descripción del error",
  "error_code": "ERROR_CODE",
  "timestamp": "2024-01-15T14:30:00Z",
  "path": "/api/v1/endpoint"
}
```

### Códigos de Error Personalizados

| Código | Descripción |
|--------|-------------|
| `AUTH_INVALID_CREDENTIALS` | Credenciales de autenticación inválidas |
| `AUTH_TOKEN_EXPIRED` | Token de acceso expirado |
| `APS_AUTH_FAILED` | Error en autorización de APS |
| `APS_API_ERROR` | Error en llamada a API de APS |
| `FILE_TOO_LARGE` | Archivo excede tamaño máximo |
| `FILE_TYPE_NOT_SUPPORTED` | Tipo de archivo no soportado |
| `PROJECT_NOT_FOUND` | Proyecto no encontrado |
| `TRANSLATION_FAILED` | Error en traducción de modelo |
| `BUCKET_ALREADY_EXISTS` | Bucket ya existe |
| `INSUFFICIENT_PERMISSIONS` | Permisos insuficientes |

## Rate Limiting

- **Límite por usuario:** 100 requests por minuto
- **Límite por IP:** 200 requests por minuto
- **Headers de respuesta:**
  - `X-RateLimit-Limit`: Límite máximo
  - `X-RateLimit-Remaining`: Requests restantes
  - `X-RateLimit-Reset`: Timestamp de reset

## Paginación

Los endpoints que retornan listas usan paginación basada en offset:

```http
GET /endpoint?limit=20&offset=40
```

**Respuesta:**
```json
{
  "items": [...],
  "total": 150,
  "limit": 20,
  "offset": 40,
  "has_more": true
}
```

## Filtrado y Búsqueda

### Parámetros de Query Comunes

- `search`: Búsqueda de texto libre
- `sort`: Campo de ordenamiento
- `order`: Dirección (`asc` o `desc`)
- `filter[field]`: Filtros específicos

**Ejemplo:**
```http
GET /files?search=modelo&sort=created_at&order=desc&filter[status]=ready
```

## Versionado

- **Versión actual:** v1
- **Header de versión:** `Accept: application/vnd.api+json;version=1`
- **Deprecación:** Se notificará con 6 meses de anticipación