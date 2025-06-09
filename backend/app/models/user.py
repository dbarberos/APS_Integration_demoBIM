"""
Modelo de usuario
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

from app.core.database import Base


class User(Base):
    """Modelo de usuario del sistema"""
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    
    # Campos APS específicos
    aps_user_id = Column(String(255), nullable=True, unique=True)
    aps_access_token = Column(Text, nullable=True)
    aps_refresh_token = Column(Text, nullable=True)
    aps_token_expires_at = Column(DateTime, nullable=True)
    
    # Metadatos
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    last_login = Column(DateTime, nullable=True)
    
    # Relaciones
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    viewer_sessions = relationship("ViewerSession", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}')>"
    
    @property
    def is_aps_authenticated(self) -> bool:
        """Verificar si el usuario tiene tokens APS válidos"""
        if not self.aps_access_token or not self.aps_token_expires_at:
            return False
        return self.aps_token_expires_at > datetime.utcnow()
