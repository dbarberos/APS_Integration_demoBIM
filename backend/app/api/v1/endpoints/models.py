"""
Endpoints para gestión de modelos CAD/BIM
"""
import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
import structlog

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_active_user, require_aps_auth
from app.models.user import User
from app.models.project import Project
from app.models.file import File as FileModel, FileStatus
from app.services.aps_storage import APSStorageService
from app.services.aps_service import APSService
from app.schemas.files import FileUploadResponse, FileResponse, FileListResponse
from app.schemas.aps import ModelTranslationResponse

router = APIRouter()
logger = structlog.get_logger()


@router.post("/upload", response_model=FileUploadResponse)
async def upload_model(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project_id: int = Form(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Subir modelo CAD/BIM para procesamiento
    """
    try:
        # Verificar autorización APS
        require_aps_auth(current_user)
        
        # Verificar que el proyecto existe y pertenece al usuario
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == current_user.id
        ).first()
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado"
            )
        
        # Validar archivo
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nombre de archivo requerido"
            )
        
        # Verificar extensión
        allowed_extensions = settings.ALLOWED_EXTENSIONS
        file_extension = '.' + file.filename.split('.')[-1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo de archivo no soportado. Permitidos: {', '.join(allowed_extensions)}"
            )
        
        # Verificar tamaño
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Archivo demasiado grande. Máximo: {settings.MAX_FILE_SIZE / (1024*1024):.1f}MB"
            )
        
        # Generar nombre único para el objeto
        file_id = str(uuid.uuid4())
        object_name = f"{file_id}_{file.filename}"
        
        # Subir a APS
        aps_storage = APSStorageService()
        
        # Crear bucket si no existe
        try:
            await aps_storage.get_bucket_details(project.bucket_key)
        except:
            await aps_storage.create_bucket(
                bucket_key=project.bucket_key,
                policy=project.aps_bucket_policy
            )
        
        # Subir archivo
        file.file.seek(0)  # Reset file pointer
        upload_response = await aps_storage.upload_file(
            bucket_key=project.bucket_key,
            object_name=object_name,
            file_content=file.file,
            content_type=file.content_type
        )
        
        # Crear registro en base de datos
        file_record = FileModel(
            name=file.filename,
            original_filename=file.filename,
            content_type=file.content_type,
            size=file_size,
            urn=upload_response.urn,
            object_key=object_name,
            bucket_key=project.bucket_key,
            status=FileStatus.UPLOADED,
            project_id=project.id
        )
        
        db.add(file_record)
        db.commit()
        db.refresh(file_record)
        
        # Iniciar traducción en background
        background_tasks.add_task(
            start_translation,
            file_record.id,
            upload_response.urn
        )
        
        logger.info("Archivo subido exitosamente",
                   user_id=current_user.id,
                   project_id=project.id,
                   file_id=file_record.id,
                   filename=file.filename,
                   size_mb=round(file_size / (1024*1024), 2))
        
        return FileUploadResponse(
            id=file_record.id,
            name=file_record.name,
            original_filename=file_record.original_filename,
            urn=file_record.urn,
            project_id=file_record.project_id,
            status=file_record.status,
            size=file_record.size,
            uploaded_at=file_record.uploaded_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("Error al subir archivo", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al subir archivo"
        )


@router.get("/", response_model=FileListResponse)
async def list_models(
    project_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Listar modelos del usuario
    """
    try:
        # Construir query base
        query = db.query(FileModel).join(Project).filter(
            Project.user_id == current_user.id
        )
        
        # Aplicar filtros
        if project_id:
            query = query.filter(FileModel.project_id == project_id)
        
        if status_filter:
            query = query.filter(FileModel.status == status_filter)
        
        # Obtener total
        total = query.count()
        
        # Aplicar paginación
        files = query.offset(offset).limit(limit).all()
        
        # Convertir a respuesta
        file_items = []
        for file_record in files:
            file_items.append({
                "id": file_record.id,
                "name": file_record.name,
                "original_filename": file_record.original_filename,
                "urn": file_record.urn,
                "project_id": file_record.project_id,
                "status": file_record.status,
                "size": file_record.size,
                "uploaded_at": file_record.uploaded_at,
                "translated_at": file_record.translated_at
            })
        
        logger.info("Modelos listados",
                   user_id=current_user.id,
                   count=len(file_items),
                   total=total)
        
        return {
            "items": file_items,
            "total": total,
            "has_more": offset + limit < total
        }
        
    except Exception as e:
        logger.error("Error al listar modelos", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener modelos"
        )


@router.get("/{model_id}", response_model=FileResponse)
async def get_model(
    model_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtener información detallada de un modelo
    """
    try:
        # Buscar modelo
        file_record = db.query(FileModel).join(Project).filter(
            FileModel.id == model_id,
            Project.user_id == current_user.id
        ).first()
        
        if not file_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modelo no encontrado"
            )
        
        return {
            "id": file_record.id,
            "name": file_record.name,
            "original_filename": file_record.original_filename,
            "size": file_record.size,
            "project_id": file_record.project_id,
            "urn": file_record.urn,
            "status": file_record.status,
            "uploaded_at": file_record.uploaded_at,
            "translated_at": file_record.translated_at,
            "metadata": file_record.metadata
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al obtener modelo", model_id=model_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener modelo"
        )


@router.post("/translate", response_model=ModelTranslationResponse)
async def translate_model(
    urn: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Iniciar traducción manual de modelo
    """
    try:
        # Verificar autorización APS
        require_aps_auth(current_user)
        
        # Verificar que el modelo pertenece al usuario
        file_record = db.query(FileModel).join(Project).filter(
            FileModel.urn == urn,
            Project.user_id == current_user.id
        ).first()
        
        if not file_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modelo no encontrado"
            )
        
        # Iniciar traducción
        aps_service = APSService()
        translation_result = await aps_service.translate_model(urn)
        
        # Actualizar estado en base de datos
        file_record.status = FileStatus.TRANSLATING
        file_record.translation_job_id = translation_result.urn
        db.commit()
        
        logger.info("Traducción iniciada manualmente",
                   user_id=current_user.id,
                   file_id=file_record.id,
                   urn=urn[:20] + "...")
        
        return translation_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al iniciar traducción", urn=urn[:20], error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al iniciar traducción"
        )


@router.get("/translate/{job_id}/status")
async def get_translation_status(
    job_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtener estado de traducción
    """
    try:
        # Verificar autorización APS
        require_aps_auth(current_user)
        
        # Buscar archivo por job_id
        file_record = db.query(FileModel).join(Project).filter(
            FileModel.translation_job_id == job_id,
            Project.user_id == current_user.id
        ).first()
        
        if not file_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job de traducción no encontrado"
            )
        
        # Obtener estado desde APS
        aps_service = APSService()
        status_result = await aps_service.get_translation_status(job_id)
        
        # Actualizar estado local si es necesario
        if status_result.status == "success" and file_record.status != FileStatus.READY:
            file_record.status = FileStatus.READY
            file_record.translated_at = datetime.utcnow()
            db.commit()
        elif status_result.status == "failed" and file_record.status != FileStatus.ERROR:
            file_record.status = FileStatus.ERROR
            db.commit()
        
        return status_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al obtener estado de traducción", job_id=job_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener estado de traducción"
        )


@router.delete("/{model_id}")
async def delete_model(
    model_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Eliminar modelo y sus archivos asociados
    """
    try:
        # Buscar modelo
        file_record = db.query(FileModel).join(Project).filter(
            FileModel.id == model_id,
            Project.user_id == current_user.id
        ).first()
        
        if not file_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Modelo no encontrado"
            )
        
        # Eliminar de APS si el usuario tiene autorización
        if current_user.is_aps_authenticated:
            try:
                aps_storage = APSStorageService()
                await aps_storage.delete_object(
                    bucket_key=file_record.bucket_key,
                    object_name=file_record.object_key,
                    user_token=current_user.aps_access_token
                )
            except Exception as e:
                logger.warning("Error al eliminar de APS", error=str(e))
        
        # Eliminar de base de datos
        db.delete(file_record)
        db.commit()
        
        logger.info("Modelo eliminado",
                   user_id=current_user.id,
                   model_id=model_id,
                   filename=file_record.name)
        
        return {"message": "Modelo eliminado exitosamente"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error("Error al eliminar modelo", model_id=model_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar modelo"
        )


async def start_translation(file_id: int, urn: str):
    """
    Función de background para iniciar traducción automática
    """
    try:
        from app.core.database import SessionLocal
        
        db = SessionLocal()
        
        # Obtener archivo
        file_record = db.query(FileModel).filter(FileModel.id == file_id).first()
        if not file_record:
            return
        
        # Actualizar estado
        file_record.status = FileStatus.TRANSLATING
        db.commit()
        
        # Iniciar traducción con token de aplicación
        aps_service = APSService()
        translation_result = await aps_service.translate_model(urn)
        
        # Actualizar job ID
        file_record.translation_job_id = translation_result.urn
        db.commit()
        
        logger.info("Traducción automática iniciada",
                   file_id=file_id,
                   job_id=translation_result.urn)
        
        db.close()
        
    except Exception as e:
        logger.error("Error en traducción automática", file_id=file_id, error=str(e))
        
        # Marcar como error si falla
        try:
            file_record.status = FileStatus.ERROR
            file_record.translation_error = str(e)
            db.commit()
            db.close()
        except:
            pass
