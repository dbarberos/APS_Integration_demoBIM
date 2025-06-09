"""
Endpoints de API para traducción de modelos
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
import structlog

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.file import File
from app.models.translation_job import (
    TranslationJob, TranslationStatus, TranslationConfig, 
    TranslationMetrics, TranslationPriority
)
from app.schemas.translation import (
    TranslationRequest, TranslationResponse, TranslationSummary,
    TranslationDetails, TranslationProgress, ManifestResponse,
    MetadataExtracted, TranslationListResponse, TranslationRetryRequest,
    TranslationCancelRequest, TranslationConfigSchema, TranslationConfigResponse,
    SupportedFormatsResponse, TranslationStatsResponse, TranslationMetricsResponse,
    TranslationError, TranslationWebhookPayload
)
from app.services.translation_manager import translation_manager, TranslationManagerError
from app.services.model_derivative import model_derivative_service, ModelDerivativeError
from app.services.metadata_extractor import metadata_extractor, MetadataExtractionError
from app.tasks.translation_tasks import (
    start_model_translation, monitor_translation_progress,
    retry_failed_translation, extract_translation_results
)

router = APIRouter()
logger = structlog.get_logger()


@router.post("/", response_model=TranslationResponse)
async def start_translation(
    translation_request: TranslationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Iniciar nueva traducción de modelo
    """
    try:
        logger.info("Iniciando traducción", 
                   user_id=current_user.id,
                   file_id=translation_request.file_id,
                   output_formats=translation_request.output_formats)
        
        # Verificar que el archivo existe y pertenece al usuario
        file_obj = db.query(File).filter(
            File.id == translation_request.file_id,
            File.user_id == current_user.id
        ).first()
        
        if not file_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Archivo no encontrado o sin permisos"
            )
        
        # Verificar que el archivo tenga URN
        if not file_obj.urn:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Archivo no tiene URN válido para traducción"
            )
        
        # Verificar si ya hay una traducción activa
        active_job = db.query(TranslationJob).filter(
            TranslationJob.file_id == translation_request.file_id,
            TranslationJob.status.in_([TranslationStatus.PENDING, TranslationStatus.INPROGRESS])
        ).first()
        
        if active_job:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe una traducción activa: {active_job.job_id}"
            )
        
        # Iniciar traducción usando el manager
        translation_job = await translation_manager.start_translation(
            file_id=translation_request.file_id,
            user_id=current_user.id,
            output_formats=translation_request.output_formats,
            quality_level=translation_request.quality_level,
            priority=translation_request.priority,
            config_name=translation_request.config_name,
            custom_config=translation_request.custom_config,
            db=db
        )
        
        # Programar tareas adicionales si están habilitadas
        if translation_request.auto_extract_metadata:
            background_tasks.add_task(
                extract_translation_results.delay,
                translation_job.job_id
            )
        
        # Construir URLs para seguimiento
        base_url = "/api/v1/translate"
        polling_url = f"{base_url}/{translation_job.job_id}/status"
        manifest_url = f"{base_url}/{translation_job.job_id}/manifest"
        metadata_url = f"{base_url}/{translation_job.job_id}/metadata"
        
        logger.info("Traducción iniciada exitosamente", 
                   job_id=translation_job.job_id,
                   internal_id=translation_job.internal_id)
        
        return TranslationResponse(
            success=True,
            job_id=translation_job.job_id,
            internal_id=translation_job.internal_id,
            status=translation_job.status,
            message="Traducción iniciada exitosamente",
            estimated_duration=translation_job.estimated_duration,
            polling_url=polling_url,
            manifest_url=manifest_url,
            metadata_url=metadata_url
        )
        
    except TranslationManagerError as e:
        logger.error("Error de Translation Manager", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Error inesperado iniciando traducción", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.get("/", response_model=TranslationListResponse)
async def list_translations(
    file_id: Optional[int] = Query(None, description="Filtrar por archivo"),
    status_filter: Optional[TranslationStatus] = Query(None, description="Filtrar por estado"),
    priority: Optional[TranslationPriority] = Query(None, description="Filtrar por prioridad"),
    page: int = Query(1, ge=1, description="Número de página"),
    per_page: int = Query(20, ge=1, le=100, description="Elementos por página"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Listar traducciones del usuario con filtros
    """
    try:
        # Construir query base
        query = db.query(TranslationJob).filter(
            TranslationJob.user_id == current_user.id
        )
        
        # Aplicar filtros
        if file_id:
            query = query.filter(TranslationJob.file_id == file_id)
        
        if status_filter:
            query = query.filter(TranslationJob.status == status_filter)
        
        if priority:
            query = query.filter(TranslationJob.priority == priority)
        
        # Ordenar por fecha de creación (más recientes primero)
        query = query.order_by(desc(TranslationJob.created_at))
        
        # Contar total
        total = query.count()
        
        # Aplicar paginación
        offset = (page - 1) * per_page
        translations = query.offset(offset).limit(per_page).all()
        
        # Calcular metadatos de paginación
        pages = (total + per_page - 1) // per_page
        has_next = page < pages
        has_prev = page > 1
        
        # Convertir a schemas
        translation_summaries = [
            TranslationSummary.from_orm(job) for job in translations
        ]
        
        return TranslationListResponse(
            translations=translation_summaries,
            total=total,
            page=page,
            per_page=per_page,
            pages=pages,
            has_next=has_next,
            has_prev=has_prev
        )
        
    except Exception as e:
        logger.error("Error listando traducciones", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.get("/{job_id}", response_model=TranslationDetails)
async def get_translation_details(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener detalles completos de traducción
    """
    try:
        # Buscar trabajo de traducción
        job = db.query(TranslationJob).filter(
            TranslationJob.job_id == job_id,
            TranslationJob.user_id == current_user.id
        ).first()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Traducción no encontrada"
            )
        
        return TranslationDetails.from_orm(job)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error obteniendo detalles", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.get("/{job_id}/status", response_model=TranslationProgress)
async def get_translation_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener estado actual de traducción
    """
    try:
        # Buscar trabajo
        job = db.query(TranslationJob).filter(
            TranslationJob.job_id == job_id,
            TranslationJob.user_id == current_user.id
        ).first()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Traducción no encontrada"
            )
        
        # Si está activa, obtener estado actualizado de APS
        if job.is_active:
            try:
                status_info = await model_derivative_service.get_translation_status(job.source_urn)
                
                # Actualizar job con nueva información
                job.update_progress(
                    status_info.get('progress', job.progress),
                    status_info.get('message', job.progress_message)
                )
                
                # Actualizar estado si cambió
                aps_status = status_info.get('status', 'unknown')
                if aps_status == 'success' and job.status != TranslationStatus.SUCCESS:
                    job.status = TranslationStatus.SUCCESS
                    job.completed_at = datetime.utcnow()
                elif aps_status == 'failed' and job.status != TranslationStatus.FAILED:
                    job.status = TranslationStatus.FAILED
                    job.completed_at = datetime.utcnow()
                    job.error_message = status_info.get('error', 'Translation failed')
                
                db.commit()
                
            except Exception as e:
                logger.warning("No se pudo actualizar estado desde APS", 
                             job_id=job_id, error=str(e))
        
        # Calcular tiempo estimado restante
        estimated_time_remaining = None
        if job.is_active and job.estimated_duration and job.started_at:
            elapsed = (datetime.utcnow() - job.started_at).total_seconds()
            estimated_time_remaining = max(0, job.estimated_duration - int(elapsed))
        
        return TranslationProgress(
            job_id=job.job_id,
            status=job.status,
            progress=job.progress,
            progress_message=job.progress_message,
            current_step=job.progress_message,
            estimated_time_remaining=estimated_time_remaining,
            last_updated=job.last_checked_at or job.created_at,
            warnings=job.warnings or []
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error obteniendo estado", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.get("/{job_id}/manifest", response_model=ManifestResponse)
async def get_translation_manifest(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener manifest completo del modelo traducido
    """
    try:
        # Buscar trabajo
        job = db.query(TranslationJob).filter(
            TranslationJob.job_id == job_id,
            TranslationJob.user_id == current_user.id
        ).first()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Traducción no encontrada"
            )
        
        # Verificar que la traducción esté completa
        if job.status != TranslationStatus.SUCCESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Traducción no completada exitosamente"
            )
        
        # Obtener manifest de la BD si está disponible
        if job.manifest_data:
            manifest_data = job.manifest_data
        else:
            # Obtener manifest desde APS
            try:
                manifest_data = await model_derivative_service.get_manifest(job.source_urn)
                
                # Guardar en BD para futuros accesos
                job.manifest_data = manifest_data
                db.commit()
                
            except ModelDerivativeError as e:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Manifest no disponible: {e}"
                )
        
        # Procesar derivatives
        derivatives = []
        for derivative in manifest_data.get('derivatives', []):
            derivatives.append({
                'name': derivative.get('name', ''),
                'status': derivative.get('status', ''),
                'progress': derivative.get('progress', '0%'),
                'output_type': derivative.get('outputType', ''),
                'size': derivative.get('size'),
                'mime': derivative.get('mime'),
                'children': derivative.get('children', [])
            })
        
        return ManifestResponse(
            job_id=job.job_id,
            type=manifest_data.get('type', ''),
            region=manifest_data.get('region', ''),
            version=manifest_data.get('version', ''),
            status=manifest_data.get('status', ''),
            progress=manifest_data.get('progress', '100%'),
            derivatives=derivatives,
            thumbnails=manifest_data.get('thumbnails', []),
            metadata=manifest_data.get('metadata', {}),
            warnings=job.warnings or []
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error obteniendo manifest", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.get("/{job_id}/metadata", response_model=MetadataExtracted)
async def get_translation_metadata(
    job_id: str,
    extract_fresh: bool = Query(False, description="Extraer metadatos nuevamente"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener metadatos extraídos del modelo
    """
    try:
        # Buscar trabajo
        job = db.query(TranslationJob).filter(
            TranslationJob.job_id == job_id,
            TranslationJob.user_id == current_user.id
        ).first()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Traducción no encontrada"
            )
        
        # Verificar que la traducción esté completa
        if job.status != TranslationStatus.SUCCESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Traducción no completada exitosamente"
            )
        
        # Usar metadatos existentes si no se solicita extracción fresca
        if not extract_fresh and job.metadata_extracted:
            metadata = job.metadata_extracted
        else:
            # Extraer metadatos frescos
            try:
                manifest = job.manifest_data
                if not manifest:
                    manifest = await model_derivative_service.get_manifest(job.source_urn)
                
                metadata = await metadata_extractor.extract_comprehensive_metadata(
                    job.source_urn, manifest
                )
                
                # Guardar metadatos actualizados
                job.metadata_extracted = metadata
                db.commit()
                
            except MetadataExtractionError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error extrayendo metadatos: {e}"
                )
        
        return MetadataExtracted(**metadata)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error obteniendo metadatos", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.get("/{job_id}/hierarchy")
async def get_translation_hierarchy(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener jerarquía de objetos del modelo
    """
    try:
        # Buscar trabajo
        job = db.query(TranslationJob).filter(
            TranslationJob.job_id == job_id,
            TranslationJob.user_id == current_user.id
        ).first()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Traducción no encontrada"
            )
        
        if job.status != TranslationStatus.SUCCESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Traducción no completada exitosamente"
            )
        
        # Usar jerarquía existente o extraer nueva
        if job.hierarchy_data:
            return job.hierarchy_data
        else:
            try:
                manifest = job.manifest_data or await model_derivative_service.get_manifest(job.source_urn)
                
                # Extraer GUID del modelo
                model_guid = None
                derivatives = manifest.get('derivatives', [])
                for derivative in derivatives:
                    if derivative.get('outputType') in ['svf', 'svf2']:
                        children = derivative.get('children', [])
                        for child in children:
                            if child.get('type') == 'resource' and child.get('role') == 'graphics':
                                model_guid = child.get('guid')
                                break
                        if model_guid:
                            break
                
                if not model_guid:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="GUID del modelo no encontrado"
                    )
                
                # Obtener jerarquía
                hierarchy = await model_derivative_service.get_object_tree(job.source_urn, model_guid)
                
                # Guardar para futuros accesos
                job.hierarchy_data = hierarchy
                db.commit()
                
                return hierarchy
                
            except ModelDerivativeError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error obteniendo jerarquía: {e}"
                )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error obteniendo jerarquía", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.post("/{job_id}/retry", response_model=TranslationResponse)
