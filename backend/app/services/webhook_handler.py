"""
Sistema de webhooks para notificaciones APS
"""
import hashlib
import hmac
import json
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import asyncio
import structlog
from fastapi import HTTPException, status, Request
from sqlalchemy.orm import Session

from app.models.file import File, FileStatus
from app.core.database import SessionLocal
from app.core.config import settings

logger = structlog.get_logger()


class WebhookEvent:
    """Clase para eventos de webhook"""
    
    def __init__(self, event_data: Dict):
        self.event_data = event_data
        self.event_type = event_data.get('EventType', '')
        self.timestamp = event_data.get('TimeStamp', '')
        self.resource_urn = event_data.get('ResourceURN', '')
        self.payload = event_data.get('Payload', {})
        self.created_at = datetime.utcnow()
    
    @property
    def is_translation_event(self) -> bool:
        """Verificar si es evento de traducción"""
        return 'extraction' in self.event_type.lower() or 'derivative' in self.event_type.lower()
    
    @property
    def translation_status(self) -> Optional[str]:
        """Obtener estado de traducción del evento"""
        if not self.is_translation_event:
            return None
        
        status_map = {
            'success': 'ready',
            'complete': 'ready',
            'failed': 'error',
            'timeout': 'error',
            'inprogress': 'translating'
        }
        
        payload_status = self.payload.get('Status', '').lower()
        return status_map.get(payload_status, 'translating')
    
    @property
    def progress_percentage(self) -> Optional[str]:
        """Obtener porcentaje de progreso"""
        progress = self.payload.get('Progress', '')
        if progress:
            return progress
        
        # Calcular progreso basado en estado
        if self.translation_status == 'ready':
            return '100%'
        elif self.translation_status == 'error':
            return '0%'
        else:
            return '50%'  # Estado intermedio
    
    def to_dict(self) -> Dict:
        """Convertir a diccionario"""
        return {
            'event_type': self.event_type,
            'timestamp': self.timestamp,
            'resource_urn': self.resource_urn,
            'payload': self.payload,
            'translation_status': self.translation_status,
            'progress_percentage': self.progress_percentage,
            'created_at': self.created_at.isoformat()
        }


class WebhookValidator:
    """Validador de webhooks APS"""
    
    def __init__(self, webhook_secret: str):
        self.webhook_secret = webhook_secret
    
    def validate_signature(self, request_body: bytes, signature: str) -> bool:
        """Validar firma del webhook"""
        try:
            # APS usa HMAC-SHA256 para firmar webhooks
            expected_signature = hmac.new(
                self.webhook_secret.encode('utf-8'),
                request_body,
                hashlib.sha256
            ).hexdigest()
            
            # Comparar firmas (time-safe comparison)
            return hmac.compare_digest(signature, expected_signature)
            
        except Exception as e:
            logger.error("Error al validar firma de webhook", error=str(e))
            return False
    
    def validate_event_structure(self, event_data: Dict) -> bool:
        """Validar estructura del evento"""
        required_fields = ['EventType', 'TimeStamp', 'ResourceURN']
        
        for field in required_fields:
            if field not in event_data:
                logger.warning("Campo requerido faltante en webhook",
                             field=field, event_data=event_data)
                return False
        
        return True


class WebhookRetryManager:
    """Gestor de reintentos para webhooks"""
    
    def __init__(self):
        self.max_retries = 3
        self.retry_delays = [1, 5, 15]  # Segundos
        self.failed_webhooks = {}
    
    async def process_with_retry(
        self,
        webhook_id: str,
        process_func,
        *args,
        **kwargs
    ):
        """Procesar webhook con reintentos"""
        for attempt in range(self.max_retries + 1):
            try:
                await process_func(*args, **kwargs)
                
                # Si llega aquí, fue exitoso
                if webhook_id in self.failed_webhooks:
                    del self.failed_webhooks[webhook_id]
                
                logger.info("Webhook procesado exitosamente",
                           webhook_id=webhook_id,
                           attempt=attempt + 1)
                return
                
            except Exception as e:
                logger.warning("Error al procesar webhook",
                             webhook_id=webhook_id,
                             attempt=attempt + 1,
                             error=str(e))
                
                if attempt < self.max_retries:
                    delay = self.retry_delays[attempt]
                    logger.info("Reintentando webhook",
                               webhook_id=webhook_id,
                               delay=delay)
                    await asyncio.sleep(delay)
                else:
                    # Máximo de reintentos alcanzado
                    self.failed_webhooks[webhook_id] = {
                        'error': str(e),
                        'failed_at': datetime.utcnow(),
                        'attempts': attempt + 1
                    }
                    logger.error("Webhook falló después de todos los reintentos",
                               webhook_id=webhook_id,
                               final_error=str(e))
                    raise


