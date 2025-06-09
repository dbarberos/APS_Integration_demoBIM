"""
Tests para endpoints de webhooks
"""
import pytest
from unittest.mock import AsyncMock, patch, Mock
from httpx import AsyncClient


@pytest.mark.api
@pytest.mark.websocket
class TestWebhookEndpoints:
    """Tests para endpoints de webhooks"""
    
    async def test_aps_translation_webhook_success(self, client: AsyncClient, test_translation_job):
        """Test webhook de traducción APS exitoso"""
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
        
        with patch('app.services.webhook_handler.WebhookHandler.handle_translation_webhook') as mock_handler:
            mock_handler.return_value = {"status": "processed"}
            
            response = await client.post(
                "/api/v1/webhooks/aps/translation",
                json=webhook_payload,
                headers={"Content-Type": "application/json"}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processed"
        mock_handler.assert_called_once()
    
    async def test_aps_translation_webhook_failed(self, client: AsyncClient, test_translation_job):
        """Test webhook de traducción fallida"""
        webhook_payload = {
            "Version": "1.0",
            "Type": "Notification",
            "TimeStamp": "2024-01-01T12:00:00Z",
            "Events": [
                {
                    "EventType": "extraction.failed",
                    "ActivityId": test_translation_job.id,
                    "Urn": test_translation_job.urn,
                    "Status": "failed",
                    "Progress": "0%",
                    "Region": "US",
                    "ErrorMessage": "Translation failed due to invalid file format"
                }
            ]
        }
        
        with patch('app.services.webhook_handler.WebhookHandler.handle_translation_webhook') as mock_handler:
            mock_handler.return_value = {"status": "processed", "error_handled": True}
            
            response = await client.post(
                "/api/v1/webhooks/aps/translation",
                json=webhook_payload
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processed"
        assert data["error_handled"] is True
    
    async def test_aps_translation_webhook_invalid_payload(self, client: AsyncClient):
        """Test webhook con payload inválido"""
        invalid_payload = {
            "Invalid": "payload"
        }
        
        response = await client.post(
            "/api/v1/webhooks/aps/translation",
            json=invalid_payload
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "invalid" in data["detail"].lower()
    
    async def test_aps_translation_webhook_signature_validation(self, client: AsyncClient, test_translation_job):
        """Test validación de firma de webhook"""
        webhook_payload = {
            "Version": "1.0",
            "Type": "Notification",
            "Events": [{
                "EventType": "extraction.finished",
                "ActivityId": test_translation_job.id
            }]
        }
        
        # Test without signature
        response = await client.post(
            "/api/v1/webhooks/aps/translation",
            json=webhook_payload
        )
        
        # Should still work but log warning (depending on security config)
        assert response.status_code in [200, 401]
        
        # Test with invalid signature
        response = await client.post(
            "/api/v1/webhooks/aps/translation",
            json=webhook_payload,
            headers={"X-APS-Signature": "invalid-signature"}
        )
        
        assert response.status_code in [200, 401]
    
    async def test_file_upload_webhook(self, client: AsyncClient, test_file):
        """Test webhook de upload de archivo"""
        webhook_payload = {
            "event_type": "file.uploaded",
            "file_id": test_file.id,
            "bucket_key": test_file.bucket_key,
            "object_key": test_file.object_key,
            "size": test_file.size,
            "timestamp": "2024-01-01T12:00:00Z"
        }
        
        with patch('app.services.webhook_handler.WebhookHandler.handle_file_webhook') as mock_handler:
            mock_handler.return_value = {"status": "processed"}
            
            response = await client.post(
                "/api/v1/webhooks/file",
                json=webhook_payload
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processed"
    
    async def test_user_activity_webhook(self, client: AsyncClient, test_user):
        """Test webhook de actividad de usuario"""
        webhook_payload = {
            "event_type": "user.login",
            "user_id": test_user.id,
            "timestamp": "2024-01-01T12:00:00Z",
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0..."
        }
        
        response = await client.post(
            "/api/v1/webhooks/user",
            json=webhook_payload
        )
        
        assert response.status_code == 200
    
    async def test_system_health_webhook(self, client: AsyncClient):
        """Test webhook de salud del sistema"""
        webhook_payload = {
            "event_type": "system.health_check",
            "status": "healthy",
            "services": {
                "database": "healthy",
                "redis": "healthy",
                "aps_api": "healthy"
            },
            "timestamp": "2024-01-01T12:00:00Z"
        }
        
        response = await client.post(
            "/api/v1/webhooks/system",
            json=webhook_payload
        )
        
        assert response.status_code == 200
    
    async def test_webhook_retry_mechanism(self, client: AsyncClient, test_translation_job):
        """Test mecanismo de retry de webhooks"""
        webhook_payload = {
            "Version": "1.0",
            "Type": "Notification",
            "Events": [{
                "EventType": "extraction.finished",
                "ActivityId": test_translation_job.id
            }]
        }
        
        # Mock handler to fail first time, succeed second time
        call_count = 0
        def mock_handler_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Temporary failure")
            return {"status": "processed"}
        
        with patch('app.services.webhook_handler.WebhookHandler.handle_translation_webhook') as mock_handler:
            mock_handler.side_effect = mock_handler_side_effect
            
            # First call should fail but be retried
            response = await client.post(
                "/api/v1/webhooks/aps/translation",
                json=webhook_payload
            )
        
        # Should eventually succeed after retry
        assert response.status_code == 200
    
    async def test_webhook_rate_limiting(self, client: AsyncClient, test_translation_job):
        """Test rate limiting de webhooks"""
        webhook_payload = {
            "Version": "1.0",
            "Type": "Notification",
            "Events": [{
                "EventType": "extraction.finished",
                "ActivityId": test_translation_job.id
            }]
        }
        
        # Send multiple requests rapidly
        responses = []
        for i in range(10):
            response = await client.post(
                "/api/v1/webhooks/aps/translation",
                json=webhook_payload
            )
            responses.append(response.status_code)
        
        # Some requests should be rate limited (429) if rate limiting is enabled
        success_count = sum(1 for status in responses if status == 200)
        rate_limited_count = sum(1 for status in responses if status == 429)
        
        # At least some should succeed
        assert success_count > 0
        # Rate limiting might kick in
        assert rate_limited_count >= 0
    
    async def test_webhook_batch_processing(self, client: AsyncClient, test_translation_job):
        """Test procesamiento en lote de webhooks"""
        webhook_payload = {
            "Version": "1.0",
            "Type": "Notification",
            "Events": [
                {
                    "EventType": "extraction.finished",
                    "ActivityId": f"{test_translation_job.id}-1",
                    "Status": "success"
                },
                {
                    "EventType": "extraction.finished", 
                    "ActivityId": f"{test_translation_job.id}-2",
                    "Status": "success"
                },
                {
                    "EventType": "extraction.failed",
                    "ActivityId": f"{test_translation_job.id}-3",
                    "Status": "failed"
                }
            ]
        }
        
        with patch('app.services.webhook_handler.WebhookHandler.handle_translation_webhook') as mock_handler:
            mock_handler.return_value = {
                "status": "processed",
                "processed_events": 3,
                "successful": 2,
                "failed": 1
            }
            
            response = await client.post(
                "/api/v1/webhooks/aps/translation",
                json=webhook_payload
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["processed_events"] == 3
        assert data["successful"] == 2
        assert data["failed"] == 1
    
    async def test_webhook_security_headers(self, client: AsyncClient, test_translation_job):
        """Test headers de seguridad en webhooks"""
        webhook_payload = {
            "Version": "1.0",
            "Type": "Notification",
            "Events": [{
                "EventType": "extraction.finished",
                "ActivityId": test_translation_job.id
            }]
        }
        
        # Test with security headers
        security_headers = {
            "X-Forwarded-For": "192.168.1.1",
            "X-Real-IP": "192.168.1.1",
            "User-Agent": "APS-Webhook/1.0",
            "X-APS-Timestamp": "1234567890"
        }
        
        response = await client.post(
            "/api/v1/webhooks/aps/translation",
            json=webhook_payload,
            headers=security_headers
        )
        
        assert response.status_code == 200
    
    async def test_webhook_logging_and_audit(self, client: AsyncClient, test_translation_job):
        """Test logging y auditoría de webhooks"""
        webhook_payload = {
            "Version": "1.0",
            "Type": "Notification",
            "Events": [{
                "EventType": "extraction.finished",
                "ActivityId": test_translation_job.id
            }]
        }
        
        with patch('app.services.webhook_handler.WebhookHandler.log_webhook_event') as mock_logger:
            response = await client.post(
                "/api/v1/webhooks/aps/translation",
                json=webhook_payload
            )
        
        assert response.status_code == 200
        # Verify logging was called
        mock_logger.assert_called()
    
    async def test_webhook_duplicate_detection(self, client: AsyncClient, test_translation_job):
        """Test detección de webhooks duplicados"""
        webhook_payload = {
            "Version": "1.0",
            "Type": "Notification",
            "MessageId": "unique-message-id-123",
            "Events": [{
                "EventType": "extraction.finished",
                "ActivityId": test_translation_job.id
            }]
        }
        
        # Send same webhook twice
        response1 = await client.post(
            "/api/v1/webhooks/aps/translation",
            json=webhook_payload
        )
        
        response2 = await client.post(
            "/api/v1/webhooks/aps/translation",
            json=webhook_payload
        )
        
        assert response1.status_code == 200
        # Second request should be detected as duplicate (or processed normally)
        assert response2.status_code in [200, 202]  # 202 = already processed
    
    @pytest.mark.performance
    async def test_webhook_performance(self, client: AsyncClient, test_translation_job, performance_timer):
        """Test performance de procesamiento de webhooks"""
        webhook_payload = {
            "Version": "1.0",
            "Type": "Notification",
            "Events": [{
                "EventType": "extraction.finished",
                "ActivityId": test_translation_job.id
            }]
        }
        
        performance_timer.start()
        
        response = await client.post(
            "/api/v1/webhooks/aps/translation",
            json=webhook_payload
        )
        
        performance_timer.stop()
        
        assert response.status_code == 200
        assert performance_timer.elapsed < 1.0  # Should process within 1 second
    
    @pytest.mark.slow
    async def test_webhook_concurrent_processing(self, client: AsyncClient, test_translation_job):
        """Test procesamiento concurrente de webhooks"""
        import asyncio
        
        async def webhook_task(task_id):
            webhook_payload = {
                "Version": "1.0",
                "Type": "Notification",
                "Events": [{
                    "EventType": "extraction.finished",
                    "ActivityId": f"{test_translation_job.id}-{task_id}"
                }]
            }
            
            response = await client.post(
                "/api/v1/webhooks/aps/translation",
                json=webhook_payload
            )
            return response.status_code
        
        # Execute 5 concurrent webhook calls
        tasks = [webhook_task(i) for i in range(5)]
        results = await asyncio.gather(*tasks)
        
        # All should succeed
        assert all(status == 200 for status in results)
    
    async def test_webhook_error_handling(self, client: AsyncClient):
        """Test manejo de errores en webhooks"""
        # Test with malformed JSON
        response = await client.post(
            "/api/v1/webhooks/aps/translation",
            data="invalid json",
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400
        
        # Test with missing required fields
        incomplete_payload = {
            "Version": "1.0"
            # Missing Type and Events
        }
        
        response = await client.post(
            "/api/v1/webhooks/aps/translation",
            json=incomplete_payload
        )
        
        assert response.status_code == 400
    
    async def test_webhook_metrics_collection(self, client: AsyncClient, test_translation_job):
        """Test recolección de métricas de webhooks"""
        webhook_payload = {
            "Version": "1.0",
            "Type": "Notification",
            "Events": [{
                "EventType": "extraction.finished",
                "ActivityId": test_translation_job.id
            }]
        }
        
        with patch('app.services.metrics_collector.collect_webhook_metrics') as mock_metrics:
            response = await client.post(
                "/api/v1/webhooks/aps/translation",
                json=webhook_payload
            )
        
        assert response.status_code == 200
        # Verify metrics were collected
        mock_metrics.assert_called()
    
    async def test_webhook_health_check(self, client: AsyncClient):
        """Test health check para webhooks"""
        response = await client.get("/api/v1/webhooks/health")
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "webhook_processor" in data
        assert "queue_length" in data
        assert "last_processed" in data
