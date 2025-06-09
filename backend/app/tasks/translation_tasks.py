"""
Tareas asíncronas para traducción de modelos
"""
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from celery import current_task
import structlog

from app.core.database import SessionLocal
from app.models.translation_job import TranslationJob, TranslationStatus
from app.models.file import File
from app.services.translation_manager import translation_manager
from app.services.model_derivative import model_derivative_service
from app.services.metadata_extractor import metadata_extractor
from app.tasks import celery_app

logger = structlog.get_logger()


@celery_app.task(bind=True, max_retries=3)
def start_model_translation(
    self,
    file_id: int,
    user_id: int,
    output_formats: list = None,
    quality_level: str = "medium",
    priority: str = "normal",
    custom_config: dict = None
):
    """
    Tarea para iniciar traducción de modelo
    
    Args:
        file_id: ID del archivo a traducir
        user_id: ID del usuario
        output_formats: Formatos de salida deseados
        quality_level: Nivel de calidad
        priority: Prioridad del trabajo
        custom_config: Configuración personalizada
    """
    try:
        logger.info("Iniciando tarea de traducción", 
                   file_id=file_id, 
                   output_formats=output_formats)
        
        # Ejecutar traducción usando el manager
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            translation_job = loop.run_until_complete(
                translation_manager.start_translation(
                    file_id=file_id,
                    user_id=user_id,
                    output_formats=output_formats,
                    quality_level=quality_level,
                    priority=priority,
                    custom_config=custom_config
                )
            )
            
            logger.info("Traducción iniciada exitosamente", 
                       job_id=translation_job.job_id)
            
            return {
                'success': True,
                'job_id': translation_job.job_id,
                'internal_id': translation_job.internal_id,
                'status': translation_job.status,
                'estimated_duration': translation_job.estimated_duration
            }
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error("Error en tarea de traducción", error=str(e))
        
        # Reintentar si no hemos alcanzado el máximo
        if self.request.retries < self.max_retries:
            logger.info("Reintentando tarea de traducción", 
                       retry=self.request.retries + 1)
            raise self.retry(countdown=60 * (2 ** self.request.retries))
        
        return {
            'success': False,
            'error': str(e),
            'retries': self.request.retries
        }


@celery_app.task(bind=True)
def monitor_translation_progress(self, job_id: str):
    """
    Tarea para monitorear progreso de traducción
    
    Args:
        job_id: ID del trabajo de traducción
    """
    try:
        logger.debug("Monitoreando progreso de traducción", job_id=job_id)
        
        db = SessionLocal()
        try:
            # Obtener trabajo de traducción
            job = db.query(TranslationJob).filter(
                TranslationJob.job_id == job_id
            ).first()
            
            if not job:
                logger.warning("Trabajo no encontrado", job_id=job_id)
                return {'success': False, 'error': 'Job not found'}
            
            # Si ya está completado, no hacer nada
            if job.is_completed:
                logger.debug("Trabajo ya completado", job_id=job_id)
                return {'success': True, 'status': 'completed'}
            
            # Consultar estado en APS
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                status_info = loop.run_until_complete(
                    model_derivative_service.get_translation_status(job.source_urn)
                )
                
                # Actualizar progreso
                progress = status_info.get('progress', 0.0)
                message = status_info.get('message', '')
                job.update_progress(progress, message)
                
                # Actualizar estado si cambió
                aps_status = status_info.get('status', 'unknown')
                if aps_status == 'success':
                    job.status = TranslationStatus.SUCCESS
                    job.completed_at = datetime.utcnow()
                    
                    # Programar extracción de resultados
                    extract_translation_results.delay(job_id)
                    
                elif aps_status == 'failed':
                    job.status = TranslationStatus.FAILED
                    job.completed_at = datetime.utcnow()
                    job.error_message = status_info.get('error', 'Translation failed')
                    
                elif aps_status == 'inprogress':
                    job.status = TranslationStatus.INPROGRESS
                    if not job.started_at:
                        job.started_at = datetime.utcnow()
                
                db.commit()
                
                # Programar siguiente monitoreo si aún está en progreso
                if not job.is_completed:
                    monitor_translation_progress.apply_async(
                        args=[job_id],
                        countdown=job.polling_interval
                    )
                
                return {
                    'success': True,
                    'status': job.status,
                    'progress': job.progress,
                    'message': message
                }
                
            finally:
                loop.close()
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error("Error monitoreando progreso", job_id=job_id, error=str(e))
        return {'success': False, 'error': str(e)}


