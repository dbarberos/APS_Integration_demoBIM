"""
Servicio de almacenamiento APS (Object Storage Service)
"""
import httpx
import base64
import hashlib
import os
from typing import Dict, List, Optional, BinaryIO
from datetime import datetime
import structlog

from app.core.config import settings
from app.services.aps_auth import APSAuthService
from app.schemas.aps import BucketResponse, FileUploadResponse

logger = structlog.get_logger()


class APSStorageService:
    """Servicio para operaciones de almacenamiento en APS OSS"""
    
    def __init__(self):
        self.base_url = settings.APS_BASE_URL
        self.auth_service = APSAuthService()
    
    async def _make_authenticated_request(
        self,
        method: str,
        endpoint: str,
        use_app_token: bool = True,
        user_token: Optional[str] = None,
        **kwargs
    ) -> Dict:
        """
        Realizar petición autenticada a APS API
        """
        if use_app_token:
            token_response = await self.auth_service.get_app_token()
            access_token = token_response.access_token
        else:
            if not user_token:
                raise ValueError("Token de usuario requerido")
            access_token = user_token
        
        headers = kwargs.get("headers", {})
        headers["Authorization"] = f"Bearer {access_token}"
        
        if "json" in kwargs and "Content-Type" not in headers:
            headers["Content-Type"] = "application/json"
        
        kwargs["headers"] = headers
        
        url = f"{self.base_url}{endpoint}"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.request(method, url, **kwargs)
            response.raise_for_status()
            
            if response.headers.get("content-type", "").startswith("application/json"):
                return response.json()
            else:
                return {"content": response.content, "headers": dict(response.headers)}
    
    async def list_buckets(self, user_token: Optional[str] = None) -> List[BucketResponse]:
        """
        Listar buckets disponibles
        """
        try:
            response = await self._make_authenticated_request(
                "GET",
                "/oss/v2/buckets",
                use_app_token=user_token is None,
                user_token=user_token
            )
            
            buckets = []
            for bucket_data in response.get("items", []):
                bucket = BucketResponse(
                    bucket_key=bucket_data["bucketKey"],
                    bucket_owner=bucket_data["bucketOwner"],
                    created_date=datetime.fromisoformat(bucket_data["createdDate"].replace('Z', '+00:00')),
                    policy=bucket_data["policyKey"],
                    permissions=bucket_data.get("permissions", [])
                )
                buckets.append(bucket)
            
            logger.info("Buckets listados exitosamente", count=len(buckets))
            return buckets
            
        except Exception as e:
            logger.error("Error al listar buckets", error=str(e))
            raise
    
    async def create_bucket(
        self,
        bucket_key: str,
        policy: str = "temporary",
        user_token: Optional[str] = None
    ) -> BucketResponse:
        """
        Crear nuevo bucket
        """
        try:
            data = {
                "bucketKey": bucket_key,
                "policyKey": policy
            }
            
            response = await self._make_authenticated_request(
                "POST",
                "/oss/v2/buckets",
                json=data,
                use_app_token=user_token is None,
                user_token=user_token
            )
            
            bucket = BucketResponse(
                bucket_key=response["bucketKey"],
                bucket_owner=response["bucketOwner"],
                created_date=datetime.fromisoformat(response["createdDate"].replace('Z', '+00:00')),
                policy=response["policyKey"],
                permissions=response.get("permissions", [])
            )
            
            logger.info("Bucket creado exitosamente", bucket_key=bucket_key)
            return bucket
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 409:
                logger.warning("Bucket ya existe", bucket_key=bucket_key)
                # Intentar obtener el bucket existente
                try:
                    return await self.get_bucket_details(bucket_key, user_token)
                except:
                    raise e
            else:
                logger.error("Error al crear bucket", 
                           bucket_key=bucket_key,
                           status_code=e.response.status_code,
                           response=e.response.text)
                raise
        except Exception as e:
            logger.error("Error inesperado al crear bucket", bucket_key=bucket_key, error=str(e))
            raise
    
    async def get_bucket_details(
        self,
        bucket_key: str,
        user_token: Optional[str] = None
    ) -> BucketResponse:
        """
        Obtener detalles de un bucket específico
        """
        try:
            response = await self._make_authenticated_request(
                "GET",
                f"/oss/v2/buckets/{bucket_key}/details",
                use_app_token=user_token is None,
                user_token=user_token
            )
            
            return BucketResponse(
                bucket_key=response["bucketKey"],
                bucket_owner=response["bucketOwner"],
                created_date=datetime.fromisoformat(response["createdDate"].replace('Z', '+00:00')),
                policy=response["policyKey"],
                permissions=response.get("permissions", [])
            )
            
        except Exception as e:
            logger.error("Error al obtener detalles del bucket", bucket_key=bucket_key, error=str(e))
            raise
    
    async def upload_file(
        self,
        bucket_key: str,
        object_name: str,
        file_content: BinaryIO,
        content_type: Optional[str] = None,
        user_token: Optional[str] = None
    ) -> FileUploadResponse:
        """
        Subir archivo a bucket
        """
        try:
            # Leer contenido del archivo
            file_content.seek(0)
            content = file_content.read()
            file_size = len(content)
            
            # Calcular SHA1
            sha1_hash = hashlib.sha1(content).hexdigest()
            
            # Preparar headers
            headers = {}
            if content_type:
                headers["Content-Type"] = content_type
            else:
                headers["Content-Type"] = "application/octet-stream"
            
            headers["Content-Length"] = str(file_size)
            
            # Subir archivo
            response = await self._make_authenticated_request(
                "PUT",
                f"/oss/v2/buckets/{bucket_key}/objects/{object_name}",
                content=content,
                headers=headers,
                use_app_token=user_token is None,
                user_token=user_token
            )
            
            # Crear URN
            urn = f"urn:adsk.objects:os.object:{bucket_key}/{object_name}"
            encoded_urn = base64.urlsafe_b64encode(urn.encode()).decode()
            
            upload_response = FileUploadResponse(
                bucket_key=bucket_key,
                object_id=response.get("objectId", urn),
                object_key=object_name,
                sha1=response.get("sha1", sha1_hash),
                size=response.get("size", file_size),
                content_type=response.get("contentType", content_type or "application/octet-stream"),
                location=response.get("location", f"{self.base_url}/oss/v2/buckets/{bucket_key}/objects/{object_name}"),
                urn=encoded_urn
            )
            
            logger.info("Archivo subido exitosamente",
                       bucket_key=bucket_key,
                       object_name=object_name,
                       size_mb=round(file_size / (1024 * 1024), 2))
            
            return upload_response
            
        except Exception as e:
            logger.error("Error al subir archivo",
                        bucket_key=bucket_key,
                        object_name=object_name,
                        error=str(e))
            raise
    
    async def get_object_details(
        self,
        bucket_key: str,
        object_name: str,
        user_token: Optional[str] = None
    ) -> Dict:
        """
        Obtener detalles de un objeto en el bucket
        """
        try:
            response = await self._make_authenticated_request(
                "GET",
                f"/oss/v2/buckets/{bucket_key}/objects/{object_name}/details",
                use_app_token=user_token is None,
                user_token=user_token
            )
            
            return response
            
        except Exception as e:
            logger.error("Error al obtener detalles del objeto",
                        bucket_key=bucket_key,
                        object_name=object_name,
                        error=str(e))
            raise
    
    async def delete_object(
        self,
        bucket_key: str,
        object_name: str,
        user_token: Optional[str] = None
    ) -> bool:
        """
        Eliminar objeto del bucket
        """
        try:
            await self._make_authenticated_request(
                "DELETE",
                f"/oss/v2/buckets/{bucket_key}/objects/{object_name}",
                use_app_token=user_token is None,
                user_token=user_token
            )
            
            logger.info("Objeto eliminado exitosamente",
                       bucket_key=bucket_key,
                       object_name=object_name)
            
            return True
            
        except Exception as e:
            logger.error("Error al eliminar objeto",
                        bucket_key=bucket_key,
                        object_name=object_name,
                        error=str(e))
            raise
    
    async def generate_signed_url(
        self,
        bucket_key: str,
        object_name: str,
        access: str = "read",
        expires_in: int = 3600,
        user_token: Optional[str] = None
    ) -> str:
        """
        Generar URL firmada para acceso temporal al objeto
        """
        try:
            data = {
                "access": access,
                "expiresIn": expires_in
            }
            
            response = await self._make_authenticated_request(
                "POST",
                f"/oss/v2/buckets/{bucket_key}/objects/{object_name}/signed",
                json=data,
                use_app_token=user_token is None,
                user_token=user_token
            )
            
            signed_url = response.get("signedUrl")
            
            logger.info("URL firmada generada",
                       bucket_key=bucket_key,
                       object_name=object_name,
                       expires_in=expires_in)
            
            return signed_url
            
        except Exception as e:
            logger.error("Error al generar URL firmada",
                        bucket_key=bucket_key,
                        object_name=object_name,
                        error=str(e))
            raise
    
    @staticmethod
    def generate_bucket_key(base_name: str, user_id: int) -> str:
        """
        Generar clave de bucket única
        """
        # Los bucket keys deben ser únicos globalmente y seguir ciertas reglas
        # - Solo minúsculas, números y guiones
        # - Entre 3 y 128 caracteres
        # - No pueden empezar o terminar con guión
        
        import re
        import uuid
        
        # Limpiar base_name
        clean_name = re.sub(r'[^a-z0-9\-]', '-', base_name.lower())
        clean_name = re.sub(r'-+', '-', clean_name)  # Múltiples guiones a uno
        clean_name = clean_name.strip('-')  # Remover guiones al inicio/final
        
        # Limitar longitud
        if len(clean_name) > 50:
            clean_name = clean_name[:50]
        
        # Agregar sufijo único
        suffix = str(uuid.uuid4())[:8]
        bucket_key = f"{clean_name}-{user_id}-{suffix}"
        
        return bucket_key
