"""
Aplicación principal FastAPI para integración con Autodesk Platform Services (APS)
"""
from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import structlog

from app.core.config import settings
from app.core.security import get_current_user
from app.core.database import create_tables
from app.api.v1.api import api_router
from app.middleware.security import (
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    RequestLoggingMiddleware,
    InputSanitizationMiddleware,
    FileUploadSecurityMiddleware
)

# Configurar logging estructurado
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Crear instancia de FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API para integración con Autodesk Platform Services",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configurar CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Middleware de seguridad (orden importa - del más interno al más externo)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# Agregar middleware personalizado
app.add_middleware(FileUploadSecurityMiddleware)
app.add_middleware(InputSanitizationMiddleware)
app.add_middleware(RateLimitMiddleware, calls_per_minute=100)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# Manejador de excepciones global
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(
        "HTTP Exception",
        status_code=exc.status_code,
        detail=exc.detail,
        url=str(request.url),
        method=request.method
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "status_code": exc.status_code,
            "timestamp": "2024-01-16T10:00:00Z",
            "path": str(request.url.path)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled Exception",
        error=str(exc),
        url=str(request.url),
        method=request.method,
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Error interno del servidor",
            "status_code": 500,
            "timestamp": "2024-01-16T10:00:00Z",
            "path": str(request.url.path)
        }
    )

# Incluir routers de la API
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    """Endpoint raíz de la API"""
    return {
        "message": "API de Integración APS",
        "version": settings.VERSION,
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Endpoint de verificación de salud"""
    return {"status": "healthy"}

@app.on_event("startup")
async def startup_event():
    """Eventos de inicio de la aplicación"""
    logger.info("Iniciando aplicación APS API", version=settings.VERSION)
    
    # Crear tablas de base de datos
    try:
        create_tables()
        logger.info("Tablas de base de datos creadas/verificadas")
    except Exception as e:
        logger.error("Error al crear tablas de base de datos", error=str(e))

@app.on_event("shutdown")
async def shutdown_event():
    """Eventos de cierre de la aplicación"""
    logger.info("Cerrando aplicación APS API")