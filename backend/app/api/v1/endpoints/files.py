"""
Endpoints avanzados para gestión de archivos
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Request, BackgroundTasks
from sqlalchemy.orm import Session
import structlog

from app.core.security import get_current_active_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.files import (
    FileResponse,
    FileListResponse,
    FileUploadResponse
)
from app.services.file_manager import file_manager
from app.tasks.file_processing import file_processing_tasks

router = APIRouter()
logger = structlog.get_logger()


@router.get("/", response_model=FileListResponse)
async def list_files(
    project_id: Optional[int] = Query(None, description="Filtrar por proyecto"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filtrar por estado"),
    search: Optional[str] = Query(None, description="Buscar en nombre de archivo"),
    limit: int = Query(20, ge=1, le=100, description="Límite de resultados"),
    offset: int = Query(0, ge=0, description="Offset para paginación"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Listar archivos con filtros avanzados y paginación
    """
    try:
        result = await file_manager.list_files(
            user_id=current_user.id,
            db=db,
            project_id=project_id,
            status_filter=status_filter,
            search=search,
            limit=limit,
            offset=offset
        )
        
        logger.info("Archivos listados",
                   user_id=current_user.id,
                   count=len(result['items']),
                   total=result['total'])
        
        return {
            "items": result['items'],
            "total": result['total'],
            "limit": result['limit'],
            "offset": result['offset'],
            "has_more": result['has_more']
        }
        
    except Exception as e:
        logger.error("Error al listar archivos", user_id=current_user.id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener archivos"
        )


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(..., description="Archivo CAD/BIM a subir"),
    project_id: int = Form(..., description="ID del proyecto"),
    metadata: Optional[str] = Form(None, description="Metadatos adicionales en JSON"),
    auto_translate: bool = Form(True, description="Iniciar traducción automática"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Upload avanzado de archivo con validación completa y procesamiento automático
    """
    try:
        # Parsear metadatos si se proporcionan
        metadata_dict = {}
        if metadata:
            try:
                import json
                metadata_dict = json.loads(metadata)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Metadatos JSON inválidos"
                )
        
        # Upload con validación completa
        upload_result = await file_manager.upload_file(
            file=file,
            project_id=project_id,
            user_id=current_user.id,
            db=db,
            metadata=metadata_dict
        )
        
        # Programar tareas de procesamiento en background
        if auto_translate and upload_result.get('status') == 'uploaded':
            background_tasks.add_task(
                file_processing_tasks.translate_file,
                upload_result['id']
            )
            
            # También generar thumbnails después de traducción
            background_tasks.add_task(
                file_processing_tasks.generate_thumbnails,
                upload_result['id']
            )
            
            # Extraer metadatos
            background_tasks.add_task(
                file_processing_tasks.extract_metadata,
                upload_result['id']
            )
        
        logger.info("Archivo subido exitosamente",
                   user_id=current_user.id,
                   file_id=upload_result['id'],
                   filename=upload_result['filename'],
                   size_mb=round(upload_result['size'] / (1024*1024), 2))
        
        return upload_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al subir archivo",
                    user_id=current_user.id,
                    filename=file.filename if file else "unknown",
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al subir archivo: {str(e)}"
        )


@router.get("/{file_id}")
async def get_file(
    file_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtener información detallada de archivo con metadatos extendidos
    """
    try:
        file_details = await file_manager.get_file_details(
            file_id=file_id,
            user_id=current_user.id,
            db=db
        )
        
        logger.info("Detalles de archivo obtenidos",
                   user_id=current_user.id,
                   file_id=file_id)
        
        return file_details
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al obtener archivo",
                    user_id=current_user.id,
                    file_id=file_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener archivo"
        )


