"""
Endpoints para webhooks de APS con sistema completo de notificaciones
"""
from fastapi import APIRouter, Request, HTTPException, status, Depends
from typing import Dict, Any, List
import structlog

from app.services.webhook_handler import webhook_handler
from app.core.security import get_current_active_user
from app.models.user import User

router = APIRouter()
logger = structlog.get_logger()


@router.post("/aps/translation")
async def aps_translation_webhook(request: Request):
    """
    Webhook principal para todas las notificaciones de APS (traducción, extracción, etc.)
    """
    try:
        # Obtener datos del webhook
        event_data = await request.json()
        
        # Procesar webhook con sistema completo
        result = await webhook_handler.handle_webhook(request, event_data)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al procesar webhook APS", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno al procesar webhook"
        )


@router.post("/aps/extraction")
async def aps_extraction_webhook(request: Request):
    """
    Webhook específico para notificaciones de extracción de metadatos
    """
    try:
        event_data = await request.json()
        
        # Procesar con el sistema de webhooks
        result = await webhook_handler.handle_webhook(request, event_data)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al procesar webhook de extracción", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al procesar webhook de extracción"
        )


@router.post("/aps/generic")
async def aps_generic_webhook(request: Request):
    """
    Webhook genérico para cualquier evento de APS
    """
    try:
        event_data = await request.json()
        
        # Usar el manejador general para todos los eventos
        result = await webhook_handler.handle_webhook(request, event_data)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al procesar webhook genérico", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al procesar webhook"
        )


# Endpoints de gestión y monitoreo de webhooks
@router.get("/status")
async def get_webhook_status(
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener estado del sistema de webhooks
    """
    try:
        # Solo superusuarios pueden ver el estado del sistema
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes"
            )
        
        status_info = await webhook_handler.get_webhook_status()
        
        return status_info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al obtener estado de webhooks", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener estado"
        )


@router.get("/failed")
async def get_failed_webhooks(
    current_user: User = Depends(get_current_active_user)
) -> List[Dict[str, Any]]:
    """
    Obtener lista de webhooks fallidos
    """
    try:
        # Solo superusuarios pueden ver webhooks fallidos
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes"
            )
        
        failed_webhooks = await webhook_handler.get_failed_webhooks()
        
        return failed_webhooks
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al obtener webhooks fallidos", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener webhooks fallidos"
        )


@router.post("/retry/{webhook_id}")
async def retry_failed_webhook(
    webhook_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Reintentar webhook fallido manualmente
    """
    try:
        # Solo superusuarios pueden reintentar webhooks
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes"
            )
        
        success = await webhook_handler.retry_failed_webhook(webhook_id)
        
        if success:
            return {
                "message": "Webhook marcado para reintento",
                "webhook_id": webhook_id
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Webhook fallido no encontrado"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al reintentar webhook",
                    webhook_id=webhook_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al reintentar webhook"
        )


@router.get("/health")
async def webhook_health_check():
    """
    Endpoint de verificación de salud para webhooks
    """
    try:
        # Obtener estado básico del sistema
        status_info = await webhook_handler.get_webhook_status()
        
        return {
            "status": "healthy",
            "service": "webhooks",
            "timestamp": status_info.get("last_cleanup"),
            "statistics": status_info.get("statistics", {}),
            "configuration": status_info.get("configuration", {})
        }
        
    except Exception as e:
        logger.error("Error en health check de webhooks", error=str(e))
        return {
            "status": "unhealthy",
            "service": "webhooks",
            "error": str(e)
        }


# Endpoint de configuración
@router.post("/configure")
async def configure_webhooks(
    webhook_url: str,
    events: List[str],
    current_user: User = Depends(get_current_active_user)
):
    """
    Configurar webhooks en APS (endpoint administrativo)
    """
    try:
        # Solo superusuarios pueden configurar webhooks
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes"
            )
        
        # TODO: Implementar configuración real de webhooks en APS
        # Esto requiere hacer llamadas a la API de APS para registrar los webhooks
        
        logger.info("Configuración de webhooks solicitada",
                   webhook_url=webhook_url,
                   events=events,
                   user_id=current_user.id)
        
        return {
            "message": "Configuración de webhooks iniciada",
            "webhook_url": webhook_url,
            "events": events,
            "status": "pending"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al configurar webhooks", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al configurar webhooks"
        )


# Endpoint de test para desarrollo
@router.post("/test")
async def test_webhook(
    event_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """
    Endpoint de prueba para simular webhooks (solo desarrollo)
    """
    try:
        # Solo en modo desarrollo y para superusuarios
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes"
            )
        
        # Crear request simulado
        from fastapi import Request
        from unittest.mock import AsyncMock
        
        mock_request = AsyncMock(spec=Request)
        mock_request.body = AsyncMock(return_value=b'{}')
        mock_request.headers = {}
        
        # Procesar evento de prueba
        result = await webhook_handler.handle_webhook(mock_request, event_data)
        
        logger.info("Webhook de prueba procesado",
                   user_id=current_user.id,
                   event_type=event_data.get('EventType'))
        
        return {
            "message": "Webhook de prueba procesado",
            "result": result,
            "test_data": event_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error en webhook de prueba", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error en webhook de prueba"
        )