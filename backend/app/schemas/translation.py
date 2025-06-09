"""
Schemas para API de traducción de modelos
"""
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field, validator
from enum import Enum

from app.models.translation_job import TranslationStatus, OutputFormat, TranslationPriority


class TranslationStatusEnum(str, Enum):
    """Estados de traducción para API"""
    PENDING = "pending"
    INPROGRESS = "inprogress"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class OutputFormatEnum(str, Enum):
    """Formatos de salida para API"""
    SVF = "svf"
    SVF2 = "svf2"
    THUMBNAIL = "thumbnail"
    STL = "stl"
    STEP = "step"
    IGES = "iges"
    OBJ = "obj"
    GLTF = "gltf"


class QualityLevelEnum(str, Enum):
    """Niveles de calidad"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TranslationPriorityEnum(str, Enum):
    """Prioridades de traducción"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


# Schemas de entrada (Request)
class TranslationRequest(BaseModel):
    """Solicitud de traducción"""
    file_id: int = Field(..., description="ID del archivo a traducir")
    output_formats: List[OutputFormatEnum] = Field(
        default=[OutputFormatEnum.SVF2, OutputFormatEnum.THUMBNAIL],
        description="Formatos de salida deseados"
    )
    quality_level: QualityLevelEnum = Field(
        default=QualityLevelEnum.MEDIUM,
        description="Nivel de calidad de traducción"
    )
    priority: TranslationPriorityEnum = Field(
        default=TranslationPriorityEnum.NORMAL,
        description="Prioridad del trabajo"
    )
    config_name: Optional[str] = Field(
        None,
        description="Nombre de configuración predefinida"
    )
    custom_config: Optional[Dict[str, Any]] = Field(
        None,
        description="Configuración personalizada"
    )
    auto_extract_metadata: bool = Field(
        default=True,
        description="Extraer metadatos automáticamente"
    )
    generate_thumbnails: bool = Field(
        default=True,
        description="Generar thumbnails automáticamente"
    )
    
    @validator('output_formats')
    def validate_output_formats(cls, v):
        if not v:
            raise ValueError("Debe especificar al menos un formato de salida")
        if len(v) > 5:
            raise ValueError("Máximo 5 formatos de salida permitidos")
        return v
    
    @validator('custom_config')
    def validate_custom_config(cls, v):
        if v and not isinstance(v, dict):
            raise ValueError("custom_config debe ser un diccionario")
        return v


class TranslationRetryRequest(BaseModel):
    """Solicitud de reintento de traducción"""
    reset_retry_count: bool = Field(
        default=False,
        description="Reiniciar contador de reintentos"
    )
    new_config: Optional[Dict[str, Any]] = Field(
        None,
        description="Nueva configuración para el reintento"
    )


class TranslationCancelRequest(BaseModel):
    """Solicitud de cancelación de traducción"""
    reason: Optional[str] = Field(
        None,
        description="Razón de la cancelación"
    )
    delete_manifest: bool = Field(
        default=True,
        description="Eliminar manifest de APS"
    )


# Schemas de salida (Response)
class TranslationSummary(BaseModel):
    """Resumen de trabajo de traducción"""
    id: int
    job_id: str
    internal_id: str
    file_id: int
    status: TranslationStatusEnum
    progress: float = Field(..., ge=0.0, le=100.0)
    progress_message: Optional[str]
    output_formats: List[str]
    priority: str
    retry_count: int
    max_retries: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_seconds: Optional[int]
    estimated_completion: Optional[datetime]
    can_retry: bool
    is_completed: bool
    is_active: bool
    
    class Config:
        from_attributes = True


class TranslationProgress(BaseModel):
    """Progreso detallado de traducción"""
    job_id: str
    status: TranslationStatusEnum
    progress: float = Field(..., ge=0.0, le=100.0)
    progress_message: Optional[str]
    current_step: Optional[str]
    estimated_time_remaining: Optional[int]  # segundos
    last_updated: datetime
    warnings: List[str] = []
    
    class Config:
        from_attributes = True


class DerivativeInfo(BaseModel):
    """Información de derivative"""
    name: str
    status: str
    progress: str
    output_type: str
    size: Optional[int] = None
    mime: Optional[str] = None
    children: List[Dict[str, Any]] = []


