"""
Pruebas unitarias para el sistema de webhooks
"""
import pytest
import asyncio
import hmac
import hashlib
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime

from app.services.webhook_handler import (
    WebhookEvent, 
    WebhookValidator, 
    WebhookRetryManager, 
    WebhookHandler
)
from app.models.file import File, FileStatus


class TestWebhookEvent:
    """Pruebas para la clase WebhookEvent"""
    
    def test_translation_event_detection(self):
        """Probar detección de eventos de traducción"""
        # Evento de traducción
        translation_data = {
            'EventType': 'extraction.finished',
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'test-urn',
            'Payload': {'Status': 'Success'}
        }
        
        event = WebhookEvent(translation_data)
        assert event.is_translation_event is True
        assert event.translation_status == 'ready'
        
        # Evento de traducción con derivative
        derivative_data = {
            'EventType': 'derivative.complete',
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'test-urn',
            'Payload': {'Status': 'Complete'}
        }
        
        event2 = WebhookEvent(derivative_data)
        assert event2.is_translation_event is True
        assert event2.translation_status == 'ready'
        
        # Evento no de traducción
        other_data = {
            'EventType': 'file.uploaded',
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'test-urn',
            'Payload': {}
        }
        
        event3 = WebhookEvent(other_data)
        assert event3.is_translation_event is False
        assert event3.translation_status is None
    
    def test_translation_status_mapping(self):
        """Probar mapeo de estados de traducción"""
        test_cases = [
            ('success', 'ready'),
            ('complete', 'ready'),
            ('failed', 'error'),
            ('timeout', 'error'),
            ('inprogress', 'translating'),
            ('unknown_status', 'translating')
        ]
        
        for aps_status, expected_status in test_cases:
            event_data = {
                'EventType': 'extraction.finished',
                'TimeStamp': '2024-01-01T00:00:00Z',
                'ResourceURN': 'test-urn',
                'Payload': {'Status': aps_status}
            }
            
            event = WebhookEvent(event_data)
            assert event.translation_status == expected_status
    
    def test_progress_percentage(self):
        """Probar obtención de porcentaje de progreso"""
        # Con progreso explícito
        event_data = {
            'EventType': 'extraction.progress',
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'test-urn',
            'Payload': {'Progress': '75%'}
        }
        
        event = WebhookEvent(event_data)
        assert event.progress_percentage == '75%'
        
        # Sin progreso, estado completado
        event_data['Payload'] = {'Status': 'success'}
        event = WebhookEvent(event_data)
        assert event.progress_percentage == '100%'
        
        # Sin progreso, estado error
        event_data['Payload'] = {'Status': 'failed'}
        event = WebhookEvent(event_data)
        assert event.progress_percentage == '0%'
    
    def test_to_dict(self):
        """Probar serialización a diccionario"""
        event_data = {
            'EventType': 'extraction.finished',
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'test-urn',
            'Payload': {'Status': 'Success', 'Progress': '100%'}
        }
        
        event = WebhookEvent(event_data)
        result = event.to_dict()
        
        assert result['event_type'] == 'extraction.finished'
        assert result['resource_urn'] == 'test-urn'
        assert result['translation_status'] == 'ready'
        assert result['progress_percentage'] == '100%'
        assert 'created_at' in result


class TestWebhookValidator:
    """Pruebas para WebhookValidator"""
    
    def test_validate_signature_success(self):
        """Probar validación exitosa de firma"""
        secret = "test_secret"
        validator = WebhookValidator(secret)
        
        request_body = b'{"test": "data"}'
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            request_body,
            hashlib.sha256
        ).hexdigest()
        
        assert validator.validate_signature(request_body, expected_signature) is True
    
    def test_validate_signature_failure(self):
        """Probar validación fallida de firma"""
        secret = "test_secret"
        validator = WebhookValidator(secret)
        
        request_body = b'{"test": "data"}'
        wrong_signature = "wrong_signature"
        
        assert validator.validate_signature(request_body, wrong_signature) is False
    
    def test_validate_event_structure_success(self):
        """Probar validación exitosa de estructura"""
        validator = WebhookValidator("secret")
        
        valid_event = {
            'EventType': 'extraction.finished',
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'test-urn'
        }
        
        assert validator.validate_event_structure(valid_event) is True
    
    def test_validate_event_structure_failure(self):
        """Probar validación fallida de estructura"""
        validator = WebhookValidator("secret")
        
        # Evento faltante EventType
        invalid_event = {
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'test-urn'
        }
        
        assert validator.validate_event_structure(invalid_event) is False
        
        # Evento faltante TimeStamp
        invalid_event2 = {
            'EventType': 'extraction.finished',
            'ResourceURN': 'test-urn'
        }
        
        assert validator.validate_event_structure(invalid_event2) is False


