"""
Endpoints para gestión de proyectos
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
import structlog

from app.core.security import get_current_user
from app.schemas.projects import (
    ProjectCreate,
    ProjectUpdate, 
    ProjectResponse,
    ProjectListResponse
)

router = APIRouter()
logger = structlog.get_logger()


@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user)
):
    """
    Listar proyectos del usuario con paginación y búsqueda
    """
    try:
        # TODO: Implementar consulta a base de datos
        # Por ahora, datos de ejemplo
        projects = [
            {
                "id": 1,
                "name": "Edificio Corporativo",
                "description": "Proyecto de oficinas principales",
                "bucket_key": "proyecto-edificio-corp",
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-01-16T15:45:00Z",
                "files_count": 5
            }
        ]
        
        # Aplicar filtros de búsqueda si se proporciona
        if search:
            projects = [p for p in projects if search.lower() in p["name"].lower()]
        
        # Aplicar paginación
        total = len(projects)
        paginated_projects = projects[offset:offset + limit]
        
        logger.info("Proyectos listados", user=current_user, count=len(paginated_projects))
        
        return {
            "items": paginated_projects,
            "total": total,
            "has_more": offset + limit < total
        }
        
    except Exception as e:
        logger.error("Error al listar proyectos", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener proyectos"
        )


@router.post("/", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    current_user: str = Depends(get_current_user)
):
    """
    Crear nuevo proyecto
    """
    try:
        # TODO: Implementar creación en base de datos
        # Generar bucket_key único
        import uuid
        bucket_key = f"{project_data.name.lower().replace(' ', '-')}-{str(uuid.uuid4())[:8]}"
        
        new_project = {
            "id": 2,
            "name": project_data.name,
            "description": project_data.description,
            "bucket_key": bucket_key,
            "created_at": "2024-01-16T09:00:00Z",
            "updated_at": "2024-01-16T09:00:00Z",
            "files_count": 0
        }
        
        logger.info("Proyecto creado", user=current_user, project_name=project_data.name)
        return new_project
        
    except Exception as e:
        logger.error("Error al crear proyecto", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear proyecto"
        )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    current_user: str = Depends(get_current_user)
):
    """
    Obtener proyecto específico con sus archivos
    """
    try:
        # TODO: Implementar consulta a base de datos
        project = {
            "id": project_id,
            "name": "Edificio Corporativo",
            "description": "Proyecto de oficinas principales",
            "bucket_key": "proyecto-edificio-corp",
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-16T15:45:00Z",
            "files": [
                {
                    "id": 1,
                    "name": "planta-baja.rvt",
                    "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6cHJveWVjdG8tZWRpZmljaW8tY29ycC9wbGFudGEtYmFqYS5ydnQ",
                    "status": "ready",
                    "uploaded_at": "2024-01-15T11:00:00Z"
                }
            ]
        }
        
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado"
            )
        
        return project
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error al obtener proyecto", project_id=project_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener proyecto"
        )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    current_user: str = Depends(get_current_user)
):
    """
    Actualizar proyecto existente
    """
    try:
        # TODO: Implementar actualización en base de datos
        updated_project = {
            "id": project_id,
            "name": project_data.name or "Edificio Corporativo",
            "description": project_data.description or "Proyecto actualizado",
            "bucket_key": "proyecto-edificio-corp",
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-16T16:00:00Z",
            "files_count": 5
        }
        
        logger.info("Proyecto actualizado", user=current_user, project_id=project_id)
        return updated_project
        
    except Exception as e:
        logger.error("Error al actualizar proyecto", project_id=project_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar proyecto"
        )


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    current_user: str = Depends(get_current_user)
):
    """
    Eliminar proyecto y todos sus archivos
    """
    try:
        # TODO: Implementar eliminación en base de datos
        # También eliminar bucket de APS si es necesario
        
        logger.info("Proyecto eliminado", user=current_user, project_id=project_id)
        return {"message": "Proyecto eliminado exitosamente"}
        
    except Exception as e:
        logger.error("Error al eliminar proyecto", project_id=project_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar proyecto"
        )