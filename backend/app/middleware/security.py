"""
Middleware de seguridad
"""
import time
import json
from typing import Dict, Optional
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import structlog
import redis
from datetime import datetime, timedelta

from app.core.config import settings

logger = structlog.get_logger()

# Cliente Redis para rate limiting
try:
    redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception as e:
    logger.warning("No se pudo conectar a Redis para rate limiting", error=str(e))
    redis_client = None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware para rate limiting basado en IP y usuario
    """
    
    def __init__(self, app, calls_per_minute: int = 100):
        super().__init__(app)
        self.calls_per_minute = calls_per_minute
        self.window_size = 60  # 1 minuto
    
    async def dispatch(self, request: Request, call_next):
        if not redis_client:
            # Si no hay Redis, permitir todas las peticiones
            return await call_next(request)
        
        # Obtener identificador (IP o usuario)
        client_ip = self.get_client_ip(request)
        user_id = getattr(request.state, 'user_id', None)
        identifier = f"user:{user_id}" if user_id else f"ip:{client_ip}"
        
        # Verificar rate limit
        if await self.is_rate_limited(identifier):
            logger.warning("Rate limit excedido", 
                         identifier=identifier,
                         endpoint=str(request.url.path))
            
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Demasiadas peticiones. Intenta de nuevo más tarde.",
                    "retry_after": 60
                },
                headers={"Retry-After": "60"}
            )
        
        # Procesar petición
        response = await call_next(request)
        
        # Incrementar contador
        await self.increment_counter(identifier)
        
        return response
    
    def get_client_ip(self, request: Request) -> str:
        """Obtener IP del cliente considerando proxies"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    async def is_rate_limited(self, identifier: str) -> bool:
        """Verificar si el identificador está rate limited"""
        try:
            key = f"rate_limit:{identifier}"
            current_count = redis_client.get(key)
            
            if current_count is None:
                return False
            
            return int(current_count) >= self.calls_per_minute
            
        except Exception as e:
            logger.error("Error al verificar rate limit", error=str(e))
            return False
    
    async def increment_counter(self, identifier: str):
        """Incrementar contador de peticiones"""
        try:
            key = f"rate_limit:{identifier}"
            current = redis_client.incr(key)
            
            if current == 1:
                # Establecer expiración en primera petición
                redis_client.expire(key, self.window_size)
                
        except Exception as e:
            logger.error("Error al incrementar contador rate limit", error=str(e))


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware para agregar headers de seguridad
    """
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Headers de seguridad
        security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:;",
        }
        
        # Solo agregar HSTS en HTTPS
        if request.url.scheme == "https":
            security_headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        for name, value in security_headers.items():
            response.headers[name] = value
        
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware para logging de peticiones
    """
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Información de la petición
        client_ip = self.get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "Unknown")
        
        # Procesar petición
        try:
            response = await call_next(request)
            
            # Calcular tiempo de procesamiento
            process_time = time.time() - start_time
            
            # Log de la petición
            logger.info(
                "HTTP Request",
                method=request.method,
                url=str(request.url),
                status_code=response.status_code,
                process_time=f"{process_time:.3f}s",
                client_ip=client_ip,
                user_agent=user_agent,
                user_id=getattr(request.state, 'user_id', None)
            )
            
            # Agregar header de tiempo de procesamiento
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
            
        except Exception as e:
            process_time = time.time() - start_time
            
            # Log de error
            logger.error(
                "HTTP Request Error",
                method=request.method,
                url=str(request.url),
                process_time=f"{process_time:.3f}s",
                client_ip=client_ip,
                error=str(e)
            )
            
            raise
    
    def get_client_ip(self, request: Request) -> str:
        """Obtener IP del cliente considerando proxies"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"


class InputSanitizationMiddleware(BaseHTTPMiddleware):
    """
    Middleware para sanitización básica de inputs
    """
    
    DANGEROUS_PATTERNS = [
        # SQL Injection patterns
        r"(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)",
        # XSS patterns
        r"(<script|</script|javascript:|vbscript:|onload=|onerror=)",
        # Path traversal
        r"(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)",
        # Command injection
        r"(\b(cmd|powershell|bash|sh|eval|system|exec)\b.*[;&|])",
    ]
    
    async def dispatch(self, request: Request, call_next):
        # Solo verificar para métodos que pueden tener body
        if request.method in ["POST", "PUT", "PATCH"]:
            # Verificar Content-Type
            content_type = request.headers.get("content-type", "")
            
            if "application/json" in content_type:
                # Leer y verificar JSON body
                body = await request.body()
                
                if body:
                    try:
                        # Decodificar JSON
                        json_data = json.loads(body.decode())
                        
                        # Verificar patrones peligrosos
                        if self.contains_dangerous_patterns(json_data):
                            logger.warning(
                                "Patrones peligrosos detectados en request",
                                method=request.method,
                                url=str(request.url),
                                client_ip=self.get_client_ip(request)
                            )
                            
                            return JSONResponse(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                content={"detail": "Input contiene patrones no permitidos"}
                            )
                    
                    except json.JSONDecodeError:
                        # JSON inválido, dejar que FastAPI lo maneje
                        pass
        
        return await call_next(request)
    
    def contains_dangerous_patterns(self, data, max_depth: int = 10) -> bool:
        """Verificar patrones peligrosos en datos JSON recursivamente"""
        if max_depth <= 0:
            return False
        
        import re
        
        if isinstance(data, str):
            # Verificar string contra patrones peligrosos
            for pattern in self.DANGEROUS_PATTERNS:
                if re.search(pattern, data, re.IGNORECASE):
                    return True
        
        elif isinstance(data, dict):
            for key, value in data.items():
                if (isinstance(key, str) and self.contains_dangerous_patterns(key, max_depth - 1)) or \
                   self.contains_dangerous_patterns(value, max_depth - 1):
                    return True
        
        elif isinstance(data, list):
            for item in data:
                if self.contains_dangerous_patterns(item, max_depth - 1):
                    return True
        
        return False
    
    def get_client_ip(self, request: Request) -> str:
        """Obtener IP del cliente"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.client.host if request.client else "unknown"