class TestWebhookRetryManager:
    """Pruebas para WebhookRetryManager"""
    
    @pytest.mark.asyncio
    async def test_process_with_retry_success_first_attempt(self):
        """Probar procesamiento exitoso en primer intento"""
        manager = WebhookRetryManager()
        
        # Mock función que tiene éxito
        mock_func = AsyncMock()
        
        await manager.process_with_retry("test_webhook", mock_func, "arg1", kwarg1="value1")
        
        # Debería llamarse solo una vez
        mock_func.assert_called_once_with("arg1", kwarg1="value1")
        assert "test_webhook" not in manager.failed_webhooks
    
    @pytest.mark.asyncio
    async def test_process_with_retry_success_after_retries(self):
        """Probar procesamiento exitoso después de reintentos"""
        manager = WebhookRetryManager()
        
        # Mock función que falla primero y luego tiene éxito
        mock_func = AsyncMock(side_effect=[Exception("Error 1"), Exception("Error 2"), None])
        
        await manager.process_with_retry("test_webhook", mock_func)
        
        # Debería llamarse 3 veces
        assert mock_func.call_count == 3
        assert "test_webhook" not in manager.failed_webhooks
    
    @pytest.mark.asyncio
    async def test_process_with_retry_final_failure(self):
        """Probar fallo final después de todos los reintentos"""
        manager = WebhookRetryManager()
        manager.max_retries = 2  # Reducir para test
        
        # Mock función que siempre falla
        mock_func = AsyncMock(side_effect=Exception("Persistent error"))
        
        with pytest.raises(Exception) as exc_info:
            await manager.process_with_retry("test_webhook", mock_func)
        
        assert "Persistent error" in str(exc_info.value)
        assert mock_func.call_count == 3  # Intento inicial + 2 reintentos
        assert "test_webhook" in manager.failed_webhooks
        assert manager.failed_webhooks["test_webhook"]["error"] == "Persistent error"


