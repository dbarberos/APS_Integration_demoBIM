# Documentación de APIs - Plataforma de Integración APS

Esta documentación detalla todas las APIs disponibles en la Plataforma de Integración APS, incluyendo ejemplos de uso, parámetros y respuestas.

## Índice de Contenidos

1. [Información General](#información-general)
2. [Autenticación](#autenticación)
3. [Endpoints de Autenticación](#endpoints-de-autenticación)
4. [Endpoints de APS](#endpoints-de-aps)
5. [Endpoints de Proyectos](#endpoints-de-proyectos)
6. [Endpoints de Archivos](#endpoints-de-archivos)
7. [Endpoints del Viewer](#endpoints-del-viewer)
8. [Webhooks](#webhooks)
9. [Códigos de Error](#códigos-de-error)
10. [Rate Limiting](#rate-limiting)
11. [Paginación y Filtrado](#paginación-y-filtrado)
12. [Versionado de API](#versionado-de-api)

## Información General

- **Base URL:** `https://[su-dominio]/api/v1`
- **Autenticación:** Bearer Token (JWT)
- **Formato de datos:** JSON
- **Versión actual:** 1.0.0
- **Swagger/OpenAPI:** Disponible en `/docs` (ej: `https://[su-dominio]/docs`)

## Autenticación

La API utiliza autenticación basada en tokens JWT para la mayoría de los endpoints.

### Headers Requeridos

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Flujo de Autenticación

1. El cliente obtiene un token JWT mediante el endpoint `/auth/login`
2. El token debe incluirse en el header `Authorization` de las solicitudes
3. Los tokens expiran después de un tiempo determinado (configurable, por defecto 24 horas)
4. Se pueden usar refresh tokens para obtener nuevos tokens de acceso

## Endpoints de Autenticación

### Login de Usuario

```http
POST /auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "username": "usuario@ejemplo.com",
  "password": "contraseña_segura"
}
```

**Respuesta Exitosa (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 86400,
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Errores:**
- `401` - Credenciales inválidas
- `422` - Datos de entrada inválidos

### Registro de Usuario

```http
POST /auth/register
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña_segura",
  "full_name": "Juan Pérez"
}
```

**Respuesta Exitosa (201):**
```json
{
  "id": 1,
  "email": "usuario@ejemplo.com",
  "is_active": true,
  "full_name": "Juan Pérez"
}
```

### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json
```

**Request Body:**
```json
{
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
}
```

**Respuesta Exitosa (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### URL de Autorización APS

```http
GET /auth/aps/auth-url
Authorization: Bearer <jwt_token>
```

**Respuesta Exitosa (200):**
```json
{
  "auth_url": "https://developer.api.autodesk.com/authentication/v1/authorize?...",
  "client_id": "your_client_id",
  "scopes": ["data:read", "data:write", "data:create"]
}
```

### Callback de Autorización APS

```http
POST /auth/aps/callback
Authorization: Bearer <jwt_token>
Content-Type: application/json
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
  "status": "success"
}
```

## Endpoints de APS

### Listar Buckets

```http
GET /aps/buckets
Authorization: Bearer <jwt_token>
```

**Respuesta Exitosa (200):**
```json
[
  {
    "bucket_key": "mi-bucket-principal",
    "bucket_owner": "usuario_id",
    "created_date": "2024-01-15T10:30:00Z",
    "policy": "temporary",
    "permissions": []
  }
]
```

### Crear Bucket

```http
POST /aps/buckets
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "bucket_key": "mi-nuevo-bucket",
  "policy": "temporary"
}
```

**Respuesta Exitosa (201):**
```json
{
  "bucket_key": "mi-nuevo-bucket",
  "bucket_owner": "usuario_id",
  "created_date": "2024-01-15T10:30:00Z",
  "policy": "temporary",
  "permissions": []
}
```

### Subir Archivo

```http
POST /aps/buckets/{bucket_key}/files
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body:**
```
file: <archivo_binario>
file_name: "modelo.rvt"
```

**Respuesta Exitosa (201):**
```json
{
  "bucket_key": "mi-bucket",
  "object_id": "urn:adsk.objects:os.object:mi-bucket/modelo.rvt",
  "object_key": "modelo.rvt",
  "sha1": "da39a3ee5e6b4b0d3255bfef95601890afd80709",
  "size": 1024000,
  "content_type": "application/octet-stream",
  "location": "https://developer.api.autodesk.com/oss/v2/buckets/mi-bucket/objects/modelo.rvt"
}
```

### Traducir Modelo

```http
POST /aps/translate
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6bXktYnVja2V0L21vZGVsby5ydnQ",
  "output_format": "svf2",
  "quality": "medium"
}
```

**Respuesta Exitosa (202):**
```json
{
  "type": "manifest",
  "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6bXktYnVja2V0L21vZGVsby5ydnQ",
  "result": "success",
  "job_id": "job123456789",
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

### Estado de Traducción

```http
GET /aps/translate/{urn}/status
Authorization: Bearer <jwt_token>
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
  "progress": "complete",
  "stats": {
    "total": 100,
    "processed": 100
  }
}
```

### Metadatos de Modelo

```http
GET /aps/models/{urn}/metadata
Authorization: Bearer <jwt_token>
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

### Listar Proyectos

```http
GET /projects
Authorization: Bearer <jwt_token>
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

### Crear Proyecto

```http
POST /projects
Authorization: Bearer <jwt_token>
Content-Type: application/json
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

### Obtener Proyecto

```http
GET /projects/{project_id}
Authorization: Bearer <jwt_token>
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

### Actualizar Proyecto

```http
PUT /projects/{project_id}
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Nombre Actualizado",
  "description": "Nueva descripción"
}
```

**Respuesta Exitosa (200):**
```json
{
  "id": 1,
  "name": "Nombre Actualizado",
  "description": "Nueva descripción",
  "bucket_key": "proyecto-edificio-corp",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-16T16:00:00Z",
  "files_count": 5
}
```

### Eliminar Proyecto

```http
DELETE /projects/{project_id}
Authorization: Bearer <jwt_token>
```

**Respuesta Exitosa (204):** Sin contenido

## Endpoints de Archivos

### Listar Archivos

```http
GET /files
Authorization: Bearer <jwt_token>
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

### Subir Archivo

```http
POST /files
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body:**
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

### Obtener Archivo

```http
GET /files/{file_id}
Authorization: Bearer <jwt_token>
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

### Eliminar Archivo

```http
DELETE /files/{file_id}
Authorization: Bearer <jwt_token>
```

**Respuesta Exitosa (204):** Sin contenido

## Endpoints del Viewer

### Obtener Token del Viewer

```http
GET /viewer/token
Authorization: Bearer <jwt_token>
```

**Respuesta Exitosa (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Configuración del Viewer

```http
GET /viewer/config/{urn}
Authorization: Bearer <jwt_token>
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

### Webhook de Estado de Traducción

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

**Respuesta Exitosa (200):**
```json
{
  "message": "Webhook recibido y procesado correctamente"
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
- `429` - Too Many Requests
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

La API implementa límites de tasa para prevenir abusos y garantizar un servicio equitativo.

- **Límite por usuario:** 100 requests por minuto
- **Límite por IP:** 200 requests por minuto

Cuando se alcanza el límite, la API responde con status code `429 Too Many Requests`.

### Headers de Respuesta

Todas las respuestas incluyen los siguientes headers relacionados con el rate limiting:

- `X-RateLimit-Limit`: Número máximo de requests permitidos en el período
- `X-RateLimit-Remaining`: Número de requests restantes en el período actual
- `X-RateLimit-Reset`: Timestamp Unix que indica cuándo se reiniciará el contador

## Paginación y Filtrado

### Paginación

Los endpoints que devuelven listas de recursos soportan paginación mediante parámetros `limit` y `offset`:

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

### Filtrado

Los endpoints soportan múltiples opciones de filtrado:

- **Búsqueda general**: `?search=término`
- **Filtrado por campo**: `?filter[campo]=valor`
- **Ordenamiento**: `?sort=campo&order=asc|desc`
- **Rangos de fechas**: `?filter[created_at][gte]=2024-01-01&filter[created_at][lte]=2024-01-31`

Ejemplo:
```http
GET /files?search=modelo&sort=created_at&order=desc&filter[status]=ready
```

## Versionado de API

### Versión Actual

La versión actual de la API es `v1`.

### Especificación de Versión

La versión puede especificarse de dos formas:

1. **URL Path**: `/api/v1/endpoint`
2. **Header de Versión**: `Accept: application/vnd.api+json;version=1`

### Política de Deprecación

- Las versiones obsoletas se marcarán con el header `Deprecation: true`
- Las nuevas versiones se anunciarán con 6 meses de anticipación
- Las versiones obsoletas serán soportadas por al menos 12 meses

## Recursos Adicionales

- [Ejemplos de Código](./ejemplos-codigo.md)
- [Postman Collection](./aps-integration-postman.json)
- [Referencia OpenAPI](./openapi-spec.yml)
- [Guía de Migración entre Versiones](./migracion-api.md)