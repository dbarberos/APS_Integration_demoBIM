"""
Configuración de la aplicación APS
"""
from typing import List, Union
from pydantic import AnyHttpUrl, EmailStr, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuración principal de la aplicación"""
    
    # Información del proyecto
    PROJECT_NAME: str = "APS Integration API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Configuración del servidor
    SERVER_HOST: str = "localhost"
    SERVER_PORT: int = 8000
    
    # Seguridad
    SECRET_KEY: str = "changeme-secret-key-for-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 días
    ALGORITHM: str = "HS256"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"]
    
    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    # Base de datos PostgreSQL
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "aps_user"
    POSTGRES_PASSWORD: str = "aps_password"
    POSTGRES_DB: str = "aps_db"
    POSTGRES_PORT: int = 5432
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    
    @property
    def REDIS_URL(self) -> str:
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    # Autodesk Platform Services (APS/Forge)
    APS_CLIENT_ID: str = ""
    APS_CLIENT_SECRET: str = ""
    APS_CALLBACK_URL: str = "http://localhost:3000/auth/callback"
    APS_SCOPES: List[str] = ["data:read", "data:write", "data:create", "bucket:create", "bucket:read"]
    
    # URLs de APS
    APS_BASE_URL: str = "https://developer.api.autodesk.com"
    APS_AUTH_URL: str = "https://developer.api.autodesk.com/authentication/v1/authenticate"
    
    # Almacenamiento de archivos
    UPLOAD_FOLDER: str = "./uploads"
    MAX_FILE_SIZE: int = 500 * 1024 * 1024  # 500MB
    ALLOWED_EXTENSIONS: List[str] = [
        ".rvt", ".rfa", ".rte",  # Revit
        ".dwg", ".dxf",          # AutoCAD
        ".ifc",                  # IFC
        ".nwd", ".nwf", ".nwc",  # Navisworks
        ".3ds", ".max",          # 3ds Max
        ".fbx", ".obj", ".dae",  # General 3D
        ".skp",                  # SketchUp
        ".3dm",                  # Rhino
        ".sat", ".step", ".stp", # CAD formats
        ".iges", ".igs",         # CAD formats
        ".3mf", ".stl",          # 3D printing
        ".pts", ".xyz", ".las", ".laz",  # Point clouds
        ".pdf", ".jpg", ".png"   # Documents/Images
    ]
    
    # Configuración de chunked upload
    CHUNK_SIZE: int = 5 * 1024 * 1024  # 5MB chunks
    MAX_UPLOAD_RETRIES: int = 3
    
    # Cuotas de usuario
    DEFAULT_USER_QUOTA: int = 5 * 1024 * 1024 * 1024  # 5GB por usuario
    MAX_FILES_PER_PROJECT: int = 1000
    MAX_PROJECTS_PER_USER: int = 50
    
    # Configuración de logging
    LOG_LEVEL: str = "INFO"
    
    # Webhooks
    WEBHOOK_SECRET: str = ""
    WEBHOOK_MAX_RETRIES: int = 3
    WEBHOOK_RETRY_DELAYS: List[int] = [1, 5, 15]  # segundos
    WEBHOOK_TIMEOUT: int = 30  # segundos
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    RATE_LIMIT_BURST: int = 200
    RATE_LIMIT_ENABLED: bool = True
    
    # Configuración de seguridad de archivos
    ENABLE_VIRUS_SCAN: bool = False
    VIRUS_SCAN_API_KEY: str = ""
    ENABLE_FILE_ENCRYPTION: bool = False
    
    # Configuración de thumbnails
    THUMBNAIL_SIZES: List[str] = ["small", "medium", "large"]
    THUMBNAIL_QUALITY: int = 85
    THUMBNAIL_FORMAT: str = "png"
    
    # Configuración de procesamiento
    AUTO_TRANSLATE_ON_UPLOAD: bool = True
    AUTO_GENERATE_THUMBNAILS: bool = True
    AUTO_EXTRACT_METADATA: bool = True
    
    # Configuración de monitoreo
    ENABLE_METRICS: bool = True
    METRICS_ENDPOINT: str = "/metrics"
    
    # Configuración de cache
    CACHE_TTL_TOKENS: int = 3600  # 1 hora
    CACHE_TTL_METADATA: int = 86400  # 24 horas
    CACHE_TTL_THUMBNAILS: int = 604800  # 7 días
    
    # Email (opcional para notificaciones)
    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str = ""
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: EmailStr = "noreply@aps-integration.com"
    EMAILS_FROM_NAME: str = "APS Integration"
    
    # Notificaciones
    ENABLE_EMAIL_NOTIFICATIONS: bool = False
    ENABLE_WEBHOOK_NOTIFICATIONS: bool = True
    ENABLE_WEBSOCKET_NOTIFICATIONS: bool = True
    
    # Configuración de Celery para tareas async
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""
    
    @validator("CELERY_BROKER_URL", pre=True)
    def assemble_celery_broker(cls, v: str, values: dict) -> str:
        if v:
            return v
        return values.get("REDIS_URL", "redis://localhost:6379/0")
    
    @validator("CELERY_RESULT_BACKEND", pre=True)
    def assemble_celery_backend(cls, v: str, values: dict) -> str:
        if v:
            return v
        return values.get("REDIS_URL", "redis://localhost:6379/0")
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()