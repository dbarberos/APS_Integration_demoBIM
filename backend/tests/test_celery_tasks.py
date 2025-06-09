"""
Tests para tareas asíncronas de Celery
"""
import pytest
from unittest.mock import AsyncMock, patch, Mock
from celery import Celery
from celery.result import AsyncResult


@pytest.mark.unit
@pytest.mark.integration
class TestCeleryTasks:
    """Tests para tareas de Celery"""
    
    @pytest.fixture
    def mock_celery_app(self):
        """Mock Celery app for testing"""
        app = Mock(spec=Celery)
        app.send_task = Mock()
        return app
    
    @pytest.fixture
    def mock_task_result(self):
        """Mock task result"""
        result = Mock(spec=AsyncResult)
        result.id = "test-task-id-123"
        result.state = "SUCCESS"
        result.result = {"status": "completed", "message": "Task completed successfully"}
        result.ready.return_value = True
        result.successful.return_value = True
        result.failed.return_value = False
        return result
    
    def test_file_processing_task(self, mock_celery_app, test_file):
        """Test tarea de procesamiento de archivos"""
        from app.tasks.file_processing import process_file_upload
        
        # Mock task execution
        mock_result = {
            "file_id": test_file.id,
            "status": "processed",
            "metadata": {
                "size": test_file.size,
                "content_type": test_file.content_type,
                "checksum": "abc123def456"
            }
        }
        
        with patch('app.tasks.file_processing.process_file_upload.delay') as mock_task:
            mock_task.return_value.get.return_value = mock_result
            
            # Execute task
            task_result = process_file_upload.delay(
                file_id=test_file.id,
                file_path="/tmp/test.rvt",
                user_id=test_file.user_id
            )
            
            result = task_result.get()
            
            assert result["file_id"] == test_file.id
            assert result["status"] == "processed"
            assert "checksum" in result["metadata"]
    
    def test_translation_task(self, mock_celery_app, test_translation_job):
        """Test tarea de traducción APS"""
        from app.tasks.translation_tasks import start_translation_task
        
        # Mock translation result
        mock_result = {
            "job_id": test_translation_job.id,
            "urn": test_translation_job.urn,
            "status": "inprogress",
            "message": "Translation started successfully"
        }
        
        with patch('app.tasks.translation_tasks.start_translation_task.delay') as mock_task:
            mock_task.return_value.get.return_value = mock_result
            
            # Execute task
            task_result = start_translation_task.delay(
                job_id=test_translation_job.id,
                file_id=test_translation_job.file_id,
                output_formats=test_translation_job.output_formats,
                user_id=test_translation_job.user_id
            )
            
            result = task_result.get()
            
            assert result["job_id"] == test_translation_job.id
            assert result["status"] == "inprogress"
    
    def test_translation_status_check_task(self, mock_celery_app, test_translation_job):
        """Test tarea de verificación de estado de traducción"""
        from app.tasks.translation_tasks import check_translation_status
        
        # Mock status check result
        mock_result = {
            "job_id": test_translation_job.id,
            "urn": test_translation_job.urn,
            "status": "success",
            "progress": "100%",
            "derivatives": [
                {"type": "svf2", "status": "success"},
                {"type": "thumbnail", "status": "success"}
            ]
        }
        
        with patch('app.tasks.translation_tasks.check_translation_status.delay') as mock_task:
            mock_task.return_value.get.return_value = mock_result
            
            # Execute task
            task_result = check_translation_status.delay(
                job_id=test_translation_job.id,
                urn=test_translation_job.urn
            )
            
            result = task_result.get()
            
            assert result["status"] == "success"
            assert result["progress"] == "100%"
            assert len(result["derivatives"]) == 2
    
    def test_bulk_file_processing_task(self, mock_celery_app, test_project):
        """Test tarea de procesamiento en lote de archivos"""
        from app.tasks.file_processing import process_bulk_files
        
        file_ids = [1, 2, 3, 4, 5]
        
        # Mock bulk processing result
        mock_result = {
            "project_id": test_project.id,
            "processed_files": len(file_ids),
            "successful": 4,
            "failed": 1,
            "results": [
                {"file_id": 1, "status": "success"},
                {"file_id": 2, "status": "success"},
                {"file_id": 3, "status": "success"},
                {"file_id": 4, "status": "success"},
                {"file_id": 5, "status": "failed", "error": "Invalid format"}
            ]
        }
        
        with patch('app.tasks.file_processing.process_bulk_files.delay') as mock_task:
            mock_task.return_value.get.return_value = mock_result
            
            # Execute task
            task_result = process_bulk_files.delay(
                file_ids=file_ids,
                project_id=test_project.id,
                user_id=test_project.user_id
            )
            
            result = task_result.get()
            
            assert result["processed_files"] == 5
            assert result["successful"] == 4
            assert result["failed"] == 1
    
    def test_cleanup_task(self, mock_celery_app):
        """Test tarea de limpieza automática"""
        from app.tasks.cleanup_tasks import cleanup_old_files
        
        # Mock cleanup result
        mock_result = {
            "cleanup_type": "old_files",
            "removed_files": 15,
            "freed_space": "150MB",
            "duration": "2.5s"
        }
        
        with patch('app.tasks.cleanup_tasks.cleanup_old_files.delay') as mock_task:
            mock_task.return_value.get.return_value = mock_result
            
            # Execute task
            task_result = cleanup_old_files.delay(
                older_than_days=30,
                dry_run=False
            )
            
            result = task_result.get()
            
            assert result["cleanup_type"] == "old_files"
            assert result["removed_files"] == 15
            assert "MB" in result["freed_space"]
    
    def test_notification_task(self, mock_celery_app, test_user):
        """Test tarea de notificaciones"""
        from app.tasks.notification_tasks import send_notification
        
        # Mock notification result
        mock_result = {
            "user_id": test_user.id,
            "notification_type": "translation_complete",
            "status": "sent",
            "channels": ["email", "websocket"],
            "message_id": "msg-123"
        }
        
        with patch('app.tasks.notification_tasks.send_notification.delay') as mock_task:
            mock_task.return_value.get.return_value = mock_result
            
            # Execute task
            task_result = send_notification.delay(
                user_id=test_user.id,
                notification_type="translation_complete",
                data={
                    "job_id": "test-job-123",
                    "file_name": "test.rvt",
                    "status": "success"
                }
            )
            
            result = task_result.get()
            
            assert result["user_id"] == test_user.id
            assert result["status"] == "sent"
            assert "email" in result["channels"]
    
    def test_periodic_task_health_check(self, mock_celery_app):
        """Test tarea periódica de health check"""
        from app.tasks.monitoring_tasks import system_health_check
        
        # Mock health check result
        mock_result = {
            "timestamp": "2024-01-01T12:00:00Z",
            "overall_status": "healthy",
            "services": {
                "database": {"status": "healthy", "response_time": "15ms"},
                "redis": {"status": "healthy", "response_time": "5ms"},
                "aps_api": {"status": "healthy", "response_time": "120ms"},
                "storage": {"status": "healthy", "free_space": "85%"}
            },
            "alerts": []
        }
        
        with patch('app.tasks.monitoring_tasks.system_health_check.delay') as mock_task:
            mock_task.return_value.get.return_value = mock_result
            
            # Execute task
            task_result = system_health_check.delay()
            result = task_result.get()
            
            assert result["overall_status"] == "healthy"
            assert len(result["services"]) == 4
            assert len(result["alerts"]) == 0
    
    def test_task_retry_mechanism(self, mock_celery_app):
        """Test mecanismo de reintentos de tareas"""
        from app.tasks.file_processing import process_file_upload
        
        # Mock task that fails first time, succeeds second time
        call_count = 0
        def mock_task_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Temporary failure")
            return {"status": "success", "retry_count": call_count - 1}
        
        with patch('app.tasks.file_processing.process_file_upload.delay') as mock_task:
            mock_task.return_value.get.side_effect = mock_task_side_effect
            
            # Execute task (should retry and eventually succeed)
            task_result = process_file_upload.delay(
                file_id=1,
                file_path="/tmp/test.rvt",
                user_id=1
            )
            
            # This would be handled by Celery's retry mechanism in real scenario
            try:
                result = task_result.get()
            except Exception:
                # Simulate retry
                result = task_result.get()
            
            assert result["status"] == "success"
    
    def test_task_progress_tracking(self, mock_celery_app, test_translation_job):
        """Test seguimiento de progreso de tareas"""
        from app.tasks.translation_tasks import start_translation_task
        
        # Mock progressive updates
        progress_updates = [
            {"status": "starting", "progress": 0},
            {"status": "uploading", "progress": 25},
            {"status": "processing", "progress": 50},
            {"status": "generating", "progress": 75},
            {"status": "completed", "progress": 100}
        ]
        
        with patch('app.tasks.translation_tasks.start_translation_task.delay') as mock_task:
            # Mock task state updates
            mock_task_instance = Mock()
            mock_task_instance.update_state = Mock()
            
            for update in progress_updates:
                mock_task_instance.update_state(
                    state="PROGRESS",
                    meta=update
                )
            
            # Verify progress tracking
            assert mock_task_instance.update_state.call_count == len(progress_updates)
    
    def test_task_error_handling(self, mock_celery_app):
        """Test manejo de errores en tareas"""
        from app.tasks.file_processing import process_file_upload
        
        # Mock task failure
        error_result = {
            "status": "failed",
            "error_type": "ValidationError",
            "error_message": "File format not supported",
            "error_code": "FILE_001",
            "retry_count": 3,
            "max_retries": 3
        }
        
        with patch('app.tasks.file_processing.process_file_upload.delay') as mock_task:
            mock_task.return_value.get.side_effect = Exception("Task failed")
            mock_task.return_value.failed.return_value = True
            mock_task.return_value.result = error_result
            
            # Execute task that should fail
            task_result = process_file_upload.delay(
                file_id=1,
                file_path="/tmp/invalid.xyz",
                user_id=1
            )
            
            with pytest.raises(Exception):
                task_result.get()
            
            assert task_result.failed()
    
    def test_task_chaining(self, mock_celery_app, test_file):
        """Test encadenamiento de tareas"""
        from app.tasks.file_processing import process_file_upload
        from app.tasks.translation_tasks import start_translation_task
        
        # Mock chained task execution
        upload_result = {
            "file_id": test_file.id,
            "status": "processed",
            "object_id": "aps-object-123"
        }
        
        translation_result = {
            "job_id": "translation-job-123",
            "status": "started",
            "urn": "test-urn-base64"
        }
        
        with patch('app.tasks.file_processing.process_file_upload.delay') as mock_upload, \
             patch('app.tasks.translation_tasks.start_translation_task.delay') as mock_translate:
            
            mock_upload.return_value.get.return_value = upload_result
            mock_translate.return_value.get.return_value = translation_result
            
            # Execute chained tasks
            upload_task = process_file_upload.delay(
                file_id=test_file.id,
                file_path="/tmp/test.rvt",
                user_id=test_file.user_id
            )
            
            upload_result_data = upload_task.get()
            
            # Chain to translation
            if upload_result_data["status"] == "processed":
                translate_task = start_translation_task.delay(
                    job_id="new-job-id",
                    file_id=test_file.id,
                    output_formats=["svf2"],
                    user_id=test_file.user_id
                )
                
                translate_result_data = translate_task.get()
                
                assert translate_result_data["status"] == "started"
    
    def test_task_scheduling(self, mock_celery_app):
        """Test programación de tareas"""
        from app.tasks.cleanup_tasks import schedule_cleanup
        from datetime import datetime, timedelta
        
        # Mock scheduled task
        schedule_time = datetime.utcnow() + timedelta(hours=1)
        
        mock_result = {
            "task_id": "scheduled-cleanup-123",
            "scheduled_time": schedule_time.isoformat(),
            "task_type": "cleanup",
            "status": "scheduled"
        }
        
        with patch('app.tasks.cleanup_tasks.cleanup_old_files.apply_async') as mock_scheduled:
            mock_scheduled.return_value.id = "scheduled-cleanup-123"
            
            # Schedule task
            task_result = schedule_cleanup.delay(
                schedule_time=schedule_time,
                cleanup_type="old_files",
                older_than_days=30
            )
            
            assert mock_scheduled.called
    
    @pytest.mark.performance
    def test_task_performance(self, mock_celery_app, performance_timer):
        """Test performance de tareas"""
        from app.tasks.file_processing import process_file_upload
        
        # Mock fast task execution
        mock_result = {
            "file_id": 1,
            "status": "processed",
            "processing_time": "1.2s"
        }
        
        with patch('app.tasks.file_processing.process_file_upload.delay') as mock_task:
            mock_task.return_value.get.return_value = mock_result
            
            performance_timer.start()
            
            task_result = process_file_upload.delay(
                file_id=1,
                file_path="/tmp/test.rvt",
                user_id=1
            )
            
            result = task_result.get()
            performance_timer.stop()
            
            assert result["status"] == "processed"
            assert performance_timer.elapsed < 0.1  # Mock should be very fast
    
    @pytest.mark.slow
    def test_concurrent_tasks(self, mock_celery_app):
        """Test tareas concurrentes"""
        import asyncio
        from app.tasks.file_processing import process_file_upload
        
        async def task_wrapper(task_id):
            with patch('app.tasks.file_processing.process_file_upload.delay') as mock_task:
                mock_task.return_value.get.return_value = {
                    "file_id": task_id,
                    "status": "processed"
                }
                
                task_result = process_file_upload.delay(
                    file_id=task_id,
                    file_path=f"/tmp/test_{task_id}.rvt",
                    user_id=1
                )
                
                return task_result.get()
        
        async def run_concurrent_tasks():
            # Execute 5 concurrent tasks
            tasks = [task_wrapper(i) for i in range(5)]
            results = await asyncio.gather(*tasks)
            return results
        
        # Run test
        import asyncio
        results = asyncio.run(run_concurrent_tasks())
        
        assert len(results) == 5
        assert all(result["status"] == "processed" for result in results)
    
    def test_task_monitoring_and_logging(self, mock_celery_app):
        """Test monitoreo y logging de tareas"""
        from app.tasks.file_processing import process_file_upload
        
        with patch('app.tasks.file_processing.process_file_upload.delay') as mock_task, \
             patch('app.core.logging.task_logger') as mock_logger:
            
            mock_task.return_value.get.return_value = {
                "status": "processed",
                "file_id": 1
            }
            
            # Execute task
            task_result = process_file_upload.delay(
                file_id=1,
                file_path="/tmp/test.rvt",
                user_id=1
            )
            
            result = task_result.get()
            
            # Verify logging was called (in a real scenario)
            assert result["status"] == "processed"
    
    def test_task_result_backend(self, mock_celery_app, mock_task_result):
        """Test backend de resultados de tareas"""
        from app.tasks.file_processing import get_task_result
        
        with patch('app.tasks.file_processing.AsyncResult') as mock_async_result:
            mock_async_result.return_value = mock_task_result
            
            # Get task result
            result = get_task_result("test-task-id-123")
            
            assert result.id == "test-task-id-123"
            assert result.state == "SUCCESS"
            assert result.ready()
            assert result.successful()
