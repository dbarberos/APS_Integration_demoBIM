"""
Gestor completo de archivos - Coordina todas las operaciones de archivos
"""
import asyncio
import uuid
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from pathlib import Path
import structlog
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.core.file_validation import file_validator, file_sanitizer
from app.services.aps_storage_advanced import APSStorageAdvanced
from app.services.aps_auth import APSAuthService
from app.services.aps_service import APSService
from app.models.file import File, FileStatus
from app.models.project import Project
from app.models.user import User
from app.core.database import get_db
from app.core.config import settings

logger = structlog.get_logger()


class FileUploadProgress:
    """Clase para tracking de progreso de upload"""
    
    def __init__(self, file_id: str, total_size: int):
        self.file_id = file_id
        self.total_size = total_size
        self.uploaded_bytes = 0
        self.start_time = datetime.utcnow()
        self.current_part = 0
        self.total_parts = 0
        self.status = "uploading"
        self.error = None
    
    @property
    def progress_percentage(self) -> float:
        """Porcentaje de progreso"""
        if self.total_size == 0:
            return 0.0
        return (self.uploaded_bytes / self.total_size) * 100
    
    @property
    def elapsed_time(self) -> timedelta:
        """Tiempo transcurrido"""
        return datetime.utcnow() - self.start_time
    
    @property
    def upload_speed_mbps(self) -> float:
        """Velocidad de upload en MB/s"""
        elapsed_seconds = self.elapsed_time.total_seconds()
        if elapsed_seconds == 0:
            return 0.0
        mb_uploaded = self.uploaded_bytes / (1024 * 1024)
        return mb_uploaded / elapsed_seconds
    
    def update_progress(self, uploaded_bytes: int, current_part: int = None):
        """Actualizar progreso"""
        self.uploaded_bytes = uploaded_bytes
        if current_part:
            self.current_part = current_part
    
    def to_dict(self) -> Dict:
        """Convertir a diccionario para serialización"""
        return {
            'file_id': self.file_id,
            'total_size': self.total_size,
            'uploaded_bytes': self.uploaded_bytes,
            'progress_percentage': round(self.progress_percentage, 1),
            'current_part': self.current_part,
            'total_parts': self.total_parts,
            'status': self.status,
            'upload_speed_mbps': round(self.upload_speed_mbps, 2),
            'elapsed_seconds': int(self.elapsed_time.total_seconds()),
            'error': self.error
        }


