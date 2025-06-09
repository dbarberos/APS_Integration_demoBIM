"""
Esquemas Pydantic para archivos
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class FileStatus(str, Enum):
    """Estados de archivo"""
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    TRANSLATING = "translating"
    READY = "ready"
    ERROR = "error"


class FileBase(BaseModel):
    """Esquema base de archivo"""
    name: str
    original_filename: str
    size: int
    project_id: int


class FileUploadResponse(BaseModel):
    """Esquema de respuesta de subida de archivo"""
    id: int
    name: str
    original_filename: str
    urn: str
    project_id: int
    status: FileStatus
    size: int
    uploaded_at: datetime


class FileMetadata(BaseModel):
    """Esquema de metadatos de archivo"""
    guid: str
    type: str
    name: str
    progress: str
    children: Optional[List[Dict[str, Any]]] = None


class FileResponse(FileBase):
    """Esquema de respuesta completa de archivo"""
    id: int
    urn: str
    status: FileStatus
    uploaded_at: datetime
    translated_at: Optional[datetime] = None
    metadata: Optional[FileMetadata] = None
    
    class Config:
        from_attributes = True


class FileListItem(BaseModel):
    """Esquema de item en lista de archivos"""
    id: int
    name: str
    original_filename: str
    urn: str
    project_id: int
    status: FileStatus
    size: int
    uploaded_at: datetime
    translated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class FileListResponse(BaseModel):
    """Esquema de respuesta de lista de archivos"""
    items: List[FileListItem]
    total: int
    has_more: bool


class FileStatusResponse(BaseModel):
    """Esquema de respuesta de estado de archivo"""
    file_id: int
    status: FileStatus
    progress: str
    last_updated: datetime
    can_view: bool