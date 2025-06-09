"""
Servicio avanzado de almacenamiento APS con optimizaciones para archivos grandes
"""
import asyncio
import base64
import hashlib
import os
import tempfile
from typing import Dict, List, Optional, BinaryIO, AsyncGenerator
from pathlib import Path
import httpx
import structlog
from fastapi import UploadFile

from app.services.aps_auth import APSAuthService
from app.core.config import settings

logger = structlog.get_logger()


class APSStorageAdvanced:
    """Servicio avanzado de almacenamiento APS con soporte para archivos grandes"""
    
    def __init__(self, auth_service: APSAuthService):
        self.auth_service = auth_service
        self.base_url = "https://developer.api.autodesk.com"
        self.chunk_size = 5 * 1024 * 1024  # 5MB chunks por defecto
        self.max_retries = 3
    
    async def upload_large_file(
        self,
        bucket_key: str,
        file: UploadFile,
        object_name: Optional[str] = None,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, any]:
        """
        Upload de archivo grande con chunking y resumibilidad
        
        Args:
            bucket_key: Clave del bucket
            file: Archivo a subir
            object_name: Nombre del objeto (opcional)
            progress_callback: Callback para reportar progreso
            
        Returns:
            Dict con información del archivo subido
        """
        try:
            if not object_name:
                object_name = file.filename
            
            # Obtener tamaño del archivo
            await file.seek(0, 2)  # Ir al final
            file_size = await file.tell()
            await file.seek(0)  # Regresar al inicio
            
            logger.info("Iniciando upload de archivo grande",
                       object_name=object_name,
                       file_size_mb=round(file_size / (1024*1024), 2),
                       bucket_key=bucket_key)
            
            # Decidir estrategia de upload según tamaño
            if file_size <= self.chunk_size:
                # Upload simple para archivos pequeños
                return await self._simple_upload(bucket_key, file, object_name)
            else:
                # Upload multipart para archivos grandes
                return await self._multipart_upload(
                    bucket_key, file, object_name, file_size, progress_callback
                )
                
        except Exception as e:
            logger.error("Error en upload de archivo grande", error=str(e))
            raise
    
    async def _simple_upload(
        self,
        bucket_key: str,
        file: UploadFile,
        object_name: str
    ) -> Dict[str, any]:
        """Upload simple para archivos pequeños"""
        try:
            token = await self.auth_service.get_application_token()
            
            # Leer contenido del archivo
            await file.seek(0)
            file_content = await file.read()
            
            # Headers para upload
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(file_content))
            }
            
            # URL de upload
            url = f"{self.base_url}/oss/v2/buckets/{bucket_key}/objects/{object_name}"
            
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.put(url, headers=headers, content=file_content)
                
                if response.status_code in [200, 201]:
                    result = response.json()
                    
                    # Generar URN
                    object_id = result.get('objectId') or result.get('objectKey')
                    urn = base64.b64encode(object_id.encode()).decode()
                    
                    logger.info("Upload simple completado",
                               object_name=object_name,
                               object_id=object_id,
                               urn=urn)
                    
                    return {
                        'object_id': object_id,
                        'object_key': object_name,
                        'bucket_key': bucket_key,
                        'urn': urn,
                        'size': len(file_content),
                        'sha1': result.get('sha1'),
                        'location': result.get('location'),
                        'upload_type': 'simple'
                    }
                else:
                    logger.error("Error en upload simple",
                               status_code=response.status_code,
                               response=response.text)
                    raise Exception(f"Upload falló: {response.status_code} - {response.text}")
                    
        except Exception as e:
            logger.error("Error en upload simple", error=str(e))
            raise
    
    async def _multipart_upload(
        self,
        bucket_key: str,
        file: UploadFile,
        object_name: str,
        file_size: int,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, any]:
        """Upload multipart para archivos grandes"""
        try:
            # 1. Iniciar upload multipart
            upload_key = await self._initiate_multipart_upload(bucket_key, object_name)
            
            # 2. Calcular número de partes
            num_parts = (file_size + self.chunk_size - 1) // self.chunk_size
            
            logger.info("Upload multipart iniciado",
                       upload_key=upload_key,
                       total_parts=num_parts,
                       chunk_size_mb=self.chunk_size / (1024*1024))
            
            # 3. Upload de partes
            parts = []
            uploaded_bytes = 0
            
            await file.seek(0)
            
            for part_number in range(1, num_parts + 1):
                # Leer chunk
                chunk = await file.read(self.chunk_size)
                if not chunk:
                    break
                
                # Upload de parte con reintento
                part_etag = await self._upload_part_with_retry(
                    upload_key, part_number, chunk
                )
                
                parts.append({
                    'PartNumber': part_number,
                    'ETag': part_etag
                })
                
                uploaded_bytes += len(chunk)
                
                # Reportar progreso
                if progress_callback:
                    progress = (uploaded_bytes / file_size) * 100
                    await progress_callback(progress, part_number, num_parts)
                
                logger.debug("Parte subida",
                           part_number=part_number,
                           part_size=len(chunk),
                           progress=f"{uploaded_bytes/file_size*100:.1f}%")
            
            # 4. Completar upload multipart
            result = await self._complete_multipart_upload(upload_key, parts)
            
            # 5. Generar URN
            object_id = result.get('objectId') or result.get('objectKey')
            urn = base64.b64encode(object_id.encode()).decode()
            
            logger.info("Upload multipart completado",
                       object_name=object_name,
                       total_parts=len(parts),
                       total_size_mb=round(file_size / (1024*1024), 2),
                       urn=urn)
            
            return {
                'object_id': object_id,
                'object_key': object_name,
                'bucket_key': bucket_key,
                'urn': urn,
                'size': file_size,
                'sha1': result.get('sha1'),
                'location': result.get('location'),
                'upload_type': 'multipart',
                'parts_count': len(parts)
            }
            
        except Exception as e:
            logger.error("Error en upload multipart", error=str(e))
            # Intentar abortar upload en caso de error
            try:
                await self._abort_multipart_upload(upload_key)
            except Exception:
                pass
            raise
    
    async def _initiate_multipart_upload(
        self,
        bucket_key: str,
        object_name: str
    ) -> str:
        """Iniciar upload multipart"""
        try:
            token = await self.auth_service.get_application_token()
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            url = f"{self.base_url}/oss/v2/buckets/{bucket_key}/objects/{object_name}/resumable"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers)
                
                if response.status_code in [200, 201]:
                    result = response.json()
                    upload_key = result.get('uploadKey')
                    
                    if not upload_key:
                        raise Exception("No se recibió uploadKey en la respuesta")
                    
                    return upload_key
                else:
                    logger.error("Error al iniciar upload multipart",
                               status_code=response.status_code,
                               response=response.text)
                    raise Exception(f"No se pudo iniciar upload multipart: {response.status_code}")
                    
        except Exception as e:
            logger.error("Error al iniciar upload multipart", error=str(e))
            raise
    
    async def _upload_part_with_retry(
        self,
        upload_key: str,
        part_number: int,
        chunk: bytes,
        max_retries: int = None
    ) -> str:
        """Upload de parte individual con reintentos"""
        if max_retries is None:
            max_retries = self.max_retries
        
        for attempt in range(max_retries + 1):
            try:
                return await self._upload_part(upload_key, part_number, chunk)
            except Exception as e:
                if attempt == max_retries:
                    logger.error("Máximo de reintentos alcanzado para parte",
                               part_number=part_number,
                               attempts=attempt + 1,
                               error=str(e))
                    raise
                
                # Esperar antes de reintentar (backoff exponencial)
                wait_time = (2 ** attempt) * 1
                logger.warning("Reintentando upload de parte",
                             part_number=part_number,
                             attempt=attempt + 1,
                             wait_time=wait_time,
                             error=str(e))
                await asyncio.sleep(wait_time)
    
    async def _upload_part(
        self,
        upload_key: str,
        part_number: int,
        chunk: bytes
    ) -> str:
        """Upload de parte individual"""
        try:
            token = await self.auth_service.get_application_token()
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(chunk))
            }
            
            url = f"{self.base_url}/oss/v2/buckets/resumable/upload"
            params = {
                "uploadKey": upload_key,
                "partNumber": part_number
            }
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.put(
                    url, headers=headers, params=params, content=chunk
                )
                
                if response.status_code in [200, 201]:
                    # Obtener ETag del header
                    etag = response.headers.get('ETag', '').strip('"')
                    if not etag:
                        # Si no hay ETag, usar hash del contenido
                        etag = hashlib.md5(chunk).hexdigest()
                    
                    return etag
                else:
                    logger.error("Error en upload de parte",
                               part_number=part_number,
                               status_code=response.status_code,
                               response=response.text)
                    raise Exception(f"Upload de parte {part_number} falló: {response.status_code}")
                    
        except Exception as e:
            logger.error("Error en upload de parte",
                       part_number=part_number,
                       error=str(e))
            raise
    
    async def _complete_multipart_upload(
        self,
        upload_key: str,
        parts: List[Dict]
    ) -> Dict[str, any]:
        """Completar upload multipart"""
        try:
            token = await self.auth_service.get_application_token()
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "uploadKey": upload_key,
                "parts": parts
            }
            
            url = f"{self.base_url}/oss/v2/buckets/resumable/complete"
            
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code in [200, 201]:
                    return response.json()
                else:
                    logger.error("Error al completar upload multipart",
                               status_code=response.status_code,
                               response=response.text)
                    raise Exception(f"No se pudo completar upload: {response.status_code}")
                    
        except Exception as e:
            logger.error("Error al completar upload multipart", error=str(e))
            raise
    
    async def _abort_multipart_upload(self, upload_key: str):
        """Abortar upload multipart"""
        try:
            token = await self.auth_service.get_application_token()
            
            headers = {
                "Authorization": f"Bearer {token}"
            }
            
            url = f"{self.base_url}/oss/v2/buckets/resumable/abort"
            params = {"uploadKey": upload_key}
            
            async with httpx.AsyncClient() as client:
                response = await client.delete(url, headers=headers, params=params)
                
                if response.status_code in [200, 204]:
                    logger.info("Upload multipart abortado", upload_key=upload_key)
                else:
                    logger.warning("No se pudo abortar upload multipart",
                                 upload_key=upload_key,
                                 status_code=response.status_code)
                    
        except Exception as e:
            logger.error("Error al abortar upload multipart", error=str(e))
    
    async def get_object_details(
        self,
        bucket_key: str,
        object_key: str
    ) -> Dict[str, any]:
        """Obtener detalles de objeto"""
        try:
            token = await self.auth_service.get_application_token()
            
            headers = {
                "Authorization": f"Bearer {token}"
            }
            
            url = f"{self.base_url}/oss/v2/buckets/{bucket_key}/objects/{object_key}/details"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error("Error al obtener detalles de objeto",
                               status_code=response.status_code)
                    raise Exception(f"No se pudieron obtener detalles: {response.status_code}")
                    
        except Exception as e:
            logger.error("Error al obtener detalles de objeto", error=str(e))
            raise
    
    async def generate_signed_url(
        self,
        bucket_key: str,
        object_key: str,
        access: str = "read",
        expires_in: int = 3600
    ) -> Dict[str, any]:
        """Generar URL firmada para descarga"""
        try:
            token = await self.auth_service.get_application_token()
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "ossbucketKey": bucket_key,
                "ossSourceFileObjectKey": object_key,
                "access": access,
                "minutesExpiration": expires_in // 60
            }
            
            url = f"{self.base_url}/oss/v2/signedresources"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload)
                
                if response.status_code in [200, 201]:
                    result = response.json()
                    
                    logger.info("URL firmada generada",
                               object_key=object_key,
                               access=access,
                               expires_in=expires_in)
                    
                    return {
                        'signed_url': result.get('signedUrl'),
                        'expires_in': expires_in,
                        'access': access,
                        'object_key': object_key,
                        'bucket_key': bucket_key
                    }
                else:
                    logger.error("Error al generar URL firmada",
                               status_code=response.status_code,
                               response=response.text)
                    raise Exception(f"No se pudo generar URL firmada: {response.status_code}")
                    
        except Exception as e:
            logger.error("Error al generar URL firmada", error=str(e))
            raise
    
    async def delete_object(
        self,
        bucket_key: str,
        object_key: str
    ) -> bool:
        """Eliminar objeto del bucket"""
        try:
            token = await self.auth_service.get_application_token()
            
            headers = {
                "Authorization": f"Bearer {token}"
            }
            
            url = f"{self.base_url}/oss/v2/buckets/{bucket_key}/objects/{object_key}"
            
            async with httpx.AsyncClient() as client:
                response = await client.delete(url, headers=headers)
                
                if response.status_code in [200, 204]:
                    logger.info("Objeto eliminado",
                               bucket_key=bucket_key,
                               object_key=object_key)
                    return True
                else:
                    logger.error("Error al eliminar objeto",
                               status_code=response.status_code,
                               response=response.text)
                    return False
                    
        except Exception as e:
            logger.error("Error al eliminar objeto", error=str(e))
            return False
    
    async def copy_object(
        self,
        source_bucket: str,
        source_object: str,
        target_bucket: str,
        target_object: str
    ) -> Dict[str, any]:
        """Copiar objeto entre buckets"""
        try:
            token = await self.auth_service.get_application_token()
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "sourceKey": source_object,
                "targetKey": target_object
            }
            
            url = f"{self.base_url}/oss/v2/buckets/{source_bucket}/objects/copy"
            
            async with httpx.AsyncClient() as client:
                response = await client.put(url, headers=headers, json=payload)
                
                if response.status_code in [200, 201]:
                    result = response.json()
                    
                    logger.info("Objeto copiado",
                               source=f"{source_bucket}/{source_object}",
                               target=f"{target_bucket}/{target_object}")
                    
                    return result
                else:
                    logger.error("Error al copiar objeto",
                               status_code=response.status_code,
                               response=response.text)
                    raise Exception(f"No se pudo copiar objeto: {response.status_code}")
                    
        except Exception as e:
            logger.error("Error al copiar objeto", error=str(e))
            raise
    
    async def get_bucket_objects(
        self,
        bucket_key: str,
        prefix: Optional[str] = None,
        limit: int = 100,
        start_at: Optional[str] = None
    ) -> Dict[str, any]:
        """Listar objetos en bucket"""
        try:
            token = await self.auth_service.get_application_token()
            
            headers = {
                "Authorization": f"Bearer {token}"
            }
            
            params = {"limit": limit}
            if prefix:
                params["prefix"] = prefix
            if start_at:
                params["startAt"] = start_at
            
            url = f"{self.base_url}/oss/v2/buckets/{bucket_key}/objects"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, params=params)
                
                if response.status_code == 200:
                    result = response.json()
                    
                    return {
                        'objects': result.get('items', []),
                        'next': result.get('next'),
                        'total': len(result.get('items', []))
                    }
                else:
                    logger.error("Error al listar objetos",
                               status_code=response.status_code,
                               response=response.text)
                    raise Exception(f"No se pudieron listar objetos: {response.status_code}")
                    
        except Exception as e:
            logger.error("Error al listar objetos", error=str(e))
            raise
