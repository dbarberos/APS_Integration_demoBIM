"""
Tests para endpoints de traducción APS
"""
import pytest
from unittest.mock import AsyncMock, patch, Mock
from httpx import AsyncClient


@pytest.mark.api
@pytest.mark.aps
class TestTranslationEndpoints:
    """Tests para endpoints de traducción"""
    
    async def test_start_translation_success(self, client: AsyncClient, auth_headers, test_file, mock_translation_manager):
        """Test iniciar traducción exitosa"""
        mock_translation_manager.start_translation.return_value = {
            "urn": "test-urn-base64",
            "job_id": "test-job-id",
            "status": "inprogress",
            "region": "US"
        }
        
        translation_data = {
            "file_id": test_file.id,
            "output_formats": ["svf2", "thumbnail"],
            "priority": "normal",
            "quality_level": "high"
        }
        
        with patch('app.api.v1.endpoints.translate.translation_manager', mock_translation_manager):
            response = await client.post(
                "/api/v1/translate/",
                headers=auth_headers,
                json=translation_data
            )
        
        assert response.status_code == 201
        data = response.json()
        assert data["urn"] == "test-urn-base64"
        assert data["status"] == "inprogress"
        assert data["input_file_name"] == test_file.name
        assert "job_id" in data
    
    async def test_start_translation_file_not_found(self, client: AsyncClient, auth_headers):
        """Test iniciar traducción con archivo inexistente"""
        translation_data = {
            "file_id": 99999,
            "output_formats": ["svf2"],
            "priority": "normal"
        }
        
        response = await client.post(
            "/api/v1/translate/",
            headers=auth_headers,
            json=translation_data
        )
        
        assert response.status_code == 404
    
    async def test_start_translation_invalid_format(self, client: AsyncClient, auth_headers, test_file):
        """Test iniciar traducción con formato inválido"""
        translation_data = {
            "file_id": test_file.id,
            "output_formats": ["invalid_format"],
            "priority": "normal"
        }
        
        response = await client.post(
            "/api/v1/translate/",
            headers=auth_headers,
            json=translation_data
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "format" in data["detail"].lower()
    
    async def test_get_translation_jobs(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test obtener lista de trabajos de traducción"""
        response = await client.get(
            "/api/v1/translate/",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data
        assert len(data["data"]) >= 1
        
        # Check that our test job is in the results
        job_ids = [job["id"] for job in data["data"]]
        assert test_translation_job.id in job_ids
    
    async def test_get_translation_jobs_with_filters(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test obtener trabajos con filtros"""
        response = await client.get(
            "/api/v1/translate/",
            headers=auth_headers,
            params={
                "status": "pending",
                "priority": "normal",
                "search": "test"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
    
    async def test_get_translation_job_by_id(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test obtener trabajo de traducción por ID"""
        response = await client.get(
            f"/api/v1/translate/{test_translation_job.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_translation_job.id
        assert data["urn"] == test_translation_job.urn
        assert data["status"] == test_translation_job.status
    
    async def test_get_translation_job_not_found(self, client: AsyncClient, auth_headers):
        """Test obtener trabajo inexistente"""
        response = await client.get(
            "/api/v1/translate/nonexistent-job-id",
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    async def test_get_translation_status(self, client: AsyncClient, auth_headers, test_translation_job, mock_translation_manager):
        """Test obtener estado de traducción"""
        mock_translation_manager.get_translation_status.return_value = {
            "status": "success",
            "progress": "100%",
            "region": "US",
            "urn": test_translation_job.urn
        }
        
        with patch('app.api.v1.endpoints.translate.translation_manager', mock_translation_manager):
            response = await client.get(
                f"/api/v1/translate/{test_translation_job.id}/status",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["progress"] == "100%"
    
    async def test_get_translation_manifest(self, client: AsyncClient, auth_headers, test_translation_job, mock_translation_manager):
        """Test obtener manifiesto de traducción"""
        mock_manifest = {
            "type": "manifest",
            "hasThumbnail": "true",
            "status": "success",
            "progress": "complete",
            "region": "US",
            "urn": test_translation_job.urn,
            "derivatives": [
                {
                    "name": "test_file.svf2",
                    "hasThumbnail": "true",
                    "status": "success",
                    "progress": "complete",
                    "outputType": "svf2",
                    "children": []
                }
            ]
        }
        
        mock_translation_manager.get_manifest.return_value = mock_manifest
        
        with patch('app.api.v1.endpoints.translate.translation_manager', mock_translation_manager):
            response = await client.get(
                f"/api/v1/translate/{test_translation_job.id}/manifest",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "manifest"
        assert data["status"] == "success"
        assert "derivatives" in data
    
    async def test_get_translation_metadata(self, client: AsyncClient, auth_headers, test_translation_job, mock_translation_manager):
        """Test obtener metadatos de traducción"""
        mock_metadata = {
            "data": {
                "type": "metadata",
                "metadata": [
                    {"name": "Model", "value": "Test Model"},
                    {"name": "Author", "value": "Test Author"},
                    {"name": "Created", "value": "2024-01-01"}
                ]
            }
        }
        
        mock_translation_manager.get_metadata.return_value = mock_metadata
        
        with patch('app.api.v1.endpoints.translate.translation_manager', mock_translation_manager):
            response = await client.get(
                f"/api/v1/translate/{test_translation_job.id}/metadata",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        data = response.json()
        assert "metadata" in data["data"]
    
    async def test_retry_translation(self, client: AsyncClient, auth_headers, test_translation_job, mock_translation_manager):
        """Test reintentar traducción"""
        # First, set job status to failed
        test_translation_job.status = "failed"
        
        mock_translation_manager.start_translation.return_value = {
            "urn": test_translation_job.urn,
            "job_id": test_translation_job.id,
            "status": "inprogress",
            "region": "US"
        }
        
        with patch('app.api.v1.endpoints.translate.translation_manager', mock_translation_manager):
            response = await client.post(
                f"/api/v1/translate/{test_translation_job.id}/retry",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "inprogress"
        assert data["retry_count"] > 0
    
    async def test_retry_translation_not_failed(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test reintentar traducción que no ha fallado"""
        # Job is in pending status (not failed)
        response = await client.post(
            f"/api/v1/translate/{test_translation_job.id}/retry",
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "failed" in data["detail"].lower()
    
    async def test_cancel_translation(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test cancelar traducción"""
        # Set job to inprogress status
        test_translation_job.status = "inprogress"
        
        response = await client.post(
            f"/api/v1/translate/{test_translation_job.id}/cancel",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"
    
    async def test_cancel_translation_already_completed(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test cancelar traducción ya completada"""
        # Set job to success status
        test_translation_job.status = "success"
        
        response = await client.post(
            f"/api/v1/translate/{test_translation_job.id}/cancel",
            headers=auth_headers
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "completed" in data["detail"].lower() or "success" in data["detail"].lower()
    
    async def test_delete_translation_job(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test eliminar trabajo de traducción"""
        response = await client.delete(
            f"/api/v1/translate/{test_translation_job.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 204
        
        # Verify job is deleted
        get_response = await client.get(
            f"/api/v1/translate/{test_translation_job.id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404
    
    async def test_get_translation_hierarchy(self, client: AsyncClient, auth_headers, test_translation_job, mock_translation_manager):
        """Test obtener jerarquía del modelo"""
        mock_hierarchy = {
            "data": {
                "type": "objects",
                "objects": [
                    {
                        "objectid": 1,
                        "name": "Model",
                        "objects": [
                            {"objectid": 2, "name": "Level 1"},
                            {"objectid": 3, "name": "Level 2"}
                        ]
                    }
                ]
            }
        }
        
        mock_translation_manager.get_hierarchy.return_value = mock_hierarchy
        
        with patch('app.api.v1.endpoints.translate.translation_manager', mock_translation_manager):
            response = await client.get(
                f"/api/v1/translate/{test_translation_job.id}/hierarchy",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        data = response.json()
        assert "objects" in data["data"]
    
    async def test_get_translation_thumbnail(self, client: AsyncClient, auth_headers, test_translation_job, mock_translation_manager):
        """Test obtener thumbnail de traducción"""
        mock_thumbnail = b"thumbnail_image_data"
        mock_translation_manager.get_thumbnail.return_value = mock_thumbnail
        
        with patch('app.api.v1.endpoints.translate.translation_manager', mock_translation_manager):
            response = await client.get(
                f"/api/v1/translate/{test_translation_job.id}/thumbnail",
                headers=auth_headers
            )
        
        assert response.status_code == 200
        assert response.content == mock_thumbnail
        assert "image" in response.headers.get("content-type", "")
    
    async def test_get_supported_formats(self, client: AsyncClient, auth_headers):
        """Test obtener formatos soportados"""
        response = await client.get(
            "/api/v1/translate/formats/supported",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "input_formats" in data
        assert "output_formats" in data
        assert "svf2" in data["output_formats"]
        assert "thumbnail" in data["output_formats"]
    
    async def test_get_translation_stats(self, client: AsyncClient, auth_headers):
        """Test obtener estadísticas de traducción"""
        response = await client.get(
            "/api/v1/translate/stats/overview",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "total_jobs" in data
        assert "completed_jobs" in data
        assert "failed_jobs" in data
        assert "active_jobs" in data
    
    async def test_get_active_translations(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test obtener traducciones activas"""
        # Set job to inprogress
        test_translation_job.status = "inprogress"
        
        response = await client.get(
            "/api/v1/translate/active",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should include our inprogress job
        active_ids = [job["id"] for job in data]
        assert test_translation_job.id in active_ids
    
    async def test_get_recent_translations(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test obtener traducciones recientes"""
        response = await client.get(
            "/api/v1/translate/recent",
            headers=auth_headers,
            params={"limit": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 10
    
    @pytest.mark.performance
    async def test_translation_start_performance(self, client: AsyncClient, auth_headers, test_file, mock_translation_manager, performance_timer):
        """Test performance de inicio de traducción"""
        mock_translation_manager.start_translation.return_value = {
            "urn": "test-urn",
            "job_id": "test-job-id",
            "status": "inprogress"
        }
        
        translation_data = {
            "file_id": test_file.id,
            "output_formats": ["svf2"],
            "priority": "normal"
        }
        
        with patch('app.api.v1.endpoints.translate.translation_manager', mock_translation_manager):
            performance_timer.start()
            
            response = await client.post(
                "/api/v1/translate/",
                headers=auth_headers,
                json=translation_data
            )
            
            performance_timer.stop()
        
        assert response.status_code == 201
        assert performance_timer.elapsed < 2.0  # Should complete within 2 seconds
    
    @pytest.mark.slow
    async def test_concurrent_translations(self, client: AsyncClient, auth_headers, test_file, mock_translation_manager):
        """Test traducciones concurrentes"""
        import asyncio
        
        mock_translation_manager.start_translation.side_effect = lambda **kwargs: {
            "urn": f"test-urn-{kwargs.get('file_id', 'default')}",
            "job_id": f"test-job-{kwargs.get('file_id', 'default')}",
            "status": "inprogress"
        }
        
        async def translation_task(task_id):
            translation_data = {
                "file_id": test_file.id,
                "output_formats": ["svf2"],
                "priority": "normal"
            }
            
            with patch('app.api.v1.endpoints.translate.translation_manager', mock_translation_manager):
                response = await client.post(
                    "/api/v1/translate/",
                    headers=auth_headers,
                    json=translation_data
                )
            return response.status_code
        
        # Execute 3 concurrent translations
        tasks = [translation_task(i) for i in range(3)]
        results = await asyncio.gather(*tasks)
        
        # All should succeed
        assert all(status == 201 for status in results)
    
    @pytest.mark.parametrize("output_format", [
        "svf2",
        "thumbnail", 
        "stl",
        "step",
        "iges"
    ])
    async def test_different_output_formats(self, client: AsyncClient, auth_headers, test_file, output_format, mock_translation_manager):
        """Test diferentes formatos de salida"""
        mock_translation_manager.start_translation.return_value = {
            "urn": "test-urn",
            "job_id": "test-job-id",
            "status": "inprogress"
        }
        
        translation_data = {
            "file_id": test_file.id,
            "output_formats": [output_format],
            "priority": "normal"
        }
        
        with patch('app.api.v1.endpoints.translate.translation_manager', mock_translation_manager):
            response = await client.post(
                "/api/v1/translate/",
                headers=auth_headers,
                json=translation_data
            )
        
        assert response.status_code == 201
        data = response.json()
        assert output_format in data["output_formats"]
    
    @pytest.mark.parametrize("priority", ["low", "normal", "high", "urgent"])
    async def test_different_priorities(self, client: AsyncClient, auth_headers, test_file, priority, mock_translation_manager):
        """Test diferentes prioridades de traducción"""
        mock_translation_manager.start_translation.return_value = {
            "urn": "test-urn",
            "job_id": "test-job-id",
            "status": "inprogress"
        }
        
        translation_data = {
            "file_id": test_file.id,
            "output_formats": ["svf2"],
            "priority": priority
        }
        
        with patch('app.api.v1.endpoints.translate.translation_manager', mock_translation_manager):
            response = await client.post(
                "/api/v1/translate/",
                headers=auth_headers,
                json=translation_data
            )
        
        assert response.status_code == 201
        data = response.json()
        assert data["priority"] == priority
    
    async def test_translation_permissions(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test permisos de acceso a traducciones"""
        # Test that user can access their own translation
        response = await client.get(
            f"/api/v1/translate/{test_translation_job.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Test access with different user (should be forbidden)
        different_user_headers = {
            "Authorization": "Bearer different-user-token"
        }
        
        with patch('app.api.v1.endpoints.translate.get_current_user') as mock_get_user:
            # Mock different user
            mock_different_user = Mock()
            mock_different_user.id = 999  # Different user ID
            mock_get_user.return_value = mock_different_user
            
            response = await client.get(
                f"/api/v1/translate/{test_translation_job.id}",
                headers=different_user_headers
            )
        
        assert response.status_code == 403
    
    async def test_translation_webhook_handling(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test manejo de webhooks de traducción"""
        webhook_data = {
            "Version": "1.0",
            "Type": "Notification",
            "TimeStamp": "2024-01-01T12:00:00Z",
            "Events": [
                {
                    "EventType": "extraction.finished",
                    "ActivityId": test_translation_job.id,
                    "Urn": test_translation_job.urn,
                    "Status": "success",
                    "Progress": "complete"
                }
            ]
        }
        
        # This would typically be called by APS webhook
        response = await client.post(
            "/api/v1/webhooks/translation",
            json=webhook_data
        )
        
        assert response.status_code == 200
    
    async def test_translation_job_cleanup(self, client: AsyncClient, auth_headers, test_translation_job):
        """Test limpieza automática de trabajos antiguos"""
        # Test endpoint for cleaning up old completed jobs
        response = await client.post(
            "/api/v1/translate/cleanup",
            headers=auth_headers,
            json={"older_than_days": 30}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "cleaned_jobs" in data
