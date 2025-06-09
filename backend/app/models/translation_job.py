"""
Modelos para trabajos de traducción de modelos
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import uuid

from app.core.database import Base


class TranslationStatus(str, PyEnum):
    """Estados de traducción"""
    PENDING = "pending"
    INPROGRESS = "inprogress"
    SUCCESS = "success" 
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class OutputFormat(str, PyEnum):
    """Formatos de salida soportados"""
    SVF = "svf"
    SVF2 = "svf2"
    THUMBNAIL = "thumbnail"
    STL = "stl"
    STEP = "step"
    IGES = "iges"
    OBJ = "obj"
    GLTF = "gltf"


class TranslationPriority(str, PyEnum):
    """Prioridades de traducción"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class TranslationJob(Base):
    """Modelo de trabajo de traducción"""
    
    __tablename__ = "translation_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Identificadores
    job_id = Column(String(255), unique=True, nullable=False, index=True)  # ID de APS
    internal_id = Column(String(255), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    
    # Relaciones
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Información del trabajo
    source_urn = Column(Text, nullable=False)
    output_formats = Column(JSON, nullable=False)  # Lista de formatos solicitados
    priority = Column(String(20), default=TranslationPriority.NORMAL, nullable=False)
    
    # Estado y progreso
    status = Column(String(20), default=TranslationStatus.PENDING, nullable=False, index=True)
    progress = Column(Float, default=0.0, nullable=False)
    progress_message = Column(Text, nullable=True)
    
    # Configuración de traducción
    translation_config = Column(JSON, nullable=True)  # Configuración específica
    advanced_options = Column(JSON, nullable=True)    # Opciones avanzadas
    
    # Resultados
    output_urns = Column(JSON, nullable=True)          # URNs de salida por formato
    manifest_data = Column(JSON, nullable=True)        # Manifest completo
    metadata_extracted = Column(JSON, nullable=True)   # Metadatos extraídos
    hierarchy_data = Column(JSON, nullable=True)       # Jerarquía de componentes
    
    # Información de calidad
    quality_metrics = Column(JSON, nullable=True)      # Métricas de calidad
    warnings = Column(JSON, nullable=True)             # Advertencias durante traducción
    
    # Manejo de errores
    error_message = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    last_checked_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    # Configuración de polling
    polling_interval = Column(Integer, default=30, nullable=False)  # segundos
    polling_enabled = Column(Boolean, default=True, nullable=False)
    
    # Métricas de performance
    estimated_duration = Column(Integer, nullable=True)  # segundos estimados
    actual_duration = Column(Integer, nullable=True)     # duración real
    
    # Relaciones
    file = relationship("File", back_populates="translation_jobs")
    user = relationship("User")
    
    def __repr__(self):
        return f"<TranslationJob(id={self.id}, job_id='{self.job_id}', status='{self.status}')>"
    
    @property
    def is_completed(self) -> bool:
        """Verificar si la traducción está completada"""
        return self.status in [TranslationStatus.SUCCESS, TranslationStatus.FAILED, 
                              TranslationStatus.TIMEOUT, TranslationStatus.CANCELLED]
    
    @property
    def is_active(self) -> bool:
        """Verificar si la traducción está activa"""
        return self.status in [TranslationStatus.PENDING, TranslationStatus.INPROGRESS]
    
    @property
    def can_retry(self) -> bool:
        """Verificar si se puede reintentar"""
        return (self.status in [TranslationStatus.FAILED, TranslationStatus.TIMEOUT] and 
                self.retry_count < self.max_retries)
    
    @property
    def duration_seconds(self) -> Optional[int]:
        """Duración del trabajo en segundos"""
        if not self.started_at:
            return None
        
        end_time = self.completed_at or datetime.utcnow()
        return int((end_time - self.started_at).total_seconds())
    
    @property
    def estimated_completion(self) -> Optional[datetime]:
        """Tiempo estimado de finalización"""
        if not self.started_at or not self.estimated_duration:
            return None
        
        return self.started_at + timedelta(seconds=self.estimated_duration)
    
    @property
    def success_rate(self) -> float:
        """Tasa de éxito basada en reintentos"""
        total_attempts = self.retry_count + 1
        if self.status == TranslationStatus.SUCCESS:
            return 1.0
        elif self.status in [TranslationStatus.FAILED, TranslationStatus.TIMEOUT]:
            return 0.0
        else:
            return 0.5  # En progreso
    
    def update_progress(self, progress: float, message: str = None):
        """Actualizar progreso de traducción"""
        self.progress = max(0.0, min(100.0, progress))
        if message:
            self.progress_message = message
        self.last_checked_at = datetime.utcnow()
    
    def mark_started(self):
        """Marcar como iniciado"""
        self.status = TranslationStatus.INPROGRESS
        self.started_at = datetime.utcnow()
        self.last_checked_at = datetime.utcnow()
    
    def mark_completed(self, status: TranslationStatus, result_data: Dict = None):
        """Marcar como completado"""
        self.status = status
        self.completed_at = datetime.utcnow()
        self.progress = 100.0 if status == TranslationStatus.SUCCESS else self.progress
        
        if result_data:
            if 'manifest' in result_data:
                self.manifest_data = result_data['manifest']
            if 'metadata' in result_data:
                self.metadata_extracted = result_data['metadata']
            if 'hierarchy' in result_data:
                self.hierarchy_data = result_data['hierarchy']
            if 'output_urns' in result_data:
                self.output_urns = result_data['output_urns']
            if 'quality_metrics' in result_data:
                self.quality_metrics = result_data['quality_metrics']
    
    def mark_failed(self, error_message: str, error_code: str = None):
        """Marcar como fallido"""
        self.status = TranslationStatus.FAILED
        self.error_message = error_message
        self.error_code = error_code
        self.completed_at = datetime.utcnow()
    
    def increment_retry(self):
        """Incrementar contador de reintentos"""
        self.retry_count += 1
        self.status = TranslationStatus.PENDING
        self.error_message = None
        self.error_code = None
    
    def get_output_urn(self, format_type: str) -> Optional[str]:
        """Obtener URN de salida para formato específico"""
        if not self.output_urns:
            return None
        
        return self.output_urns.get(format_type)
    
    def get_summary(self) -> Dict[str, Any]:
        """Obtener resumen del trabajo"""
        return {
            'id': self.id,
            'job_id': self.job_id,
            'internal_id': self.internal_id,
            'file_id': self.file_id,
            'status': self.status,
            'progress': self.progress,
            'progress_message': self.progress_message,
            'output_formats': self.output_formats,
            'priority': self.priority,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'duration_seconds': self.duration_seconds,
            'estimated_completion': self.estimated_completion.isoformat() if self.estimated_completion else None,
            'can_retry': self.can_retry,
            'is_completed': self.is_completed,
            'is_active': self.is_active
        }


class TranslationConfig(Base):
    """Configuración de traducción"""
    
    __tablename__ = "translation_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    
    # Configuración por formato de archivo
    file_extensions = Column(JSON, nullable=False)  # ['.rvt', '.ifc', etc.]
    
    # Configuración de salida
    default_output_formats = Column(JSON, nullable=False)
    svf_config = Column(JSON, nullable=True)
    svf2_config = Column(JSON, nullable=True)
    thumbnail_config = Column(JSON, nullable=True)
    
    # Configuración avanzada
    advanced_options = Column(JSON, nullable=True)
    quality_settings = Column(JSON, nullable=True)
    
    # Configuración de polling
    polling_interval = Column(Integer, default=30, nullable=False)
    max_polling_duration = Column(Integer, default=3600, nullable=False)  # 1 hora
    
    # Configuración de reintentos
    max_retries = Column(Integer, default=3, nullable=False)
    retry_delay = Column(Integer, default=60, nullable=False)  # segundos
    
    # Configuración de prioridad
    default_priority = Column(String(20), default=TranslationPriority.NORMAL, nullable=False)
    
    # Metadatos
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relaciones
    created_by = relationship("User")
    
    def __repr__(self):
        return f"<TranslationConfig(id={self.id}, name='{self.name}')>"
    
    def get_config_for_format(self, format_type: str) -> Dict[str, Any]:
        """Obtener configuración específica para formato"""
        if format_type == "svf" and self.svf_config:
            return self.svf_config
        elif format_type == "svf2" and self.svf2_config:
            return self.svf2_config
        elif format_type == "thumbnail" and self.thumbnail_config:
            return self.thumbnail_config
        else:
            return {}
    
    def supports_extension(self, extension: str) -> bool:
        """Verificar si soporta extensión de archivo"""
        return extension.lower() in [ext.lower() for ext in self.file_extensions]


class TranslationMetrics(Base):
    """Métricas de traducción para análisis"""
    
    __tablename__ = "translation_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    translation_job_id = Column(Integer, ForeignKey("translation_jobs.id"), nullable=False)
    
    # Métricas de tiempo
    queue_time = Column(Integer, nullable=True)      # Tiempo en cola (segundos)
    processing_time = Column(Integer, nullable=True) # Tiempo de procesamiento
    total_time = Column(Integer, nullable=True)      # Tiempo total
    
    # Métricas de calidad
    geometry_quality = Column(Float, nullable=True)   # Calidad de geometría (0-1)
    texture_quality = Column(Float, nullable=True)    # Calidad de texturas
    material_accuracy = Column(Float, nullable=True)  # Precisión de materiales
    
    # Métricas de tamaño
    input_file_size = Column(Integer, nullable=True)  # Tamaño archivo original
    output_file_size = Column(Integer, nullable=True) # Tamaño archivo traducido
    compression_ratio = Column(Float, nullable=True)  # Ratio de compresión
    
    # Métricas de geometría
    vertex_count = Column(Integer, nullable=True)     # Número de vértices
    face_count = Column(Integer, nullable=True)       # Número de caras
    object_count = Column(Integer, nullable=True)     # Número de objetos
    
    # Métricas de viewer
    load_time = Column(Float, nullable=True)          # Tiempo de carga en viewer
    render_performance = Column(Float, nullable=True) # Performance de renderizado
    
    # Información adicional
    warnings_count = Column(Integer, default=0, nullable=False)
    errors_count = Column(Integer, default=0, nullable=False)
    
    # Timestamps
    measured_at = Column(DateTime, default=func.now(), nullable=False)
    
    # Relaciones
    translation_job = relationship("TranslationJob")
    
    def __repr__(self):
        return f"<TranslationMetrics(id={self.id}, job_id={self.translation_job_id})>"
    
    @property
    def overall_quality_score(self) -> float:
        """Puntuación general de calidad"""
        scores = []
        
        if self.geometry_quality is not None:
            scores.append(self.geometry_quality * 0.4)  # 40% peso
        
        if self.texture_quality is not None:
            scores.append(self.texture_quality * 0.3)   # 30% peso
        
        if self.material_accuracy is not None:
            scores.append(self.material_accuracy * 0.3) # 30% peso
        
        return sum(scores) if scores else 0.0
    
    @property
    def efficiency_score(self) -> float:
        """Puntuación de eficiencia"""
        if not self.total_time or not self.input_file_size:
            return 0.0
        
        # Bytes por segundo procesados
        throughput = self.input_file_size / self.total_time
        
        # Normalizar a una escala 0-1 (asumiendo 1MB/s como baseline)
        baseline_throughput = 1024 * 1024  # 1MB/s
        return min(1.0, throughput / baseline_throughput)


# Actualizar modelo File para incluir relación con trabajos de traducción
def extend_file_model_with_translation():
    """Función para extender el modelo File con relaciones de traducción"""
    from app.models.file import File
    
    # Agregar relación al modelo File existente
    File.translation_jobs = relationship("TranslationJob", back_populates="file", cascade="all, delete-orphan")
    
    # Agregar propiedades útiles
    @property
    def active_translation_job(self) -> Optional["TranslationJob"]:
        """Obtener trabajo de traducción activo"""
        for job in self.translation_jobs:
            if job.is_active:
                return job
        return None
    
    @property
    def latest_translation_job(self) -> Optional["TranslationJob"]:
        """Obtener último trabajo de traducción"""
        if not self.translation_jobs:
            return None
        return max(self.translation_jobs, key=lambda j: j.created_at)
    
    @property
    def successful_translation_jobs(self) -> List["TranslationJob"]:
        """Obtener trabajos de traducción exitosos"""
        return [job for job in self.translation_jobs if job.status == TranslationStatus.SUCCESS]
    
    @property
    def translation_success_rate(self) -> float:
        """Tasa de éxito de traducciones"""
        if not self.translation_jobs:
            return 0.0
        
        successful = len(self.successful_translation_jobs)
        total = len(self.translation_jobs)
        return successful / total
    
    # Asignar propiedades al modelo
    File.active_translation_job = active_translation_job
    File.latest_translation_job = latest_translation_job
    File.successful_translation_jobs = successful_translation_jobs
    File.translation_success_rate = translation_success_rate


# Ejecutar extensión del modelo
extend_file_model_with_translation()
