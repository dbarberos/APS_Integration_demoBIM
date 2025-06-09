"""
Pruebas unitarias para servicio de autenticación APS
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta

from app.services.aps_auth import APSAuthService
from app.schemas.auth import APSTokenResponse, APSUserInfo


class TestAPSAuthService:
    """Pruebas para el servicio de autenticación APS"""
    
    @pytest.fixture
    def aps_auth_service(self):
        """Fixture para crear instancia del servicio"""
        return APSAuthService()
    
    @pytest.mark.asyncio
    async def test_get_app_token_success(self, aps_auth_service):
        """Probar obtención exitosa de token de aplicación"""
        # Mock response
        mock_response_data = {
            "access_token": "test_access_token",
            "token_type": "Bearer",
            "expires_in": 3600
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = Mock()
            mock_response.json.return_value = mock_response_data
            mock_response.raise_for_status.return_value = None
            
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            
            # Ejecutar
            result = await aps_auth_service.get_app_token()
            
            # Verificar
            assert isinstance(result, APSTokenResponse)
            assert result.access_token == "test_access_token"
            assert result.token_type == "Bearer"
            assert result.expires_in == 3600
    
    @pytest.mark.asyncio
    async def test_get_app_token_cached(self, aps_auth_service):
        """Probar que el token se usa desde cache cuando es válido"""
        # Configurar cache
        aps_auth_service._app_token = "cached_token"
        aps_auth_service._app_token_expires_at = datetime.utcnow() + timedelta(hours=1)
        
        with patch('httpx.AsyncClient') as mock_client:
            # Ejecutar
            result = await aps_auth_service.get_app_token()
            
            # Verificar que no se hizo petición HTTP
            mock_client.assert_not_called()
            assert result.access_token == "cached_token"
    
    @pytest.mark.asyncio
    async def test_exchange_code_for_token_success(self, aps_auth_service):
        """Probar intercambio exitoso de código por token"""
        mock_response_data = {
            "access_token": "user_access_token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "refresh_token": "refresh_token"
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = Mock()
            mock_response.json.return_value = mock_response_data
            mock_response.raise_for_status.return_value = None
            
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                return_value=mock_response
            )
            
            # Ejecutar
            result = await aps_auth_service.exchange_code_for_token("test_code")
            
            # Verificar
            assert isinstance(result, APSTokenResponse)
            assert result.access_token == "user_access_token"
            assert result.refresh_token == "refresh_token"
    
    def test_get_authorization_url(self, aps_auth_service):
        """Probar generación de URL de autorización"""
        # Ejecutar
        url = aps_auth_service.get_authorization_url(state="test_state")
        
        # Verificar
        assert "response_type=code" in url
        assert "client_id=" in url
        assert "redirect_uri=" in url
        assert "scope=" in url
        assert "state=test_state" in url
    
    @pytest.mark.asyncio
    async def test_get_user_info_success(self, aps_auth_service):
        """Probar obtención exitosa de información de usuario"""
        mock_response_data = {
            "userId": "user123",
            "userName": "testuser",
            "emailId": "test@example.com",
            "firstName": "Test",
            "lastName": "User",
            "profileImages": {"sizeX20": "url"}
        }
        
        with patch('httpx.AsyncClient') as mock_client:
            mock_response = Mock()
            mock_response.json.return_value = mock_response_data
            mock_response.raise_for_status.return_value = None
            
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            # Ejecutar
            result = await aps_auth_service.get_user_info("test_token")
            
            # Verificar
            assert isinstance(result, APSUserInfo)
            assert result.user_id == "user123"
            assert result.email_id == "test@example.com"
    
    @pytest.mark.asyncio
    async def test_validate_token_success(self, aps_auth_service):
        """Probar validación exitosa de token"""
        with patch.object(aps_auth_service, 'get_user_info', new_callable=AsyncMock) as mock_get_user:
            mock_get_user.return_value = Mock()
            
            # Ejecutar
            result = await aps_auth_service.validate_token("valid_token")
            
            # Verificar
            assert result is True
            mock_get_user.assert_called_once_with("valid_token")
    
    @pytest.mark.asyncio
    async def test_validate_token_failure(self, aps_auth_service):
        """Probar validación fallida de token"""
        with patch.object(aps_auth_service, 'get_user_info', new_callable=AsyncMock) as mock_get_user:
            mock_get_user.side_effect = Exception("Invalid token")
            
            # Ejecutar
            result = await aps_auth_service.validate_token("invalid_token")
            
            # Verificar
            assert result is False
    
    def test_invalidate_app_token(self, aps_auth_service):
        """Probar invalidación de token de aplicación"""
        # Configurar token en cache
        aps_auth_service._app_token = "token"
        aps_auth_service._app_token_expires_at = datetime.utcnow()
        
        # Ejecutar
        aps_auth_service.invalidate_app_token()
        
        # Verificar
        assert aps_auth_service._app_token is None
        assert aps_auth_service._app_token_expires_at is None


@pytest.mark.asyncio
async def test_integration_aps_auth_flow():
    """Prueba de integración para flujo completo de autenticación APS"""
    service = APSAuthService()
    
    # Mock de respuestas HTTP exitosas
    mock_token_response = {
        "access_token": "integration_token",
        "token_type": "Bearer", 
        "expires_in": 3600
    }
    
    mock_user_response = {
        "userId": "integration_user",
        "userName": "testuser",
        "emailId": "integration@example.com",
        "firstName": "Integration",
        "lastName": "Test"
    }
    
    with patch('httpx.AsyncClient') as mock_client:
        mock_response_token = Mock()
        mock_response_token.json.return_value = mock_token_response
        mock_response_token.raise_for_status.return_value = None
        
        mock_response_user = Mock()
        mock_response_user.json.return_value = mock_user_response
        mock_response_user.raise_for_status.return_value = None
        
        # Configurar respuestas para diferentes endpoints
        async def mock_request(method, url, **kwargs):
            if "authenticate" in url:
                return mock_response_token
            elif "users/@me" in url:
                return mock_response_user
            else:
                return Mock()
        
        mock_client.return_value.__aenter__.return_value.post = mock_request
        mock_client.return_value.__aenter__.return_value.get = mock_request
        
        # Flujo completo
        # 1. Obtener token de aplicación
        app_token = await service.get_app_token()
        assert app_token.access_token == "integration_token"
        
        # 2. Obtener información de usuario (simulando token de usuario)
        user_info = await service.get_user_info("user_token")
        assert user_info.user_id == "integration_user"
