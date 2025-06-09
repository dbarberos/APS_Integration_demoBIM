"""
Pruebas unitarias para las tareas de procesamiento de archivos
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta

from app.tasks.file_processing import FileProcessingTasks
from app.models.file import File, FileStatus
from app.models.file_metadata import FileProcessingJob, FileThumbnail, FileMetadataExtended


class TestFileProcessingTasks:
    """Pruebas para FileProcessingTasks"""
    
    @pytest.fixture
    def processing_tasks(self):
        """Fixture para FileProcessingTasks"""
        with patch('app.tasks.file_processing.APSAuthService'), \
             patch('app.tasks.file_processing.APSService'):
            return FileProcessingTasks()
    
    @pytest.fixture
    def mock_db(self):
        """Mock de sesión de base de datos"""
        return Mock()
    
    @pytest.fixture
    def mock_file(self):
        """Mock de archivo"""
        file = File(
            id=1,
            name="test.rvt",
            urn="test-urn",
            status=FileStatus.UPLOADED
        )
        return file
    
    @pytest.mark.asyncio
    async def test_translate_file_success(self, processing_tasks, mock_db, mock_file):
        """Probar traducción exitosa de archivo"""
        # Setup mocks
        with patch('app.tasks.file_processing.SessionLocal') as mock_session_local:
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            # Mock file query
            mock_db.query.return_value.filter.return_value.first.return_value = mock_file
            
            # Mock job creation
            mock_job = FileProcessingJob(id=1, file_id=1, job_type="translation")
            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock(side_effect=lambda obj: setattr(obj, 'id', 1))
            
            # Mock APS translation
            processing_tasks.aps_service.translate_model = AsyncMock(return_value={
                'urn': 'translation-job-urn',
                'status': 'accepted'
            })
            
            # Mock monitoring
            processing_tasks._monitor_translation_progress = AsyncMock()
            
            # Execute
            result = await processing_tasks.translate_file(
                file_id=1,
                translation_params={'output_formats': ['svf2']}
            )
            
            # Verify
            assert result['status'] == 'started'
            assert 'job_id' in result
            assert 'aps_job_id' in result
            
            # Verify file status updated
            assert mock_file.status == FileStatus.TRANSLATING
            assert mock_file.translation_progress == "0%"
            
            # Verify APS service called
            processing_tasks.aps_service.translate_model.assert_called_once_with(
                urn="test-urn",
                output_formats=['svf2']
            )
    
    @pytest.mark.asyncio
    async def test_translate_file_not_found(self, processing_tasks):
        """Probar traducción con archivo no encontrado"""
        with patch('app.tasks.file_processing.SessionLocal') as mock_session_local:
            mock_db = Mock()
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            # Mock file not found
            mock_db.query.return_value.filter.return_value.first.return_value = None
            
            # Execute and expect exception
            with pytest.raises(Exception) as exc_info:
                await processing_tasks.translate_file(file_id=999)
            
            assert "Archivo 999 no encontrado" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_translate_file_no_urn(self, processing_tasks, mock_file):
        """Probar traducción con archivo sin URN"""
        mock_file.urn = None
        
        with patch('app.tasks.file_processing.SessionLocal') as mock_session_local:
            mock_db = Mock()
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            mock_db.query.return_value.filter.return_value.first.return_value = mock_file
            
            # Execute and expect exception
            with pytest.raises(Exception) as exc_info:
                await processing_tasks.translate_file(file_id=1)
            
            assert "no tiene URN válido" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_monitor_translation_progress_success(self, processing_tasks):
        """Probar monitoreo exitoso de progreso de traducción"""
        with patch('app.tasks.file_processing.SessionLocal') as mock_session_local:
            mock_db = Mock()
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            # Mock job and file
            mock_job = FileProcessingJob(id=1, job_id="aps-job-123")
            mock_file = File(id=1, status=FileStatus.TRANSLATING)
            
            mock_db.query.side_effect = [
                Mock(filter=Mock(return_value=Mock(first=Mock(return_value=mock_job)))),
                Mock(filter=Mock(return_value=Mock(first=Mock(return_value=mock_file))))
            ]
            
            # Mock successful translation
            processing_tasks.aps_service.get_translation_status = AsyncMock(return_value={
                'status': 'success',
                'progress': '100%'
            })
            
            # Execute
            await processing_tasks._monitor_translation_progress(1, 1)
            
            # Verify final status
            assert mock_job.status == "completed"
            assert mock_file.status == FileStatus.READY
            assert mock_file.translated_at is not None
    
    @pytest.mark.asyncio
    async def test_monitor_translation_progress_failure(self, processing_tasks):
        """Probar monitoreo con fallo de traducción"""
        with patch('app.tasks.file_processing.SessionLocal') as mock_session_local:
            mock_db = Mock()
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            # Mock job and file
            mock_job = FileProcessingJob(id=1, job_id="aps-job-123")
            mock_file = File(id=1, status=FileStatus.TRANSLATING)
            
            mock_db.query.side_effect = [
                Mock(filter=Mock(return_value=Mock(first=Mock(return_value=mock_job)))),
                Mock(filter=Mock(return_value=Mock(first=Mock(return_value=mock_file))))
            ]
            
            # Mock failed translation
            processing_tasks.aps_service.get_translation_status = AsyncMock(return_value={
                'status': 'failed',
                'errorMessage': 'Translation failed'
            })
            
            # Execute
            await processing_tasks._monitor_translation_progress(1, 1)
            
            # Verify error status
            assert mock_job.status == "failed"
            assert mock_job.error_message == "Translation failed"
            assert mock_file.status == FileStatus.ERROR
            assert mock_file.translation_error == "Translation failed"
    
    @pytest.mark.asyncio
    async def test_generate_thumbnails_success(self, processing_tasks, mock_file):
        """Probar generación exitosa de thumbnails"""
        mock_file.status = FileStatus.READY
        
        with patch('app.tasks.file_processing.SessionLocal') as mock_session_local:
            mock_db = Mock()
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            mock_db.query.return_value.filter.return_value.first.return_value = mock_file
            
            # Mock thumbnail generation
            processing_tasks._generate_single_thumbnail = AsyncMock(return_value={
                'thumbnail_id': 1,
                'size': 'small',
                'width': 200,
                'height': 200,
                'status': 'completed'
            })
            
            # Execute
            result = await processing_tasks.generate_thumbnails(
                file_id=1,
                thumbnail_sizes=['small', 'medium']
            )
            
            # Verify
            assert result['status'] == 'completed'
            assert 'thumbnails' in result
            assert 'small' in result['thumbnails']
            assert 'medium' in result['thumbnails']
            
            # Verify thumbnail generation called for each size
            assert processing_tasks._generate_single_thumbnail.call_count == 2
    
    @pytest.mark.asyncio
    async def test_generate_thumbnails_file_not_ready(self, processing_tasks, mock_file):
        """Probar generación de thumbnails con archivo no listo"""
        mock_file.status = FileStatus.UPLOADED  # No ready
        
        with patch('app.tasks.file_processing.SessionLocal') as mock_session_local:
            mock_db = Mock()
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            mock_db.query.return_value.filter.return_value.first.return_value = mock_file
            
            # Execute and expect exception
            with pytest.raises(Exception) as exc_info:
                await processing_tasks.generate_thumbnails(file_id=1)
            
            assert "no está listo para thumbnails" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_generate_single_thumbnail(self, processing_tasks, mock_file):
        """Probar generación de thumbnail individual"""
        with patch('app.tasks.file_processing.SessionLocal'):
            mock_db = Mock()
            
            # Mock APS thumbnail generation
            processing_tasks.aps_service.get_thumbnail = AsyncMock(return_value={
                'urn': 'thumbnail-urn',
                'data': b'thumbnail_data'
            })
            
            # Execute
            result = await processing_tasks._generate_single_thumbnail(
                mock_file, 'medium', mock_db
            )
            
            # Verify
            assert result['size'] == 'medium'
            assert result['width'] == 400
            assert result['height'] == 400
            assert result['status'] == 'completed'
            
            # Verify APS service called
            processing_tasks.aps_service.get_thumbnail.assert_called_once_with(
                urn=mock_file.urn,
                width=400,
                height=400
            )
    
    @pytest.mark.asyncio
    async def test_extract_metadata_success(self, processing_tasks, mock_file):
        """Probar extracción exitosa de metadatos"""
        with patch('app.tasks.file_processing.SessionLocal') as mock_session_local:
            mock_db = Mock()
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            mock_db.query.return_value.filter.return_value.first.return_value = mock_file
            
            # Mock metadata extraction
            processing_tasks.aps_service.get_metadata = AsyncMock(return_value={
                'data': {
                    'type': 'design',
                    'boundingBox': {'min': {'x': 0, 'y': 0, 'z': 0}, 'max': {'x': 10, 'y': 10, 'z': 10}},
                    'objectCount': 100,
                    'properties': {
                        'units': 'mm',
                        'discipline': 'Architecture',
                        'author': 'Test Author'
                    }
                }
            })
            
            # Mock metadata processing
            mock_metadata = FileMetadataExtended(id=1, file_id=1)
            mock_metadata.get_summary = Mock(return_value={'format': 'design', 'units': 'mm'})
            processing_tasks._process_metadata = AsyncMock(return_value=mock_metadata)
            
            # Execute
            result = await processing_tasks.extract_metadata(file_id=1)
            
            # Verify
            assert result['status'] == 'completed'
            assert 'metadata' in result
            
            # Verify APS service called
            processing_tasks.aps_service.get_metadata.assert_called_once_with(mock_file.urn)
    
    @pytest.mark.asyncio
    async def test_process_metadata(self, processing_tasks, mock_file):
        """Probar procesamiento de metadatos"""
        mock_db = Mock()
        
        # Mock metadata result
        metadata_result = {
            'data': {
                'type': 'design',
                'version': '2024.1',
                'boundingBox': {'min': {'x': 0, 'y': 0, 'z': 0}, 'max': {'x': 10, 'y': 10, 'z': 10}},
                'objectCount': 150,
                'properties': {
                    'units': 'mm',
                    'discipline': 'Architecture',
                    'category': 'Building',
                    'author': 'Test Author',
                    'organization': 'Test Org'
                },
                'materials': True,
                'textures': False,
                'lights': True,
                'tags': ['architecture', 'building'],
                'customProperties': {'projectPhase': 'design'}
            }
        }
        
        # Mock existing metadata query
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Execute
        result = await processing_tasks._process_metadata(metadata_result, mock_file, mock_db)
        
        # Verify metadata object created
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        
        # Verify metadata object populated (the actual object is passed to add)
        metadata_obj = mock_db.add.call_args[0][0]
        assert isinstance(metadata_obj, FileMetadataExtended)
        assert metadata_obj.file_id == mock_file.id
        assert metadata_obj.original_format == 'design'
        assert metadata_obj.software_version == '2024.1'
        assert metadata_obj.element_count == 150
        assert metadata_obj.units == 'mm'
        assert metadata_obj.discipline == 'Architecture'
        assert metadata_obj.category == 'Building'
        assert metadata_obj.original_author == 'Test Author'
        assert metadata_obj.organization == 'Test Org'
        assert metadata_obj.has_materials is True
        assert metadata_obj.has_textures is False
        assert metadata_obj.has_lighting is True
        assert metadata_obj.tags == ['architecture', 'building']
        assert metadata_obj.custom_properties == {'projectPhase': 'design'}
    
    def test_parse_progress_percentage(self, processing_tasks):
        """Probar parseo de porcentaje de progreso"""
        # Casos válidos
        assert processing_tasks._parse_progress_percentage("75%") == 75.0
        assert processing_tasks._parse_progress_percentage("100%") == 100.0
        assert processing_tasks._parse_progress_percentage("0%") == 0.0
        
        # Casos inválidos
        assert processing_tasks._parse_progress_percentage("invalid") == 0.0
        assert processing_tasks._parse_progress_percentage(None) == 0.0
        assert processing_tasks._parse_progress_percentage("") == 0.0
    
    @pytest.mark.asyncio
    async def test_cleanup_failed_jobs(self, processing_tasks):
        """Probar limpieza de jobs fallidos"""
        with patch('app.tasks.file_processing.SessionLocal') as mock_session_local:
            mock_db = Mock()
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            # Mock failed jobs
            old_time = datetime.utcnow() - timedelta(hours=25)
            failed_jobs = [
                FileProcessingJob(id=1, status="failed", created_at=old_time),
                FileProcessingJob(id=2, status="timeout", created_at=old_time)
            ]
            
            mock_db.query.return_value.filter.return_value.all.return_value = failed_jobs
            
            # Execute
            result = await processing_tasks.cleanup_failed_jobs(max_age_hours=24)
            
            # Verify
            assert result['deleted_jobs'] == 2
            
            # Verify deletion
            for job in failed_jobs:
                mock_db.delete.assert_any_call(job)
            
            mock_db.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_processing_statistics(self, processing_tasks):
        """Probar obtención de estadísticas de procesamiento"""
        with patch('app.tasks.file_processing.SessionLocal') as mock_session_local:
            mock_db = Mock()
            mock_session_local.return_value.__enter__.return_value = mock_db
            mock_session_local.return_value.__exit__.return_value = None
            
            # Mock statistics queries
            mock_db.query.return_value.count.return_value = 100  # total jobs
            mock_db.query.return_value.filter.return_value.count.side_effect = [
                5,   # pending
                10,  # processing
                80,  # completed
                5,   # failed
                15   # recent
            ]
            
            # Mock job types
            mock_db.query.return_value.group_by.return_value.all.return_value = [
                ('translation', 60),
                ('thumbnail_generation', 25),
                ('metadata_extraction', 15)
            ]
            
            # Execute
            result = await processing_tasks.get_processing_statistics()
            
            # Verify
            assert result['total_jobs'] == 100
            assert result['by_status']['pending'] == 5
            assert result['by_status']['processing'] == 10
            assert result['by_status']['completed'] == 80
            assert result['by_status']['failed'] == 5
            assert result['by_type']['translation'] == 60
            assert result['by_type']['thumbnail_generation'] == 25
            assert result['by_type']['metadata_extraction'] == 15
            assert result['recent_jobs_last_hour'] == 15
            assert result['success_rate'] == 80.0  # 80/100 * 100
