"""
Tareas asíncronas para procesamiento de archivos
"""
import asyncio
import json
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import structlog
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.file import File, FileStatus
from app.models.file_metadata import FileProcessingJob, FileThumbnail, FileMetadataExtended
from app.services.aps_service import APSService
from app.services.aps_auth import APSAuthService
from app.core.config import settings

logger = structlog.get_logger()


class FileProcessingTasks:
    """Tareas de procesamiento de archivos"""
    
    def __init__(self):
        self.auth_service = APSAuthService()
        self.aps_service = APSService(self.auth_service)
    
    async def translate_file(
        self,
        file_id: int,
        translation_params: Optional[Dict] = None
    ) -> Dict[str, any]:
        """
        Tarea para traducir archivo CAD/BIM
        
        Args:
            file_id: ID del archivo
            translation_params: Parámetros de traducción
            
        Returns:
            Dict con resultado de la traducción
        """
        db = SessionLocal()
        job_record = None
        
        try:
            # Obtener archivo de BD
            db_file = db.query(File).filter(File.id == file_id).first()
            
            if not db_file:
                raise Exception(f"Archivo {file_id} no encontrado")
            
            if not db_file.urn:
                raise Exception(f"Archivo {file_id} no tiene URN válido")
            
            logger.info("Iniciando traducción de archivo",
                       file_id=file_id,
                       urn=db_file.urn)
            
            # Crear registro de job
            job_record = FileProcessingJob(
                file_id=file_id,
                job_type="translation",
                status="pending",
                input_params=translation_params or {},
                started_at=datetime.utcnow()
            )
            db.add(job_record)
            db.commit()
            db.refresh(job_record)
            
            # Actualizar estado del archivo
            db_file.status = FileStatus.TRANSLATING
            db_file.translation_progress = "0%"
            db.commit()
            
            # Iniciar traducción en APS
            job_record.status = "processing"
            db.commit()
            
            translation_result = await self.aps_service.translate_model(
                urn=db_file.urn,
                output_formats=['svf2'],
                **translation_params or {}
            )
            
            # Actualizar job con ID de APS
            if 'urn' in translation_result:
                job_record.job_id = translation_result['urn']
                db_file.translation_job_id = translation_result['urn']
            
            job_record.result_data = translation_result
            db.commit()
            
            # Monitorear progreso
            await self._monitor_translation_progress(file_id, job_record.id)
            
            logger.info("Traducción de archivo iniciada exitosamente",
                       file_id=file_id,
                       job_id=job_record.id,
                       aps_job_id=job_record.job_id)
            
            return {
                'job_id': job_record.id,
                'aps_job_id': job_record.job_id,
                'status': 'started',
                'translation_result': translation_result
            }
            
        except Exception as e:
            logger.error("Error en traducción de archivo",
                        file_id=file_id, error=str(e))
            
            # Actualizar estado de error
            if job_record:
                job_record.status = "failed"
                job_record.error_message = str(e)
                job_record.completed_at = datetime.utcnow()
                db.commit()
            
            if 'db_file' in locals():
                db_file.status = FileStatus.ERROR
                db_file.translation_error = str(e)
                db.commit()
            
            raise
        finally:
            db.close()
    
    async def _monitor_translation_progress(self, file_id: int, job_id: int):
        """Monitorear progreso de traducción"""
        db = SessionLocal()
        
        try:
            job_record = db.query(FileProcessingJob).filter(FileProcessingJob.id == job_id).first()
            db_file = db.query(File).filter(File.id == file_id).first()
            
            if not job_record or not db_file or not job_record.job_id:
                return
            
            max_checks = 60  # Máximo 60 checks (30 minutos si check cada 30s)
            check_interval = 30  # 30 segundos entre checks
            
            for check in range(max_checks):
                try:
                    # Verificar estado en APS
                    status_result = await self.aps_service.get_translation_status(job_record.job_id)
                    
                    progress = status_result.get('progress', '0%')
                    status = status_result.get('status', 'inprogress')
                    
                    # Actualizar progreso
                    job_record.progress = self._parse_progress_percentage(progress)
                    db_file.translation_progress = progress
                    
                    if status == 'success':
                        job_record.status = "completed"
                        job_record.completed_at = datetime.utcnow()
                        db_file.status = FileStatus.READY
                        db_file.translated_at = datetime.utcnow()
                        db.commit()
                        
                        logger.info("Traducción completada exitosamente",
                                   file_id=file_id, job_id=job_id)
                        break
                        
                    elif status in ['failed', 'timeout']:
                        error_msg = status_result.get('errorMessage', f'Traducción falló: {status}')
                        job_record.status = "failed"
                        job_record.error_message = error_msg
                        job_record.completed_at = datetime.utcnow()
                        db_file.status = FileStatus.ERROR
                        db_file.translation_error = error_msg
                        db.commit()
                        
                        logger.error("Traducción falló",
                                   file_id=file_id, job_id=job_id, error=error_msg)
                        break
                    
                    db.commit()
                    
                except Exception as e:
                    logger.warning("Error al verificar estado de traducción",
                                 file_id=file_id, check=check, error=str(e))
                
                # Esperar antes del siguiente check
                await asyncio.sleep(check_interval)
            
            else:
                # Se alcanzó el máximo de checks sin completar
                job_record.status = "timeout"
                job_record.error_message = "Tiempo de espera de traducción agotado"
                job_record.completed_at = datetime.utcnow()
                db_file.status = FileStatus.ERROR
                db_file.translation_error = "Timeout en traducción"
                db.commit()
                
                logger.warning("Traducción agotó tiempo de espera",
                             file_id=file_id, job_id=job_id)
                
        except Exception as e:
            logger.error("Error en monitoreo de traducción",
                        file_id=file_id, job_id=job_id, error=str(e))
        finally:
            db.close()
    
    async def generate_thumbnails(
        self,
        file_id: int,
        thumbnail_sizes: Optional[List[str]] = None
    ) -> Dict[str, any]:
        """
        Generar thumbnails para archivo
        
        Args:
            file_id: ID del archivo
            thumbnail_sizes: Tamaños a generar ['small', 'medium', 'large']
            
        Returns:
            Dict con resultado de generación
        """
        if thumbnail_sizes is None:
            thumbnail_sizes = ['small', 'medium', 'large']
        
        db = SessionLocal()
        
        try:
            # Obtener archivo
            db_file = db.query(File).filter(File.id == file_id).first()
            
            if not db_file:
                raise Exception(f"Archivo {file_id} no encontrado")
            
            if db_file.status != FileStatus.READY:
                raise Exception(f"Archivo {file_id} no está listo para thumbnails")
            
            logger.info("Generando thumbnails",
                       file_id=file_id,
                       sizes=thumbnail_sizes)
            
            # Crear registro de job
            job_record = FileProcessingJob(
                file_id=file_id,
                job_type="thumbnail_generation",
                status="processing",
                input_params={'sizes': thumbnail_sizes},
                started_at=datetime.utcnow()
            )
            db.add(job_record)
            db.commit()
            
            results = {}
            
            # Generar cada tamaño
            for size in thumbnail_sizes:
                try:
                    thumbnail_result = await self._generate_single_thumbnail(
                        db_file, size, db
                    )
                    results[size] = thumbnail_result
                    
                except Exception as e:
                    logger.error("Error generando thumbnail",
                               file_id=file_id, size=size, error=str(e))
                    results[size] = {'error': str(e)}
            
            # Actualizar job
            job_record.status = "completed"
            job_record.completed_at = datetime.utcnow()
            job_record.result_data = results
            db.commit()
            
            logger.info("Generación de thumbnails completada",
                       file_id=file_id,
                       results=list(results.keys()))
            
            return {
                'job_id': job_record.id,
                'status': 'completed',
                'thumbnails': results
            }
            
        except Exception as e:
            logger.error("Error en generación de thumbnails",
                        file_id=file_id, error=str(e))
            
            if 'job_record' in locals():
                job_record.status = "failed"
                job_record.error_message = str(e)
                job_record.completed_at = datetime.utcnow()
                db.commit()
            
            raise
        finally:
            db.close()
    
    async def _generate_single_thumbnail(
        self,
        db_file: File,
        size: str,
        db: Session
    ) -> Dict[str, any]:
        """Generar thumbnail individual"""
        try:
            # Configuración de tamaños
            size_configs = {
                'small': {'width': 200, 'height': 200},
                'medium': {'width': 400, 'height': 400},
                'large': {'width': 800, 'height': 800}
            }
            
            config = size_configs.get(size, size_configs['medium'])
            
            # Generar thumbnail usando APS
            thumbnail_result = await self.aps_service.get_thumbnail(
                urn=db_file.urn,
                width=config['width'],
                height=config['height']
            )
            
            # Crear registro de thumbnail
            thumbnail_record = FileThumbnail(
                file_id=db_file.id,
                thumbnail_type=size,
                format='png',
                width=config['width'],
                height=config['height'],
                status='completed',
                generated_at=datetime.utcnow()
            )
            
            # Si el thumbnail se guarda en APS, almacenar información
            if isinstance(thumbnail_result, dict) and 'urn' in thumbnail_result:
                thumbnail_record.urn = thumbnail_result['urn']
            
            db.add(thumbnail_record)
            db.commit()
            
            return {
                'thumbnail_id': thumbnail_record.id,
                'size': size,
                'width': config['width'],
                'height': config['height'],
                'status': 'completed'
            }
            
        except Exception as e:
            logger.error("Error generando thumbnail individual",
                        file_id=db_file.id, size=size, error=str(e))
            raise
    
    async def extract_metadata(self, file_id: int) -> Dict[str, any]:
        """
        Extraer metadatos extendidos del archivo
        
        Args:
            file_id: ID del archivo
            
        Returns:
            Dict con metadatos extraídos
        """
        db = SessionLocal()
        
        try:
            # Obtener archivo
            db_file = db.query(File).filter(File.id == file_id).first()
            
            if not db_file:
                raise Exception(f"Archivo {file_id} no encontrado")
            
            logger.info("Extrayendo metadatos",
                       file_id=file_id,
                       urn=db_file.urn)
            
            # Crear registro de job
            job_record = FileProcessingJob(
                file_id=file_id,
                job_type="metadata_extraction",
                status="processing",
                started_at=datetime.utcnow()
            )
            db.add(job_record)
            db.commit()
            
            # Extraer metadatos usando APS
            metadata_result = await self.aps_service.get_metadata(db_file.urn)
            
            # Procesar y almacenar metadatos extendidos
            extended_metadata = await self._process_metadata(
                metadata_result, db_file, db
            )
            
            # Actualizar job
            job_record.status = "completed"
            job_record.completed_at = datetime.utcnow()
            job_record.result_data = metadata_result
            db.commit()
            
            logger.info("Extracción de metadatos completada",
                       file_id=file_id,
                       metadata_id=extended_metadata.id if extended_metadata else None)
            
            return {
                'job_id': job_record.id,
                'status': 'completed',
                'metadata': extended_metadata.get_summary() if extended_metadata else {}
            }
            
        except Exception as e:
            logger.error("Error en extracción de metadatos",
                        file_id=file_id, error=str(e))
            
            if 'job_record' in locals():
                job_record.status = "failed"
                job_record.error_message = str(e)
                job_record.completed_at = datetime.utcnow()
                db.commit()
            
            raise
        finally:
            db.close()
    
    async def _process_metadata(
        self,
        metadata_result: Dict,
        db_file: File,
        db: Session
    ) -> Optional[FileMetadataExtended]:
        """Procesar y almacenar metadatos extendidos"""
        try:
            # Verificar si ya existe metadata extendida
            existing_metadata = db.query(FileMetadataExtended).filter(
                FileMetadataExtended.file_id == db_file.id
            ).first()
            
            if existing_metadata:
                metadata_record = existing_metadata
            else:
                metadata_record = FileMetadataExtended(file_id=db_file.id)
                db.add(metadata_record)
            
            # Extraer información relevante
            data = metadata_result.get('data', {})
            if isinstance(data, dict):
                # Información básica
                metadata_record.original_format = data.get('type')
                metadata_record.software_version = data.get('version')
                
                # Información geométrica
                if 'boundingBox' in data:
                    metadata_record.bounding_box = data['boundingBox']
                
                # Información de elementos
                metadata_record.element_count = data.get('objectCount')
                
                # Propiedades del modelo
                properties = data.get('properties', {})
                if isinstance(properties, dict):
                    metadata_record.units = properties.get('units')
                    metadata_record.discipline = properties.get('discipline')
                    metadata_record.category = properties.get('category')
                    metadata_record.original_author = properties.get('author')
                    metadata_record.organization = properties.get('organization')
                
                # Capacidades del modelo
                metadata_record.has_materials = bool(data.get('materials'))
                metadata_record.has_textures = bool(data.get('textures'))
                metadata_record.has_lighting = bool(data.get('lights'))
                
                # Tags y propiedades personalizadas
                if 'tags' in data:
                    metadata_record.tags = data['tags']
                
                if 'customProperties' in data:
                    metadata_record.custom_properties = data['customProperties']
            
            metadata_record.extracted_at = datetime.utcnow()
            metadata_record.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(metadata_record)
            
            return metadata_record
            
        except Exception as e:
            logger.error("Error procesando metadatos",
                        file_id=db_file.id, error=str(e))
            return None
    
    def _parse_progress_percentage(self, progress_str: str) -> float:
        """Parsear string de progreso a float"""
        try:
            # Remover % y convertir a float
            return float(progress_str.replace('%', ''))
        except (ValueError, AttributeError):
            return 0.0
    
    async def cleanup_failed_jobs(self, max_age_hours: int = 24) -> Dict[str, any]:
        """
        Limpiar jobs fallidos antiguos
        
        Args:
            max_age_hours: Máxima edad en horas
            
        Returns:
            Dict con estadísticas de limpieza
        """
        db = SessionLocal()
        
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
            
            # Buscar jobs fallidos antiguos
            failed_jobs = db.query(FileProcessingJob).filter(
                FileProcessingJob.status.in_(['failed', 'timeout']),
                FileProcessingJob.created_at < cutoff_time
            ).all()
            
            # Eliminar jobs
            deleted_count = 0
            for job in failed_jobs:
                db.delete(job)
                deleted_count += 1
            
            db.commit()
            
            logger.info("Jobs fallidos limpiados",
                       deleted_count=deleted_count,
                       max_age_hours=max_age_hours)
            
            return {
                'deleted_jobs': deleted_count,
                'cutoff_time': cutoff_time.isoformat()
            }
            
        except Exception as e:
            logger.error("Error limpiando jobs fallidos", error=str(e))
            raise
        finally:
            db.close()
    
    async def get_processing_statistics(self) -> Dict[str, any]:
        """Obtener estadísticas de procesamiento"""
        db = SessionLocal()
        
        try:
            # Estadísticas generales
            total_jobs = db.query(FileProcessingJob).count()
            
            # Jobs por estado
            pending_jobs = db.query(FileProcessingJob).filter(
                FileProcessingJob.status == 'pending'
            ).count()
            
            processing_jobs = db.query(FileProcessingJob).filter(
                FileProcessingJob.status.in_(['processing', 'running'])
            ).count()
            
            completed_jobs = db.query(FileProcessingJob).filter(
                FileProcessingJob.status.in_(['completed', 'success'])
            ).count()
            
            failed_jobs = db.query(FileProcessingJob).filter(
                FileProcessingJob.status.in_(['failed', 'error', 'timeout'])
            ).count()
            
            # Jobs por tipo
            job_types = db.query(
                FileProcessingJob.job_type,
                db.func.count(FileProcessingJob.id)
            ).group_by(FileProcessingJob.job_type).all()
            
            # Estadísticas recientes (última hora)
            recent_cutoff = datetime.utcnow() - timedelta(hours=1)
            recent_jobs = db.query(FileProcessingJob).filter(
                FileProcessingJob.created_at > recent_cutoff
            ).count()
            
            return {
                'total_jobs': total_jobs,
                'by_status': {
                    'pending': pending_jobs,
                    'processing': processing_jobs,
                    'completed': completed_jobs,
                    'failed': failed_jobs
                },
                'by_type': {job_type: count for job_type, count in job_types},
                'recent_jobs_last_hour': recent_jobs,
                'success_rate': (completed_jobs / total_jobs * 100) if total_jobs > 0 else 0
            }
            
        except Exception as e:
            logger.error("Error obteniendo estadísticas", error=str(e))
            raise
        finally:
            db.close()


# Instancia global del procesador de tareas
file_processing_tasks = FileProcessingTasks()
