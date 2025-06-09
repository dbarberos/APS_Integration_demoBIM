"""
Router principal de la API v1
"""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    aps,
    projects,
    files,
    viewer,
    webhooks,
    models,
    translate
)

api_router = APIRouter()

# Incluir todos los endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["autenticación"])
api_router.include_router(aps.router, prefix="/aps", tags=["aps-integration"])
api_router.include_router(projects.router, prefix="/projects", tags=["proyectos"])
api_router.include_router(files.router, prefix="/files", tags=["archivos"])
api_router.include_router(models.router, prefix="/models", tags=["modelos"])
api_router.include_router(translate.router, prefix="/translate", tags=["traducción"])
api_router.include_router(viewer.router, prefix="/viewer", tags=["viewer"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])