async def retry_translation(
    job_id: str,
    retry_request: TranslationRetryRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reintentar traducción fallida
    """
    try:
        # Buscar trabajo
        job = db.query(TranslationJob).filter(
            TranslationJob.job_id == job_id,
            TranslationJob.user_id == current_user.id
        ).first()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Traducción no encontrada"
            )
        
        # Verificar que se puede reintentar
        if not job.can_retry and not retry_request.reset_retry_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede reintentar esta traducción"
            )
        
        # Reiniciar contador si se solicita
        if retry_request.reset_retry_count:
            job.retry_count = 0
        
        # Aplicar nueva configuración si se proporciona
        if retry_request.new_config:
            job.advanced_options = {
                **(job.advanced_options or {}),
                **retry_request.new_config
            }
        
        # Ejecutar reintento
        success = await translation_manager.retry_translation(job_id, db)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo reintentar la traducción"
            )
        
        # Recargar job actualizado
        db.refresh(job)
        
        logger.info("Traducción reintentada", job_id=job_id, retry_count=job.retry_count)
        
        return TranslationResponse(
            success=True,
            job_id=job.job_id,
            internal_id=job.internal_id,
            status=job.status,
            message=f"Reintento {job.retry_count} iniciado",
            estimated_duration=job.estimated_duration,
            polling_url=f"/api/v1/translate/{job.job_id}/status",
            manifest_url=f"/api/v1/translate/{job.job_id}/manifest",
            metadata_url=f"/api/v1/translate/{job.job_id}/metadata"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error reintentando traducción", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.delete("/{job_id}")
async def cancel_translation(
    job_id: str,
    cancel_request: TranslationCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancelar traducción en progreso
    """
    try:
        # Buscar trabajo
        job = db.query(TranslationJob).filter(
            TranslationJob.job_id == job_id,
            TranslationJob.user_id == current_user.id
        ).first()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Traducción no encontrada"
            )
        
        # Cancelar usando el manager
        success = await translation_manager.cancel_translation(job_id, db)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pudo cancelar la traducción"
            )
        
        # Eliminar manifest si se solicita
        if cancel_request.delete_manifest:
            try:
                await model_derivative_service.delete_manifest(job.source_urn)
            except Exception as e:
                logger.warning("No se pudo eliminar manifest", job_id=job_id, error=str(e))
        
        logger.info("Traducción cancelada", 
                   job_id=job_id, 
                   reason=cancel_request.reason)
        
        return {"message": "Traducción cancelada exitosamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error cancelando traducción", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.get("/{job_id}/metrics", response_model=TranslationMetricsResponse)
async def get_translation_metrics(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener métricas detalladas de traducción
    """
    try:
        # Buscar trabajo
        job = db.query(TranslationJob).filter(
            TranslationJob.job_id == job_id,
            TranslationJob.user_id == current_user.id
        ).first()
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Traducción no encontrada"
            )
        
        # Buscar métricas asociadas
        metrics = db.query(TranslationMetrics).filter(
            TranslationMetrics.translation_job_id == job.id
        ).first()
        
        if metrics:
            return TranslationMetricsResponse.from_orm(metrics)
        else:
            # Crear métricas básicas si no existen
            basic_metrics = TranslationMetricsResponse(
                job_id=job.job_id,
                queue_time=None,
                processing_time=job.duration_seconds,
                total_time=job.duration_seconds,
                geometry_quality=None,
                texture_quality=None,
                material_accuracy=None,
                input_file_size=None,
                output_file_size=None,
                compression_ratio=None,
                vertex_count=None,
                face_count=None,
                object_count=None,
                load_time=None,
                render_performance=None,
                warnings_count=len(job.warnings) if job.warnings else 0,
                errors_count=1 if job.status == TranslationStatus.FAILED else 0,
                overall_quality_score=job.quality_metrics.get('overall_quality_score', 0.0) if job.quality_metrics else 0.0,
                efficiency_score=0.5,  # Valor por defecto
                measured_at=job.completed_at or datetime.utcnow()
            )
            
            return basic_metrics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error obteniendo métricas", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.get("/formats/supported", response_model=SupportedFormatsResponse)
async def get_supported_formats():
    """
    Obtener formatos de entrada y salida soportados
    """
    try:
        # Obtener formatos desde APS
        formats_info = await model_derivative_service.check_supported_formats()
        
        # Información detallada de formatos
        format_details = {
            'svf': {
                'name': 'SVF (Simple Vector Format)',
                'description': 'Formato legacy para visualización',
                'supports_2d': True,
                'supports_3d': True,
                'file_size': 'Medium'
            },
            'svf2': {
                'name': 'SVF2 (Simple Vector Format 2)',
                'description': 'Formato optimizado para visualización',
                'supports_2d': True,
                'supports_3d': True,
                'file_size': 'Small'
            },
            'thumbnail': {
                'name': 'Thumbnail',
                'description': 'Imagen de previsualización',
                'supports_2d': True,
                'supports_3d': False,
                'file_size': 'Very Small'
            },
            'stl': {
                'name': 'STL (Stereolithography)',
                'description': 'Formato para impresión 3D',
                'supports_2d': False,
                'supports_3d': True,
                'file_size': 'Medium'
            },
            'obj': {
                'name': 'OBJ (Wavefront)',
                'description': 'Formato 3D estándar',
                'supports_2d': False,
                'supports_3d': True,
                'file_size': 'Medium'
            }
        }
        
        return SupportedFormatsResponse(
            input_formats=formats_info.get('input_formats', []),
            output_formats=formats_info.get('output_formats', []),
            format_details=format_details,
            last_updated=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error("Error obteniendo formatos soportados", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )


@router.get("/stats/overview", response_model=TranslationStatsResponse)
async def get_translation_stats(
    days: int = Query(30, ge=1, le=365, description="Días para estadísticas"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtener estadísticas de traducción del usuario
    """
    try:
        # Fecha de corte
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        # Query base para el período
        base_query = db.query(TranslationJob).filter(
            TranslationJob.user_id == current_user.id,
            TranslationJob.created_at >= cutoff_date
        )
        
        # Estadísticas básicas
        total_translations = base_query.count()
        successful = base_query.filter(TranslationJob.status == TranslationStatus.SUCCESS).count()
        failed = base_query.filter(TranslationJob.status == TranslationStatus.FAILED).count()
        pending = base_query.filter(TranslationJob.status.in_([
            TranslationStatus.PENDING, TranslationStatus.INPROGRESS
        ])).count()
        
        success_rate = (successful / total_translations * 100) if total_translations > 0 else 0.0
        
        # Tiempos promedio
        completed_jobs = base_query.filter(
            TranslationJob.completed_at.isnot(None),
            TranslationJob.started_at.isnot(None)
        ).all()
        
        processing_times = []
        queue_times = []
        
        for job in completed_jobs:
            if job.started_at and job.completed_at:
                processing_time = (job.completed_at - job.started_at).total_seconds()
                processing_times.append(processing_time)
            
            if job.created_at and job.started_at:
                queue_time = (job.started_at - job.created_at).total_seconds()
                queue_times.append(queue_time)
        
        avg_processing_time = sum(processing_times) / len(processing_times) if processing_times else None
        avg_queue_time = sum(queue_times) / len(queue_times) if queue_times else None
        
        # Formatos populares
        all_jobs = base_query.all()
        format_counts = {}
        for job in all_jobs:
            for format_type in job.output_formats:
                format_counts[format_type] = format_counts.get(format_type, 0) + 1
        
        # Traducciones por día (últimos 7 días)
        daily_stats = {}
        for i in range(min(7, days)):
            day = datetime.utcnow() - timedelta(days=i)
            day_str = day.strftime('%Y-%m-%d')
            
            day_count = base_query.filter(
                TranslationJob.created_at >= day.replace(hour=0, minute=0, second=0),
                TranslationJob.created_at < day.replace(hour=23, minute=59, second=59)
            ).count()
            
            daily_stats[day_str] = day_count
        
        # Estadísticas por estado
        status_stats = {
            'success': successful,
            'failed': failed,
            'pending': pending,
            'cancelled': base_query.filter(TranslationJob.status == TranslationStatus.CANCELLED).count(),
            'timeout': base_query.filter(TranslationJob.status == TranslationStatus.TIMEOUT).count()
        }
        
        return TranslationStatsResponse(
            total_translations=total_translations,
            successful_translations=successful,
            failed_translations=failed,
            pending_translations=pending,
            success_rate=success_rate,
            avg_processing_time=avg_processing_time,
            avg_queue_time=avg_queue_time,
            popular_formats=format_counts,
            translations_by_day=daily_stats,
            translations_by_status=status_stats,
            avg_file_size=None,  # TODO: Calcular desde archivos asociados
            total_processing_time=int(sum(processing_times)) if processing_times else None
        )
        
    except Exception as e:
        logger.error("Error obteniendo estadísticas", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor"
        )
