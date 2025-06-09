"""
Servicio para integración con Autodesk Platform Services (APS)
"""
import httpx
import base64
from typing import List, Dict, Any, Optional
import structlog

from app.core.config import settings
from app.schemas.aps import (
    BucketResponse,
    FileUploadResponse,
    ModelTranslationResponse,
    TranslationProgress,
    ViewerToken
)

logger = structlog.get_logger()


class APSService:
    """Servicio principal para interactuar con APS/Forge API"""
    
    def __init__(self):
        self.base_url = settings.APS_BASE_URL
        self.client_id = settings.APS_CLIENT_ID
        self.client_secret = settings.APS_CLIENT_SECRET
        self._access_token: Optional[str] = None
        
    async def _get_access_token(self) -> str:
        """Obtener token de acceso de APS"""
        if self._access_token:
            return self._access_token
            
        url = f"{self.base_url}/authentication/v1/authenticate"
        
        # Preparar credenciales
        credentials = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()
        
        headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "client_credentials",
            "scope": " ".join(settings.APS_SCOPES)
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, data=data)
            response.raise_for_status()
            
            token_data = response.json()
            self._access_token = token_data["access_token"]
            
            logger.info("Token de APS obtenido exitosamente")
            return self._access_token
    
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict] = None,
        files: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Realizar petición autenticada a APS API"""
        token = await self._get_access_token()
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        if files:
            # Para uploads, no establecer Content-Type
            headers.pop("Content-Type", None)
        
        url = f"{self.base_url}{endpoint}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            if method.upper() == "GET":
                response = await client.get(url, headers=headers, params=data)
            elif method.upper() == "POST":
                if files:
                    response = await client.post(url, headers=headers, files=files, data=data)
                else:
                    response = await client.post(url, headers=headers, json=data)
            elif method.upper() == "PUT":
                response = await client.put(url, headers=headers, json=data)
            elif method.upper() == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise ValueError(f"Método HTTP no soportado: {method}")
            
            response.raise_for_status()
            return response.json()
    
    async def list_buckets(self) -> List[BucketResponse]:
        """Listar buckets del usuario"""
        try:
            response = await self._make_request("GET", "/oss/v2/buckets")
            
            buckets = []
            for bucket_data in response.get("items", []):
                bucket = BucketResponse(
                    bucket_key=bucket_data["bucketKey"],
                    bucket_owner=bucket_data["bucketOwner"],
                    created_date=bucket_data["createdDate"],
                    policy=bucket_data["policyKey"],
                    permissions=bucket_data.get("permissions", [])
                )
                buckets.append(bucket)
            
            return buckets
            
        except Exception as e:
            logger.error("Error al listar buckets", error=str(e))
            raise
    
    async def create_bucket(self, bucket_key: str, policy: str) -> BucketResponse:
        """Crear nuevo bucket"""
        try:
            data = {
                "bucketKey": bucket_key,
                "policyKey": policy
            }
            
            response = await self._make_request("POST", "/oss/v2/buckets", data=data)
            
            return BucketResponse(
                bucket_key=response["bucketKey"],
                bucket_owner=response["bucketOwner"],
                created_date=response["createdDate"],
                policy=response["policyKey"],
                permissions=response.get("permissions", [])
            )
            
        except Exception as e:
            logger.error("Error al crear bucket", bucket_key=bucket_key, error=str(e))
            raise
    
    async def upload_file(self, bucket_key: str, file_name: str) -> FileUploadResponse:
        """Subir archivo a bucket"""
        try:
            # TODO: Implementar lógica real de upload
            # Por ahora, respuesta simulada
            response = {
                "bucketKey": bucket_key,
                "objectId": f"urn:adsk.objects:os.object:{bucket_key}/{file_name}",
                "objectKey": file_name,
                "sha1": "dummy_sha1",
                "size": 1024000,
                "contentType": "application/octet-stream",
                "location": f"https://developer.api.autodesk.com/oss/v2/buckets/{bucket_key}/objects/{file_name}"
            }
            
            return FileUploadResponse(**response)
            
        except Exception as e:
            logger.error("Error al subir archivo", bucket=bucket_key, file=file_name, error=str(e))
            raise
    
    async def translate_model(self, urn: str) -> ModelTranslationResponse:
        """Iniciar traducción de modelo"""
        try:
            # Codificar URN en base64 si no está codificado
            if not urn.startswith("dXJuOmFkc2"):
                encoded_urn = base64.urlsafe_b64encode(urn.encode()).decode()
            else:
                encoded_urn = urn
            
            data = {
                "input": {
                    "urn": encoded_urn
                },
                "output": {
                    "formats": [
                        {
                            "type": "svf2",
                            "views": ["2d", "3d"]
                        }
                    ]
                }
            }
            
            response = await self._make_request(
                "POST", 
                "/modelderivative/v2/designdata/job", 
                data=data
            )
            
            return ModelTranslationResponse(**response)
            
        except Exception as e:
            logger.error("Error al iniciar traducción", urn=urn[:20], error=str(e))
            raise
    
    async def get_translation_status(self, urn: str) -> TranslationProgress:
        """Obtener estado de traducción"""
        try:
            # Codificar URN si es necesario
            if not urn.startswith("dXJuOmFkc2"):
                encoded_urn = base64.urlsafe_b64encode(urn.encode()).decode()
            else:
                encoded_urn = urn
            
            response = await self._make_request(
                "GET", 
                f"/modelderivative/v2/designdata/{encoded_urn}/manifest"
            )
            
            return TranslationProgress(**response)
            
        except Exception as e:
            logger.error("Error al obtener estado de traducción", urn=urn[:20], error=str(e))
            raise
    
    async def get_model_metadata(self, urn: str) -> Dict[str, Any]:
        """Obtener metadatos de modelo"""
        try:
            # Codificar URN si es necesario
            if not urn.startswith("dXJuOmFkc2"):
                encoded_urn = base64.urlsafe_b64encode(urn.encode()).decode()
            else:
                encoded_urn = urn
            
            response = await self._make_request(
                "GET", 
                f"/modelderivative/v2/designdata/{encoded_urn}/metadata"
            )
            
            return response
            
        except Exception as e:
            logger.error("Error al obtener metadatos", urn=urn[:20], error=str(e))
            raise
    
    async def get_viewer_token(self) -> ViewerToken:
        """Obtener token para el viewer"""
        try:
            # Para el viewer, necesitamos un token con scopes específicos
            token = await self._get_access_token()
            
            return ViewerToken(
                access_token=token,
                token_type="Bearer",
                expires_in=3600  # 1 hora
            )
            
        except Exception as e:
            logger.error("Error al obtener token del viewer", error=str(e))
            raise