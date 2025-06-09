"""
Tests para endpoints de autenticación
"""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

from app.schemas.auth import LoginRequest, TokenResponse


@pytest.mark.api
@pytest.mark.auth
class TestAuthEndpoints:
    """Tests para endpoints de autenticación"""
    
    async def test_login_success(self, client: AsyncClient, mock_aps_auth_service):
        """Test login exitoso"""
        # Mock response del servicio APS
        mock_aps_auth_service.authenticate_user.return_value = {
            "access_token": "test-access-token",
            "refresh_token": "test-refresh-token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "user_info": {
                "user_id": "test-user-id",
                "email": "test@example.com",
                "name": "Test User"
            }
        }
        
        with patch('app.api.v1.endpoints.auth.aps_auth_service', mock_aps_auth_service):
            response = await client.post(
                "/api/v1/auth/login",
                json={
                    "username": "test@example.com",
                    "password": "testpassword"
                }
            )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "Bearer"
        assert "expires_in" in data
        assert "user" in data
    
    async def test_login_invalid_credentials(self, client: AsyncClient, mock_aps_auth_service):
        """Test login con credenciales inválidas"""
        mock_aps_auth_service.authenticate_user.side_effect = Exception("Invalid credentials")
        
        with patch('app.api.v1.endpoints.auth.aps_auth_service', mock_aps_auth_service):
            response = await client.post(
                "/api/v1/auth/login",
                json={
                    "username": "invalid@example.com",
                    "password": "wrongpassword"
                }
            )
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
    
    async def test_login_missing_fields(self, client: AsyncClient):
        """Test login con campos faltantes"""
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": "test@example.com"}  # Missing password
        )
        
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
    
    async def test_refresh_token_success(self, client: AsyncClient, mock_aps_auth_service):
        """Test refresh token exitoso"""
        mock_aps_auth_service.refresh_user_token.return_value = {
            "access_token": "new-access-token",
            "token_type": "Bearer",
            "expires_in": 3600
        }
        
        with patch('app.api.v1.endpoints.auth.aps_auth_service', mock_aps_auth_service):
            response = await client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": "valid-refresh-token"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "Bearer"
    
    async def test_refresh_token_invalid(self, client: AsyncClient, mock_aps_auth_service):
        """Test refresh token inválido"""
        mock_aps_auth_service.refresh_user_token.side_effect = Exception("Invalid refresh token")
        
        with patch('app.api.v1.endpoints.auth.aps_auth_service', mock_aps_auth_service):
            response = await client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": "invalid-refresh-token"}
            )
        
        assert response.status_code == 401
    
    async def test_logout_success(self, client: AsyncClient, auth_headers):
        """Test logout exitoso"""
        response = await client.post(
            "/api/v1/auth/logout",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Successfully logged out"
    
    async def test_logout_no_auth(self, client: AsyncClient):
        """Test logout sin autenticación"""
        response = await client.post("/api/v1/auth/logout")
        
        assert response.status_code == 401
    
    async def test_user_profile_success(self, client: AsyncClient, auth_headers, test_user):
        """Test obtener perfil de usuario"""
        with patch('app.api.v1.endpoints.auth.get_current_user', return_value=test_user):
            response = await client.get(
                "/api/v1/auth/me",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        assert data["email"] == test_user.email
        assert data["username"] == test_user.username
    
    async def test_user_profile_unauthorized(self, client: AsyncClient):
        """Test obtener perfil sin autorización"""
        response = await client.get("/api/v1/auth/me")
        
        assert response.status_code == 401
    
    async def test_aps_callback_success(self, client: AsyncClient, mock_aps_auth_service):
        """Test callback de OAuth APS"""
        mock_aps_auth_service.handle_oauth_callback.return_value = {
            "access_token": "callback-access-token",
            "refresh_token": "callback-refresh-token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "user_info": {
                "user_id": "callback-user-id",
                "email": "callback@example.com",
                "name": "Callback User"
            }
        }
        
        with patch('app.api.v1.endpoints.auth.aps_auth_service', mock_aps_auth_service):
            response = await client.get(
                "/api/v1/auth/callback",
                params={
                    "code": "auth-code",
                    "state": "auth-state"
                }
            )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
    
    async def test_aps_callback_error(self, client: AsyncClient, mock_aps_auth_service):
        """Test callback de OAuth con error"""
        response = await client.get(
            "/api/v1/auth/callback",
            params={"error": "access_denied", "error_description": "User denied access"}
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data["detail"]
    
    async def test_change_password_success(self, client: AsyncClient, auth_headers, test_user):
        """Test cambio de contraseña exitoso"""
        with patch('app.api.v1.endpoints.auth.get_current_user', return_value=test_user), \
             patch('app.services.user_service.verify_password', return_value=True), \
             patch('app.services.user_service.update_password') as mock_update:
            
            mock_update.return_value = test_user
            
            response = await client.post(
                "/api/v1/auth/change-password",
                headers=auth_headers,
                json={
                    "current_password": "current-password",
                    "new_password": "new-password"
                }
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Password updated successfully"
    
    async def test_change_password_wrong_current(self, client: AsyncClient, auth_headers, test_user):
        """Test cambio de contraseña con contraseña actual incorrecta"""
        with patch('app.api.v1.endpoints.auth.get_current_user', return_value=test_user), \
             patch('app.services.user_service.verify_password', return_value=False):
            
            response = await client.post(
                "/api/v1/auth/change-password",
                headers=auth_headers,
                json={
                    "current_password": "wrong-password",
                    "new_password": "new-password"
                }
            )
        
        assert response.status_code == 400
        data = response.json()
        assert "current password" in data["detail"].lower()
    
    @pytest.mark.performance
    async def test_login_performance(self, client: AsyncClient, mock_aps_auth_service, performance_timer):
        """Test performance del login"""
        mock_aps_auth_service.authenticate_user.return_value = {
            "access_token": "test-token",
            "refresh_token": "test-refresh",
            "token_type": "Bearer",
            "expires_in": 3600,
            "user_info": {"user_id": "test", "email": "test@example.com", "name": "Test"}
        }
        
        with patch('app.api.v1.endpoints.auth.aps_auth_service', mock_aps_auth_service):
            performance_timer.start()
            
            response = await client.post(
                "/api/v1/auth/login",
                json={"username": "test@example.com", "password": "password"}
            )
            
            performance_timer.stop()
        
        assert response.status_code == 200
        assert performance_timer.elapsed < 1.0  # Should complete within 1 second
    
    @pytest.mark.slow
    async def test_concurrent_logins(self, client: AsyncClient, mock_aps_auth_service):
        """Test logins concurrentes"""
        import asyncio
        
        mock_aps_auth_service.authenticate_user.return_value = {
            "access_token": "test-token",
            "refresh_token": "test-refresh",
            "token_type": "Bearer",
            "expires_in": 3600,
            "user_info": {"user_id": "test", "email": "test@example.com", "name": "Test"}
        }
        
        async def login_task(user_id):
            with patch('app.api.v1.endpoints.auth.aps_auth_service', mock_aps_auth_service):
                response = await client.post(
                    "/api/v1/auth/login",
                    json={"username": f"user{user_id}@example.com", "password": "password"}
                )
            return response.status_code
        
        # Execute 10 concurrent logins
        tasks = [login_task(i) for i in range(10)]
        results = await asyncio.gather(*tasks)
        
        # All should succeed
        assert all(status == 200 for status in results)
    
    async def test_auth_headers_validation(self, client: AsyncClient):
        """Test validación de headers de autenticación"""
        # No Authorization header
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401
        
        # Invalid Authorization header format
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "InvalidFormat"}
        )
        assert response.status_code == 401
        
        # Missing Bearer prefix
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "token-without-bearer"}
        )
        assert response.status_code == 401
    
    async def test_token_expiration_handling(self, client: AsyncClient, mock_aps_auth_service):
        """Test manejo de tokens expirados"""
        # Mock expired token
        mock_aps_auth_service.verify_token.side_effect = Exception("Token expired")
        
        with patch('app.api.v1.endpoints.auth.aps_auth_service', mock_aps_auth_service):
            response = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer expired-token"}
            )
        
        assert response.status_code == 401
        data = response.json()
        assert "expired" in data["detail"].lower() or "invalid" in data["detail"].lower()
    
    @pytest.mark.parametrize("invalid_email", [
        "not-an-email",
        "missing@domain",
        "@missing-local.com",
        "spaces in@email.com",
        ""
    ])
    async def test_login_email_validation(self, client: AsyncClient, invalid_email):
        """Test validación de formato de email en login"""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "username": invalid_email,
                "password": "password123"
            }
        )
        
        assert response.status_code == 422
    
    @pytest.mark.parametrize("weak_password", [
        "",           # Empty
        "123",        # Too short
        "password",   # No numbers/special chars
        "12345678",   # Only numbers
    ])
    async def test_change_password_validation(self, client: AsyncClient, auth_headers, test_user, weak_password):
        """Test validación de contraseñas débiles"""
        with patch('app.api.v1.endpoints.auth.get_current_user', return_value=test_user), \
             patch('app.services.user_service.verify_password', return_value=True):
            
            response = await client.post(
                "/api/v1/auth/change-password",
                headers=auth_headers,
                json={
                    "current_password": "current-password",
                    "new_password": weak_password
                }
            )
        
        assert response.status_code == 422
