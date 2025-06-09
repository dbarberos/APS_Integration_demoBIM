"""
Esquemas Pydantic para APS (Autodesk Platform Services)
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class BucketPolicy(str, Enum):
    """Políticas de bucket de APS"""
    TRANSIENT = "transient"
    TEMPORARY = "temporary"
    PERSISTENT = "persistent"


class BucketCreate(BaseModel):
    """Esquema para creación de bucket"""
    bucket_key: str
    policy: BucketPolicy = BucketPolicy.TEMPORARY


class BucketResponse(BaseModel):
    """Esquema de respuesta de bucket"""
    bucket_key: str
    bucket_owner: str
    created_date: datetime
    policy: str
    permissions: List[Dict[str, Any]]


class FileUploadResponse(BaseModel):
    """Esquema de respuesta de subida de archivo"""
    bucket_key: str
    object_id: str
    object_key: str
    sha1: str
    size: int
    content_type: str
    location: str
    urn: str  # URN codificado en base64


class TranslationFormat(str, Enum):
    """Formatos de traducción disponibles"""
    SVF = "svf"
    SVF2 = "svf2"
    THUMBNAIL = "thumbnail"
    STL = "stl"
    STEP = "step"
    IGES = "iges"


class ModelTranslationRequest(BaseModel):
    """Esquema para solicitud de traducción"""
    urn: str
    output_formats: List[TranslationFormat] = [TranslationFormat.SVF2]
    force: bool = False


class ModelTranslationResponse(BaseModel):
    """Esquema de respuesta de traducción"""
    type: str
    urn: str
    result: str
    accepted_jobs: Dict[str, Any]
    
    
class TranslationStatus(str, Enum):
    """Estados de traducción"""
    PENDING = "pending"
    INPROGRESS = "inprogress"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"


class TranslationProgress(BaseModel):
    """Esquema de progreso de traducción"""
    type: str
    urn: str
    region: str
    version: str
    status: TranslationStatus
    progress: str
    success: str
    
    
class ModelMetadata(BaseModel):
    """Esquema de metadatos de modelo"""
    type: str
    name: str
    guid: str
    role: str
    status: str
    progress: str
    children: List[Dict[str, Any]]


class ViewerToken(BaseModel):
    """Esquema para token del viewer"""
    access_token: str
    token_type: str
    expires_in: int


class DerivativeManifest(BaseModel):
    """Esquema para manifest de derivatives"""
    type: str
    hasThumbnail: str
    status: str
    progress: str
    region: str
    urn: str
    version: str
    derivatives: List[Dict[str, Any]]