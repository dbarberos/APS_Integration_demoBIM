"""
Pruebas unitarias para servicios de traducción
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timedelta
import uuid

from app.services.translation_manager import TranslationManager, TranslationManagerError
from app.services.model_derivative import ModelDerivativeService, ModelDerivativeError
from app.services.urn_manager import URNManager, URNValidationError, URNEncryptionError
from app.services.metadata_extractor import MetadataExtractor, MetadataExtractionError
from app.models.translation_job import TranslationJob, TranslationStatus, TranslationPriority
from app.models.file import File
from app.models.user import User


@pytest.fixture
def sample_urn():
    """URN de ejemplo para pruebas"""
    return "urn:adsk.objects:os.object:test-bucket/sample-file.rvt"


@pytest.fixture
def sample_manifest():
    """Manifest de ejemplo"""
    return {
        "type": "manifest",
        "region": "US",
        "version": "1.0",
        "status": "success",
        "progress": "100%",
        "derivatives": [
            {
                "name": "sample-file.rvt",
                "status": "success",
                "progress": "100%",
                "outputType": "svf2",
                "urn": "encoded-derivative-urn",
                "children": [
                    {
                        "type": "resource",
                        "role": "graphics",
                        "guid": "test-model-guid",
                        "mime": "application/autodesk-svf2"
                    }
                ]
            }
        ]
    }


@pytest.fixture
def sample_metadata():
    """Metadatos de ejemplo"""
    return {
        "extraction_timestamp": datetime.utcnow().isoformat(),
        "source_info": {
            "type": "manifest",
            "status": "success"
        },
        "model_info": {
            "name": "Sample Model",
            "application": "Revit"
        },
        "statistics": {
            "element_count": 1250,
            "property_count": 15000,
            "file_complexity_score": 0.7
        },
        "quality_metrics": {
            "overall_quality_score": 0.85
        }
    }


class TestURNManager:
    """Pruebas para URNManager"""
    
    def test_validate_valid_urn(self, sample_urn):
        """Probar validación de URN válido"""
        urn_manager = URNManager()
        
        # No debe lanzar excepción
        assert urn_manager.validate_urn(sample_urn) is True
    
    def test_validate_invalid_urn(self):
        """Probar validación de URN inválido"""
        urn_manager = URNManager()
        
        with pytest.raises(URNValidationError):
            urn_manager.validate_urn("invalid-urn")
        
        with pytest.raises(URNValidationError):
            urn_manager.validate_urn("")
        
        with pytest.raises(URNValidationError):
            urn_manager.validate_urn(None)
    
    def test_encode_decode_urn(self, sample_urn):
        """Probar codificación y decodificación de URN"""
        urn_manager = URNManager()
        
        # Codificar
        encoded = urn_manager.encode_urn(sample_urn)
        assert isinstance(encoded, str)
        assert encoded != sample_urn
        
        # Decodificar
        decoded = urn_manager.decode_urn(encoded)
        assert decoded == sample_urn
    
    def test_encrypt_decrypt_urn(self, sample_urn):
        """Probar encriptación y desencriptación de URN"""
        urn_manager = URNManager()
        
        # Encriptar
        encrypted = urn_manager.encrypt_urn(sample_urn)
        assert isinstance(encrypted, str)
        assert encrypted != sample_urn
        
        # Desencriptar
        decrypted = urn_manager.decrypt_urn(encrypted)
        assert decrypted == sample_urn
    
    def test_generate_object_urn(self):
        """Probar generación de URN de objeto"""
        urn_manager = URNManager()
        
        bucket_key = "test-bucket"
        object_key = "sample-file.rvt"
        
        urn = urn_manager.generate_object_urn(bucket_key, object_key)
        
        assert urn.startswith("urn:adsk.objects:os.object:")
        assert bucket_key in urn
        assert object_key in urn
    
    def test_extract_bucket_and_object(self, sample_urn):
        """Probar extracción de bucket y objeto"""
        urn_manager = URNManager()
        
        bucket_key, object_key = urn_manager.extract_bucket_and_object(sample_urn)
        
        assert bucket_key == "test-bucket"
        assert object_key == "sample-file.rvt"
    
    def test_create_verify_signed_urn(self, sample_urn):
        """Probar creación y verificación de URN firmado"""
        urn_manager = URNManager()
        
        # Crear URN firmado
        signed_urn = urn_manager.create_signed_urn(sample_urn, expires_in=3600)
        assert isinstance(signed_urn, str)
        assert signed_urn != sample_urn
        
        # Verificar URN firmado
        original_urn, is_valid = urn_manager.verify_signed_urn(signed_urn)
        assert is_valid is True
        assert original_urn == sample_urn
    
    def test_get_urn_info(self, sample_urn):
        """Probar obtención de información de URN"""
        urn_manager = URNManager()
        
        info = urn_manager.get_urn_info(sample_urn)
        
        assert info['type'] == 'object'
        assert info['namespace'] == 'adsk.objects'
        assert info['service'] == 'oss'
        assert 'bucket_key' in info
        assert 'object_key' in info


class TestModelDerivativeService:
    """Pruebas para ModelDerivativeService"""
    
    @pytest.mark.asyncio
    async def test_start_translation_success(self, sample_urn):
        """Probar inicio exitoso de traducción"""
        service = ModelDerivativeService()
        
        # Mock del cliente HTTP
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "urn": "job-urn-123",
            "result": "created"
        }
        
        with patch.object(service, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_get_client.return_value = mock_client
            
            result = await service.start_translation(
                source_urn=sample_urn,
                output_formats=['svf2', 'thumbnail'],
                quality_level='medium'
            )
            
            assert result['job_id'] == "job-urn-123"
            assert result['status'] == 'pending'
            assert 'estimated_duration' in result
    
    @pytest.mark.asyncio
    async def test_start_translation_error(self, sample_urn):
        """Probar error en inicio de traducción"""
        service = ModelDerivativeService()
        
        mock_response = Mock()
        mock_response.status_code = 400
        mock_response.json.return_value = {
            "errorMessage": "Invalid URN"
        }
        
        with patch.object(service, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_get_client.return_value = mock_client
            
            with pytest.raises(ModelDerivativeError, match="Invalid URN"):
                await service.start_translation(sample_urn)
    
    @pytest.mark.asyncio
    async def test_get_translation_status_success(self, sample_urn):
        """Probar obtención exitosa de estado"""
        service = ModelDerivativeService()
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success",
            "progress": "100%",
            "derivatives": []
        }
        
        with patch.object(service, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_get_client.return_value = mock_client
            
            status = await service.get_translation_status(sample_urn)
            
            assert status['status'] == 'success'
            assert status['progress'] == 100.0
    
    @pytest.mark.asyncio
    async def test_get_translation_status_in_progress(self, sample_urn):
        """Probar estado de traducción en progreso"""
        service = ModelDerivativeService()
        
        mock_response = Mock()
        mock_response.status_code = 202
        
        with patch.object(service, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_get_client.return_value = mock_client
            
            status = await service.get_translation_status(sample_urn)
            
            assert status['status'] == 'inprogress'
            assert status['progress'] == 50.0
    
    @pytest.mark.asyncio
    async def test_get_manifest(self, sample_urn, sample_manifest):
        """Probar obtención de manifest"""
        service = ModelDerivativeService()
        
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = sample_manifest
        
        with patch.object(service, '_get_client') as mock_get_client:
            mock_client = AsyncMock()
            mock_client.get.return_value = mock_response
            mock_get_client.return_value = mock_client
            
            manifest = await service.get_manifest(sample_urn)
            
            assert manifest == sample_manifest
            assert manifest['status'] == 'success'
    
    def test_build_translation_payload(self):
        """Probar construcción de payload de traducción"""
        service = ModelDerivativeService()
        
        source_urn = "urn:adsk.objects:os.object:test/file.rvt"
        output_formats = ['svf2', 'thumbnail']
        quality_level = 'high'
        config = service.FORMAT_CONFIGS['.rvt']
        
        payload = service._build_translation_payload(
            source_urn=source_urn,
            output_formats=output_formats,
            quality_level=quality_level,
            config=config
        )
        
        assert 'input' in payload
        assert 'output' in payload
        assert 'urn' in payload['input']
        assert len(payload['output']['formats']) == 2
        
        # Verificar formato SVF2
        svf2_format = next(f for f in payload['output']['formats'] if f['type'] == 'svf2')
        assert 'views' in svf2_format
        assert 'advanced' in svf2_format


class TestMetadataExtractor:
    """Pruebas para MetadataExtractor"""
    
    @pytest.mark.asyncio
    async def test_extract_comprehensive_metadata(self, sample_urn, sample_manifest, sample_metadata):
        """Probar extracción completa de metadatos"""
        extractor = MetadataExtractor()
        
        # Mock de métodos internos
        with patch.object(extractor, '_extract_model_metadata', return_value=AsyncMock(return_value={})), \
             patch.object(extractor, '_extract_object_tree', return_value=AsyncMock(return_value={})), \
             patch.object(extractor, '_extract_properties_bulk', return_value=AsyncMock(return_value={})), \
             patch.object(extractor, '_extract_geometry_metadata', return_value=AsyncMock(return_value={})), \
             patch.object(extractor, '_extract_material_metadata', return_value=AsyncMock(return_value={})), \
             patch.object(extractor, '_extract_units_metadata', return_value=AsyncMock(return_value={})), \
             patch.object(extractor, '_compile_comprehensive_metadata', return_value=sample_metadata):
            
            metadata = await extractor.extract_comprehensive_metadata(sample_urn, sample_manifest)
            
            assert 'extraction_timestamp' in metadata
            assert 'statistics' in metadata
            assert 'quality_metrics' in metadata
    
    def test_extract_model_guid(self, sample_manifest):
        """Probar extracción de GUID del modelo"""
        extractor = MetadataExtractor()
        
        guid = extractor._extract_model_guid(sample_manifest)
        
        assert guid == "test-model-guid"
    
    def test_analyze_hierarchy(self):
        """Probar análisis de jerarquía"""
        extractor = MetadataExtractor()
        
        object_tree = {
            "data": {
                "objects": [
                    {
                        "name": "Root",
                        "objects": [
                            {"name": "Child1", "objects": []},
                            {"name": "Child2", "objects": [
                                {"name": "Grandchild", "objects": []}
                            ]}
                        ]
                    }
                ]
            }
        }
        
        hierarchy_info = extractor._analyze_hierarchy(object_tree)
        
        assert hierarchy_info['total_nodes'] == 4
        assert hierarchy_info['max_depth'] == 2
        assert hierarchy_info['leaf_nodes'] == 2
    
    def test_map_category_to_discipline(self):
        """Probar mapeo de categoría a disciplina"""
        extractor = MetadataExtractor()
        
        assert extractor._map_category_to_discipline("Walls") == "Architecture"
        assert extractor._map_category_to_discipline("Structural Framing") == "Structure"
        assert extractor._map_category_to_discipline("Duct Systems") == "MEP"
        assert extractor._map_category_to_discipline("Unknown Category") == "Generic"


class TestTranslationManager:
    """Pruebas para TranslationManager"""
    
    @pytest.fixture
    def mock_db_session(self):
        """Mock de sesión de base de datos"""
        return Mock()
    
    @pytest.fixture
    def sample_file(self):
        """Archivo de ejemplo"""
        file_obj = Mock(spec=File)
        file_obj.id = 1
        file_obj.name = "sample.rvt"
        file_obj.urn = "urn:adsk.objects:os.object:test/sample.rvt"
        file_obj.original_filename = "Sample Model.rvt"
        return file_obj
    
    @pytest.fixture
    def sample_user(self):
        """Usuario de ejemplo"""
        user = Mock(spec=User)
        user.id = 1
        user.email = "test@example.com"
        return user
    
    @pytest.mark.asyncio
    async def test_start_translation_success(self, mock_db_session, sample_file, sample_user):
        """Probar inicio exitoso de traducción"""
        manager = TranslationManager()
        
        # Mock de consultas a BD
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_file
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            sample_file,  # Búsqueda de archivo
            None,         # No hay traducción activa
            None          # Configuración de traducción
        ]
        
        # Mock del modelo derivative service
        with patch('app.services.translation_manager.model_derivative_service') as mock_service:
            mock_service.start_translation.return_value = {
                'job_id': 'test-job-123',
                'status': 'pending',
                'estimated_duration': 300
            }
            
            # Mock de creación de TranslationJob
            mock_job = Mock(spec=TranslationJob)
            mock_job.job_id = 'test-job-123'
            mock_job.internal_id = str(uuid.uuid4())
            mock_job.status = TranslationStatus.PENDING
            mock_job.estimated_duration = 300
            
            with patch('app.services.translation_manager.TranslationJob', return_value=mock_job):
                with patch.object(manager, '_start_monitoring') as mock_monitor:
                    
                    result = await manager.start_translation(
                        file_id=1,
                        user_id=1,
                        output_formats=['svf2'],
                        db=mock_db_session
                    )
                    
                    assert result.job_id == 'test-job-123'
                    assert result.status == TranslationStatus.PENDING
                    mock_monitor.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_start_translation_file_not_found(self, mock_db_session):
        """Probar error cuando archivo no existe"""
        manager = TranslationManager()
        
        # Mock de archivo no encontrado
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        
        with pytest.raises(TranslationManagerError, match="Archivo .* no encontrado"):
            await manager.start_translation(
                file_id=999,
                user_id=1,
                db=mock_db_session
            )
    
    @pytest.mark.asyncio
    async def test_start_translation_active_job_exists(self, mock_db_session, sample_file):
        """Probar error cuando ya existe traducción activa"""
        manager = TranslationManager()
        
        # Mock de archivo existente
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            sample_file,  # Archivo encontrado
            Mock(job_id='existing-job')  # Trabajo activo existente
        ]
        
        result = await manager.start_translation(
            file_id=1,
            user_id=1,
            db=mock_db_session
        )
        
        # Debe retornar el trabajo existente
        assert result.job_id == 'existing-job'
    
    @pytest.mark.asyncio
    async def test_cancel_translation(self, mock_db_session):
        """Probar cancelación de traducción"""
        manager = TranslationManager()
        
        # Mock de trabajo encontrado
        mock_job = Mock(spec=TranslationJob)
        mock_job.job_id = 'test-job-123'
        mock_job.is_completed = False
        mock_job.status = TranslationStatus.INPROGRESS
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_job
        
        # Mock de monitoreo activo
        manager.polling_tasks['test-job-123'] = Mock()
        manager.polling_tasks['test-job-123'].cancel = Mock()
        manager.active_jobs['test-job-123'] = {'start_time': datetime.utcnow()}
        
        success = await manager.cancel_translation('test-job-123', mock_db_session)
        
        assert success is True
        assert mock_job.status == TranslationStatus.CANCELLED
        assert 'test-job-123' not in manager.polling_tasks
        assert 'test-job-123' not in manager.active_jobs
    
    @pytest.mark.asyncio
    async def test_retry_translation(self, mock_db_session):
        """Probar reintento de traducción"""
        manager = TranslationManager()
        
        # Mock de trabajo fallido que puede reintentar
        mock_job = Mock(spec=TranslationJob)
        mock_job.job_id = 'test-job-123'
        mock_job.can_retry = True
        mock_job.retry_count = 1
        
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_job
        
        with patch.object(manager, '_start_monitoring') as mock_monitor:
            success = await manager.retry_translation('test-job-123', mock_db_session)
            
            assert success is True
            mock_job.increment_retry.assert_called_once()
            mock_monitor.assert_called_once()
    
    def test_get_active_jobs_count(self):
        """Probar conteo de trabajos activos"""
        manager = TranslationManager()
        
        # Agregar trabajos activos simulados
        manager.active_jobs = {
            'job1': {'start_time': datetime.utcnow()},
            'job2': {'start_time': datetime.utcnow()},
            'job3': {'start_time': datetime.utcnow()}
        }
        
        assert manager.get_active_jobs_count() == 3
    
    def test_get_active_jobs_info(self):
        """Probar información de trabajos activos"""
        manager = TranslationManager()
        
        start_time = datetime.utcnow()
        mock_job = Mock()
        mock_job.status = TranslationStatus.INPROGRESS
        
        manager.active_jobs = {
            'job1': {
                'start_time': start_time.timestamp(),
                'last_check': start_time.timestamp(),
                'translation_job': mock_job
            }
        }
        
        info = manager.get_active_jobs_info()
        
        assert 'job1' in info
        assert 'start_time' in info['job1']
        assert 'elapsed' in info['job1']
        assert info['job1']['job_status'] == TranslationStatus.INPROGRESS


@pytest.mark.asyncio
async def test_integration_translation_flow(sample_urn):
    """Prueba de integración del flujo completo de traducción"""
    
    # Este test simula el flujo completo de traducción
    # desde inicio hasta completado
    
    # 1. Inicializar servicios
    urn_manager = URNManager()
    model_service = ModelDerivativeService()
    metadata_extractor = MetadataExtractor()
    translation_manager = TranslationManager()
    
    # 2. Validar URN
    assert urn_manager.validate_urn(sample_urn) is True
    
    # 3. Simular inicio de traducción (mock)
    with patch.object(model_service, 'start_translation') as mock_start:
        mock_start.return_value = {
            'job_id': 'integration-test-job',
            'status': 'pending',
            'estimated_duration': 180
        }
        
        job_info = await model_service.start_translation(sample_urn)
        assert job_info['job_id'] == 'integration-test-job'
    
    # 4. Simular consulta de estado
    with patch.object(model_service, 'get_translation_status') as mock_status:
        mock_status.return_value = {
            'status': 'success',
            'progress': 100.0,
            'message': 'Translation completed'
        }
        
        status = await model_service.get_translation_status(sample_urn)
        assert status['status'] == 'success'
    
    # 5. Simular obtención de manifest
    with patch.object(model_service, 'get_manifest') as mock_manifest:
        mock_manifest.return_value = {
            'status': 'success',
            'derivatives': [{'outputType': 'svf2', 'status': 'success'}]
        }
        
        manifest = await model_service.get_manifest(sample_urn)
        assert manifest['status'] == 'success'
    
    # 6. Simular extracción de metadatos
    with patch.object(metadata_extractor, 'extract_comprehensive_metadata') as mock_metadata:
        mock_metadata.return_value = {
            'statistics': {'element_count': 1000},
            'quality_metrics': {'overall_quality_score': 0.9}
        }
        
        metadata = await metadata_extractor.extract_comprehensive_metadata(sample_urn)
        assert metadata['statistics']['element_count'] == 1000


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