@router.get("/{file_id}/download")
async def download_file(
    file_id: int,
    expires_in: int = Query(3600, ge=300, le=86400, description="Duración en segundos"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generar URL firmada para descarga directa de archivo
    """
    try:
        download_info = await file_manager.generate_download_url(
            file_id=file_id,
            user_id=current_user.id,
            db=db,
            expires_in=expires_in
        )
        
        logger.info("URL de descarga generada",
                   user_id=current_user.id,
                   file_id=file_id,
                   expires_in=expires_in)
        
        return download_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al generar URL de descarga",
                    user_id=current_user.id,
                    file_id=file_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al generar URL de descarga"
        )


@router.post("/{file_id}/share")
async def share_file(
    file_id: int,
    share_type: str = Form("protected"),
    password: Optional[str] = Form(None),
    expires_hours: Optional[int] = Form(24),
    max_downloads: Optional[int] = Form(None),
    allow_download: bool = Form(True),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Generar enlace compartido para archivo
    """
    try:
        # TODO: Implementar funcionalidad de compartir
        # Esto requiere los modelos de FileShare que creamos
        
        share_data = {
            "share_token": f"share_{file_id}_{current_user.id}",
            "share_url": f"https://app.example.com/shared/share_{file_id}_{current_user.id}",
            "share_type": share_type,
            "expires_hours": expires_hours,
            "max_downloads": max_downloads,
            "allow_download": allow_download
        }
        
        logger.info("Enlace de compartir generado",
                   user_id=current_user.id,
                   file_id=file_id,
                   share_type=share_type)
        
        return share_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al generar enlace compartido",
                    user_id=current_user.id,
                    file_id=file_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al generar enlace compartido"
        )


@router.get("/{file_id}/metadata")
async def get_file_metadata(
    file_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtener metadatos detallados del archivo
    """
    try:
        file_details = await file_manager.get_file_details(
            file_id=file_id,
            user_id=current_user.id,
            db=db
        )
        
        # Extraer solo metadatos
        metadata_response = {
            "file_id": file_id,
            "basic_metadata": file_details.get("metadata", {}),
            "extended_metadata": file_details.get("extended_metadata", {}),
            "aps_details": file_details.get("aps_details", {}),
            "last_updated": file_details.get("updated_at")
        }
        
        return metadata_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al obtener metadatos",
                    user_id=current_user.id,
                    file_id=file_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener metadatos"
        )


@router.put("/{file_id}/metadata")
async def update_file_metadata(
    file_id: int,
    metadata: Dict[str, Any],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Actualizar metadatos del archivo
    """
    try:
        updated_metadata = await file_manager.update_file_metadata(
            file_id=file_id,
            user_id=current_user.id,
            metadata=metadata,
            db=db
        )
        
        logger.info("Metadatos actualizados",
                   user_id=current_user.id,
                   file_id=file_id,
                   updated_fields=list(metadata.keys()))
        
        return updated_metadata
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al actualizar metadatos",
                    user_id=current_user.id,
                    file_id=file_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar metadatos"
        )


@router.delete("/{file_id}")
async def delete_file(
    file_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Eliminar archivo completamente (BD y APS)
    """
    try:
        success = await file_manager.delete_file(
            file_id=file_id,
            user_id=current_user.id,
            db=db
        )
        
        if success:
            logger.info("Archivo eliminado exitosamente",
                       user_id=current_user.id,
                       file_id=file_id)
            return {"message": "Archivo eliminado exitosamente"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo eliminar el archivo"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al eliminar archivo",
                    user_id=current_user.id,
                    file_id=file_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar archivo"
        )


# Endpoints de progreso y monitoreo
@router.get("/upload/{upload_id}/progress")
async def get_upload_progress(
    upload_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener progreso de upload en tiempo real
    """
    try:
        progress_data = await file_manager.get_upload_progress(upload_id)
        
        if not progress_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload no encontrado o expirado"
            )
        
        return progress_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al obtener progreso de upload",
                    upload_id=upload_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener progreso"
        )


# Endpoints de procesamiento
@router.post("/{file_id}/translate")
async def translate_file(
    file_id: int,
    output_formats: List[str] = Form(["svf2"]),
    current_user: User = Depends(get_current_active_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Iniciar traducción manual de archivo
    """
    try:
        # Programar traducción en background
        background_tasks.add_task(
            file_processing_tasks.translate_file,
            file_id,
            {"output_formats": output_formats}
        )
        
        logger.info("Traducción manual iniciada",
                   user_id=current_user.id,
                   file_id=file_id,
                   formats=output_formats)
        
        return {
            "message": "Traducción iniciada",
            "file_id": file_id,
            "output_formats": output_formats
        }
        
    except Exception as e:
        logger.error("Error al iniciar traducción",
                    user_id=current_user.id,
                    file_id=file_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al iniciar traducción"
        )


@router.post("/{file_id}/thumbnails")
async def generate_thumbnails(
    file_id: int,
    sizes: List[str] = Form(["small", "medium", "large"]),
    current_user: User = Depends(get_current_active_user),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Generar thumbnails para archivo
    """
    try:
        # Programar generación en background
        background_tasks.add_task(
            file_processing_tasks.generate_thumbnails,
            file_id,
            sizes
        )
        
        logger.info("Generación de thumbnails iniciada",
                   user_id=current_user.id,
                   file_id=file_id,
                   sizes=sizes)
        
        return {
            "message": "Generación de thumbnails iniciada",
            "file_id": file_id,
            "sizes": sizes
        }
        
    except Exception as e:
        logger.error("Error al generar thumbnails",
                    user_id=current_user.id,
                    file_id=file_id,
                    error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al generar thumbnails"
        )


# Endpoints de estadísticas
@router.get("/statistics/processing")
async def get_processing_statistics(
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener estadísticas de procesamiento de archivos
    """
    try:
        # Solo superusuarios pueden ver estadísticas globales
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes"
            )
        
        statistics = await file_processing_tasks.get_processing_statistics()
        
        return statistics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al obtener estadísticas", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener estadísticas"
        )