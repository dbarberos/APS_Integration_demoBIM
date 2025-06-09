"""
Configuración global de tests para la aplicación APS
"""
import asyncio
import os
import tempfile
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.core.database import Base, get_db
from app.main import app
from app.models import User, Project, File, TranslationJob
from app.services.aps_auth import APSAuthService
from app.services.aps_storage import APSStorageService
from app.services.translation_manager import TranslationManager
from app.services.file_manager import FileManager


# Test database configuration
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
TEST_SYNC_DATABASE_URL = "sqlite:///:memory:"

# Override settings for testing
@pytest.fixture(scope="session")
def test_settings():
    """Override application settings for testing"""
    settings = get_settings()
    settings.TESTING = True
    settings.DATABASE_URL = TEST_DATABASE_URL
    settings.SECRET_KEY = "test-secret-key"
    settings.APS_CLIENT_ID = "test-client-id"
    settings.APS_CLIENT_SECRET = "test-client-secret"
    settings.REDIS_URL = "redis://localhost:6379/1"  # Test Redis DB
    return settings


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def async_engine():
    """Create async database engine for testing"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=StaticPool,
        connect_args={
            "check_same_thread": False,
        },
        echo=False,
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create async database session for testing"""
    async_session_maker = sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session_maker() as session:
        yield session
        await session.rollback()


@pytest.fixture(scope="function")
def sync_engine():
    """Create sync database engine for testing"""
    engine = create_engine(
        TEST_SYNC_DATABASE_URL,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
        echo=False,
    )
    
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def sync_session(sync_engine):
    """Create sync database session for testing"""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="function")
async def client(async_session, test_settings) -> AsyncGenerator[AsyncClient, None]:
    """Create test client with dependency overrides"""
    
    async def override_get_db():
        yield async_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def sync_client(sync_session, test_settings) -> Generator[TestClient, None, None]:
    """Create sync test client"""
    
    def override_get_db():
        try:
            yield sync_session
        finally:
            sync_session.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as client:
        yield client
    
    app.dependency_overrides.clear()


# Mock fixtures for external services
@pytest.fixture
def mock_aps_auth_service():
    """Mock APS authentication service"""
    mock_service = Mock(spec=APSAuthService)
    mock_service.get_app_token = AsyncMock(return_value={
        "access_token": "test_access_token",
        "token_type": "Bearer",
        "expires_in": 3600
    })
    mock_service.get_user_token = AsyncMock(return_value={
        "access_token": "test_user_token",
        "refresh_token": "test_refresh_token",
        "expires_in": 3600
    })
    mock_service.refresh_token = AsyncMock(return_value={
        "access_token": "new_test_token",
        "expires_in": 3600
    })
    return mock_service


@pytest.fixture
def mock_aps_storage_service():
    """Mock APS storage service"""
    mock_service = Mock(spec=APSStorageService)
    mock_service.create_bucket = AsyncMock(return_value="test-bucket")
    mock_service.upload_file = AsyncMock(return_value={
        "bucket_key": "test-bucket",
        "object_key": "test-object",
        "object_id": "test-object-id",
        "size": 1024
    })
    mock_service.get_object_details = AsyncMock(return_value={
        "object_id": "test-object-id",
        "object_key": "test-object",
        "size": 1024,
        "content_type": "application/octet-stream"
    })
    mock_service.delete_object = AsyncMock(return_value=True)
    return mock_service


@pytest.fixture
def mock_translation_manager():
    """Mock translation manager service"""
    mock_service = Mock(spec=TranslationManager)
    mock_service.start_translation = AsyncMock(return_value={
        "urn": "test-urn",
        "job_id": "test-job-id",
        "status": "inprogress"
    })
    mock_service.get_translation_status = AsyncMock(return_value={
        "status": "success",
        "progress": "100%",
        "region": "US"
    })
    mock_service.get_manifest = AsyncMock(return_value={
        "type": "manifest",
        "hasThumbnail": "true",
        "status": "success",
        "progress": "complete",
        "region": "US",
        "urn": "test-urn",
        "derivatives": []
    })
    return mock_service


@pytest.fixture
def mock_file_manager():
    """Mock file manager service"""
    mock_service = Mock(spec=FileManager)
    mock_service.validate_file = AsyncMock(return_value=True)
    mock_service.process_upload = AsyncMock(return_value={
        "file_id": "test-file-id",
        "size": 1024,
        "content_type": "application/octet-stream"
    })
    return mock_service


