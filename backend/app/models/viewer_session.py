"""
Modelo de sesión de viewer
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timedelta

from app.core.database import Base


class ViewerSession(Base):
    """Modelo de sesión de visualización"""
    
    __tablename__ = "viewer_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), unique=True, nullable=False, index=True)
    
    # Relaciones
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="viewer_sessions")
    
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    file = relationship("File", back_populates="viewer_sessions")
    
    # Información de sesión
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(String(500), nullable=True)
    
    # Timestamps
    started_at = Column(DateTime, default=func.now(), nullable=False)
    ended_at = Column(DateTime, nullable=True)
    last_activity = Column(DateTime, default=func.now(), nullable=False)
    
    def __repr__(self):
        return f"<ViewerSession(id={self.id}, session_id='{self.session_id}')>"
    
    @property
    def duration_minutes(self) -> int:
        """Duración de la sesión en minutos"""
        end_time = self.ended_at or datetime.utcnow()
        duration = end_time - self.started_at
        return int(duration.total_seconds() / 60)
    
    @property
    def is_active(self) -> bool:
        """Verificar si la sesión está activa"""
        if self.ended_at:
            return False
        # Considerar inactiva si no hay actividad en más de 30 minutos
        inactive_threshold = datetime.utcnow() - timedelta(minutes=30)
        return self.last_activity > inactive_threshold
    
    def end_session(self):
        """Finalizar la sesión"""
        self.ended_at = datetime.utcnow()
    
    def update_activity(self):
        """Actualizar última actividad"""
        self.last_activity = datetime.utcnow()