class TestWebhookHandler:
    """Pruebas para WebhookHandler"""
    
    @pytest.fixture
    def webhook_handler(self):
        """Fixture para WebhookHandler"""
        with patch('app.services.webhook_handler.settings') as mock_settings:
            mock_settings.WEBHOOK_SECRET = "test_secret"
            return WebhookHandler()
    
    @pytest.mark.asyncio
    async def test_handle_webhook_success(self, webhook_handler):
        """Probar manejo exitoso de webhook"""
        # Mock request
        mock_request = AsyncMock()
        mock_request.body.return_value = b'{"EventType":"test"}'
        mock_request.headers = {'X-Adsk-Signature': 'valid_signature'}
        
        # Mock validaciones
        webhook_handler.validator.validate_signature = Mock(return_value=True)
        webhook_handler.validator.validate_event_structure = Mock(return_value=True)
        
        # Mock procesamiento
        webhook_handler._process_webhook_event = AsyncMock()
        
        event_data = {
            'EventType': 'extraction.finished',
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'test-urn'
        }
        
        result = await webhook_handler.handle_webhook(mock_request, event_data)
        
        assert result['status'] == 'success'
        assert 'event_id' in result
        assert result['event_type'] == 'extraction.finished'
    
    @pytest.mark.asyncio
    async def test_handle_webhook_invalid_signature(self, webhook_handler):
        """Probar webhook con firma inválida"""
        # Mock request
        mock_request = AsyncMock()
        mock_request.body.return_value = b'{"EventType":"test"}'
        mock_request.headers = {'X-Adsk-Signature': 'invalid_signature'}
        
        # Mock validación fallida
        webhook_handler.validator.validate_signature = Mock(return_value=False)
        
        event_data = {'EventType': 'test'}
        
        with pytest.raises(Exception) as exc_info:
            await webhook_handler.handle_webhook(mock_request, event_data)
        
        assert "Firma de webhook inválida" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_handle_webhook_invalid_structure(self, webhook_handler):
        """Probar webhook con estructura inválida"""
        # Mock request
        mock_request = AsyncMock()
        mock_request.body.return_value = b'{"invalid":"data"}'
        mock_request.headers = {}
        
        # Mock validación de estructura fallida
        webhook_handler.validator.validate_event_structure = Mock(return_value=False)
        
        event_data = {'invalid': 'data'}
        
        with pytest.raises(Exception) as exc_info:
            await webhook_handler.handle_webhook(mock_request, event_data)
        
        assert "Estructura de evento inválida" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_handle_webhook_duplicate_event(self, webhook_handler):
        """Probar manejo de evento duplicado"""
        # Mock request
        mock_request = AsyncMock()
        mock_request.body.return_value = b'{"EventType":"test"}'
        mock_request.headers = {}
        
        # Mock validaciones exitosas
        webhook_handler.validator.validate_signature = Mock(return_value=True)
        webhook_handler.validator.validate_event_structure = Mock(return_value=True)
        
        event_data = {
            'EventType': 'extraction.finished',
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'test-urn'
        }
        
        # Simular evento ya procesado
        event_id = webhook_handler._generate_event_id(WebhookEvent(event_data))
        webhook_handler.processed_events[event_id] = {
            'status': 'completed',
            'started_at': datetime.utcnow()
        }
        
        result = await webhook_handler.handle_webhook(mock_request, event_data)
        
        assert result['status'] == 'duplicate'
        assert result['event_id'] == event_id
    
    @pytest.mark.asyncio
    async def test_handle_translation_event(self, webhook_handler):
        """Probar manejo de evento de traducción"""
        event_data = {
            'EventType': 'extraction.finished',
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'test-urn',
            'Payload': {'Status': 'Success'}
        }
        
        webhook_event = WebhookEvent(event_data)
        
        with patch('app.services.webhook_handler.SessionLocal') as mock_session_local:
            # Mock database session
            mock_db = Mock()
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            # Mock file query
            mock_file = File(
                id=1,
                urn='test-urn',
                status=FileStatus.TRANSLATING
            )
            mock_db.query.return_value.filter.return_value.first.return_value = mock_file
            
            # Mock notification
            webhook_handler._notify_file_status_change = AsyncMock()
            
            await webhook_handler._handle_translation_event(webhook_event)
            
            # Verificar que el archivo se actualizó
            assert mock_file.status == FileStatus.READY
            assert mock_file.translated_at is not None
            mock_db.commit.assert_called()
    
    @pytest.mark.asyncio
    async def test_handle_translation_event_file_not_found(self, webhook_handler):
        """Probar evento de traducción con archivo no encontrado"""
        event_data = {
            'EventType': 'extraction.finished',
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'nonexistent-urn',
            'Payload': {'Status': 'Success'}
        }
        
        webhook_event = WebhookEvent(event_data)
        
        with patch('app.services.webhook_handler.SessionLocal') as mock_session_local:
            # Mock database session
            mock_db = Mock()
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            # Mock file not found
            mock_db.query.return_value.filter.return_value.first.return_value = None
            
            # No debería fallar, solo registrar warning
            await webhook_handler._handle_translation_event(webhook_event)
            
            # No debería haber llamadas a commit
            mock_db.commit.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_get_webhook_status(self, webhook_handler):
        """Probar obtención de estado de webhooks"""
        # Agregar algunos eventos procesados
        webhook_handler.processed_events = {
            'event1': {'status': 'completed', 'started_at': datetime.utcnow()},
            'event2': {'status': 'processing', 'started_at': datetime.utcnow()},
        }
        
        webhook_handler.retry_manager.failed_webhooks = {
            'failed1': {'error': 'Test error', 'failed_at': datetime.utcnow(), 'attempts': 3}
        }
        
        status = await webhook_handler.get_webhook_status()
        
        assert status['status'] == 'active'
        assert 'statistics' in status
        assert status['statistics']['total_events'] == 2
        assert status['statistics']['completed_events'] == 1
        assert status['statistics']['processing_events'] == 1
        assert status['statistics']['failed_events'] == 1
        assert 'configuration' in status
    
    @pytest.mark.asyncio
    async def test_get_failed_webhooks(self, webhook_handler):
        """Probar obtención de webhooks fallidos"""
        # Agregar webhook fallido
        webhook_handler.retry_manager.failed_webhooks = {
            'failed1': {
                'error': 'Test error',
                'failed_at': datetime.utcnow(),
                'attempts': 3
            }
        }
        
        failed_list = await webhook_handler.get_failed_webhooks()
        
        assert len(failed_list) == 1
        assert failed_list[0]['webhook_id'] == 'failed1'
        assert failed_list[0]['error'] == 'Test error'
        assert failed_list[0]['attempts'] == 3
    
    @pytest.mark.asyncio
    async def test_retry_failed_webhook_success(self, webhook_handler):
        """Probar reintento exitoso de webhook fallido"""
        # Agregar webhook fallido
        webhook_handler.retry_manager.failed_webhooks['failed1'] = {
            'error': 'Test error',
            'failed_at': datetime.utcnow(),
            'attempts': 3
        }
        
        result = await webhook_handler.retry_failed_webhook('failed1')
        
        assert result is True
        assert 'failed1' not in webhook_handler.retry_manager.failed_webhooks
    
    @pytest.mark.asyncio
    async def test_retry_failed_webhook_not_found(self, webhook_handler):
        """Probar reintento de webhook no encontrado"""
        result = await webhook_handler.retry_failed_webhook('nonexistent')
        
        assert result is False
    
    def test_generate_event_id(self, webhook_handler):
        """Probar generación de ID de evento"""
        event_data = {
            'EventType': 'extraction.finished',
            'TimeStamp': '2024-01-01T00:00:00Z',
            'ResourceURN': 'test-urn'
        }
        
        webhook_event = WebhookEvent(event_data)
        
        event_id1 = webhook_handler._generate_event_id(webhook_event)
        event_id2 = webhook_handler._generate_event_id(webhook_event)
        
        # Mismo evento debería generar mismo ID
        assert event_id1 == event_id2
        assert len(event_id1) == 32  # MD5 hash length
        
        # Evento diferente debería generar ID diferente
        event_data2 = event_data.copy()
        event_data2['ResourceURN'] = 'different-urn'
        webhook_event2 = WebhookEvent(event_data2)
        
        event_id3 = webhook_handler._generate_event_id(webhook_event2)
        assert event_id1 != event_id3