class WebhookHandler:
    """Manejador principal de webhooks"""
    
    def __init__(self):
        self.validator = WebhookValidator(settings.WEBHOOK_SECRET)
        self.retry_manager = WebhookRetryManager()
        self.processed_events = {}  # Cache para evitar duplicados
    
    async def handle_webhook(
        self,
        request: Request,
        event_data: Dict
    ) -> Dict[str, any]:
        """
        Manejar webhook entrante
        
        Args:
            request: Request de FastAPI
            event_data: Datos del evento
            
        Returns:
            Dict con resultado del procesamiento
        """
        try:
            # 1. Obtener cuerpo y firma del request
            request_body = await request.body()
            signature = request.headers.get('X-Adsk-Signature', '')
            
            # 2. Validar firma si está configurada
            if settings.WEBHOOK_SECRET and signature:
                if not self.validator.validate_signature(request_body, signature):
                    logger.warning("Firma de webhook inválida",
                                 signature=signature[:10] + "...")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Firma de webhook inválida"
                    )
            
            # 3. Validar estructura del evento
            if not self.validator.validate_event_structure(event_data):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Estructura de evento inválida"
                )
            
            # 4. Crear objeto de evento
            webhook_event = WebhookEvent(event_data)
            event_id = self._generate_event_id(webhook_event)
            
            # 5. Verificar duplicados
            if event_id in self.processed_events:
                logger.info("Evento webhook duplicado ignorado", event_id=event_id)
                return {"status": "duplicate", "event_id": event_id}
            
            # 6. Marcar como procesándose
            self.processed_events[event_id] = {
                'status': 'processing',
                'started_at': datetime.utcnow()
            }
            
            # 7. Procesar evento con reintentos
            await self.retry_manager.process_with_retry(
                event_id,
                self._process_webhook_event,
                webhook_event
            )
            
            # 8. Marcar como completado
            self.processed_events[event_id]['status'] = 'completed'
            self.processed_events[event_id]['completed_at'] = datetime.utcnow()
            
            logger.info("Webhook procesado exitosamente",
                       event_id=event_id,
                       event_type=webhook_event.event_type)
            
            return {
                "status": "success",
                "event_id": event_id,
                "event_type": webhook_event.event_type,
                "processed_at": datetime.utcnow().isoformat()
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error al manejar webhook", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al procesar webhook: {str(e)}"
            )
    
    async def _process_webhook_event(self, webhook_event: WebhookEvent):
        """Procesar evento específico"""
        try:
            if webhook_event.is_translation_event:
                await self._handle_translation_event(webhook_event)
            else:
                logger.info("Tipo de evento no manejado",
                           event_type=webhook_event.event_type)
            
        except Exception as e:
            logger.error("Error al procesar evento webhook",
                        event_type=webhook_event.event_type,
                        error=str(e))
            raise
    
    async def _handle_translation_event(self, webhook_event: WebhookEvent):
        """Manejar evento de traducción"""
        try:
            resource_urn = webhook_event.resource_urn
            translation_status = webhook_event.translation_status
            progress = webhook_event.progress_percentage
            
            if not resource_urn:
                logger.warning("URN faltante en evento de traducción")
                return
            
            # Obtener archivo de base de datos
            db = SessionLocal()
            try:
                db_file = db.query(File).filter(File.urn == resource_urn).first()
                
                if not db_file:
                    logger.warning("Archivo no encontrado para URN",
                                 urn=resource_urn)
                    return
                
                # Actualizar estado del archivo
                old_status = db_file.status
                
                if translation_status == 'ready':
                    db_file.status = FileStatus.READY
                    db_file.translated_at = datetime.utcnow()
                    db_file.translation_error = None
                elif translation_status == 'error':
                    db_file.status = FileStatus.ERROR
                    error_message = webhook_event.payload.get('ErrorMessage', 'Error de traducción')
                    db_file.translation_error = error_message
                elif translation_status == 'translating':
                    db_file.status = FileStatus.TRANSLATING
                
                # Actualizar progreso
                if progress:
                    db_file.translation_progress = progress
                
                # Actualizar metadatos con información del webhook
                metadata = db_file.metadata or {}
                metadata['last_webhook_event'] = webhook_event.to_dict()
                db_file.metadata = metadata
                
                db.commit()
                
                logger.info("Estado de archivo actualizado por webhook",
                           file_id=db_file.id,
                           old_status=old_status,
                           new_status=db_file.status,
                           progress=progress)
                
                # Notificar cambio en tiempo real
                await self._notify_file_status_change(db_file)
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error("Error al manejar evento de traducción", error=str(e))
            raise
    
    async def _notify_file_status_change(self, db_file: File):
        """Notificar cambio de estado en tiempo real"""
        try:
            # TODO: Implementar notificación real via WebSocket
            notification_data = {
                'type': 'file_status_change',
                'file_id': db_file.id,
                'status': db_file.status,
                'progress': db_file.translation_progress,
                'project_id': db_file.project_id,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            logger.info("Notificación de cambio de estado enviada",
                       file_id=db_file.id,
                       status=db_file.status)
            
            # Aquí se integraría con WebSocket, Redis pub/sub, etc.
            
        except Exception as e:
            logger.error("Error al enviar notificación", error=str(e))
    
    def _generate_event_id(self, webhook_event: WebhookEvent) -> str:
        """Generar ID único para evento"""
        # Combinar tipo, timestamp y URN para crear ID único
        combined = f"{webhook_event.event_type}{webhook_event.timestamp}{webhook_event.resource_urn}"
        return hashlib.md5(combined.encode()).hexdigest()
    
    async def get_webhook_status(self) -> Dict[str, any]:
        """Obtener estado del sistema de webhooks"""
        now = datetime.utcnow()
        
        # Estadísticas de eventos procesados
        total_events = len(self.processed_events)
        completed_events = sum(1 for event in self.processed_events.values() 
                             if event['status'] == 'completed')
        processing_events = sum(1 for event in self.processed_events.values() 
                              if event['status'] == 'processing')
        
        # Eventos fallidos
        failed_events = len(self.retry_manager.failed_webhooks)
        
        # Limpiar eventos antiguos (más de 1 hora)
        cutoff_time = now - timedelta(hours=1)
        old_events = [event_id for event_id, event_data in self.processed_events.items()
                     if event_data.get('completed_at', event_data.get('started_at', now)) < cutoff_time]
        
        for event_id in old_events:
            del self.processed_events[event_id]
        
        return {
            'status': 'active',
            'statistics': {
                'total_events': total_events,
                'completed_events': completed_events,
                'processing_events': processing_events,
                'failed_events': failed_events
            },
            'configuration': {
                'webhook_secret_configured': bool(settings.WEBHOOK_SECRET),
                'max_retries': self.retry_manager.max_retries,
                'retry_delays': self.retry_manager.retry_delays
            },
            'last_cleanup': now.isoformat()
        }
    
    async def get_failed_webhooks(self) -> List[Dict]:
        """Obtener lista de webhooks fallidos"""
        failed_list = []
        
        for webhook_id, failure_data in self.retry_manager.failed_webhooks.items():
            failed_list.append({
                'webhook_id': webhook_id,
                'error': failure_data['error'],
                'failed_at': failure_data['failed_at'].isoformat(),
                'attempts': failure_data['attempts']
            })
        
        return failed_list
    
    async def retry_failed_webhook(self, webhook_id: str) -> bool:
        """Reintentar webhook fallido manualmente"""
        if webhook_id not in self.retry_manager.failed_webhooks:
            return False
        
        try:
            # Eliminar de lista de fallidos para permitir reintento
            del self.retry_manager.failed_webhooks[webhook_id]
            
            logger.info("Webhook marcado para reintento manual", webhook_id=webhook_id)
            return True
            
        except Exception as e:
            logger.error("Error al reintentar webhook", webhook_id=webhook_id, error=str(e))
            return False


# Instancia global del manejador de webhooks
webhook_handler = WebhookHandler()
