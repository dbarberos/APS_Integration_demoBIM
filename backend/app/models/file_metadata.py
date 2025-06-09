"""
Modelos extendidos de metadatos de archivos
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum
from typing import Dict, Any, Optional
import json

from app.core.database import Base


class FileShareType(str, Enum):
    """Tipos de compartición de archivos"""
    PUBLIC = "public"
    PROTECTED = "protected"
    PRIVATE = "private"


class FileVersion(Base):
    """Modelo de versionado de archivos"""
    
    __tablename__ = "file_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    
    # Información de la versión
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    urn = Column(Text, unique=True, nullable=False)
    object_key = Column(String(255), nullable=False)
    size = Column(Integer, nullable=False)
    
    # Información de cambios
    changelog = Column(Text, nullable=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    
    # Relaciones
    file = relationship("File", back_populates="versions")
    author = relationship("User")
    
    def __repr__(self):
        return f"<FileVersion(id={self.id}, file_id={self.file_id}, version={self.version_number})>"


class FileShare(Base):
    """Modelo de archivos compartidos"""
    
    __tablename__ = "file_shares"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    
    # Información de compartición
    share_token = Column(String(255), unique=True, nullable=False, index=True)
    share_type = Column(String(50), default=FileShareType.PROTECTED, nullable=False)
    password_hash = Column(String(255), nullable=True)
    
    # Configuración de acceso
    expires_at = Column(DateTime, nullable=True)
    max_downloads = Column(Integer, nullable=True)
    current_downloads = Column(Integer, default=0, nullable=False)
    
    # Configuración de permisos
    allow_download = Column(Boolean, default=True, nullable=False)
    allow_view = Column(Boolean, default=True, nullable=False)
    require_login = Column(Boolean, default=False, nullable=False)
    
    # Información del creador
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    last_accessed = Column(DateTime, nullable=True)
    
    # Metadatos adicionales
    metadata = Column(JSON, nullable=True)
    
    # Relaciones
    file = relationship("File", back_populates="shares")
    created_by = relationship("User")
    
    def __repr__(self):
        return f"<FileShare(id={self.id}, token={self.share_token}, type={self.share_type})>"
    
    @property
    def is_expired(self) -> bool:
        """Verificar si el enlace ha expirado"""
        if not self.expires_at:
            return False
        return func.now() > self.expires_at
    
    @property
    def downloads_remaining(self) -> Optional[int]:
        """Descargas restantes"""
        if not self.max_downloads:
            return None
        return max(0, self.max_downloads - self.current_downloads)
    
    @property
    def is_download_available(self) -> bool:
        """Verificar si se puede descargar"""
        if self.is_expired:
            return False
        if self.max_downloads and self.current_downloads >= self.max_downloads:
            return False
        return self.allow_download


class FileAccessLog(Base):
    """Log de accesos a archivos"""
    
    __tablename__ = "file_access_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    
    # Información de acceso
    access_type = Column(String(50), nullable=False)  # view, download, share, etc.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Información de sesión
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    referer = Column(String(255), nullable=True)
    
    # Información adicional
    share_token = Column(String(255), nullable=True)
    success = Column(Boolean, default=True, nullable=False)
    error_message = Column(Text, nullable=True)
    
    # Timestamp
    accessed_at = Column(DateTime, default=func.now(), nullable=False)
    
    # Metadatos adicionales
    metadata = Column(JSON, nullable=True)
    
    # Relaciones
    file = relationship("File")
    user = relationship("User")
    
    def __repr__(self):
        return f"<FileAccessLog(id={self.id}, file_id={self.file_id}, type={self.access_type})>"


class FileProcessingJob(Base):
    """Jobs de procesamiento de archivos"""
    
    __tablename__ = "file_processing_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    
    # Información del job
    job_type = Column(String(100), nullable=False)  # translation, thumbnail, conversion, etc.
    job_id = Column(String(255), nullable=True)  # ID externo (APS, etc.)
    
    # Estado del job
    status = Column(String(50), default="pending", nullable=False)
    progress = Column(Float, default=0.0, nullable=False)
    
    # Configuración del job
    input_params = Column(JSON, nullable=True)
    output_params = Column(JSON, nullable=True)
    
    # Resultados
    result_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relaciones
    file = relationship("File", back_populates="processing_jobs")
    
    def __repr__(self):
        return f"<FileProcessingJob(id={self.id}, type={self.job_type}, status={self.status})>"
    
    @property
    def duration_seconds(self) -> Optional[int]:
        """Duración del job en segundos"""
        if not self.started_at:
            return None
        end_time = self.completed_at or func.now()
        return int((end_time - self.started_at).total_seconds())
    
    @property
    def is_completed(self) -> bool:
        """Verificar si el job está completado"""
        return self.status in ["completed", "success", "failed", "error"]


class FileThumbnail(Base):
    """Miniaturas/previews de archivos"""
    
    __tablename__ = "file_thumbnails"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    
    # Información del thumbnail
    thumbnail_type = Column(String(50), nullable=False)  # small, medium, large, preview
    format = Column(String(10), nullable=False)  # png, jpg, svg
    
    # Ubicación del thumbnail
    urn = Column(Text, nullable=True)  # URN de APS si aplica
    object_key = Column(String(255), nullable=True)
    bucket_key = Column(String(255), nullable=True)
    local_path = Column(String(500), nullable=True)
    
    # Propiedades del thumbnail
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    
    # Estado
    status = Column(String(50), default="pending", nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    generated_at = Column(DateTime, nullable=True)
    
    # Relaciones
    file = relationship("File", back_populates="thumbnails")
    
    def __repr__(self):
        return f"<FileThumbnail(id={self.id}, file_id={self.file_id}, type={self.thumbnail_type})>"


class FileMetadataExtended(Base):
    """Metadatos extendidos de archivos"""
    
    __tablename__ = "file_metadata_extended"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False, unique=True)
    
    # Metadatos del archivo original
    original_format = Column(String(50), nullable=True)
    software_version = Column(String(100), nullable=True)
    created_with = Column(String(100), nullable=True)
    
    # Propiedades del modelo 3D/CAD
    units = Column(String(20), nullable=True)
    scale = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    
    # Información geométrica
    bounding_box = Column(JSON, nullable=True)  # {min: {x,y,z}, max: {x,y,z}}
    element_count = Column(Integer, nullable=True)
    face_count = Column(Integer, nullable=True)
    vertex_count = Column(Integer, nullable=True)
    
    # Información del proyecto/modelo
    discipline = Column(String(100), nullable=True)
    category = Column(String(100), nullable=True)
    level_of_detail = Column(String(50), nullable=True)
    
    # Información de autoría
    original_author = Column(String(200), nullable=True)
    organization = Column(String(200), nullable=True)
    copyright_info = Column(Text, nullable=True)
    
    # Tags y clasificación
    tags = Column(JSON, nullable=True)  # Array de strings
    custom_properties = Column(JSON, nullable=True)  # Propiedades personalizadas
    
    # Información de calidad
    has_materials = Column(Boolean, default=False, nullable=False)
    has_textures = Column(Boolean, default=False, nullable=False)
    has_lighting = Column(Boolean, default=False, nullable=False)
    has_animation = Column(Boolean, default=False, nullable=False)
    
    # Información de compatibilidad
    min_viewer_version = Column(String(50), nullable=True)
    supported_features = Column(JSON, nullable=True)
    
    # Timestamps
    extracted_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relaciones
    file = relationship("File", back_populates="extended_metadata", uselist=False)
    
    def __repr__(self):
        return f"<FileMetadataExtended(id={self.id}, file_id={self.file_id})>"
    
    @property
    def complexity_score(self) -> float:
        """Calcular puntuación de complejidad del modelo"""
        score = 0.0
        
        if self.element_count:
            score += min(self.element_count / 10000, 5.0)  # Max 5 puntos por elementos
        
        if self.face_count:
            score += min(self.face_count / 100000, 3.0)  # Max 3 puntos por caras
        
        if self.has_materials:
            score += 1.0
        if self.has_textures:
            score += 1.0
        if self.has_lighting:
            score += 0.5
        if self.has_animation:
            score += 0.5
        
        return min(score, 10.0)  # Máximo 10
    
    def get_summary(self) -> Dict[str, Any]:
        """Obtener resumen de metadatos"""
        return {
            'format': self.original_format,
            'software': self.created_with,
            'units': self.units,
            'discipline': self.discipline,
            'category': self.category,
            'complexity_score': self.complexity_score,
            'has_materials': self.has_materials,
            'has_textures': self.has_textures,
            'element_count': self.element_count,
            'tags': self.tags or []
        }


# Actualizar modelo File para incluir nuevas relaciones
def extend_file_model():
    """Función para extender el modelo File con nuevas relaciones"""
    from app.models.file import File
    
    # Agregar relaciones al modelo File existente
    File.versions = relationship("FileVersion", back_populates="file", cascade="all, delete-orphan")
    File.shares = relationship("FileShare", back_populates="file", cascade="all, delete-orphan")
    File.processing_jobs = relationship("FileProcessingJob", back_populates="file", cascade="all, delete-orphan")
    File.thumbnails = relationship("FileThumbnail", back_populates="file", cascade="all, delete-orphan")
    File.extended_metadata = relationship("FileMetadataExtended", back_populates="file", uselist=False, cascade="all, delete-orphan")
    
    # Agregar propiedades útiles
    @property
    def current_version(self) -> Optional["FileVersion"]:
        """Obtener versión actual del archivo"""
        if not self.versions:
            return None
        return max(self.versions, key=lambda v: v.version_number)
    
    @property
    def is_shared(self) -> bool:
        """Verificar si el archivo está compartido"""
        return len([share for share in self.shares if not share.is_expired]) > 0
    
    @property
    def active_processing_jobs(self) -> List["FileProcessingJob"]:
        """Obtener jobs de procesamiento activos"""
        return [job for job in self.processing_jobs if not job.is_completed]
    
    @property
    def available_thumbnails(self) -> List["FileThumbnail"]:
        """Obtener thumbnails disponibles"""
        return [thumb for thumb in self.thumbnails if thumb.status == "completed"]
    
    # Asignar propiedades al modelo
    File.current_version = current_version
    File.is_shared = is_shared
    File.active_processing_jobs = active_processing_jobs
    File.available_thumbnails = available_thumbnails


# Ejecutar extensión del modelo
extend_file_model()
