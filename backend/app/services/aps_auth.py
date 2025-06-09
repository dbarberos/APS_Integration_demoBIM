"""
Servicio de autenticación APS OAuth 2.0
"""
import httpx
import base64
from typing import Dict, Optional, List
from datetime import datetime, timedelta
import structlog
from urllib.parse import urlencode

from app.core.config import settings
from app.schemas.auth import APSTokenResponse, APSUserInfo

logger = structlog.get_logger()


class APSAuthService:
    """Servicio para autenticación OAuth 2.0 con APS"""
    
    def __init__(self):
        self.base_url = settings.APS_BASE_URL
        self.client_id = settings.APS_CLIENT_ID
        self.client_secret = settings.APS_CLIENT_SECRET
        self.callback_url = settings.APS_CALLBACK_URL
        
        # Cache de tokens 2-legged
        self._app_token: Optional[str] = None
        self._app_token_expires_at: Optional[datetime] = None
    
    async def get_app_token(self, scopes: Optional[List[str]] = None) -> APSTokenResponse:
        """
        Obtener token de aplicación (2-legged OAuth)
        Para operaciones que no requieren usuario específico
        """
        if scopes is None:
            scopes = ["bucket:create", "bucket:read", "data:read", "data:write"]
        
        # Verificar si tenemos token válido en cache
        if (self._app_token and self._app_token_expires_at and 
            self._app_token_expires_at > datetime.utcnow() + timedelta(minutes=5)):
            logger.debug("Usando token de aplicación desde cache")
            return APSTokenResponse(
                access_token=self._app_token,
                token_type="Bearer",
                expires_in=int((self._app_token_expires_at - datetime.utcnow()).total_seconds())
            )
        
        url = f"{self.base_url}/authentication/v1/authenticate"
        
        # Preparar credenciales Basic Auth
        credentials = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()
        
        headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "client_credentials",
            "scope": " ".join(scopes)
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, data=data)
                response.raise_for_status()
                
                token_data = response.json()
                
                # Cachear token
                self._app_token = token_data["access_token"]
                self._app_token_expires_at = datetime.utcnow() + timedelta(
                    seconds=token_data.get("expires_in", 3600)
                )
                
                logger.info("Token de aplicación APS obtenido exitosamente", 
                          expires_in=token_data.get("expires_in"))
                
                return APSTokenResponse(**token_data)
                
        except httpx.HTTPStatusError as e:
            logger.error("Error al obtener token de aplicación APS", 
                        status_code=e.response.status_code,
                        response=e.response.text)
            raise
        except Exception as e:
            logger.error("Error inesperado al obtener token APS", error=str(e))
            raise
    
    def get_authorization_url(self, state: Optional[str] = None) -> str:
        """
        Generar URL de autorización para flujo 3-legged OAuth
        Para operaciones que requieren autorización específica del usuario
        """
        scopes = [
            "user-profile:read",
            "user:read",
            "data:read",
            "data:write",
            "data:create",
            "data:search",
            "bucket:create",
            "bucket:read",
            "bucket:update",
            "bucket:delete"
        ]
        
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.callback_url,
            "scope": " ".join(scopes)
        }
        
        if state:
            params["state"] = state
        
        auth_url = f"{self.base_url}/authentication/v1/authorize?" + urlencode(params)
        
        logger.info("URL de autorización APS generada", state=state)
        return auth_url
    
    async def exchange_code_for_token(self, code: str) -> APSTokenResponse:
        """
        Intercambiar código de autorización por tokens (3-legged OAuth)
        """
        url = f"{self.base_url}/authentication/v1/gettoken"
        
        # Preparar credenciales Basic Auth
        credentials = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()
        
        headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.callback_url
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, data=data)
                response.raise_for_status()
                
                token_data = response.json()
                
                logger.info("Tokens de usuario APS obtenidos exitosamente",
                          expires_in=token_data.get("expires_in"))
                
                return APSTokenResponse(**token_data)
                
        except httpx.HTTPStatusError as e:
            logger.error("Error al intercambiar código por token APS",
                        status_code=e.response.status_code,
                        response=e.response.text)
            raise
        except Exception as e:
            logger.error("Error inesperado al intercambiar código APS", error=str(e))
            raise
    
    async def refresh_user_token(self, refresh_token: str) -> APSTokenResponse:
        """
        Refrescar token de usuario usando refresh token
        """
        url = f"{self.base_url}/authentication/v1/refreshtoken"
        
        # Preparar credenciales Basic Auth
        credentials = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode()
        ).decode()
        
        headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, data=data)
                response.raise_for_status()
                
                token_data = response.json()
                
                logger.info("Token de usuario APS refrescado exitosamente")
                
                return APSTokenResponse(**token_data)
                
        except httpx.HTTPStatusError as e:
            logger.error("Error al refrescar token APS",
                        status_code=e.response.status_code,
                        response=e.response.text)
            raise
        except Exception as e:
            logger.error("Error inesperado al refrescar token APS", error=str(e))
            raise
    
    async def get_user_info(self, access_token: str) -> APSUserInfo:
        """
        Obtener información del usuario usando access token
        """
        url = f"{self.base_url}/userprofile/v1/users/@me"
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                
                user_data = response.json()
                
                logger.info("Información de usuario APS obtenida")
                
                return APSUserInfo(
                    user_id=user_data.get("userId"),
                    user_name=user_data.get("userName"),
                    email_id=user_data.get("emailId"),
                    first_name=user_data.get("firstName"),
                    last_name=user_data.get("lastName"),
                    profile_images=user_data.get("profileImages", {})
                )
                
        except httpx.HTTPStatusError as e:
            logger.error("Error al obtener información de usuario APS",
                        status_code=e.response.status_code,
                        response=e.response.text)
            raise
        except Exception as e:
            logger.error("Error inesperado al obtener info de usuario APS", error=str(e))
            raise
    
    async def validate_token(self, access_token: str) -> bool:
        """
        Validar si un token de acceso sigue siendo válido
        """
        try:
            await self.get_user_info(access_token)
            return True
        except Exception:
            return False
    
    def invalidate_app_token(self):
        """
        Invalidar token de aplicación en cache
        """
        self._app_token = None
        self._app_token_expires_at = None
        logger.info("Token de aplicación APS invalidado del cache")
