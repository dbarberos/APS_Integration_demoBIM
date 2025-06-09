"""
Esquemas Pydantic para proyectos
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime


class ProjectBase(BaseModel):
    """Esquema base de proyecto"""
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    """Esquema para creación de proyecto"""
    pass


class ProjectUpdate(BaseModel):
    """Esquema para actualización de proyecto"""
    name: Optional[str] = None
    description: Optional[str] = None


class FileInProject(BaseModel):
    """Esquema simplificado de archivo en proyecto"""
    id: int
    name: str
    urn: str
    status: str
    uploaded_at: datetime


class ProjectResponse(ProjectBase):
    """Esquema de respuesta de proyecto"""
    id: int
    bucket_key: str
    created_at: datetime
    updated_at: datetime
    files: Optional[List[FileInProject]] = None
    files_count: Optional[int] = None
    
    class Config:
        from_attributes = True


class ProjectListItem(ProjectBase):
    """Esquema de item en lista de proyectos"""
    id: int
    bucket_key: str
    created_at: datetime
    updated_at: datetime
    files_count: int
    
    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    """Esquema de respuesta de lista de proyectos"""
    items: List[ProjectListItem]
    total: int
    has_more: bool