@celery_app.task(bind=True)
def extract_translation_results(self, job_id: str):
    """
    Tarea para extraer resultados de traducción completada
    
    Args:
        job_id: ID del trabajo de traducción
    """
    try:
        logger.info("Extrayendo resultados de traducción", job_id=job_id)
        
        db = SessionLocal()
        try:
            # Obtener trabajo
            job = db.query(TranslationJob).filter(
                TranslationJob.job_id == job_id
            ).first()
            
            if not job:
                logger.error("Trabajo no encontrado", job_id=job_id)
                return {'success': False, 'error': 'Job not found'}
            
            if job.status != TranslationStatus.SUCCESS:
                logger.warning("Trabajo no exitoso", job_id=job_id, status=job.status)
                return {'success': False, 'error': 'Job not successful'}
            
            # Extraer resultados usando event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # Obtener manifest
                manifest = loop.run_until_complete(
                    model_derivative_service.get_manifest(job.source_urn)
                )
                
                # Extraer metadatos completos
                metadata = loop.run_until_complete(
                    metadata_extractor.extract_comprehensive_metadata(
                        job.source_urn, manifest
                    )
                )
                
                # Obtener jerarquía de objetos
                model_guid = _extract_model_guid(manifest)
                hierarchy = {}
                if model_guid:
                    hierarchy = loop.run_until_complete(
                        model_derivative_service.get_object_tree(job.source_urn, model_guid)
                    )
                
                # Extraer URNs de salida
                output_urns = _extract_output_urns(manifest, job.output_formats)
                
                # Calcular métricas de calidad
                quality_metrics = _calculate_quality_metrics(manifest, metadata)
                
                # Actualizar trabajo con resultados
                job.manifest_data = manifest
                job.metadata_extracted = metadata
                job.hierarchy_data = hierarchy
                job.output_urns = output_urns
                job.quality_metrics = quality_metrics
                
                db.commit()
                
                logger.info("Resultados extraídos exitosamente", job_id=job_id)
                
                # Programar tareas adicionales
                generate_thumbnails.delay(job_id)
                update_file_metadata.delay(job.file_id, metadata)
                
                return {
                    'success': True,
                    'manifest_extracted': bool(manifest),
                    'metadata_extracted': bool(metadata),
                    'hierarchy_extracted': bool(hierarchy),
                    'output_urns_count': len(output_urns)
                }
                
            finally:
                loop.close()
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error("Error extrayendo resultados", job_id=job_id, error=str(e))
        return {'success': False, 'error': str(e)}


@celery_app.task(bind=True)
def generate_thumbnails(self, job_id: str):
    """
    Tarea para generar thumbnails del modelo
    
    Args:
        job_id: ID del trabajo de traducción
    """
    try:
        logger.info("Generando thumbnails", job_id=job_id)
        
        db = SessionLocal()
        try:
            job = db.query(TranslationJob).filter(
                TranslationJob.job_id == job_id
            ).first()
            
            if not job or not job.manifest_data:
                return {'success': False, 'error': 'Job or manifest not found'}
            
            # Extraer thumbnails del manifest
            thumbnails = _extract_thumbnails_from_manifest(job.manifest_data)
            
            if thumbnails:
                # Actualizar información de thumbnails en el archivo
                file_obj = db.query(File).filter(File.id == job.file_id).first()
                if file_obj:
                    # Actualizar metadata del archivo con thumbnails
                    if not file_obj.metadata:
                        file_obj.metadata = {}
                    
                    file_obj.metadata['thumbnails'] = thumbnails
                    db.commit()
                
                logger.info("Thumbnails generados", 
                           job_id=job_id, 
                           count=len(thumbnails))
                
                return {
                    'success': True,
                    'thumbnails_count': len(thumbnails),
                    'thumbnails': thumbnails
                }
            else:
                logger.warning("No se encontraron thumbnails", job_id=job_id)
                return {'success': True, 'thumbnails_count': 0}
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error("Error generando thumbnails", job_id=job_id, error=str(e))
        return {'success': False, 'error': str(e)}


