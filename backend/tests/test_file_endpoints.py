"""
Tests para endpoints de gestión de archivos
"""
import io
import pytest
from unittest.mock import AsyncMock, patch, Mock
from httpx import AsyncClient


@pytest.mark.api
class TestFileEndpoints:
    """Tests para endpoints de archivos"""
    
    async def test_upload_file_success(self, client: AsyncClient, auth_headers, test_project, mock_aps_storage_service):
        """Test upload exitoso de archivo"""
        # Mock storage service
        mock_aps_storage_service.upload_file.return_value = {
            "bucket_key": "test-bucket",
            "object_key": "test-object",
            "object_id": "test-object-id",
            "size": 1024
        }
        
        # Prepare file data
        file_content = b"Test CAD file content"
        files = {
            "file": ("test.rvt", io.BytesIO(file_content), "application/octet-stream")
        }
        data = {
            "project_id": str(test_project.id)
        }
        
        with patch('app.api.v1.endpoints.files.aps_storage_service', mock_aps_storage_service):
            response = await client.post(
                "/api/v1/files/upload",
                headers={"Authorization": auth_headers["Authorization"]},
                files=files,
                data=data
            )
        
        assert response.status_code == 201
        response_data = response.json()
        assert "id" in response_data
        assert response_data["name"] == "test.rvt"
        assert response_data["size"] == len(file_content)
        assert response_data["project_id"] == test_project.id
        assert response_data["status"] == "uploaded"
    
    async def test_upload_file_invalid_format(self, client: AsyncClient, auth_headers, test_project):
        """Test upload de archivo con formato no soportado"""
        file_content = b"Invalid file content"
        files = {
            "file": ("test.txt", io.BytesIO(file_content), "text/plain")
        }
        data = {"project_id": str(test_project.id)}
        
        response = await client.post(
            "/api/v1/files/upload",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files,
            data=data
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "format" in data["detail"].lower() or "supported" in data["detail"].lower()
    
    async def test_upload_file_too_large(self, client: AsyncClient, auth_headers, test_project):
        """Test upload de archivo demasiado grande"""
        # Create large file content (>100MB)
        large_content = b"x" * (101 * 1024 * 1024)
        files = {
            "file": ("large.rvt", io.BytesIO(large_content), "application/octet-stream")
        }
        data = {"project_id": str(test_project.id)}
        
        response = await client.post(
            "/api/v1/files/upload",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files,
            data=data
        )
        
        assert response.status_code == 413
    
    async def test_upload_file_no_auth(self, client: AsyncClient, test_project):
        """Test upload sin autenticación"""
        file_content = b"Test content"
        files = {
            "file": ("test.rvt", io.BytesIO(file_content), "application/octet-stream")
        }
        data = {"project_id": str(test_project.id)}
        
        response = await client.post(
            "/api/v1/files/upload",
            files=files,
            data=data
        )
        
        assert response.status_code == 401
    
    async def test_get_files_list(self, client: AsyncClient, auth_headers, test_file):
        """Test obtener lista de archivos"""
        response = await client.get(
            "/api/v1/files/",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data
        assert len(data["data"]) >= 1
        assert any(file["id"] == test_file.id for file in data["data"])
    
    async def test_get_files_with_filters(self, client: AsyncClient, auth_headers, test_file):
        """Test obtener archivos con filtros"""
        response = await client.get(
            "/api/v1/files/",
            headers=auth_headers,
            params={
                "status": "uploaded",
                "project_id": test_file.project_id,
                "search": "test"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert len(data["data"]) >= 1
    
    async def test_get_files_pagination(self, client: AsyncClient, auth_headers):
        """Test paginación de archivos"""
        response = await client.get(
            "/api/v1/files/",
            headers=auth_headers,
            params={"page": 1, "per_page": 5}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["page"] == 1
        assert data["pagination"]["per_page"] == 5
        assert "total" in data["pagination"]
        assert "total_pages" in data["pagination"]
    
    async def test_get_file_by_id(self, client: AsyncClient, auth_headers, test_file):
        """Test obtener archivo por ID"""
        response = await client.get(
            f"/api/v1/files/{test_file.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_file.id
        assert data["name"] == test_file.name
        assert data["project_id"] == test_file.project_id
    
    async def test_get_file_not_found(self, client: AsyncClient, auth_headers):
        """Test obtener archivo que no existe"""
        response = await client.get(
            "/api/v1/files/99999",
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    async def test_update_file(self, client: AsyncClient, auth_headers, test_file):
        """Test actualizar archivo"""
        update_data = {
            "name": "updated_file.rvt",
            "tags": ["tag1", "tag2"]
        }
        
        response = await client.patch(
            f"/api/v1/files/{test_file.id}",
            headers=auth_headers,
            json=update_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "updated_file.rvt"
        assert "tag1" in data.get("tags", [])
        assert "tag2" in data.get("tags", [])
    
    async def test_delete_file(self, client: AsyncClient, auth_headers, test_file, mock_aps_storage_service):
        """Test eliminar archivo"""
        mock_aps_storage_service.delete_object.return_value = True
        
        with patch('app.api.v1.endpoints.files.aps_storage_service', mock_aps_storage_service):
            response = await client.delete(
                f"/api/v1/files/{test_file.id}",
                headers=auth_headers
            )
        
        assert response.status_code == 204
        
        # Verify file is deleted
        get_response = await client.get(
            f"/api/v1/files/{test_file.id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404
    
    async def test_download_file(self, client: AsyncClient, auth_headers, test_file, mock_aps_storage_service):
        """Test descargar archivo"""
        mock_content = b"Test file content for download"
        mock_aps_storage_service.download_object.return_value = mock_content
        
        with patch('app.api.v1.endpoints.files.aps_storage_service', mock_aps_storage_service):
            response = await client.get(
                f"/api/v1/files/{test_file.id}/download",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        assert response.content == mock_content
        assert "attachment" in response.headers.get("content-disposition", "")
    
    async def test_get_file_metadata(self, client: AsyncClient, auth_headers, test_file):
        """Test obtener metadatos de archivo"""
        response = await client.get(
            f"/api/v1/files/{test_file.id}/metadata",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "size" in data
        assert "content_type" in data
        assert "created_at" in data
    
    async def test_generate_thumbnail(self, client: AsyncClient, auth_headers, test_file):
        """Test generar thumbnail"""
        mock_thumbnail = b"thumbnail data"
        
        with patch('app.services.thumbnail_generator.generate_thumbnail', return_value=mock_thumbnail):
            response = await client.post(
                f"/api/v1/files/{test_file.id}/thumbnail",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        assert response.content == mock_thumbnail
    
    async def test_bulk_delete_files(self, client: AsyncClient, auth_headers, test_file, mock_aps_storage_service):
        """Test eliminación en lote de archivos"""
        mock_aps_storage_service.delete_object.return_value = True
        
        with patch('app.api.v1.endpoints.files.aps_storage_service', mock_aps_storage_service):
            response = await client.delete(
                "/api/v1/files/bulk",
                headers=auth_headers,
                json={"file_ids": [test_file.id]}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] >= 1
        assert data["failed_count"] == 0
    
    async def test_move_file_to_project(self, client: AsyncClient, auth_headers, test_file, test_project):
        """Test mover archivo a otro proyecto"""
        # Create another project for testing
        from app.models import Project
        
        # Move file to different project
        response = await client.patch(
            f"/api/v1/files/{test_file.id}/move",
            headers=auth_headers,
            json={"target_project_id": test_project.id}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["project_id"] == test_project.id
    
    async def test_duplicate_file(self, client: AsyncClient, auth_headers, test_file, mock_aps_storage_service):
        """Test duplicar archivo"""
        mock_aps_storage_service.copy_object.return_value = {
            "bucket_key": "test-bucket",
            "object_key": "test-object-copy",
            "object_id": "test-object-copy-id",
            "size": test_file.size
        }
        
        with patch('app.api.v1.endpoints.files.aps_storage_service', mock_aps_storage_service):
            response = await client.post(
                f"/api/v1/files/{test_file.id}/duplicate",
                headers=auth_headers,
                json={"new_name": "duplicate_file.rvt"}
            )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "duplicate_file.rvt"
        assert data["id"] != test_file.id
    
    async def test_get_file_versions(self, client: AsyncClient, auth_headers, test_file):
        """Test obtener versiones de archivo"""
        response = await client.get(
            f"/api/v1/files/{test_file.id}/versions",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    async def test_share_file(self, client: AsyncClient, auth_headers, test_file):
        """Test compartir archivo"""
        share_data = {
            "expires_in": 3600,
            "download_limit": 10,
            "password": "sharepassword"
        }
        
        response = await client.post(
            f"/api/v1/files/{test_file.id}/share",
            headers=auth_headers,
            json=share_data
        )
        
        assert response.status_code == 201
        data = response.json()
        assert "share_url" in data
        assert "share_id" in data
        assert "expires_at" in data
    
    @pytest.mark.performance
    async def test_upload_performance(self, client: AsyncClient, auth_headers, test_project, performance_timer, mock_aps_storage_service):
        """Test performance de upload"""
        mock_aps_storage_service.upload_file.return_value = {
            "bucket_key": "test-bucket",
            "object_key": "test-object",
            "object_id": "test-object-id",
            "size": 1024
        }
        
        file_content = b"x" * (1024 * 1024)  # 1MB file
        files = {
            "file": ("performance.rvt", io.BytesIO(file_content), "application/octet-stream")
        }
        data = {"project_id": str(test_project.id)}
        
        with patch('app.api.v1.endpoints.files.aps_storage_service', mock_aps_storage_service):
            performance_timer.start()
            
            response = await client.post(
                "/api/v1/files/upload",
                headers={"Authorization": auth_headers["Authorization"]},
                files=files,
                data=data
            )
            
            performance_timer.stop()
        
        assert response.status_code == 201
        assert performance_timer.elapsed < 5.0  # Should complete within 5 seconds
    
    @pytest.mark.slow
    async def test_concurrent_uploads(self, client: AsyncClient, auth_headers, test_project, mock_aps_storage_service):
        """Test uploads concurrentes"""
        import asyncio
        
        mock_aps_storage_service.upload_file.return_value = {
            "bucket_key": "test-bucket",
            "object_key": "test-object",
            "object_id": "test-object-id",
            "size": 1024
        }
        
        async def upload_task(file_index):
            file_content = b"Test content " + str(file_index).encode()
            files = {
                "file": (f"test{file_index}.rvt", io.BytesIO(file_content), "application/octet-stream")
            }
            data = {"project_id": str(test_project.id)}
            
            with patch('app.api.v1.endpoints.files.aps_storage_service', mock_aps_storage_service):
                response = await client.post(
                    "/api/v1/files/upload",
                    headers={"Authorization": auth_headers["Authorization"]},
                    files=files,
                    data=data
                )
            return response.status_code
        
        # Execute 5 concurrent uploads
        tasks = [upload_task(i) for i in range(5)]
        results = await asyncio.gather(*tasks)
        
        # All should succeed
        assert all(status == 201 for status in results)
    
    @pytest.mark.parametrize("file_extension", [
        ".rvt", ".rfa", ".rte",  # Revit
        ".ifc",                   # IFC
        ".dwg", ".dxf",          # AutoCAD
        ".step", ".stp",         # STEP
        ".3dm",                  # Rhino
        ".skp"                   # SketchUp
    ])
    async def test_supported_file_formats(self, client: AsyncClient, auth_headers, test_project, file_extension, mock_aps_storage_service):
        """Test formatos de archivo soportados"""
        mock_aps_storage_service.upload_file.return_value = {
            "bucket_key": "test-bucket",
            "object_key": "test-object",
            "object_id": "test-object-id",
            "size": 1024
        }
        
        file_content = b"Test CAD content"
        files = {
            "file": (f"test{file_extension}", io.BytesIO(file_content), "application/octet-stream")
        }
        data = {"project_id": str(test_project.id)}
        
        with patch('app.api.v1.endpoints.files.aps_storage_service', mock_aps_storage_service):
            response = await client.post(
                "/api/v1/files/upload",
                headers={"Authorization": auth_headers["Authorization"]},
                files=files,
                data=data
            )
        
        assert response.status_code == 201
    
    async def test_file_access_permissions(self, client: AsyncClient, auth_headers, test_file):
        """Test permisos de acceso a archivos"""
        # Test that user can only access their own files
        response = await client.get(
            f"/api/v1/files/{test_file.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Test access with different user (should be forbidden)
        different_user_headers = {
            "Authorization": "Bearer different-user-token"
        }
        
        with patch('app.api.v1.endpoints.files.get_current_user') as mock_get_user:
            # Mock different user
            mock_different_user = Mock()
            mock_different_user.id = 999  # Different user ID
            mock_get_user.return_value = mock_different_user
            
            response = await client.get(
                f"/api/v1/files/{test_file.id}",
                headers=different_user_headers
            )
        
        assert response.status_code == 403
    
    async def test_file_upload_virus_scan(self, client: AsyncClient, auth_headers, test_project):
        """Test escaneo de virus en archivos subidos"""
        # Mock virus detection
        malicious_content = b"MALICIOUS_CONTENT_DETECTED"
        files = {
            "file": ("malicious.rvt", io.BytesIO(malicious_content), "application/octet-stream")
        }
        data = {"project_id": str(test_project.id)}
        
        with patch('app.services.virus_scanner.scan_file', return_value=False):  # Virus detected
            response = await client.post(
                "/api/v1/files/upload",
                headers={"Authorization": auth_headers["Authorization"]},
                files=files,
                data=data
            )
        
        assert response.status_code == 400
        data = response.json()
        assert "virus" in data["detail"].lower() or "malicious" in data["detail"].lower()