class FileManager:
    """Gestor principal de archivos"""
    
    def __init__(self):
        self.auth_service = APSAuthService()
        self.storage_service = APSStorageAdvanced(self.auth_service)
        self.aps_service = APSService(self.auth_service)
        self.upload_progress = {}  # Track upload progress
    
    async def upload_file(
        self,
        file: UploadFile,
        project_id: int,
        user_id: int,
        db: Session,
        metadata: Optional[Dict] = None
    ) -> Dict[str, any]:
        """
        Upload completo de archivo con validación, almacenamiento y registro en BD
        
        Args:
            file: Archivo a subir
            project_id: ID del proyecto
            user_id: ID del usuario
            db: Sesión de base de datos
            metadata: Metadatos adicionales
            
        Returns:
            Dict con información del archivo subido
        """
        upload_id = str(uuid.uuid4())
        
        try:
            logger.info("Iniciando upload de archivo",
                       upload_id=upload_id,
                       filename=file.filename,
                       user_id=user_id,
                       project_id=project_id)
            
            # 1. Validar proyecto existe y pertenece al usuario
            project = db.query(Project).filter(
                Project.id == project_id,
                Project.user_id == user_id
            ).first()
            
            if not project:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Proyecto no encontrado o sin acceso"
                )
            
            # 2. Validar archivo
            validation_result = await file_validator.validate_file(
                file, user_id, check_quota=True
            )
            
            if not validation_result['is_valid']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Validación de archivo falló: {', '.join(validation_result['errors'])}"
                )
            
            file_info = validation_result['file_info']
            
            # 3. Generar nombres seguros
            safe_object_name = file_sanitizer.generate_safe_object_name(
                file_info['filename'], user_id
            )
            
            # 4. Inicializar tracking de progreso
            progress = FileUploadProgress(upload_id, file_info['size'])
            self.upload_progress[upload_id] = progress
            
            # 5. Crear registro en base de datos (estado inicial)
            db_file = File(
                name=file_info['filename'],
                original_filename=file_info['original_filename'],
                content_type=file_info.get('content_type'),
                size=file_info['size'],
                urn="",  # Se actualizará después del upload
                object_key=safe_object_name,
                bucket_key=project.bucket_key,
                status=FileStatus.UPLOADING,
                project_id=project_id,
                metadata=file_sanitizer.sanitize_metadata(metadata or {})
            )
            
            db.add(db_file)
            db.commit()
            db.refresh(db_file)
            
            # 6. Upload a APS con callback de progreso
            async def progress_callback(progress_percent: float, current_part: int, total_parts: int):
                progress.total_parts = total_parts
                progress.update_progress(
                    int((progress_percent / 100) * file_info['size']),
                    current_part
                )
                
                # Notificar progreso (WebSocket, etc.)
                await self._notify_upload_progress(upload_id, progress)
            
            upload_result = await self.storage_service.upload_large_file(
                bucket_key=project.bucket_key,
                file=file,
                object_name=safe_object_name,
                progress_callback=progress_callback
            )
            
            # 7. Actualizar registro con información de APS
            db_file.urn = upload_result['urn']
            db_file.status = FileStatus.UPLOADED
            if upload_result.get('sha1'):
                metadata_update = db_file.metadata or {}
                metadata_update['sha1'] = upload_result['sha1']
                metadata_update['upload_type'] = upload_result['upload_type']
                if upload_result.get('parts_count'):
                    metadata_update['parts_count'] = upload_result['parts_count']
                db_file.metadata = metadata_update
            
            db.commit()
            db.refresh(db_file)
            
            # 8. Finalizar progreso
            progress.status = "completed"
            progress.uploaded_bytes = file_info['size']
            
            # 9. Iniciar traducción automática si es un modelo CAD/BIM
            if self._should_auto_translate(file_info['extension']):
                asyncio.create_task(
                    self._auto_translate_file(db_file.id, db_file.urn)
                )
            
            logger.info("Upload de archivo completado exitosamente",
                       upload_id=upload_id,
                       file_id=db_file.id,
                       urn=db_file.urn,
                       size_mb=round(file_info['size'] / (1024*1024), 2))
            
            # 10. Limpiar tracking de progreso después de un tiempo
            asyncio.create_task(self._cleanup_progress_tracking(upload_id, delay=300))
            
            return {
                'id': db_file.id,
                'upload_id': upload_id,
                'filename': db_file.name,
                'original_filename': db_file.original_filename,
                'urn': db_file.urn,
                'size': db_file.size,
                'status': db_file.status,
                'project_id': db_file.project_id,
                'uploaded_at': db_file.uploaded_at.isoformat(),
                'object_key': db_file.object_key,
                'bucket_key': db_file.bucket_key,
                'metadata': db_file.metadata
            }
            
        except HTTPException:
            # Limpiar progreso en caso de error de validación
            if upload_id in self.upload_progress:
                self.upload_progress[upload_id].status = "error"
            raise
        except Exception as e:
            logger.error("Error durante upload de archivo",
                        upload_id=upload_id,
                        error=str(e))
            
            # Actualizar progreso con error
            if upload_id in self.upload_progress:
                self.upload_progress[upload_id].status = "error"
                self.upload_progress[upload_id].error = str(e)
            
            # Actualizar estado en BD si el archivo fue creado
            try:
                if 'db_file' in locals():
                    db_file.status = FileStatus.ERROR
                    db.commit()
            except Exception:
                pass
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error durante upload de archivo: {str(e)}"
            )
    
    async def get_upload_progress(self, upload_id: str) -> Optional[Dict]:
        """Obtener progreso de upload"""
        progress = self.upload_progress.get(upload_id)
        if progress:
            return progress.to_dict()
        return None
    
    async def get_file_details(
        self,
        file_id: int,
        user_id: int,
        db: Session
    ) -> Dict[str, any]:
        """Obtener detalles completos de archivo"""
        try:
            # Obtener archivo de BD
            db_file = db.query(File).join(Project).filter(
                File.id == file_id,
                Project.user_id == user_id
            ).first()
            
            if not db_file:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Archivo no encontrado"
                )
            
            # Obtener detalles adicionales de APS si está disponible
            aps_details = None
            if db_file.urn and db_file.status in [FileStatus.UPLOADED, FileStatus.READY]:
                try:
                    aps_details = await self.storage_service.get_object_details(
                        db_file.bucket_key, db_file.object_key
                    )
                except Exception as e:
                    logger.warning("No se pudieron obtener detalles de APS",
                                 file_id=file_id, error=str(e))
            
            # Construir respuesta completa
            result = {
                'id': db_file.id,
                'name': db_file.name,
                'original_filename': db_file.original_filename,
                'urn': db_file.urn,
                'size': db_file.size,
                'size_mb': db_file.size_mb,
                'status': db_file.status,
                'project_id': db_file.project_id,
                'project_name': db_file.project.name,
                'uploaded_at': db_file.uploaded_at.isoformat(),
                'updated_at': db_file.updated_at.isoformat(),
                'metadata': db_file.metadata or {},
                'is_ready_for_viewing': db_file.is_ready_for_viewing
            }
            
            # Agregar información de traducción si existe
            if db_file.translation_job_id:
                result.update({
                    'translation_job_id': db_file.translation_job_id,
                    'translation_progress': db_file.translation_progress,
                    'translated_at': db_file.translated_at.isoformat() if db_file.translated_at else None
                })
                
                if db_file.translation_error:
                    result['translation_error'] = db_file.translation_error
            
            # Agregar detalles de APS si están disponibles
            if aps_details:
                result['aps_details'] = aps_details
            
            return result
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error al obtener detalles de archivo",
                        file_id=file_id, error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al obtener detalles de archivo"
            )
    
    async def list_files(
        self,
        user_id: int,
        db: Session,
        project_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, any]:
        """Listar archivos con filtros"""
        try:
            # Construir query base
            query = db.query(File).join(Project).filter(Project.user_id == user_id)
            
            # Aplicar filtros
            if project_id:
                query = query.filter(File.project_id == project_id)
            
            if status_filter:
                query = query.filter(File.status == status_filter)
            
            if search:
                query = query.filter(
                    File.name.ilike(f"%{search}%") |
                    File.original_filename.ilike(f"%{search}%")
                )
            
            # Contar total
            total = query.count()
            
            # Aplicar paginación y ordenamiento
            files = query.order_by(File.uploaded_at.desc()).offset(offset).limit(limit).all()
            
            # Construir respuesta
            items = []
            for file in files:
                items.append({
                    'id': file.id,
                    'name': file.name,
                    'original_filename': file.original_filename,
                    'urn': file.urn,
                    'size': file.size,
                    'size_mb': file.size_mb,
                    'status': file.status,
                    'project_id': file.project_id,
                    'project_name': file.project.name,
                    'uploaded_at': file.uploaded_at.isoformat(),
                    'is_ready_for_viewing': file.is_ready_for_viewing,
                    'translation_progress': file.translation_progress
                })
            
            return {
                'items': items,
                'total': total,
                'limit': limit,
                'offset': offset,
                'has_more': offset + limit < total
            }
            
        except Exception as e:
            logger.error("Error al listar archivos", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al listar archivos"
            )
    
    async def delete_file(
        self,
        file_id: int,
        user_id: int,
        db: Session
    ) -> bool:
        """Eliminar archivo completamente"""
        try:
            # Obtener archivo
            db_file = db.query(File).join(Project).filter(
                File.id == file_id,
                Project.user_id == user_id
            ).first()
            
            if not db_file:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Archivo no encontrado"
                )
            
            # Eliminar de APS si existe
            if db_file.object_key and db_file.bucket_key:
                try:
                    await self.storage_service.delete_object(
                        db_file.bucket_key, db_file.object_key
                    )
                    logger.info("Archivo eliminado de APS",
                               file_id=file_id,
                               object_key=db_file.object_key)
                except Exception as e:
                    logger.warning("No se pudo eliminar archivo de APS",
                                 file_id=file_id, error=str(e))
                    # Continuar con eliminación de BD aunque falle APS
            
            # Eliminar de base de datos
            db.delete(db_file)
            db.commit()
            
            logger.info("Archivo eliminado completamente",
                       file_id=file_id, user_id=user_id)
            
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error al eliminar archivo", file_id=file_id, error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al eliminar archivo"
            )
    
    async def generate_download_url(
        self,
        file_id: int,
        user_id: int,
        db: Session,
        expires_in: int = 3600
    ) -> Dict[str, any]:
        """Generar URL firmada para descarga"""
        try:
            # Obtener archivo
            db_file = db.query(File).join(Project).filter(
                File.id == file_id,
                Project.user_id == user_id
            ).first()
            
            if not db_file:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Archivo no encontrado"
                )
            
            if not db_file.object_key or not db_file.bucket_key:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Archivo no disponible para descarga"
                )
            
            # Generar URL firmada
            signed_url_result = await self.storage_service.generate_signed_url(
                bucket_key=db_file.bucket_key,
                object_key=db_file.object_key,
                access="read",
                expires_in=expires_in
            )
            
            logger.info("URL de descarga generada",
                       file_id=file_id,
                       expires_in=expires_in)
            
            return {
                'download_url': signed_url_result['signed_url'],
                'filename': db_file.original_filename,
                'size': db_file.size,
                'expires_in': expires_in,
                'expires_at': (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error al generar URL de descarga",
                        file_id=file_id, error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al generar URL de descarga"
            )
    
    async def update_file_metadata(
        self,
        file_id: int,
        user_id: int,
        metadata: Dict,
        db: Session
    ) -> Dict[str, any]:
        """Actualizar metadatos de archivo"""
        try:
            # Obtener archivo
            db_file = db.query(File).join(Project).filter(
                File.id == file_id,
                Project.user_id == user_id
            ).first()
            
            if not db_file:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Archivo no encontrado"
                )
            
            # Sanitizar y actualizar metadatos
            safe_metadata = file_sanitizer.sanitize_metadata(metadata)
            current_metadata = db_file.metadata or {}
            current_metadata.update(safe_metadata)
            
            db_file.metadata = current_metadata
            db.commit()
            db.refresh(db_file)
            
            logger.info("Metadatos de archivo actualizados",
                       file_id=file_id,
                       updated_fields=list(safe_metadata.keys()))
            
            return {
                'id': db_file.id,
                'metadata': db_file.metadata,
                'updated_at': db_file.updated_at.isoformat()
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error al actualizar metadatos",
                        file_id=file_id, error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al actualizar metadatos"
            )
    
    def _should_auto_translate(self, file_extension: str) -> bool:
        """Determinar si el archivo debe traducirse automáticamente"""
        auto_translate_extensions = {'.rvt', '.ifc', '.dwg', '.3dm', '.skp'}
        return file_extension.lower() in auto_translate_extensions
    
    async def _auto_translate_file(self, file_id: int, urn: str):
        """Iniciar traducción automática de archivo"""
        try:
            # Usar el servicio APS para iniciar traducción
            job_response = await self.aps_service.translate_model(urn)
            
            # Actualizar BD con job ID
            # (Requiere sesión de BD - implementar según contexto)
            logger.info("Traducción automática iniciada",
                       file_id=file_id,
                       urn=urn,
                       job_id=job_response.get('urn'))
            
        except Exception as e:
            logger.error("Error en traducción automática",
                        file_id=file_id, error=str(e))
    
    async def _notify_upload_progress(self, upload_id: str, progress: FileUploadProgress):
        """Notificar progreso de upload (WebSocket, etc.)"""
        # TODO: Implementar notificación real via WebSocket
        logger.debug("Progreso de upload",
                    upload_id=upload_id,
                    progress=progress.progress_percentage)
    
    async def _cleanup_progress_tracking(self, upload_id: str, delay: int = 300):
        """Limpiar tracking de progreso después de un delay"""
        await asyncio.sleep(delay)
        if upload_id in self.upload_progress:
            del self.upload_progress[upload_id]
            logger.debug("Tracking de progreso limpiado", upload_id=upload_id)


# Instancia global del gestor de archivos
file_manager = FileManager()