# Test data fixtures
@pytest.fixture
async def test_user(async_session) -> User:
    """Create test user"""
    user = User(
        id=1,
        email="test@example.com",
        username="testuser",
        full_name="Test User",
        is_active=True,
        aps_user_id="test-aps-user-id"
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest.fixture
async def test_project(async_session, test_user) -> Project:
    """Create test project"""
    project = Project(
        id=1,
        name="Test Project",
        description="Test project description",
        user_id=test_user.id
    )
    async_session.add(project)
    await async_session.commit()
    await async_session.refresh(project)
    return project


@pytest.fixture
async def test_file(async_session, test_project) -> File:
    """Create test file"""
    file = File(
        id=1,
        name="test_file.rvt",
        original_name="test_file.rvt",
        size=1024,
        content_type="application/octet-stream",
        bucket_key="test-bucket",
        object_key="test-object",
        project_id=test_project.id,
        user_id=test_project.user_id,
        status="uploaded"
    )
    async_session.add(file)
    await async_session.commit()
    await async_session.refresh(file)
    return file


@pytest.fixture
async def test_translation_job(async_session, test_file) -> TranslationJob:
    """Create test translation job"""
    job = TranslationJob(
        id="test-job-id",
        urn="test-urn",
        input_file_name=test_file.name,
        output_formats=["svf2"],
        status="pending",
        file_id=test_file.id,
        user_id=test_file.user_id
    )
    async_session.add(job)
    await async_session.commit()
    await async_session.refresh(job)
    return job


@pytest.fixture
def sample_file_content():
    """Sample file content for upload tests"""
    return b"Sample CAD file content for testing"


@pytest.fixture
def sample_large_file_content():
    """Large file content for upload tests"""
    return b"x" * (10 * 1024 * 1024)  # 10MB file


@pytest.fixture
def temp_file():
    """Create temporary file for testing"""
    with tempfile.NamedTemporaryFile(delete=False) as temp:
        temp.write(b"Test file content")
        temp.flush()
        yield temp.name
    os.unlink(temp.name)


@pytest.fixture
def auth_headers():
    """Authentication headers for tests"""
    return {
        "Authorization": "Bearer test-token",
        "Content-Type": "application/json"
    }


@pytest.fixture
def multipart_headers():
    """Multipart headers for file upload tests"""
    return {
        "Authorization": "Bearer test-token"
    }


# Utility functions for tests
@pytest.fixture
def assert_model_equal():
    """Utility function to compare model instances"""
    def _assert_equal(model1, model2, ignore_fields=None):
        if ignore_fields is None:
            ignore_fields = ['created_at', 'updated_at']
        
        for field in model1.__table__.columns.keys():
            if field not in ignore_fields:
                assert getattr(model1, field) == getattr(model2, field), f"Field {field} differs"
    
    return _assert_equal


@pytest.fixture
def create_mock_response():
    """Utility to create mock HTTP responses"""
    def _create_response(status_code=200, json_data=None, headers=None):
        mock_response = Mock()
        mock_response.status_code = status_code
        mock_response.json.return_value = json_data or {}
        mock_response.headers = headers or {}
        mock_response.raise_for_status.return_value = None if status_code < 400 else Exception("HTTP Error")
        return mock_response
    
    return _create_response


# Performance testing fixtures
@pytest.fixture
def performance_timer():
    """Timer for performance tests"""
    import time
    
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
        
        def start(self):
            self.start_time = time.time()
        
        def stop(self):
            self.end_time = time.time()
        
        @property
        def elapsed(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None
    
    return Timer()


# Async context manager for database transactions
@pytest.fixture
async def db_transaction(async_session):
    """Database transaction context for tests"""
    async with async_session.begin() as transaction:
        yield async_session
        await transaction.rollback()


# Cleanup fixtures
@pytest.fixture(autouse=True)
def cleanup_temp_files():
    """Automatically cleanup temporary files after each test"""
    temp_files = []
    
    def register_temp_file(filepath):
        temp_files.append(filepath)
    
    yield register_temp_file
    
    # Cleanup
    for filepath in temp_files:
        try:
            if os.path.exists(filepath):
                os.unlink(filepath)
        except OSError:
            pass


# Mock Redis for testing
@pytest.fixture
def mock_redis():
    """Mock Redis client for testing"""
    import fakeredis.aioredis
    return fakeredis.aioredis.FakeRedis()


# Environment variables for testing
@pytest.fixture(autouse=True)
def setup_test_env(monkeypatch, test_settings):
    """Setup test environment variables"""
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.setenv("DATABASE_URL", TEST_DATABASE_URL)
    monkeypatch.setenv("SECRET_KEY", test_settings.SECRET_KEY)
    monkeypatch.setenv("APS_CLIENT_ID", test_settings.APS_CLIENT_ID)
    monkeypatch.setenv("APS_CLIENT_SECRET", test_settings.APS_CLIENT_SECRET)


# Parametrize fixtures for different test scenarios
@pytest.fixture(params=[
    {"format": "rvt", "size": 1024},
    {"format": "ifc", "size": 2048},
    {"format": "dwg", "size": 512},
])
def file_test_data(request):
    """Parametrized test data for different file types"""
    return request.param


@pytest.fixture(params=["pending", "inprogress", "success", "failed"])
def translation_status(request):
    """Parametrized translation statuses"""
    return request.param
