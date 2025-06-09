"""
Modelo de archivo
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, BigInteger, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum

from app.core.database import Base


class FileStatus(str, Enum):
    """Estados de archivo"""
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    TRANSLATING = "translating"
    READY = "ready"
    ERROR = "error"


class File(Base):
    """Modelo de archivo del sistema"""
    
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=True)
    size = Column(BigInteger, nullable=True)
    
    # Información APS
    urn = Column(Text, unique=True, nullable=False, index=True)
    object_key = Column(String(255), nullable=False)
    bucket_key = Column(String(255), nullable=False)
    
    # Estado de procesamiento
    status = Column(String(50), default=FileStatus.UPLOADED, nullable=False, index=True)
    
    # Metadatos de traducción
    translation_job_id = Column(String(255), nullable=True)
    translation_progress = Column(String(50), default="0%", nullable=False)
    translation_error = Column(Text, nullable=True)
    metadata = Column(JSON, nullable=True)
    
    # Relación con proyecto
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    project = relationship("Project", back_populates="files")
    
    # Timestamps
    uploaded_at = Column(DateTime, default=func.now(), nullable=False)
    translated_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relaciones
    viewer_sessions = relationship("ViewerSession", back_populates="file", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<File(id={self.id}, name='{self.name}', status='{self.status}')>"
    
    @property
    def is_ready_for_viewing(self) -> bool:
        """Verificar si el archivo está listo para visualización"""
        return self.status == FileStatus.READY
    
    @property
    def size_mb(self) -> float:
        """Tamaño del archivo en MB"""
        if self.size:
            return round(self.size / (1024 * 1024), 2)
        return 0.0
