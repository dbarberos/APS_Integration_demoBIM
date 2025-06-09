"""
Pruebas unitarias para el gestor de archivos
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from fastapi import UploadFile
from sqlalchemy.orm import Session
import io

from app.services.file_manager import FileManager, FileUploadProgress
from app.models.file import File, FileStatus
from app.models.project import Project
from app.models.user import User


class TestFileUploadProgress:
    """Pruebas para la clase FileUploadProgress"""
    
    def test_progress_percentage(self):
        """Probar cálculo de porcentaje de progreso"""
        progress = FileUploadProgress("test_id", 1000)
        
        # Sin progreso
        assert progress.progress_percentage == 0.0
        
        # 50% de progreso
        progress.update_progress(500)
        assert progress.progress_percentage == 50.0
        
        # 100% de progreso
        progress.update_progress(1000)
        assert progress.progress_percentage == 100.0
    
    def test_upload_speed_calculation(self):
        """Probar cálculo de velocidad de upload"""
        progress = FileUploadProgress("test_id", 1024 * 1024)  # 1MB
        
        # Simular tiempo transcurrido
        import time
        start_time = progress.start_time
        progress.start_time = start_time.replace(second=start_time.second - 1)  # 1 segundo atrás
        
        progress.update_progress(512 * 1024)  # 512KB uploaded
        
        # Debería tener velocidad > 0
        assert progress.upload_speed_mbps >= 0
    
    def test_to_dict(self):
        """Probar serialización a diccionario"""
        progress = FileUploadProgress("test_id", 1000)
        progress.update_progress(250, 2)
        progress.total_parts = 4
        
        result = progress.to_dict()
        
        assert result['file_id'] == "test_id"
        assert result['total_size'] == 1000
        assert result['uploaded_bytes'] == 250
        assert result['progress_percentage'] == 25.0
        assert result['current_part'] == 2
        assert result['total_parts'] == 4
        assert result['status'] == "uploading"


class TestFileManager:
    """Pruebas para el FileManager"""
    
    @pytest.fixture
    def file_manager(self):
        """Fixture para FileManager"""
        with patch('app.services.file_manager.APSAuthService'), \
             patch('app.services.file_manager.APSStorageAdvanced'), \
             patch('app.services.file_manager.APSService'):
            return FileManager()
    
    @pytest.fixture
    def mock_db(self):
        """Mock de sesión de base de datos"""
        db = Mock(spec=Session)
        return db
    
    @pytest.fixture
    def mock_user(self):
        """Mock de usuario"""
        user = User(
            id=1,
            email="test@example.com",
            hashed_password="hashed",
            is_active=True
        )
        return user
    
    @pytest.fixture
    def mock_project(self):
        """Mock de proyecto"""
        project = Project(
            id=1,
            name="Test Project",
            bucket_key="test-bucket",
            user_id=1
        )
        return project
    
    @pytest.fixture
    def mock_upload_file(self):
        """Mock de archivo de upload"""
        file_content = b"test file content"
        file = Mock(spec=UploadFile)
        file.filename = "test.rvt"
        file.content_type = "application/octet-stream"
        file.read = AsyncMock(return_value=file_content)
        file.seek = AsyncMock()
        file.tell = AsyncMock(return_value=len(file_content))
        return file
    
    @pytest.mark.asyncio
    async def test_upload_file_success(self, file_manager, mock_db, mock_user, mock_project, mock_upload_file):
        """Probar upload exitoso de archivo"""
        # Setup mocks
        mock_db.query.return_value.filter.return_value.first.return_value = mock_project
        mock_db.add = Mock()
        mock_db.commit = Mock()
        mock_db.refresh = Mock()
        
        with patch('app.services.file_manager.file_validator') as mock_validator, \
             patch('app.services.file_manager.file_sanitizer') as mock_sanitizer:
            
            # Mock validation success
            mock_validator.validate_file = AsyncMock(return_value={
                'is_valid': True,
                'file_info': {
                    'filename': 'test.rvt',
                    'original_filename': 'test.rvt',
                    'size': 100,
                    'content_type': 'application/octet-stream',
                    'extension': '.rvt'
                },
                'errors': []
            })
            
            mock_sanitizer.generate_safe_object_name.return_value = "safe_test.rvt"
            mock_sanitizer.sanitize_metadata.return_value = {}
            
            # Mock APS upload
            file_manager.storage_service.upload_large_file = AsyncMock(return_value={
                'urn': 'test-urn',
                'object_key': 'safe_test.rvt',
                'bucket_key': 'test-bucket',
                'size': 100,
                'upload_type': 'simple'
            })
            
            # Execute upload
            result = await file_manager.upload_file(
                file=mock_upload_file,
                project_id=1,
                user_id=1,
                db=mock_db
            )
            
            # Verify result
            assert 'id' in result
            assert result['filename'] == 'test.rvt'
            assert result['urn'] == 'test-urn'
            assert result['status'] == FileStatus.UPLOADED
            
            # Verify database operations
            mock_db.add.assert_called()
            mock_db.commit.assert_called()
    
    @pytest.mark.asyncio
    async def test_upload_file_validation_error(self, file_manager, mock_db, mock_user, mock_project, mock_upload_file):
        """Probar upload con error de validación"""
        # Setup mocks
        mock_db.query.return_value.filter.return_value.first.return_value = mock_project
        
        with patch('app.services.file_manager.file_validator') as mock_validator:
            # Mock validation failure
            mock_validator.validate_file = AsyncMock(return_value={
                'is_valid': False,
                'errors': ['Archivo demasiado grande']
            })
            
            # Execute upload and expect exception
            with pytest.raises(Exception) as exc_info:
                await file_manager.upload_file(
                    file=mock_upload_file,
                    project_id=1,
                    user_id=1,
                    db=mock_db
                )
            
            assert "Validación de archivo falló" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_upload_file_project_not_found(self, file_manager, mock_db, mock_upload_file):
        """Probar upload con proyecto no encontrado"""
        # Setup mock para proyecto no encontrado
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Execute upload and expect exception
        with pytest.raises(Exception) as exc_info:
            await file_manager.upload_file(
                file=mock_upload_file,
                project_id=999,
                user_id=1,
                db=mock_db
            )
        
        assert "Proyecto no encontrado" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_get_file_details_success(self, file_manager, mock_db):
        """Probar obtención exitosa de detalles de archivo"""
        # Setup mock file
        mock_file = File(
            id=1,
            name="test.rvt",
            original_filename="test.rvt",
            urn="test-urn",
            size=1000,
            status=FileStatus.READY
        )
        mock_file.project = Project(id=1, name="Test Project")
        
        mock_db.query.return_value.join.return_value.filter.return_value.first.return_value = mock_file
        
        # Mock APS details
        file_manager.storage_service.get_object_details = AsyncMock(return_value={
            'size': 1000,
            'lastModified': '2024-01-01T00:00:00Z'
        })
        
        # Execute
        result = await file_manager.get_file_details(
            file_id=1,
            user_id=1,
            db=mock_db
        )
        
        # Verify
        assert result['id'] == 1
        assert result['name'] == "test.rvt"
        assert result['status'] == FileStatus.READY
        assert result['size_mb'] == round(1000 / (1024*1024), 2)
        assert 'aps_details' in result
    
    @pytest.mark.asyncio
    async def test_get_file_details_not_found(self, file_manager, mock_db):
        """Probar obtención de archivo no encontrado"""
        # Setup mock para archivo no encontrado
        mock_db.query.return_value.join.return_value.filter.return_value.first.return_value = None
        
        # Execute and expect exception
        with pytest.raises(Exception) as exc_info:
            await file_manager.get_file_details(
                file_id=999,
                user_id=1,
                db=mock_db
            )
        
        assert "Archivo no encontrado" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_list_files_with_filters(self, file_manager, mock_db):
        """Probar listado de archivos con filtros"""
        # Setup mock files
        mock_files = [
            File(id=1, name="file1.rvt", status=FileStatus.READY, project_id=1),
            File(id=2, name="file2.dwg", status=FileStatus.UPLOADED, project_id=1),
            File(id=3, name="file3.ifc", status=FileStatus.READY, project_id=2),
        ]
        
        for i, file in enumerate(mock_files):
            file.project = Project(id=file.project_id, name=f"Project {file.project_id}")
            file.size = 1000 * (i + 1)
        
        # Mock query builder
        query_mock = Mock()
        query_mock.count.return_value = len(mock_files)
        query_mock.order_by.return_value.offset.return_value.limit.return_value.all.return_value = mock_files
        
        mock_db.query.return_value.join.return_value.filter.return_value = query_mock
        
        # Execute
        result = await file_manager.list_files(
            user_id=1,
            db=mock_db,
            project_id=1,
            status_filter=FileStatus.READY,
            limit=10,
            offset=0
        )
        
        # Verify
        assert 'items' in result
        assert 'total' in result
        assert result['limit'] == 10
        assert result['offset'] == 0
    
    @pytest.mark.asyncio
    async def test_delete_file_success(self, file_manager, mock_db):
        """Probar eliminación exitosa de archivo"""
        # Setup mock file
        mock_file = File(
            id=1,
            object_key="test.rvt",
            bucket_key="test-bucket"
        )
        mock_file.project = Project(user_id=1)
        
        mock_db.query.return_value.join.return_value.filter.return_value.first.return_value = mock_file
        mock_db.delete = Mock()
        mock_db.commit = Mock()
        
        # Mock APS deletion
        file_manager.storage_service.delete_object = AsyncMock(return_value=True)
        
        # Execute
        result = await file_manager.delete_file(
            file_id=1,
            user_id=1,
            db=mock_db
        )
        
        # Verify
        assert result is True
        mock_db.delete.assert_called_with(mock_file)
        mock_db.commit.assert_called()
        file_manager.storage_service.delete_object.assert_called_with(
            "test-bucket", "test.rvt"
        )
    
    @pytest.mark.asyncio
    async def test_generate_download_url_success(self, file_manager, mock_db):
        """Probar generación exitosa de URL de descarga"""
        # Setup mock file
        mock_file = File(
            id=1,
            original_filename="test.rvt",
            object_key="test.rvt",
            bucket_key="test-bucket",
            size=1000
        )
        mock_file.project = Project(user_id=1)
        
        mock_db.query.return_value.join.return_value.filter.return_value.first.return_value = mock_file
        
        # Mock APS signed URL
        file_manager.storage_service.generate_signed_url = AsyncMock(return_value={
            'signed_url': 'https://signed-url.com/test.rvt'
        })
        
        # Execute
        result = await file_manager.generate_download_url(
            file_id=1,
            user_id=1,
            db=mock_db,
            expires_in=3600
        )
        
        # Verify
        assert 'download_url' in result
        assert result['filename'] == "test.rvt"
        assert result['size'] == 1000
        assert result['expires_in'] == 3600
    
    @pytest.mark.asyncio
    async def test_update_file_metadata_success(self, file_manager, mock_db):
        """Probar actualización exitosa de metadatos"""
        # Setup mock file
        mock_file = File(id=1, metadata={'existing': 'data'})
        mock_file.project = Project(user_id=1)
        
        mock_db.query.return_value.join.return_value.filter.return_value.first.return_value = mock_file
        mock_db.commit = Mock()
        mock_db.refresh = Mock()
        
        with patch('app.services.file_manager.file_sanitizer') as mock_sanitizer:
            mock_sanitizer.sanitize_metadata.return_value = {'new': 'metadata'}
            
            # Execute
            result = await file_manager.update_file_metadata(
                file_id=1,
                user_id=1,
                metadata={'new': 'metadata'},
                db=mock_db
            )
            
            # Verify
            assert result['id'] == 1
            assert mock_file.metadata['existing'] == 'data'  # Existing data preserved
            assert mock_file.metadata['new'] == 'metadata'    # New data added
            mock_db.commit.assert_called()
    
    @pytest.mark.asyncio
    async def test_get_upload_progress(self, file_manager):
        """Probar obtención de progreso de upload"""
        # Setup progress
        upload_id = "test_upload_123"
        progress = FileUploadProgress(upload_id, 1000)
        progress.update_progress(500, 2)
        progress.total_parts = 4
        
        file_manager.upload_progress[upload_id] = progress
        
        # Execute
        result = await file_manager.get_upload_progress(upload_id)
        
        # Verify
        assert result is not None
        assert result['file_id'] == upload_id
        assert result['progress_percentage'] == 50.0
        assert result['current_part'] == 2
        assert result['total_parts'] == 4
    
    @pytest.mark.asyncio
    async def test_get_upload_progress_not_found(self, file_manager):
        """Probar obtención de progreso no encontrado"""
        # Execute
        result = await file_manager.get_upload_progress("nonexistent")
        
        # Verify
        assert result is None
    
    def test_should_auto_translate(self, file_manager):
        """Probar determinación de traducción automática"""
        # Extensiones que deben traducirse
        assert file_manager._should_auto_translate('.rvt') is True
        assert file_manager._should_auto_translate('.ifc') is True
        assert file_manager._should_auto_translate('.dwg') is True
        assert file_manager._should_auto_translate('.3dm') is True
        assert file_manager._should_auto_translate('.skp') is True
        
        # Extensiones que no deben traducirse
        assert file_manager._should_auto_translate('.jpg') is False
        assert file_manager._should_auto_translate('.pdf') is False
        assert file_manager._should_auto_translate('.txt') is False
