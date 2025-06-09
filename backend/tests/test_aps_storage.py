"""
Pruebas unitarias para servicio de almacenamiento APS
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
import io

from app.services.aps_storage import APSStorageService
from app.schemas.aps import BucketResponse, FileUploadResponse


class TestAPSStorageService:
    """Pruebas para el servicio de almacenamiento APS"""
    
    @pytest.fixture
    def aps_storage_service(self):
        """Fixture para crear instancia del servicio"""
        return APSStorageService()
    
    @pytest.mark.asyncio
    async def test_create_bucket_success(self, aps_storage_service):
        """Probar creación exitosa de bucket"""
        mock_response = {
            "bucketKey": "test-bucket",
            "bucketOwner": "test-owner",
            "createdDate": "2024-01-16T10:00:00Z",
            "policyKey": "temporary",
            "permissions": []
        }
        
        with patch.object(aps_storage_service, '_make_authenticated_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            # Ejecutar
            result = await aps_storage_service.create_bucket("test-bucket", "temporary")
            
            # Verificar
            assert isinstance(result, BucketResponse)
            assert result.bucket_key == "test-bucket"
            assert result.policy == "temporary"
            mock_request.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_list_buckets_success(self, aps_storage_service):
        """Probar listado exitoso de buckets"""
        mock_response = {
            "items": [
                {
                    "bucketKey": "bucket1",
                    "bucketOwner": "owner1",
                    "createdDate": "2024-01-16T10:00:00Z",
                    "policyKey": "temporary",
                    "permissions": []
                },
                {
                    "bucketKey": "bucket2",
                    "bucketOwner": "owner2", 
                    "createdDate": "2024-01-16T11:00:00Z",
                    "policyKey": "persistent",
                    "permissions": []
                }
            ]
        }
        
        with patch.object(aps_storage_service, '_make_authenticated_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            # Ejecutar
            result = await aps_storage_service.list_buckets()
            
            # Verificar
            assert len(result) == 2
            assert all(isinstance(bucket, BucketResponse) for bucket in result)
            assert result[0].bucket_key == "bucket1"
            assert result[1].bucket_key == "bucket2"
    
    @pytest.mark.asyncio
    async def test_upload_file_success(self, aps_storage_service):
        """Probar subida exitosa de archivo"""
        # Preparar archivo de prueba
        test_content = b"test file content"
        test_file = io.BytesIO(test_content)
        
        mock_response = {
            "objectId": "urn:adsk.objects:os.object:bucket/file.txt",
            "sha1": "test_sha1",
            "size": len(test_content),
            "contentType": "text/plain",
            "location": "https://api.autodesk.com/oss/v2/buckets/bucket/objects/file.txt"
        }
        
        with patch.object(aps_storage_service, '_make_authenticated_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            # Ejecutar
            result = await aps_storage_service.upload_file(
                bucket_key="test-bucket",
                object_name="test-file.txt",
                file_content=test_file,
                content_type="text/plain"
            )
            
            # Verificar
            assert isinstance(result, FileUploadResponse)
            assert result.bucket_key == "test-bucket"
            assert result.object_key == "test-file.txt"
            assert result.size == len(test_content)
            assert result.urn is not None  # URN codificado
    
    @pytest.mark.asyncio
    async def test_delete_object_success(self, aps_storage_service):
        """Probar eliminación exitosa de objeto"""
        with patch.object(aps_storage_service, '_make_authenticated_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {}
            
            # Ejecutar
            result = await aps_storage_service.delete_object("test-bucket", "test-file.txt")
            
            # Verificar
            assert result is True
            mock_request.assert_called_once_with(
                "DELETE",
                "/oss/v2/buckets/test-bucket/objects/test-file.txt",
                use_app_token=True,
                user_token=None
            )
    
    @pytest.mark.asyncio
    async def test_generate_signed_url_success(self, aps_storage_service):
        """Probar generación exitosa de URL firmada"""
        mock_response = {
            "signedUrl": "https://signed-url.example.com/file.txt?signature=abc123"
        }
        
        with patch.object(aps_storage_service, '_make_authenticated_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            # Ejecutar
            result = await aps_storage_service.generate_signed_url(
                bucket_key="test-bucket",
                object_name="test-file.txt",
                access="read",
                expires_in=3600
            )
            
            # Verificar
            assert result == "https://signed-url.example.com/file.txt?signature=abc123"
            mock_request.assert_called_once()
    
    def test_generate_bucket_key(self):
        """Probar generación de clave de bucket"""
        # Ejecutar
        bucket_key = APSStorageService.generate_bucket_key("My Project", 123)
        
        # Verificar
        assert bucket_key.startswith("my-project-123-")
        assert len(bucket_key) <= 128  # Límite de APS
        assert bucket_key.replace("-", "").replace("my", "").replace("project", "").replace("123", "").isalnum()
    
    def test_generate_bucket_key_special_chars(self):
        """Probar generación de bucket key con caracteres especiales"""
        # Ejecutar
        bucket_key = APSStorageService.generate_bucket_key("My Project!@#$%", 456)
        
        # Verificar
        assert "my-project-456-" in bucket_key
        assert not any(char in bucket_key for char in "!@#$%")
    
    def test_generate_bucket_key_long_name(self):
        """Probar generación de bucket key con nombre largo"""
        long_name = "A" * 100
        
        # Ejecutar
        bucket_key = APSStorageService.generate_bucket_key(long_name, 789)
        
        # Verificar
        assert len(bucket_key) <= 128
        assert "789" in bucket_key


@pytest.mark.asyncio
async def test_integration_storage_workflow():
    """Prueba de integración para flujo completo de almacenamiento"""
    service = APSStorageService()
    
    # Mock de todas las respuestas
    create_bucket_response = {
        "bucketKey": "integration-bucket",
        "bucketOwner": "test-owner",
        "createdDate": "2024-01-16T10:00:00Z",
        "policyKey": "temporary",
        "permissions": []
    }
    
    upload_response = {
        "objectId": "urn:adsk.objects:os.object:integration-bucket/test.txt",
        "sha1": "abc123",
        "size": 100,
        "contentType": "text/plain",
        "location": "https://api.example.com/object"
    }
    
    with patch.object(service, '_make_authenticated_request', new_callable=AsyncMock) as mock_request:
        # Configurar respuestas secuenciales
        mock_request.side_effect = [create_bucket_response, upload_response, {}]
        
        # Flujo completo
        # 1. Crear bucket
        bucket = await service.create_bucket("integration-bucket")
        assert bucket.bucket_key == "integration-bucket"
        
        # 2. Subir archivo
        test_file = io.BytesIO(b"test content")
        upload_result = await service.upload_file(
            bucket_key="integration-bucket",
            object_name="test.txt",
            file_content=test_file
        )
        assert upload_result.bucket_key == "integration-bucket"
        
        # 3. Eliminar objeto
        delete_result = await service.delete_object("integration-bucket", "test.txt")
        assert delete_result is True
        
        # Verificar que se hicieron todas las llamadas
        assert mock_request.call_count == 3


class TestAPSStorageServiceErrorHandling:
    """Pruebas de manejo de errores para el servicio de almacenamiento"""
    
    @pytest.fixture
    def aps_storage_service(self):
        return APSStorageService()
    
    @pytest.mark.asyncio
    async def test_create_bucket_conflict_409(self, aps_storage_service):
        """Probar manejo de bucket existente (409 Conflict)"""
        # Mock de error HTTP 409
        import httpx
        
        mock_response = Mock()
        mock_response.status_code = 409
        mock_response.text = "Bucket already exists"
        
        get_bucket_response = {
            "bucketKey": "existing-bucket",
            "bucketOwner": "owner",
            "createdDate": "2024-01-16T10:00:00Z",
            "policyKey": "temporary"
        }
        
        with patch.object(aps_storage_service, '_make_authenticated_request', new_callable=AsyncMock) as mock_request:
            # Primera llamada falla con 409, segunda exitosa
            mock_request.side_effect = [
                httpx.HTTPStatusError("Conflict", request=Mock(), response=mock_response),
                get_bucket_response
            ]
            
            # Simular get_bucket_details exitoso
            with patch.object(aps_storage_service, 'get_bucket_details', new_callable=AsyncMock) as mock_get:
                mock_get.return_value = BucketResponse(
                    bucket_key="existing-bucket",
                    bucket_owner="owner",
                    created_date=datetime(2024, 1, 16, 10, 0, 0),
                    policy="temporary",
                    permissions=[]
                )
                
                # Ejecutar
                result = await aps_storage_service.create_bucket("existing-bucket")
                
                # Verificar que devuelve el bucket existente
                assert result.bucket_key == "existing-bucket"
    
    @pytest.mark.asyncio
    async def test_upload_file_large_content(self, aps_storage_service):
        """Probar subida de archivo grande"""
        # Crear archivo grande de prueba (1MB)
        large_content = b"A" * (1024 * 1024)
        large_file = io.BytesIO(large_content)
        
        mock_response = {
            "objectId": "urn:adsk.objects:os.object:bucket/large.txt",
            "sha1": "large_sha1",
            "size": len(large_content),
            "contentType": "text/plain",
            "location": "https://api.example.com/large"
        }
        
        with patch.object(aps_storage_service, '_make_authenticated_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            # Ejecutar
            result = await aps_storage_service.upload_file(
                bucket_key="test-bucket",
                object_name="large-file.txt",
                file_content=large_file
            )
            
            # Verificar
            assert result.size == len(large_content)
            assert result.object_key == "large-file.txt"
