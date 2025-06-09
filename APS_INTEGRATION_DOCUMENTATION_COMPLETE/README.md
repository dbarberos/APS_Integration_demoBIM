# Plataforma de Integración APS (Autodesk Platform Services)

![APS Integration Platform](https://developer.api.autodesk.com/shared/images/forge-landing-image-forge-api.png)

## Descripción General

La **Plataforma de Integración APS** es una aplicación web full-stack que permite trabajar con modelos 3D de Autodesk de manera eficiente y colaborativa. Desarrollada con tecnologías modernas, ofrece una solución completa para la gestión, traducción y visualización de modelos CAD/BIM mediante la integración con Autodesk Platform Services.

### Características Principales

- ✅ **Autenticación Segura**: JWT + OAuth 2.0 con APS
- ✅ **Gestión Avanzada de Archivos**: Upload de archivos CAD/BIM con validación y procesamiento
- ✅ **Traducción Automática**: Conversión a formatos SVF/SVF2 para visualización 3D
- ✅ **Visualizador 3D Interactivo**: Integración completa con APS Viewer v7
- ✅ **Gestión de Múltiples Modelos**: Coordinación entre disciplinas y detección de interferencias
- ✅ **Notificaciones en Tiempo Real**: Sistema WebSocket para actualizaciones en vivo
- ✅ **Panel de Administración**: Métricas y estadísticas detalladas
- ✅ **Escalabilidad**: Arquitectura de microservicios con Docker y Terraform

## Guía Rápida de Inicio

### Requisitos Previos

- Docker y Docker Compose
- Node.js 18+ y npm/yarn
- Python 3.11+
- Cuenta de Autodesk y credenciales APS

### Instalación Rápida (Desarrollo)

```bash
# Clonar el repositorio
git clone https://github.com/su-empresa/aps-integration-platform.git
cd aps-integration-platform

# Configurar variables de entorno
cp .env.template .env
# Editar .env con sus credenciales

# Iniciar con script automático
./scripts/init-project.sh

# Iniciar servicios manualmente (alternativa)
docker-compose up -d
```

La aplicación estará disponible en:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Documentación API: http://localhost:8000/docs

## Documentación Detallada

La documentación completa del proyecto está organizada en las siguientes secciones:

1. [Arquitectura del Sistema](./arquitectura/README.md): Diseño técnico y componentes
2. [Guía de Instalación](./instalacion/README.md): Configuración de entornos
3. [Documentación de APIs](./apis/README.md): Endpoints y uso
4. [Guía de Usuario](./usuario/README.md): Manual para usuarios finales
5. [Administración](./administracion/README.md): Gestión y mantenimiento
6. [Troubleshooting](./troubleshooting/README.md): Resolución de problemas
7. [Guía de Desarrollo](./desarrollo/README.md): Contribución y extensión

## Stack Tecnológico

### Backend
- **Framework**: Python FastAPI
- **Autenticación**: JWT + OAuth 2.0
- **Base de Datos**: PostgreSQL + Redis
- **Procesamiento**: Celery para tareas asíncronas

### Frontend
- **Framework**: React 18 + TypeScript
- **Estado**: Redux Toolkit + React Query
- **UI**: Tailwind CSS + Headless UI
- **Visualización 3D**: APS Viewer v7

### Infraestructura
- **Contenedores**: Docker + Docker Compose
- **IaC**: Terraform para AWS/Azure
- **CI/CD**: GitHub Actions
- **Monitoreo**: Prometheus + Grafana

## Licencia

Propiedad de [Su Empresa] - Todos los derechos reservados