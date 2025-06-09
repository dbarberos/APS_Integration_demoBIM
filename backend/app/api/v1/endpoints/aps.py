"""
Endpoints para integración con Autodesk Platform Services (APS)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import structlog

from app.core.security import get_current_user
from app.services.aps_service import APSService
from app.schemas.aps import (
    BucketCreate,
    BucketResponse,
    FileUploadResponse,
    ModelTranslationResponse
)

router = APIRouter()
logger = structlog.get_logger()


@router.get("/buckets", response_model=List[BucketResponse])
async def list_buckets(
    current_user: str = Depends(get_current_user)
):
    """
    Listar buckets de APS del usuario
    """
    try:
        aps_service = APSService()
        buckets = await aps_service.list_buckets()
        
        logger.info("Buckets listados", user=current_user, count=len(buckets))
        return buckets
        
    except Exception as e:
        logger.error("Error al listar buckets", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener buckets de APS"
        )


@router.post("/buckets", response_model=BucketResponse)
async def create_bucket(
    bucket_data: BucketCreate,
    current_user: str = Depends(get_current_user)
):
    """
    Crear nuevo bucket en APS
    """
    try:
        aps_service = APSService()
        bucket = await aps_service.create_bucket(
            bucket_key=bucket_data.bucket_key,
            policy=bucket_data.policy
        )
        
        logger.info("Bucket creado", user=current_user, bucket_key=bucket_data.bucket_key)
        return bucket
        
    except Exception as e:
        logger.error("Error al crear bucket", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear bucket en APS"
        )


@router.post("/buckets/{bucket_key}/files", response_model=FileUploadResponse)
async def upload_file(
    bucket_key: str,
    file_name: str,
    current_user: str = Depends(get_current_user)
):
    """
    Subir archivo a bucket de APS
    """
    try:
        aps_service = APSService()
        upload_result = await aps_service.upload_file(
            bucket_key=bucket_key,
            file_name=file_name
        )
        
        logger.info("Archivo subido", user=current_user, bucket=bucket_key, file=file_name)
        return upload_result
        
    except Exception as e:
        logger.error("Error al subir archivo", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al subir archivo a APS"
        )


@router.post("/translate", response_model=ModelTranslationResponse)
async def translate_model(
    urn: str,
    current_user: str = Depends(get_current_user)
):
    """
    Iniciar traducción de modelo en APS
    """
    try:
        aps_service = APSService()
        translation_result = await aps_service.translate_model(urn=urn)
        
        logger.info("Traducción iniciada", user=current_user, urn=urn[:20] + "...")
        return translation_result
        
    except Exception as e:
        logger.error("Error al iniciar traducción", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al iniciar traducción en APS"
        )


@router.get("/translate/{urn}/status")
async def get_translation_status(
    urn: str,
    current_user: str = Depends(get_current_user)
):
    """
    Obtener estado de traducción de modelo
    """
    try:
        aps_service = APSService()
        status_result = await aps_service.get_translation_status(urn=urn)
        
        return status_result
        
    except Exception as e:
        logger.error("Error al obtener estado de traducción", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener estado de traducción"
        )


@router.get("/models/{urn}/metadata")
async def get_model_metadata(
    urn: str,
    current_user: str = Depends(get_current_user)
):
    """
    Obtener metadatos de modelo traducido
    """
    try:
        aps_service = APSService()
        metadata = await aps_service.get_model_metadata(urn=urn)
        
        return metadata
        
    except Exception as e:
        logger.error("Error al obtener metadatos", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener metadatos del modelo"
        )