@celery_app.task(bind=True)
def update_file_metadata(self, file_id: int, extracted_metadata: dict):
    """
    Tarea para actualizar metadatos del archivo
    
    Args:
        file_id: ID del archivo
        extracted_metadata: Metadatos extraídos
    """
    try:
        logger.info("Actualizando metadatos del archivo", file_id=file_id)
        
        db = SessionLocal()
        try:
            file_obj = db.query(File).filter(File.id == file_id).first()
            if not file_obj:
                return {'success': False, 'error': 'File not found'}
            
            # Actualizar metadata del archivo
            if not file_obj.metadata:
                file_obj.metadata = {}
            
            # Fusionar metadatos extraídos
            file_obj.metadata.update({
                'extracted_metadata': extracted_metadata,
                'last_metadata_update': datetime.utcnow().isoformat(),
                'element_count': extracted_metadata.get('statistics', {}).get('element_count', 0),
                'categories': list(extracted_metadata.get('categories_analysis', {}).get('categories', {}).keys()),
                'primary_discipline': extracted_metadata.get('discipline_analysis', {}).get('primary_discipline'),
                'quality_score': extracted_metadata.get('quality_metrics', {}).get('overall_quality_score', 0.0),
                'complexity_score': extracted_metadata.get('statistics', {}).get('file_complexity_score', 0.0)
            })
            
            # Actualizar estado del archivo
            file_obj.status = 'ready'
            file_obj.translation_progress = "100%"
            
            db.commit()
            
            logger.info("Metadatos actualizados exitosamente", file_id=file_id)
            
            return {
                'success': True,
                'metadata_keys': list(extracted_metadata.keys()),
                'element_count': extracted_metadata.get('statistics', {}).get('element_count', 0)
            }
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error("Error actualizando metadatos", file_id=file_id, error=str(e))
        return {'success': False, 'error': str(e)}


@celery_app.task(bind=True)
def cleanup_failed_translations(self):
    """
    Tarea de limpieza para traduciones fallidas
    """
    try:
        logger.info("Iniciando limpieza de traducciones fallidas")
        
        db = SessionLocal()
        try:
            # Encontrar trabajos fallidos antiguos (más de 1 hora)
            cutoff_time = datetime.utcnow() - timedelta(hours=1)
            
            failed_jobs = db.query(TranslationJob).filter(
                TranslationJob.status == TranslationStatus.FAILED,
                TranslationJob.completed_at < cutoff_time,
                TranslationJob.retry_count >= TranslationJob.max_retries
            ).all()
            
            cleaned_count = 0
            for job in failed_jobs:
                # Limpiar recursos si es necesario
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    
                    try:
                        # Intentar eliminar manifest de APS
                        loop.run_until_complete(
                            model_derivative_service.delete_manifest(job.source_urn)
                        )
                    finally:
                        loop.close()
                        
                except Exception as e:
                    logger.warning("No se pudo limpiar manifest", 
                                 job_id=job.job_id, error=str(e))
                
                cleaned_count += 1
            
            logger.info("Limpieza completada", cleaned_jobs=cleaned_count)
            
            return {
                'success': True,
                'cleaned_jobs': cleaned_count
            }
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error("Error en limpieza", error=str(e))
        return {'success': False, 'error': str(e)}


@celery_app.task(bind=True)
def retry_failed_translation(self, job_id: str):
    """
    Tarea para reintentar traducción fallida
    
    Args:
        job_id: ID del trabajo de traducción
    """
    try:
        logger.info("Reintentando traducción fallida", job_id=job_id)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            success = loop.run_until_complete(
                translation_manager.retry_translation(job_id)
            )
            
            if success:
                logger.info("Reintento programado exitosamente", job_id=job_id)
                return {'success': True, 'retry_scheduled': True}
            else:
                logger.warning("No se pudo reintentar", job_id=job_id)
                return {'success': False, 'error': 'Cannot retry job'}
                
        finally:
            loop.close()
            
    except Exception as e:
        logger.error("Error reintentando traducción", job_id=job_id, error=str(e))
        return {'success': False, 'error': str(e)}


