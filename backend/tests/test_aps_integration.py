"""
Tests de integración con Autodesk Platform Services (APS)
"""
import pytest
from unittest.mock import AsyncMock, patch, Mock
import base64
import httpx


@pytest.mark.integration
@pytest.mark.aps
class TestAPSIntegration:
    """Tests de integración completa con APS"""
    
    @pytest.mark.asyncio
    async def test_full_translation_workflow(self, async_session, test_file, mock_aps_auth_service, mock_aps_storage_service, mock_translation_manager):
        """Test flujo completo de traducción APS"""
        from app.services.aps_service import APSService
        
        # Setup mocks
        mock_aps_auth_service.get_app_token.return_value = {
            "access_token": "test-app-token",
            "expires_in": 3600
        }
        
        mock_aps_storage_service.upload_file.return_value = {
            "bucket_key": "test-bucket",
            "object_key": "test-object",
            "object_id": "test-object-id"
        }
        
        # Create base64 URN
        urn_input = f"urn:adsk.objects:os.object:test-bucket/test-object"
        urn_base64 = base64.b64encode(urn_input.encode()).decode()
        
        mock_translation_manager.start_translation.return_value = {
            "urn": urn_base64,
            "job_id": "test-job-id",
            "status": "inprogress"
        }
        
        mock_translation_manager.get_translation_status.return_value = {
            "status": "success",
            "progress": "100%",
            "region": "US"
        }
        
        # Execute workflow
        aps_service = APSService()
        
        # Step 1: Upload file
        with patch.object(aps_service, 'auth_service', mock_aps_auth_service), \
             patch.object(aps_service, 'storage_service', mock_aps_storage_service), \
             patch.object(aps_service, 'translation_manager', mock_translation_manager):
            
            # Upload
            upload_result = await aps_service.upload_file(
                file_path="/tmp/test.rvt",
                file_content=b"test content",
                filename="test.rvt"
            )
            
            assert upload_result["object_id"] == "test-object-id"
            
            # Translate
            translation_result = await aps_service.start_translation(
                object_id=upload_result["object_id"],
                output_formats=["svf2"]
            )
            
            assert translation_result["status"] == "inprogress"
            assert "urn" in translation_result
            
            # Check status
            status_result = await aps_service.get_translation_status(
                urn=translation_result["urn"]
            )
            
            assert status_result["status"] == "success"
    
    @pytest.mark.asyncio
    async def test_aps_authentication_flow(self, mock_aps_auth_service):
        """Test flujo de autenticación APS"""
        from app.services.aps_auth import APSAuthService
        
        # Mock OAuth flow
        auth_service = APSAuthService()
        
        # Mock app token
        mock_aps_auth_service.get_app_token.return_value = {
            "access_token": "app-token-123",
            "token_type": "Bearer",
            "expires_in": 3600
        }
        
        # Mock user token
        mock_aps_auth_service.get_user_token.return_value = {
            "access_token": "user-token-123",
            "refresh_token": "refresh-token-123",
            "token_type": "Bearer",
            "expires_in": 3600
        }
        
        # Mock user info
        mock_aps_auth_service.get_user_info.return_value = {
            "user_id": "test-user-id",
            "email": "test@example.com",
            "name": "Test User",
            "picture": "https://example.com/avatar.jpg"
        }
        
        with patch.object(auth_service, 'get_app_token', mock_aps_auth_service.get_app_token), \
             patch.object(auth_service, 'get_user_token', mock_aps_auth_service.get_user_token), \
             patch.object(auth_service, 'get_user_info', mock_aps_auth_service.get_user_info):
            
            # Test app authentication
            app_token = await auth_service.get_app_token()
            assert app_token["access_token"] == "app-token-123"
            
            # Test user authentication
            user_token = await auth_service.get_user_token("auth-code")
            assert user_token["access_token"] == "user-token-123"
            
            # Test user info
            user_info = await auth_service.get_user_info("user-token-123")
            assert user_info["email"] == "test@example.com"
    
    @pytest.mark.asyncio
    async def test_aps_storage_operations(self, mock_aps_storage_service):
        """Test operaciones de almacenamiento APS"""
        from app.services.aps_storage import APSStorageService
        
        storage_service = APSStorageService()
        
        # Mock bucket creation
        mock_aps_storage_service.create_bucket.return_value = "test-bucket-created"
        
        # Mock file upload
        mock_aps_storage_service.upload_file.return_value = {
            "bucket_key": "test-bucket",
            "object_key": "test-file.rvt",
            "object_id": "object-id-123",
            "size": 1024,
            "content_type": "application/octet-stream"
        }
        
        # Mock file download
        mock_aps_storage_service.download_object.return_value = b"file content"
        
        # Mock file deletion
        mock_aps_storage_service.delete_object.return_value = True
        
        with patch.object(storage_service, 'create_bucket', mock_aps_storage_service.create_bucket), \
             patch.object(storage_service, 'upload_file', mock_aps_storage_service.upload_file), \
             patch.object(storage_service, 'download_object', mock_aps_storage_service.download_object), \
             patch.object(storage_service, 'delete_object', mock_aps_storage_service.delete_object):
            
            # Test bucket creation
            bucket = await storage_service.create_bucket("test-bucket-name")
            assert bucket == "test-bucket-created"
            
            # Test file upload
            upload_result = await storage_service.upload_file(
                bucket_key="test-bucket",
                object_key="test-file.rvt",
                file_content=b"test content"
            )
            assert upload_result["object_id"] == "object-id-123"
            
            # Test file download
            content = await storage_service.download_object("test-bucket", "test-file.rvt")
            assert content == b"file content"
            
            # Test file deletion
            deleted = await storage_service.delete_object("test-bucket", "test-file.rvt")
            assert deleted is True
    
    @pytest.mark.asyncio
    async def test_aps_model_derivative_workflow(self, mock_translation_manager):
        """Test flujo de Model Derivative"""
        from app.services.model_derivative import ModelDerivativeService
        
        derivative_service = ModelDerivativeService()
        
        # Mock translation start
        mock_translation_manager.start_translation.return_value = {
            "urn": "test-urn-base64",
            "status": "inprogress",
            "acceptedJobs": {"output": [{"job": "test-job-id"}]}
        }
        
        # Mock status check
        mock_translation_manager.get_translation_status.return_value = {
            "type": "manifest",
            "hasThumbnail": "true",
            "status": "success",
            "progress": "complete",
            "region": "US",
            "urn": "test-urn-base64"
        }
        
        # Mock manifest
        mock_translation_manager.get_manifest.return_value = {
            "type": "manifest",
            "hasThumbnail": "true",
            "status": "success",
            "progress": "complete",
            "region": "US",
            "urn": "test-urn-base64",
            "derivatives": [
                {
                    "name": "test_file.svf2",
                    "hasThumbnail": "true",
                    "status": "success",
                    "progress": "complete",
                    "outputType": "svf2"
                }
            ]
        }
        
        with patch.object(derivative_service, 'translation_manager', mock_translation_manager):
            
            # Start translation
            job = await derivative_service.start_job(
                urn="test-source-urn",
                output_formats=["svf2", "thumbnail"]
            )
            assert job["status"] == "inprogress"
            
            # Check status
            status = await derivative_service.get_job_status("test-urn-base64")
            assert status["status"] == "success"
            
            # Get manifest
            manifest = await derivative_service.get_manifest("test-urn-base64")
            assert manifest["type"] == "manifest"
            assert len(manifest["derivatives"]) > 0
    
    @pytest.mark.asyncio
    async def test_aps_error_handling(self, mock_aps_auth_service):
        """Test manejo de errores de APS"""
        from app.services.aps_auth import APSAuthService
        from app.core.exceptions import APSAuthenticationError, APSAPIError
        
        auth_service = APSAuthService()
        
        # Mock authentication failure
        mock_aps_auth_service.get_app_token.side_effect = httpx.HTTPStatusError(
            "401 Unauthorized", 
            request=Mock(), 
            response=Mock(status_code=401)
        )
        
        with patch.object(auth_service, 'get_app_token', mock_aps_auth_service.get_app_token):
            with pytest.raises(httpx.HTTPStatusError):
                await auth_service.get_app_token()
    
    @pytest.mark.asyncio
    async def test_aps_rate_limiting(self, mock_aps_auth_service):
        """Test manejo de rate limiting de APS"""
        from app.services.aps_auth import APSAuthService
        
        auth_service = APSAuthService()
        
        # Mock rate limit response
        mock_response = Mock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "60"}
        
        mock_aps_auth_service.get_app_token.side_effect = httpx.HTTPStatusError(
            "429 Too Many Requests",
            request=Mock(),
            response=mock_response
        )
        
        with patch.object(auth_service, 'get_app_token', mock_aps_auth_service.get_app_token):
            with pytest.raises(httpx.HTTPStatusError) as exc_info:
                await auth_service.get_app_token()
            
            assert exc_info.value.response.status_code == 429
    
    @pytest.mark.asyncio
    async def test_aps_token_refresh(self, mock_aps_auth_service):
        """Test refresh de tokens APS"""
        from app.services.aps_auth import APSAuthService
        
        auth_service = APSAuthService()
        
        # Mock expired token scenario
        expired_response = Mock()
        expired_response.status_code = 401
        expired_response.json.return_value = {"errorCode": "AUTH-012", "detail": "Token expired"}
        
        # Mock successful refresh
        mock_aps_auth_service.refresh_token.return_value = {
            "access_token": "new-access-token",
            "expires_in": 3600
        }
        
        with patch.object(auth_service, 'refresh_token', mock_aps_auth_service.refresh_token):
            new_token = await auth_service.refresh_token("old-refresh-token")
            assert new_token["access_token"] == "new-access-token"
    
    @pytest.mark.asyncio
    async def test_aps_webhook_integration(self, async_session, test_translation_job):
        """Test integración con webhooks de APS"""
        from app.services.webhook_handler import WebhookHandler
        
        webhook_handler = WebhookHandler()
        
        # Mock webhook payload from APS
        webhook_payload = {
            "Version": "1.0",
            "Type": "Notification",
            "TimeStamp": "2024-01-01T12:00:00Z",
            "Events": [
                {
                    "EventType": "extraction.finished",
                    "ActivityId": test_translation_job.id,
                    "Urn": test_translation_job.urn,
                    "Status": "success",
                    "Progress": "complete",
                    "Region": "US"
                }
            ]
        }
        
        # Process webhook
        result = await webhook_handler.handle_translation_webhook(webhook_payload)
        
        assert result["status"] == "processed"
        
        # Verify job status was updated
        await async_session.refresh(test_translation_job)
        assert test_translation_job.status == "success"
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_aps_concurrent_operations(self, mock_aps_auth_service, mock_aps_storage_service, performance_timer):
        """Test operaciones concurrentes con APS"""
        import asyncio
        from app.services.aps_storage import APSStorageService
        
        storage_service = APSStorageService()
        
        # Mock concurrent uploads
        mock_aps_storage_service.upload_file.side_effect = lambda **kwargs: {
            "bucket_key": "test-bucket",
            "object_key": kwargs.get("object_key", "test-object"),
            "object_id": f"object-{kwargs.get('object_key', 'default')}-id",
            "size": 1024
        }
        
        async def upload_task(file_index):
            with patch.object(storage_service, 'upload_file', mock_aps_storage_service.upload_file):
                return await storage_service.upload_file(
                    bucket_key="test-bucket",
                    object_key=f"file-{file_index}.rvt",
                    file_content=b"test content"
                )
        
        performance_timer.start()
        
        # Execute 5 concurrent uploads
        tasks = [upload_task(i) for i in range(5)]
        results = await asyncio.gather(*tasks)
        
        performance_timer.stop()
        
        assert len(results) == 5
        assert all("object_id" in result for result in results)
        assert performance_timer.elapsed < 10.0  # Should complete within 10 seconds
    
    @pytest.mark.asyncio
    async def test_aps_large_file_handling(self, mock_aps_storage_service):
        """Test manejo de archivos grandes con APS"""
        from app.services.aps_storage_advanced import APSStorageAdvanced
        
        advanced_storage = APSStorageAdvanced()
        
        # Mock chunked upload
        mock_aps_storage_service.upload_file_chunked.return_value = {
            "bucket_key": "test-bucket",
            "object_key": "large-file.rvt",
            "object_id": "large-object-id",
            "size": 100 * 1024 * 1024,  # 100MB
            "upload_method": "chunked"
        }
        
        with patch.object(advanced_storage, 'upload_file_chunked', mock_aps_storage_service.upload_file_chunked):
            result = await advanced_storage.upload_large_file(
                bucket_key="test-bucket",
                object_key="large-file.rvt",
                file_size=100 * 1024 * 1024,
                chunk_size=5 * 1024 * 1024  # 5MB chunks
            )
            
            assert result["upload_method"] == "chunked"
            assert result["size"] == 100 * 1024 * 1024
    
    @pytest.mark.asyncio
    async def test_aps_metadata_extraction(self, mock_translation_manager):
        """Test extracción de metadatos con APS"""
        from app.services.metadata_extractor import MetadataExtractor
        
        extractor = MetadataExtractor()
        
        # Mock metadata response
        mock_translation_manager.get_metadata.return_value = {
            "data": {
                "type": "metadata",
                "metadata": [
                    {"name": "Model", "value": "Building Model"},
                    {"name": "Author", "value": "Architect Name"},
                    {"name": "Created", "value": "2024-01-01"},
                    {"name": "Software", "value": "Revit 2024"}
                ]
            }
        }
        
        with patch.object(extractor, 'translation_manager', mock_translation_manager):
            metadata = await extractor.extract_model_metadata("test-urn")
            
            assert metadata["data"]["type"] == "metadata"
            assert len(metadata["data"]["metadata"]) == 4
            
            # Test specific metadata extraction
            model_info = extractor.parse_model_info(metadata)
            assert model_info["model_name"] == "Building Model"
            assert model_info["author"] == "Architect Name"
    
    @pytest.mark.asyncio
    async def test_aps_viewer_integration(self, mock_translation_manager):
        """Test integración con APS Viewer"""
        from app.services.viewer_service import ViewerService
        
        viewer_service = ViewerService()
        
        # Mock viewer token
        mock_translation_manager.get_viewer_token.return_value = {
            "access_token": "viewer-token-123",
            "expires_in": 3600
        }
        
        # Mock viewer URLs
        mock_translation_manager.get_viewer_urls.return_value = {
            "viewer_url": "https://developer.api.autodesk.com/viewingservice/v1/viewers/7.*/viewer3D.min.js",
            "stylesheet_url": "https://developer.api.autodesk.com/viewingservice/v1/viewers/7.*/style.min.css"
        }
        
        with patch.object(viewer_service, 'translation_manager', mock_translation_manager):
            # Get viewer token
            token = await viewer_service.get_viewer_token("test-urn")
            assert token["access_token"] == "viewer-token-123"
            
            # Get viewer configuration
            config = await viewer_service.get_viewer_config("test-urn")
            assert "viewer_url" in config
            assert "access_token" in config
    
    @pytest.mark.slow
    @pytest.mark.asyncio
    async def test_aps_end_to_end_integration(self, async_session, test_user, test_project):
        """Test integración end-to-end completa con APS"""
        from app.services.aps_service import APSService
        from app.models import File, TranslationJob
        
        aps_service = APSService()
        
        # Mock complete workflow
        with patch.multiple(
            aps_service,
            upload_file=AsyncMock(return_value={
                "bucket_key": "test-bucket",
                "object_key": "test-file.rvt",
                "object_id": "test-object-id"
            }),
            start_translation=AsyncMock(return_value={
                "urn": "test-urn-base64",
                "job_id": "test-job-id",
                "status": "inprogress"
            }),
            get_translation_status=AsyncMock(return_value={
                "status": "success",
                "progress": "100%"
            }),
            get_manifest=AsyncMock(return_value={
                "type": "manifest",
                "status": "success",
                "derivatives": [{"outputType": "svf2"}]
            })
        ):
            
            # 1. Create file record
            file = File(
                name="test-integration.rvt",
                original_name="test-integration.rvt",
                size=1024,
                content_type="application/octet-stream",
                project_id=test_project.id,
                user_id=test_user.id,
                status="pending"
            )
            async_session.add(file)
            await async_session.commit()
            await async_session.refresh(file)
            
            # 2. Upload to APS
            upload_result = await aps_service.upload_file(
                file_path="/tmp/test.rvt",
                file_content=b"test content",
                filename="test-integration.rvt"
            )
            
            # Update file with APS info
            file.bucket_key = upload_result["bucket_key"]
            file.object_key = upload_result["object_key"]
            file.status = "uploaded"
            await async_session.commit()
            
            # 3. Start translation
            translation_result = await aps_service.start_translation(
                object_id=upload_result["object_id"],
                output_formats=["svf2"]
            )
            
            # Create translation job record
            job = TranslationJob(
                id=translation_result["job_id"],
                urn=translation_result["urn"],
                input_file_name=file.name,
                output_formats=["svf2"],
                status="inprogress",
                file_id=file.id,
                user_id=test_user.id
            )
            async_session.add(job)
            await async_session.commit()
            
            # 4. Check final status
            final_status = await aps_service.get_translation_status(
                urn=translation_result["urn"]
            )
            
            # 5. Get manifest
            manifest = await aps_service.get_manifest(
                urn=translation_result["urn"]
            )
            
            # Verify complete workflow
            assert upload_result["object_id"] == "test-object-id"
            assert translation_result["status"] == "inprogress"
            assert final_status["status"] == "success"
            assert manifest["type"] == "manifest"
            
            # Verify database state
            await async_session.refresh(file)
            await async_session.refresh(job)
            
            assert file.status == "uploaded"
            assert job.status == "inprogress"  # Would be updated by webhook in real scenario