class ManifestResponse(BaseModel):
    """Respuesta de manifest completo"""
    job_id: str
    type: str
    region: str
    version: str
    status: str
    progress: str
    derivatives: List[DerivativeInfo]
    thumbnails: List[Dict[str, Any]] = []
    metadata: Dict[str, Any] = {}
    warnings: List[str] = []
    
    class Config:
        from_attributes = True


class QualityMetrics(BaseModel):
    """Métricas de calidad de traducción"""
    overall_quality_score: float = Field(..., ge=0.0, le=1.0)
    completeness_score: float = Field(..., ge=0.0, le=1.0)
    consistency_score: float = Field(..., ge=0.0, le=1.0)
    detail_level_score: float = Field(..., ge=0.0, le=1.0)
    organization_score: float = Field(..., ge=0.0, le=1.0)
    translation_success: bool
    derivatives_count: int
    has_geometry: bool
    has_materials: bool
    complexity_score: float = Field(..., ge=0.0, le=1.0)
    
    class Config:
        from_attributes = True


class ModelStatistics(BaseModel):
    """Estadísticas del modelo"""
    element_count: int
    property_count: int
    avg_properties_per_element: float
    unique_categories: int
    file_complexity_score: float = Field(..., ge=0.0, le=1.0)
    hierarchy_depth: int
    total_nodes: int
    leaf_nodes: int
    
    class Config:
        from_attributes = True


class DisciplineAnalysis(BaseModel):
    """Análisis de disciplinas"""
    primary_discipline: str
    disciplines: Dict[str, int]
    discipline_count: int
    category_mapping: Dict[str, str]
    
    class Config:
        from_attributes = True


class MetadataExtracted(BaseModel):
    """Metadatos extraídos del modelo"""
    extraction_timestamp: datetime
    source_info: Dict[str, Any]
    model_info: Dict[str, Any]
    geometry_info: Dict[str, Any]
    material_info: Dict[str, Any]
    units_info: Dict[str, Any]
    hierarchy_info: Dict[str, Any]
    categories_analysis: Dict[str, Any]
    discipline_analysis: DisciplineAnalysis
    properties_summary: Dict[str, Any]
    quality_metrics: QualityMetrics
    statistics: ModelStatistics
    recommendations: List[str]
    
    class Config:
        from_attributes = True


class TranslationDetails(BaseModel):
    """Detalles completos de traducción"""
    id: int
    job_id: str
    internal_id: str
    file_id: int
    user_id: int
    source_urn: str
    output_formats: List[str]
    priority: str
    status: TranslationStatusEnum
    progress: float
    progress_message: Optional[str]
    translation_config: Optional[Dict[str, Any]]
    advanced_options: Optional[Dict[str, Any]]
    output_urns: Optional[Dict[str, Any]]
    quality_metrics: Optional[QualityMetrics]
    metadata_extracted: Optional[MetadataExtracted]
    hierarchy_data: Optional[Dict[str, Any]]
    warnings: List[str] = []
    error_message: Optional[str]
    error_code: Optional[str]
    retry_count: int
    max_retries: int
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    last_checked_at: Optional[datetime]
    estimated_duration: Optional[int]
    actual_duration: Optional[int]
    polling_interval: int
    polling_enabled: bool
    
    class Config:
        from_attributes = True


class TranslationResponse(BaseModel):
    """Respuesta de inicio de traducción"""
    success: bool
    job_id: str
    internal_id: str
    status: TranslationStatusEnum
    message: str
    estimated_duration: Optional[int]
    polling_url: str
    manifest_url: Optional[str]
    metadata_url: Optional[str]
    
    class Config:
        from_attributes = True


class TranslationListResponse(BaseModel):
    """Respuesta de lista de traducciones"""
    translations: List[TranslationSummary]
    total: int
    page: int
    per_page: int
    pages: int
    has_next: bool
    has_prev: bool
    
    class Config:
        from_attributes = True