# Funciones auxiliares
def _extract_model_guid(manifest: Dict) -> Optional[str]:
    """Extraer GUID del modelo desde manifest"""
    try:
        derivatives = manifest.get('derivatives', [])
        for derivative in derivatives:
            if derivative.get('outputType') in ['svf', 'svf2']:
                children = derivative.get('children', [])
                for child in children:
                    if child.get('type') == 'resource' and child.get('role') == 'graphics':
                        return child.get('guid')
        return None
    except Exception:
        return None


def _extract_output_urns(manifest: Dict, requested_formats: list) -> Dict[str, Any]:
    """Extraer URNs de salida por formato"""
    output_urns = {}
    
    try:
        derivatives = manifest.get('derivatives', [])
        
        for derivative in derivatives:
            output_type = derivative.get('outputType', '').lower()
            
            if output_type in requested_formats:
                if output_type in ['svf', 'svf2']:
                    output_urns[output_type] = derivative.get('urn', '')
                elif output_type == 'thumbnail':
                    children = derivative.get('children', [])
                    thumbnails = []
                    for child in children:
                        if child.get('type') == 'resource' and child.get('role') == 'thumbnail':
                            thumbnails.append({
                                'urn': child.get('urn', ''),
                                'resolution': child.get('resolution', []),
                                'mime': child.get('mime', '')
                            })
                    if thumbnails:
                        output_urns['thumbnail'] = thumbnails
        
        return output_urns
        
    except Exception as e:
        logger.warning("Error extrayendo URNs de salida", error=str(e))
        return {}


def _calculate_quality_metrics(manifest: Dict, metadata: Dict) -> Dict:
    """Calcular métricas de calidad"""
    try:
        metrics = {
            'translation_success': False,
            'derivatives_count': 0,
            'has_geometry': False,
            'has_materials': False,
            'complexity_score': 0.0
        }
        
        # Analizar derivatives
        derivatives = manifest.get('derivatives', [])
        metrics['derivatives_count'] = len(derivatives)
        
        for derivative in derivatives:
            if derivative.get('status') == 'success':
                metrics['translation_success'] = True
                
                if derivative.get('outputType') in ['svf', 'svf2']:
                    metrics['has_geometry'] = True
        
        # Analizar metadatos
        if metadata:
            stats = metadata.get('statistics', {})
            metrics['complexity_score'] = stats.get('file_complexity_score', 0.0)
            
            material_info = metadata.get('material_info', {})
            metrics['has_materials'] = material_info.get('material_count', 0) > 0
        
        return metrics
        
    except Exception as e:
        logger.warning("Error calculando métricas", error=str(e))
        return {}


def _extract_thumbnails_from_manifest(manifest: Dict) -> list:
    """Extraer información de thumbnails del manifest"""
    thumbnails = []
    
    try:
        derivatives = manifest.get('derivatives', [])
        
        for derivative in derivatives:
            if derivative.get('outputType') == 'thumbnail':
                children = derivative.get('children', [])
                for child in children:
                    if child.get('type') == 'resource' and child.get('role') == 'thumbnail':
                        thumbnail_info = {
                            'urn': child.get('urn', ''),
                            'mime': child.get('mime', ''),
                            'resolution': child.get('resolution', []),
                            'size': child.get('size', 0)
                        }
                        thumbnails.append(thumbnail_info)
        
        return thumbnails
        
    except Exception as e:
        logger.warning("Error extrayendo thumbnails", error=str(e))
        return []


# Tareas programadas
@celery_app.task
def scheduled_cleanup():
    """Tarea programada para limpieza general"""
    cleanup_failed_translations.delay()


@celery_app.task
def monitor_active_translations():
    """Tarea programada para monitorear traducciones activas"""
    try:
        db = SessionLocal()
        try:
            # Encontrar traducciones activas sin monitoreo
            active_jobs = db.query(TranslationJob).filter(
                TranslationJob.status.in_([TranslationStatus.PENDING, TranslationStatus.INPROGRESS]),
                TranslationJob.polling_enabled == True
            ).all()
            
            for job in active_jobs:
                # Verificar si necesita monitoreo
                if not job.last_checked_at or \
                   (datetime.utcnow() - job.last_checked_at).total_seconds() > job.polling_interval * 2:
                    
                    logger.info("Reactivando monitoreo", job_id=job.job_id)
                    monitor_translation_progress.delay(job.job_id)
                    
        finally:
            db.close()
            
    except Exception as e:
        logger.error("Error monitoreando traducciones activas", error=str(e))
