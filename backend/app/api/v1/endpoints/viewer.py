"""
Endpoints para el viewer de Autodesk
"""
from fastapi import APIRouter, Depends, HTTPException, status
import structlog

from app.core.security import get_current_user
from app.services.aps_service import APSService
from app.schemas.aps import ViewerToken

router = APIRouter()
logger = structlog.get_logger()


@router.get("/token", response_model=ViewerToken)
async def get_viewer_token(
    current_user: str = Depends(get_current_user)
):
    """
    Obtener token de acceso para el viewer
    """
    try:
        aps_service = APSService()
        token = await aps_service.get_viewer_token()
        
        logger.info("Token de viewer obtenido", user=current_user)
        return token
        
    except Exception as e:
        logger.error("Error al obtener token de viewer", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener token de viewer"
        )


@router.get("/config/{urn}")
async def get_viewer_config(
    urn: str,
    current_user: str = Depends(get_current_user)
):
    """
    Obtener configuración completa para el viewer
    """
    try:
        aps_service = APSService()
        token = await aps_service.get_viewer_token()
        
        config = {
            "urn": urn,
            "access_token": token.access_token,
            "api": "derivativeV2",
            "env": "AutodeskProduction",
            "options": {
                "extensions": [
                    "Autodesk.DocumentBrowser",
                    "Autodesk.Measure",
                    "Autodesk.Section",
                    "Autodesk.Explode"
                ],
                "theme": "light",
                "backgroundColor": "#FFFFFF"
            }
        }
        
        logger.info("Configuración de viewer obtenida", user=current_user, urn=urn[:20] + "...")
        return config
        
    except Exception as e:
        logger.error("Error al obtener configuración de viewer", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener configuración de viewer"
        )


@router.get("/extensions")
async def list_viewer_extensions():
    """
    Listar extensiones disponibles para el viewer
    """
    extensions = [
        {
            "id": "Autodesk.DocumentBrowser",
            "name": "Document Browser",
            "description": "Navegador de documentos y geometrías"
        },
        {
            "id": "Autodesk.Measure",
            "name": "Measure Tool",
            "description": "Herramienta de medición"
        },
        {
            "id": "Autodesk.Section",
            "name": "Section Tool",
            "description": "Herramienta de cortes y secciones"
        },
        {
            "id": "Autodesk.Explode",
            "name": "Explode Tool",
            "description": "Herramienta de explosión de vista"
        },
        {
            "id": "Autodesk.Properties",
            "name": "Properties Panel",
            "description": "Panel de propiedades de elementos"
        },
        {
            "id": "Autodesk.LayerManager",
            "name": "Layer Manager",
            "description": "Gestor de capas"
        },
        {
            "id": "Autodesk.ModelStructurePanel",
            "name": "Model Structure",
            "description": "Panel de estructura del modelo"
        }
    ]
    
    return {"extensions": extensions}


@router.post("/session")
async def create_viewer_session(
    file_id: int,
    current_user: str = Depends(get_current_user)
):
    """
    Crear nueva sesión de visualización
    """
    try:
        # TODO: Implementar creación de sesión en base de datos
        session = {
            "session_id": "session_123",
            "file_id": file_id,
            "user_id": current_user,
            "started_at": "2024-01-16T10:00:00Z",
            "expires_at": "2024-01-16T18:00:00Z"
        }
        
        logger.info("Sesión de viewer creada", user=current_user, file_id=file_id)
        return session
        
    except Exception as e:
        logger.error("Error al crear sesión de viewer", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear sesión de viewer"
        )


@router.put("/session/{session_id}/end")
async def end_viewer_session(
    session_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    Finalizar sesión de visualización
    """
    try:
        # TODO: Implementar finalización de sesión en base de datos
        
        logger.info("Sesión de viewer finalizada", user=current_user, session_id=session_id)
        return {"message": "Sesión finalizada exitosamente"}
        
    except Exception as e:
        logger.error("Error al finalizar sesión de viewer", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al finalizar sesión de viewer"
        )