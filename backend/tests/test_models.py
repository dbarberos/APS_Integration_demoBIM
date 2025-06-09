"""
Pruebas unitarias para modelos de base de datos
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.user import User
from app.models.project import Project
from app.models.file import File, FileStatus
from app.models.viewer_session import ViewerSession


@pytest.fixture(scope="function")
def db_session():
    """Fixture para crear sesión de base de datos en memoria para pruebas"""
    # Crear engine en memoria
    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False}
    )
    
    # Crear todas las tablas
    Base.metadata.create_all(engine)
    
    # Crear sesión
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    
    try:
        yield session
    finally:
        session.close()


class TestUserModel:
    """Pruebas para el modelo User"""
    
    def test_create_user(self, db_session):
        """Probar creación de usuario"""
        user = User(
            email="test@example.com",
            hashed_password="hashed_password",
            full_name="Test User",
            is_active=True
        )
        
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        # Verificar
        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.full_name == "Test User"
        assert user.is_active is True
        assert user.is_superuser is False
        assert user.created_at is not None
    
    def test_user_aps_authentication_property(self, db_session):
        """Probar propiedad is_aps_authenticated"""
        user = User(
            email="test@example.com",
            hashed_password="hashed_password"
        )
        
        # Sin tokens APS
        assert user.is_aps_authenticated is False
        
        # Con tokens pero expirados
        user.aps_access_token = "token"
        user.aps_token_expires_at = datetime.utcnow() - timedelta(hours=1)
        assert user.is_aps_authenticated is False
        
        # Con tokens válidos
        user.aps_token_expires_at = datetime.utcnow() + timedelta(hours=1)
        assert user.is_aps_authenticated is True
    
    def test_user_unique_email(self, db_session):
        """Probar que el email debe ser único"""
        user1 = User(
            email="unique@example.com",
            hashed_password="password1"
        )
        
        user2 = User(
            email="unique@example.com",
            hashed_password="password2"
        )
        
        db_session.add(user1)
        db_session.commit()
        
        db_session.add(user2)
        
        # Debe fallar por email duplicado
        with pytest.raises(Exception):
            db_session.commit()


class TestProjectModel:
    """Pruebas para el modelo Project"""
    
    def test_create_project(self, db_session):
        """Probar creación de proyecto"""
        # Crear usuario primero
        user = User(
            email="user@example.com",
            hashed_password="password"
        )
        db_session.add(user)
        db_session.commit()
        
        # Crear proyecto
        project = Project(
            name="Test Project",
            description="A test project",
            bucket_key="test-project-bucket",
            user_id=user.id
        )
        
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        
        # Verificar
        assert project.id is not None
        assert project.name == "Test Project"
        assert project.bucket_key == "test-project-bucket"
        assert project.user_id == user.id
        assert project.owner == user
        assert project.created_at is not None
    
    def test_project_files_count_property(self, db_session):
        """Probar propiedad files_count"""
        # Crear usuario y proyecto
        user = User(email="user@example.com", hashed_password="password")
        db_session.add(user)
        db_session.commit()
        
        project = Project(
            name="Test Project",
            bucket_key="test-bucket",
            user_id=user.id
        )
        db_session.add(project)
        db_session.commit()
        
        # Sin archivos
        assert project.files_count == 0
        
        # Agregar archivos
        file1 = File(
            name="file1.rvt",
            original_filename="file1.rvt",
            urn="urn:1",
            object_key="file1",
            bucket_key="test-bucket",
            project_id=project.id
        )
        
        file2 = File(
            name="file2.dwg",
            original_filename="file2.dwg", 
            urn="urn:2",
            object_key="file2",
            bucket_key="test-bucket",
            project_id=project.id
        )
        
        db_session.add_all([file1, file2])
        db_session.commit()
        db_session.refresh(project)
        
        # Con archivos
        assert project.files_count == 2
    
    def test_project_unique_bucket_key(self, db_session):
        """Probar que bucket_key debe ser único"""
        user = User(email="user@example.com", hashed_password="password")
        db_session.add(user)
        db_session.commit()
        
        project1 = Project(
            name="Project 1",
            bucket_key="unique-bucket",
            user_id=user.id
        )
        
        project2 = Project(
            name="Project 2",
            bucket_key="unique-bucket",
            user_id=user.id
        )
        
        db_session.add(project1)
        db_session.commit()
        
        db_session.add(project2)
        
        # Debe fallar por bucket_key duplicado
        with pytest.raises(Exception):
            db_session.commit()


class TestFileModel:
    """Pruebas para el modelo File"""
    
    def test_create_file(self, db_session):
        """Probar creación de archivo"""
        # Crear usuario y proyecto
        user = User(email="user@example.com", hashed_password="password")
        db_session.add(user)
        db_session.commit()
        
        project = Project(
            name="Test Project",
            bucket_key="test-bucket",
            user_id=user.id
        )
        db_session.add(project)
        db_session.commit()
        
        # Crear archivo
        file = File(
            name="test.rvt",
            original_filename="Original Test.rvt",
            content_type="application/octet-stream",
            size=1024000,
            urn="urn:adsk.objects:os.object:test-bucket/test.rvt",
            object_key="test.rvt",
            bucket_key="test-bucket",
            status=FileStatus.UPLOADED,
            project_id=project.id
        )
        
        db_session.add(file)
        db_session.commit()
        db_session.refresh(file)
        
        # Verificar
        assert file.id is not None
        assert file.name == "test.rvt"
        assert file.size == 1024000
        assert file.status == FileStatus.UPLOADED
        assert file.project == project
        assert file.uploaded_at is not None
    
    def test_file_is_ready_for_viewing_property(self, db_session):
        """Probar propiedad is_ready_for_viewing"""
        file = File(
            name="test.rvt",
            original_filename="test.rvt",
            urn="urn:test",
            object_key="test",
            bucket_key="bucket",
            project_id=1
        )
        
        # Estados que no están listos
        for status in [FileStatus.UPLOADED, FileStatus.TRANSLATING, FileStatus.ERROR]:
            file.status = status
            assert file.is_ready_for_viewing is False
        
        # Estado listo
        file.status = FileStatus.READY
        assert file.is_ready_for_viewing is True
    
    def test_file_size_mb_property(self, db_session):
        """Probar propiedad size_mb"""
        file = File(
            name="test.rvt",
            original_filename="test.rvt",
            urn="urn:test",
            object_key="test",
            bucket_key="bucket",
            project_id=1
        )
        
        # Sin tamaño
        file.size = None
        assert file.size_mb == 0.0
        
        # Con tamaño en bytes
        file.size = 1024 * 1024  # 1MB
        assert file.size_mb == 1.0
        
        file.size = 1536 * 1024  # 1.5MB
        assert file.size_mb == 1.5
    
    def test_file_unique_urn(self, db_session):
        """Probar que URN debe ser único"""
        file1 = File(
            name="file1.rvt",
            original_filename="file1.rvt",
            urn="urn:unique:test",
            object_key="file1",
            bucket_key="bucket",
            project_id=1
        )
        
        file2 = File(
            name="file2.rvt",
            original_filename="file2.rvt",
            urn="urn:unique:test",
            object_key="file2",
            bucket_key="bucket",
            project_id=1
        )
        
        db_session.add(file1)
        db_session.commit()
        
        db_session.add(file2)
        
        # Debe fallar por URN duplicado
        with pytest.raises(Exception):
            db_session.commit()


class TestViewerSessionModel:
    """Pruebas para el modelo ViewerSession"""
    
    def test_create_viewer_session(self, db_session):
        """Probar creación de sesión de viewer"""
        # Crear usuario, proyecto y archivo
        user = User(email="user@example.com", hashed_password="password")
        db_session.add(user)
        db_session.commit()
        
        project = Project(
            name="Test Project",
            bucket_key="test-bucket",
            user_id=user.id
        )
        db_session.add(project)
        db_session.commit()
        
        file = File(
            name="test.rvt",
            original_filename="test.rvt",
            urn="urn:test",
            object_key="test",
            bucket_key="test-bucket",
            project_id=project.id
        )
        db_session.add(file)
        db_session.commit()
        
        # Crear sesión
        session = ViewerSession(
            session_id="session_123",
            user_id=user.id,
            file_id=file.id,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0..."
        )
        
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)
        
        # Verificar
        assert session.id is not None
        assert session.session_id == "session_123"
        assert session.user == user
        assert session.file == file
        assert session.started_at is not None
        assert session.last_activity is not None
    
    def test_viewer_session_duration_property(self, db_session):
        """Probar propiedad duration_minutes"""
        start_time = datetime.utcnow()
        
        session = ViewerSession(
            session_id="test_session",
            user_id=1,
            file_id=1
        )
        session.started_at = start_time
        
        # Sin fin (sesión activa)
        session.ended_at = None
        duration = session.duration_minutes
        assert duration >= 0
        
        # Con fin específico
        session.ended_at = start_time + timedelta(minutes=30)
        assert session.duration_minutes == 30
    
    def test_viewer_session_is_active_property(self, db_session):
        """Probar propiedad is_active"""
        session = ViewerSession(
            session_id="test_session",
            user_id=1,
            file_id=1
        )
        
        # Sesión terminada
        session.ended_at = datetime.utcnow()
        assert session.is_active is False
        
        # Sesión activa reciente
        session.ended_at = None
        session.last_activity = datetime.utcnow()
        assert session.is_active is True
        
        # Sesión inactiva (más de 30 minutos)
        session.last_activity = datetime.utcnow() - timedelta(minutes=35)
        assert session.is_active is False
    
    def test_viewer_session_end_session_method(self, db_session):
        """Probar método end_session"""
        session = ViewerSession(
            session_id="test_session",
            user_id=1,
            file_id=1
        )
        
        # Sesión activa
        assert session.ended_at is None
        
        # Finalizar sesión
        session.end_session()
        assert session.ended_at is not None
        assert isinstance(session.ended_at, datetime)
    
    def test_viewer_session_update_activity_method(self, db_session):
        """Probar método update_activity"""
        old_time = datetime.utcnow() - timedelta(minutes=10)
        
        session = ViewerSession(
            session_id="test_session",
            user_id=1,
            file_id=1
        )
        session.last_activity = old_time
        
        # Actualizar actividad
        session.update_activity()
        assert session.last_activity > old_time


class TestModelRelationships:
    """Pruebas para relaciones entre modelos"""
    
    def test_user_projects_relationship(self, db_session):
        """Probar relación Usuario -> Proyectos"""
        user = User(email="user@example.com", hashed_password="password")
        db_session.add(user)
        db_session.commit()
        
        # Crear proyectos
        project1 = Project(name="Project 1", bucket_key="bucket1", user_id=user.id)
        project2 = Project(name="Project 2", bucket_key="bucket2", user_id=user.id)
        
        db_session.add_all([project1, project2])
        db_session.commit()
        db_session.refresh(user)
        
        # Verificar relación
        assert len(user.projects) == 2
        assert project1 in user.projects
        assert project2 in user.projects
    
    def test_project_files_relationship(self, db_session):
        """Probar relación Proyecto -> Archivos"""
        user = User(email="user@example.com", hashed_password="password")
        db_session.add(user)
        db_session.commit()
        
        project = Project(name="Project", bucket_key="bucket", user_id=user.id)
        db_session.add(project)
        db_session.commit()
        
        # Crear archivos
        file1 = File(
            name="file1.rvt", original_filename="file1.rvt",
            urn="urn:1", object_key="file1", bucket_key="bucket",
            project_id=project.id
        )
        file2 = File(
            name="file2.dwg", original_filename="file2.dwg",
            urn="urn:2", object_key="file2", bucket_key="bucket",
            project_id=project.id
        )
        
        db_session.add_all([file1, file2])
        db_session.commit()
        db_session.refresh(project)
        
        # Verificar relación
        assert len(project.files) == 2
        assert file1 in project.files
        assert file2 in project.files
    
    def test_cascade_deletion(self, db_session):
        """Probar eliminación en cascada"""
        # Crear usuario con proyecto y archivo
        user = User(email="user@example.com", hashed_password="password")
        db_session.add(user)
        db_session.commit()
        
        project = Project(name="Project", bucket_key="bucket", user_id=user.id)
        db_session.add(project)
        db_session.commit()
        
        file = File(
            name="file.rvt", original_filename="file.rvt",
            urn="urn:test", object_key="file", bucket_key="bucket",
            project_id=project.id
        )
        db_session.add(file)
        db_session.commit()
        
        file_id = file.id
        project_id = project.id
        
        # Eliminar usuario
        db_session.delete(user)
        db_session.commit()
        
        # Verificar que proyecto y archivo también se eliminaron
        assert db_session.query(Project).filter(Project.id == project_id).first() is None
        assert db_session.query(File).filter(File.id == file_id).first() is None
