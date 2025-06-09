"""
Modelo de proyecto
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Project(Base):
    """Modelo de proyecto del sistema"""
    
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    bucket_key = Column(String(255), unique=True, nullable=False, index=True)
    
    # Relación con usuario
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="projects")
    
    # Metadatos APS
    aps_bucket_region = Column(String(50), default="US", nullable=False)
    aps_bucket_policy = Column(String(50), default="temporary", nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relaciones
    files = relationship("File", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}', bucket_key='{self.bucket_key}')>"
    
    @property
    def files_count(self) -> int:
        """Número de archivos en el proyecto"""
        return len(self.files) if self.files else 0