class FileUploadSecurityMiddleware(BaseHTTPMiddleware):
    """
    Middleware específico para seguridad en uploads de archivos
    """
    
    ALLOWED_MIME_TYPES = {
        'application/octet-stream',  # RVT, DWG genéricos
        'image/vnd.dwg',            # DWG
        'application/x-dwg',        # DWG alternativo
        'model/vnd.dwg',            # DWG
        'application/x-autocad',    # AutoCAD
        'image/x-dwg',              # DWG alternativo
        'application/acad',         # AutoCAD
        'application/x-acad',       # AutoCAD
        'application/autocad_dwg',  # AutoCAD DWG
        'image/x-autocad',          # AutoCAD
        'model/vnd.3ds',            # 3DS
        'application/x-3ds',        # 3DS
    }
    
    DANGEROUS_EXTENSIONS = {
        '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js',
        '.jar', '.app', '.deb', '.pkg', '.dmg', '.iso'
    }
    
    async def dispatch(self, request: Request, call_next):
        # Solo verificar rutas de upload
        if "/upload" in request.url.path and request.method == "POST":
            content_type = request.headers.get("content-type", "")
            
            if "multipart/form-data" in content_type:
                # Verificar tamaño del contenido
                content_length = request.headers.get("content-length")
                if content_length:
                    size = int(content_length)
                    max_size = settings.MAX_FILE_SIZE  # 100MB por defecto
                    
                    if size > max_size:
                        logger.warning(
                            "Archivo demasiado grande",
                            size_mb=round(size / (1024 * 1024), 2),
                            max_size_mb=round(max_size / (1024 * 1024), 2),
                            client_ip=self.get_client_ip(request)
                        )
                        
                        return JSONResponse(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            content={
                                "detail": f"Archivo demasiado grande. Máximo permitido: {round(max_size / (1024 * 1024), 2)}MB"
                            }
                        )
        
        return await call_next(request)
    
    def get_client_ip(self, request: Request) -> str:
        """Obtener IP del cliente"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