class TranslationMetricsResponse(BaseModel):
    """Respuesta de métricas de traducción"""
    job_id: str
    queue_time: Optional[int]
    processing_time: Optional[int]
    total_time: Optional[int]
    geometry_quality: Optional[float]
    texture_quality: Optional[float]
    material_accuracy: Optional[float]
    input_file_size: Optional[int]
    output_file_size: Optional[int]
    compression_ratio: Optional[float]
    vertex_count: Optional[int]
    face_count: Optional[int]
    object_count: Optional[int]
    load_time: Optional[float]
    render_performance: Optional[float]
    warnings_count: int
    errors_count: int
    overall_quality_score: float
    efficiency_score: float
    measured_at: datetime
    
    class Config:
        from_attributes = True


class TranslationConfigSchema(BaseModel):
    """Schema de configuración de traducción"""
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    file_extensions: List[str] = Field(..., min_items=1)
    default_output_formats: List[OutputFormatEnum] = Field(..., min_items=1)
    svf_config: Optional[Dict[str, Any]] = None
    svf2_config: Optional[Dict[str, Any]] = None
    thumbnail_config: Optional[Dict[str, Any]] = None
    advanced_options: Optional[Dict[str, Any]] = None
    quality_settings: Optional[Dict[str, Any]] = None
    polling_interval: int = Field(default=30, ge=10, le=300)
    max_polling_duration: int = Field(default=3600, ge=300, le=7200)
    max_retries: int = Field(default=3, ge=0, le=10)
    retry_delay: int = Field(default=60, ge=30, le=600)
    default_priority: TranslationPriorityEnum = Field(default=TranslationPriorityEnum.NORMAL)
    is_active: bool = Field(default=True)
    is_default: bool = Field(default=False)
    
    @validator('file_extensions')
    def validate_extensions(cls, v):
        for ext in v:
            if not ext.startswith('.'):
                raise ValueError("Extensiones deben comenzar con punto")
            if len(ext) < 2:
                raise ValueError("Extensión demasiado corta")
        return v
    
    class Config:
        from_attributes = True


class TranslationConfigResponse(BaseModel):
    """Respuesta de configuración de traducción"""
    id: int
    name: str
    description: Optional[str]
    file_extensions: List[str]
    default_output_formats: List[str]
    svf_config: Optional[Dict[str, Any]]
    svf2_config: Optional[Dict[str, Any]]
    thumbnail_config: Optional[Dict[str, Any]]
    advanced_options: Optional[Dict[str, Any]]
    quality_settings: Optional[Dict[str, Any]]
    polling_interval: int
    max_polling_duration: int
    max_retries: int
    retry_delay: int
    default_priority: str
    is_active: bool
    is_default: bool
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SupportedFormatsResponse(BaseModel):
    """Respuesta de formatos soportados"""
    input_formats: List[str]
    output_formats: List[str]
    format_details: Dict[str, Dict[str, Any]]
    last_updated: datetime
    
    class Config:
        from_attributes = True


class TranslationStatsResponse(BaseModel):
    """Respuesta de estadísticas de traducción"""
    total_translations: int
    successful_translations: int
    failed_translations: int
    pending_translations: int
    success_rate: float
    avg_processing_time: Optional[float]
    avg_queue_time: Optional[float]
    popular_formats: Dict[str, int]
    translations_by_day: Dict[str, int]
    translations_by_status: Dict[str, int]
    avg_file_size: Optional[float]
    total_processing_time: Optional[int]
    
    class Config:
        from_attributes = True


# Schemas para errores
class TranslationError(BaseModel):
    """Error de traducción"""
    error_code: str
    error_message: str
    job_id: Optional[str] = None
    retry_possible: bool = False
    retry_after: Optional[int] = None  # segundos
    details: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True


class ValidationError(BaseModel):
    """Error de validación"""
    field: str
    message: str
    invalid_value: Any
    
    class Config:
        from_attributes = True


# Schemas para webhooks
class TranslationWebhookPayload(BaseModel):
    """Payload de webhook de traducción"""
    job_id: str
    status: TranslationStatusEnum
    progress: float
    message: Optional[str]
    timestamp: datetime
    file_id: int
    user_id: int
    output_formats: List[str]
    error: Optional[str] = None
    
    class Config:
        from_attributes = True
