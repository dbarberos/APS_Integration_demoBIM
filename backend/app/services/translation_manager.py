"""
Gestor de trabajos de traducción - Orquestación completa del proceso
"""
import asyncio
import time
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import structlog

from app.core.database import SessionLocal
from app.models.translation_job import (
    TranslationJob, TranslationStatus, TranslationMetrics, 
    TranslationConfig, OutputFormat, TranslationPriority
)
from app.models.file import File
from app.services.model_derivative import model_derivative_service, ModelDerivativeError
from app.services.urn_manager import urn_manager
from app.services.metadata_extractor import metadata_extractor
from app.core.config import settings

logger = structlog.get_logger()


class TranslationManagerError(Exception):
    """Error del gestor de traducción"""
    pass


class TranslationManager:
    """Gestor principal de trabajos de traducción"""
    
    def __init__(self):
        self.polling_tasks = {}  # job_id -> asyncio.Task
        self.active_jobs = {}    # job_id -> job_info
        
    async def start_translation(
        self,
        file_id: int,
        user_id: int,
        output_formats: List[str] = None,
        quality_level: str = "medium",
        priority: str = TranslationPriority.NORMAL,
        config_name: str = None,
        custom_config: Dict = None,
        db: Session = None
    ) -> TranslationJob:
        """
        Iniciar nueva traducción
        
        Args:
            file_id: ID del archivo a traducir
            user_id: ID del usuario
            output_formats: Formatos de salida deseados
            quality_level: Nivel de calidad
            priority: Prioridad del trabajo
            config_name: Nombre de configuración predefinida
            custom_config: Configuración personalizada
            db: Sesión de base de datos
            
        Returns:
            Trabajo de traducción creado
        """
        db_session = db or SessionLocal()
        close_db = db is None
        
        try:
            logger.info("Iniciando nueva traducción", 
                       file_id=file_id, 
                       output_formats=output_formats,
                       quality_level=quality_level)
            
            # Obtener archivo
            file_obj = db_session.query(File).filter(File.id == file_id).first()
            if not file_obj:
                raise TranslationManagerError(f"Archivo {file_id} no encontrado")
            
            # Verificar que el archivo tenga URN
            if not file_obj.urn:
                raise TranslationManagerError("Archivo no tiene URN válido")
            
            # Verificar si ya hay una traducción activa
            active_job = db_session.query(TranslationJob).filter(
                TranslationJob.file_id == file_id,
                TranslationJob.status.in_([TranslationStatus.PENDING, TranslationStatus.INPROGRESS])
            ).first()
            
            if active_job:
                logger.warning("Ya existe traducción activa", 
                             file_id=file_id, 
                             job_id=active_job.job_id)
                return active_job
            
            # Obtener configuración
            translation_config = await self._get_translation_config(
                file_obj, config_name, output_formats, db_session
            )
            
            # Preparar configuración de traducción
            merge_config = {
                **(translation_config.get('advanced_options') or {}),
                **(custom_config or {})
            }
            
            # Iniciar traducción en APS
            aps_job = await model_derivative_service.start_translation(
                source_urn=file_obj.urn,
                output_formats=output_formats or translation_config['default_output_formats'],
                quality_level=quality_level,
                custom_config=merge_config,
                root_filename=file_obj.original_filename
            )
            
            # Crear registro en base de datos
            translation_job = TranslationJob(
                job_id=aps_job['job_id'],
                file_id=file_id,
                user_id=user_id,
                source_urn=file_obj.urn,
                output_formats=output_formats or translation_config['default_output_formats'],
                priority=priority,
                status=TranslationStatus.PENDING,
                translation_config=translation_config,
                advanced_options=merge_config,
                estimated_duration=aps_job.get('estimated_duration', 300),
                polling_interval=translation_config.get('polling_interval', 30),
                max_retries=translation_config.get('max_retries', 3)
            )
            
            db_session.add(translation_job)
            db_session.commit()
            db_session.refresh(translation_job)
            
            # Iniciar monitoreo asíncrono
            await self._start_monitoring(translation_job)
            
            logger.info("Traducción iniciada exitosamente", 
                       job_id=translation_job.job_id,
                       internal_id=translation_job.internal_id)
            
            return translation_job
            
        except Exception as e:
            logger.error("Error iniciando traducción", error=str(e))
            if close_db:
                db_session.rollback()
            raise TranslationManagerError(f"Error iniciando traducción: {e}")
        finally:
            if close_db:
                db_session.close()
    
    async def _get_translation_config(
        self, 
        file_obj: File, 
        config_name: str, 
        output_formats: List[str],
        db: Session
    ) -> Dict:
        """Obtener configuración de traducción"""
        
        if config_name:
            # Buscar configuración por nombre
            config = db.query(TranslationConfig).filter(
                TranslationConfig.name == config_name,
                TranslationConfig.is_active == True
            ).first()
            
            if config:
                return {
                    'default_output_formats': config.default_output_formats,
                    'advanced_options': config.advanced_options,
                    'polling_interval': config.polling_interval,
                    'max_retries': config.max_retries,
                    'quality_settings': config.quality_settings
                }
        
        # Buscar configuración por extensión de archivo
        file_extension = '.' + file_obj.name.split('.')[-1].lower() if '.' in file_obj.name else ''
        
        config = db.query(TranslationConfig).filter(
            TranslationConfig.file_extensions.contains([file_extension]),
            TranslationConfig.is_active == True
        ).first()
        
        if config:
            return {
                'default_output_formats': config.default_output_formats,
                'advanced_options': config.advanced_options,
                'polling_interval': config.polling_interval,
                'max_retries': config.max_retries,
                'quality_settings': config.quality_settings
            }
        
        # Configuración por defecto
        return {
            'default_output_formats': output_formats or ['svf2', 'thumbnail'],
            'advanced_options': {'generateMasterViews': True},
            'polling_interval': 30,
            'max_retries': 3,
            'quality_settings': {}
        }
    
    async def _start_monitoring(self, translation_job: TranslationJob):
        """Iniciar monitoreo asíncrono del trabajo"""
        job_id = translation_job.job_id
        
        # Cancelar monitoreo previo si existe
        if job_id in self.polling_tasks:
            self.polling_tasks[job_id].cancel()
        
        # Crear nueva tarea de monitoreo
        task = asyncio.create_task(self._monitor_translation(translation_job))
        self.polling_tasks[job_id] = task
        
        # Guardar información del trabajo
        self.active_jobs[job_id] = {
            'translation_job': translation_job,
            'start_time': time.time(),
            'last_check': time.time()
        }
        
        logger.debug("Monitoreo iniciado", job_id=job_id)
    
    async def _monitor_translation(self, translation_job: TranslationJob):
        """Monitorear progreso de traducción"""
        job_id = translation_job.job_id
        start_time = time.time()
        
        try:
            logger.info("Iniciando monitoreo de traducción", job_id=job_id)
            
            while True:
                db = SessionLocal()
                try:
                    # Recargar trabajo desde BD
                    current_job = db.query(TranslationJob).filter(
                        TranslationJob.job_id == job_id
                    ).first()
                    
                    if not current_job:
                        logger.warning("Trabajo no encontrado en BD", job_id=job_id)
                        break
                    
                    # Verificar si debe continuar monitoreando
                    if current_job.is_completed or not current_job.polling_enabled:
                        logger.info("Monitoreo completado", 
                                   job_id=job_id, 
                                   status=current_job.status)
                        break
                    
                    # Verificar timeout
                    elapsed = time.time() - start_time
                    if current_job.timeout and elapsed > current_job.timeout:
                        await self._handle_timeout(current_job, db)
                        break
                    
                    # Consultar estado en APS
                    status_info = await model_derivative_service.get_translation_status(
                        current_job.source_urn
                    )
                    
                    # Actualizar trabajo con nuevo estado
                    await self._update_job_status(current_job, status_info, db)
                    
                    # Si está completo, procesar resultados
                    if status_info.get('status') == 'success':
                        await self._process_completed_translation(current_job, status_info, db)
                        break
                    elif status_info.get('status') in ['failed', 'timeout']:
                        await self._handle_failed_translation(current_job, status_info, db)
                        break
                    
                    # Esperar intervalo de polling con jitter
                    import random
                    jitter = random.uniform(0.8, 1.2)  # ±20% jitter
                    await asyncio.sleep(current_job.polling_interval * jitter)
                    
                finally:
                    db.close()
                    
        except asyncio.CancelledError:
            logger.info("Monitoreo cancelado", job_id=job_id)
            raise
        except Exception as e:
            logger.error("Error en monitoreo", job_id=job_id, error=str(e))
            
            # Intentar marcar como fallido
            try:
                db = SessionLocal()
                job = db.query(TranslationJob).filter(
                    TranslationJob.job_id == job_id
                ).first()
                if job:
                    job.mark_failed(f"Error de monitoreo: {e}")
                    db.commit()
                db.close()
            except Exception:
                pass
        finally:
            # Limpiar recursos
            if job_id in self.polling_tasks:
                del self.polling_tasks[job_id]
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
    
    async def _update_job_status(
        self, 
        job: TranslationJob, 
        status_info: Dict, 
        db: Session
    ):
        """Actualizar estado del trabajo"""
        
        # Mapear estado de APS a nuestro estado
        aps_status = status_info.get('status', 'unknown')
        if aps_status == 'success':
            job.status = TranslationStatus.SUCCESS
        elif aps_status == 'inprogress':
            job.status = TranslationStatus.INPROGRESS
            if not job.started_at:
                job.mark_started()
        elif aps_status == 'failed':
            job.status = TranslationStatus.FAILED
        elif aps_status == 'timeout':
            job.status = TranslationStatus.TIMEOUT
        
        # Actualizar progreso
        progress = status_info.get('progress', 0.0)
        message = status_info.get('message', '')
        job.update_progress(progress, message)
        
        # Guardar advertencias
        if status_info.get('warnings'):
            job.warnings = status_info['warnings']
        
        db.commit()
        
        logger.debug("Estado actualizado", 
                    job_id=job.job_id,
                    status=job.status,
                    progress=job.progress)
    
    async def _process_completed_translation(
        self, 
        job: TranslationJob, 
        status_info: Dict, 
        db: Session
    ):
        """Procesar traducción completada"""
        try:
            logger.info("Procesando traducción completada", job_id=job.job_id)
            
            # Obtener manifest completo
            manifest = await model_derivative_service.get_manifest(job.source_urn)
            
            # Extraer metadatos
            metadata = await metadata_extractor.extract_comprehensive_metadata(
                job.source_urn, manifest
            )
            
            # Obtener jerarquía de objetos
            hierarchy = await self._extract_object_hierarchy(job.source_urn, manifest)
            
            # Generar URNs de salida
            output_urns = self._extract_output_urns(manifest, job.output_formats)
            
            # Calcular métricas de calidad
            quality_metrics = await self._calculate_quality_metrics(manifest, metadata)
            
            # Marcar como completado con resultados
            result_data = {
                'manifest': manifest,
                'metadata': metadata,
                'hierarchy': hierarchy,
                'output_urns': output_urns,
                'quality_metrics': quality_metrics
            }
            
            job.mark_completed(TranslationStatus.SUCCESS, result_data)
            
            # Crear métricas de traducción
            await self._create_translation_metrics(job, manifest, metadata, db)
            
            db.commit()
            
            logger.info("Traducción procesada exitosamente", job_id=job.job_id)
            
        except Exception as e:
            logger.error("Error procesando traducción completada", 
                        job_id=job.job_id, error=str(e))
            job.mark_failed(f"Error procesando resultados: {e}")
            db.commit()
    
    async def _extract_object_hierarchy(self, source_urn: str, manifest: Dict) -> Dict:
        """Extraer jerarquía de objetos"""
        try:
            # Obtener GUID del modelo
            model_guid = self._extract_model_guid(manifest)
            if not model_guid:
                return {}
            
            # Obtener árbol de objetos
            tree_data = await model_derivative_service.get_object_tree(source_urn, model_guid)
            return tree_data
            
        except Exception as e:
            logger.warning("No se pudo extraer jerarquía", error=str(e))
            return {}
    
    def _extract_model_guid(self, manifest: Dict) -> Optional[str]:
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
    
    def _extract_output_urns(self, manifest: Dict, requested_formats: List[str]) -> Dict[str, str]:
        """Extraer URNs de salida por formato"""
        output_urns = {}
        
        try:
            derivatives = manifest.get('derivatives', [])
            
            for derivative in derivatives:
                output_type = derivative.get('outputType', '').lower()
                
                if output_type in requested_formats:
                    # Para SVF/SVF2, usar URN del derivative
                    if output_type in ['svf', 'svf2']:
                        output_urns[output_type] = derivative.get('urn', '')
                    
                    # Para thumbnails, extraer URLs
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
    
    async def _calculate_quality_metrics(self, manifest: Dict, metadata: Dict) -> Dict:
        """Calcular métricas de calidad"""
        try:
            metrics = {
                'overall_quality': 0.0,
                'geometry_complexity': 0.0,
                'material_count': 0,
                'texture_quality': 0.0,
                'file_size_efficiency': 0.0
            }
            
            # Analizar derivatives para calidad
            derivatives = manifest.get('derivatives', [])
            for derivative in derivatives:
                if derivative.get('status') == 'success':
                    metrics['overall_quality'] += 0.25  # Base score por derivative exitoso
            
            # Analizar metadatos para complejidad
            if metadata:
                element_count = metadata.get('element_count', 0)
                if element_count > 0:
                    # Normalizar complejidad (log scale)
                    import math
                    metrics['geometry_complexity'] = min(1.0, math.log10(element_count) / 6.0)
                
                metrics['material_count'] = len(metadata.get('materials', []))
            
            # Normalizar métricas
            metrics['overall_quality'] = min(1.0, metrics['overall_quality'])
            
            return metrics
            
        except Exception as e:
            logger.warning("Error calculando métricas de calidad", error=str(e))
            return {}
    
    async def _create_translation_metrics(
        self, 
        job: TranslationJob, 
        manifest: Dict, 
        metadata: Dict, 
        db: Session
    ):
        """Crear métricas de traducción"""
        try:
            # Calcular tiempos
            queue_time = None
            processing_time = None
            total_time = job.duration_seconds
            
            if job.started_at and job.created_at:
                queue_time = int((job.started_at - job.created_at).total_seconds())
            
            if job.completed_at and job.started_at:
                processing_time = int((job.completed_at - job.started_at).total_seconds())
            
            # Extraer métricas de archivo
            file_obj = db.query(File).filter(File.id == job.file_id).first()
            input_size = file_obj.size if file_obj else None
            
            # Crear registro de métricas
            metrics = TranslationMetrics(
                translation_job_id=job.id,
                queue_time=queue_time,
                processing_time=processing_time,
                total_time=total_time,
                input_file_size=input_size,
                geometry_quality=job.quality_metrics.get('overall_quality', 0.0) if job.quality_metrics else 0.0,
                vertex_count=metadata.get('vertex_count'),
                face_count=metadata.get('face_count'),
                object_count=metadata.get('element_count'),
                warnings_count=len(job.warnings) if job.warnings else 0
            )
            
            db.add(metrics)
            db.commit()
            
        except Exception as e:
            logger.warning("Error creando métricas", error=str(e))
    
    async def _handle_failed_translation(
        self, 
        job: TranslationJob, 
        status_info: Dict, 
        db: Session
    ):
        """Manejar traducción fallida"""
        error_message = status_info.get('error', 'Traducción falló')
        job.mark_failed(error_message)
        
        # Intentar reintento automático si es elegible
        if job.can_retry:
            logger.info("Programando reintento automático", 
                       job_id=job.job_id, 
                       retry_count=job.retry_count + 1)
            
            # Incrementar contador de reintentos
            job.increment_retry()
            db.commit()
            
            # Programar reintento después de delay
            retry_delay = min(60 * (2 ** job.retry_count), 300)  # Backoff exponencial, máx 5 min
            
            asyncio.create_task(self._schedule_retry(job, retry_delay))
        else:
            db.commit()
            logger.error("Traducción falló sin más reintentos", 
                        job_id=job.job_id, 
                        error=error_message)
    
    async def _schedule_retry(self, job: TranslationJob, delay: int):
        """Programar reintento de traducción"""
        try:
            await asyncio.sleep(delay)
            
            # Reiniciar traducción
            logger.info("Ejecutando reintento automático", job_id=job.job_id)
            
            db = SessionLocal()
            try:
                # Recargar trabajo
                current_job = db.query(TranslationJob).filter(
                    TranslationJob.job_id == job.job_id
                ).first()
                
                if current_job and current_job.status == TranslationStatus.PENDING:
                    await self._start_monitoring(current_job)
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error("Error en reintento automático", job_id=job.job_id, error=str(e))
    
    async def _handle_timeout(self, job: TranslationJob, db: Session):
        """Manejar timeout de traducción"""
        logger.warning("Traducción expiró", job_id=job.job_id)
        
        job.status = TranslationStatus.TIMEOUT
        job.completed_at = datetime.utcnow()
        job.error_message = "Traducción expiró por timeout"
        
        db.commit()
    
    async def get_job_status(self, job_id: str, db: Session = None) -> Optional[TranslationJob]:
        """Obtener estado actual de trabajo"""
        db_session = db or SessionLocal()
        close_db = db is None
        
        try:
            job = db_session.query(TranslationJob).filter(
                TranslationJob.job_id == job_id
            ).first()
            
            return job
            
        finally:
            if close_db:
                db_session.close()
    
    async def cancel_translation(self, job_id: str, db: Session = None) -> bool:
        """Cancelar traducción en progreso"""
        db_session = db or SessionLocal()
        close_db = db is None
        
        try:
            job = db_session.query(TranslationJob).filter(
                TranslationJob.job_id == job_id
            ).first()
            
            if not job:
                return False
            
            if job.is_completed:
                return False
            
            # Cancelar monitoreo
            if job_id in self.polling_tasks:
                self.polling_tasks[job_id].cancel()
                del self.polling_tasks[job_id]
            
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
            
            # Marcar como cancelado
            job.status = TranslationStatus.CANCELLED
            job.completed_at = datetime.utcnow()
            job.polling_enabled = False
            
            db_session.commit()
            
            logger.info("Traducción cancelada", job_id=job_id)
            return True
            
        except Exception as e:
            logger.error("Error cancelando traducción", job_id=job_id, error=str(e))
            return False
        finally:
            if close_db:
                db_session.close()
    
    async def retry_translation(self, job_id: str, db: Session = None) -> bool:
        """Reintentar traducción fallida"""
        db_session = db or SessionLocal()
        close_db = db is None
        
        try:
            job = db_session.query(TranslationJob).filter(
                TranslationJob.job_id == job_id
            ).first()
            
            if not job or not job.can_retry:
                return False
            
            # Incrementar reintento
            job.increment_retry()
            db_session.commit()
            
            # Reiniciar monitoreo
            await self._start_monitoring(job)
            
            logger.info("Traducción reintentada", job_id=job_id, retry_count=job.retry_count)
            return True
            
        except Exception as e:
            logger.error("Error reintentando traducción", job_id=job_id, error=str(e))
            return False
        finally:
            if close_db:
                db_session.close()
    
    def get_active_jobs_count(self) -> int:
        """Obtener número de trabajos activos"""
        return len(self.active_jobs)
    
    def get_active_jobs_info(self) -> Dict:
        """Obtener información de trabajos activos"""
        return {
            job_id: {
                'start_time': info['start_time'],
                'last_check': info['last_check'],
                'elapsed': time.time() - info['start_time'],
                'job_status': info['translation_job'].status
            }
            for job_id, info in self.active_jobs.items()
        }
    
    async def cleanup_completed_jobs(self, older_than_hours: int = 24):
        """Limpiar trabajos completados antiguos"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=older_than_hours)
            
            db = SessionLocal()
            try:
                # Obtener trabajos completados antiguos
                old_jobs = db.query(TranslationJob).filter(
                    TranslationJob.completed_at < cutoff_time,
                    TranslationJob.status.in_([
                        TranslationStatus.SUCCESS,
                        TranslationStatus.FAILED,
                        TranslationStatus.TIMEOUT,
                        TranslationStatus.CANCELLED
                    ])
                ).all()
                
                cleaned_count = 0
                for job in old_jobs:
                    # Cancelar monitoreo si existe
                    if job.job_id in self.polling_tasks:
                        self.polling_tasks[job.job_id].cancel()
                        del self.polling_tasks[job.job_id]
                    
                    if job.job_id in self.active_jobs:
                        del self.active_jobs[job.job_id]
                    
                    cleaned_count += 1
                
                logger.info("Trabajos limpiados", count=cleaned_count)
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error("Error limpiando trabajos", error=str(e))


# Instancia global del gestor
translation_manager = TranslationManager()
