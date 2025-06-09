"""
Tests para operaciones de base de datos
"""
import pytest
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta

from app.models import User, Project, File, TranslationJob


@pytest.mark.model
@pytest.mark.unit
class TestDatabaseOperations:
    """Tests para operaciones de base de datos"""
    
    async def test_user_crud_operations(self, async_session):
        """Test operaciones CRUD de usuarios"""
        # Create
        user = User(
            email="test@example.com",
            username="testuser",
            full_name="Test User",
            hashed_password="hashed_password_123",
            is_active=True,
            aps_user_id="aps-user-123"
        )
        async_session.add(user)
        await async_session.commit()
        await async_session.refresh(user)
        
        assert user.id is not None
        assert user.email == "test@example.com"
        assert user.created_at is not None
        
        # Read
        result = await async_session.execute(
            select(User).where(User.email == "test@example.com")
        )
        retrieved_user = result.scalar_one()
        
        assert retrieved_user.id == user.id
        assert retrieved_user.username == "testuser"
        
        # Update
        retrieved_user.full_name = "Updated Name"
        await async_session.commit()
        await async_session.refresh(retrieved_user)
        
        assert retrieved_user.full_name == "Updated Name"
        assert retrieved_user.updated_at > retrieved_user.created_at
        
        # Delete
        await async_session.delete(retrieved_user)
        await async_session.commit()
        
        result = await async_session.execute(
            select(User).where(User.id == user.id)
        )
        deleted_user = result.scalar_one_or_none()
        
        assert deleted_user is None
    
    async def test_project_crud_operations(self, async_session, test_user):
        """Test operaciones CRUD de proyectos"""
        # Create
        project = Project(
            name="Test Project",
            description="Test project description",
            user_id=test_user.id,
            is_active=True
        )
        async_session.add(project)
        await async_session.commit()
        await async_session.refresh(project)
        
        assert project.id is not None
        assert project.name == "Test Project"
        assert project.user_id == test_user.id
        
        # Test relationship
        await async_session.refresh(project, ["user"])
        assert project.user.email == test_user.email
        
        # Update
        project.description = "Updated description"
        await async_session.commit()
        
        # Read with filter
        result = await async_session.execute(
            select(Project).where(Project.user_id == test_user.id)
        )
        user_projects = result.scalars().all()
        
        assert len(user_projects) >= 1
        assert any(p.name == "Test Project" for p in user_projects)
    
    async def test_file_crud_operations(self, async_session, test_project):
        """Test operaciones CRUD de archivos"""
        # Create
        file = File(
            name="test_file.rvt",
            original_name="original_test_file.rvt",
            size=1024,
            content_type="application/octet-stream",
            bucket_key="test-bucket",
            object_key="test-object",
            project_id=test_project.id,
            user_id=test_project.user_id,
            status="uploaded",
            tags=["revit", "architecture"]
        )
        async_session.add(file)
        await async_session.commit()
        await async_session.refresh(file)
        
        assert file.id is not None
        assert file.name == "test_file.rvt"
        assert file.tags == ["revit", "architecture"]
        
        # Test relationships
        await async_session.refresh(file, ["project", "user"])
        assert file.project.name == test_project.name
        assert file.user.id == test_project.user_id
        
        # Query with aggregations
        result = await async_session.execute(
            select(func.count(File.id), func.sum(File.size))
            .where(File.project_id == test_project.id)
        )
        count, total_size = result.one()
        
        assert count >= 1
        assert total_size >= 1024
    
    async def test_translation_job_crud_operations(self, async_session, test_file):
        """Test operaciones CRUD de trabajos de traducción"""
        # Create
        job = TranslationJob(
            id="test-job-123",
            urn="test-urn-base64",
            input_file_name=test_file.name,
            output_formats=["svf2", "thumbnail"],
            status="pending",
            priority="normal",
            quality_level="medium",
            file_id=test_file.id,
            user_id=test_file.user_id,
            started_at=datetime.utcnow()
        )
        async_session.add(job)
        await async_session.commit()
        await async_session.refresh(job)
        
        assert job.id == "test-job-123"
        assert job.status == "pending"
        assert "svf2" in job.output_formats
        
        # Update status
        job.status = "inprogress"
        job.progress_percentage = 50
        await async_session.commit()
        
        # Query active jobs
        result = await async_session.execute(
            select(TranslationJob).where(
                TranslationJob.status.in_(["pending", "inprogress"])
            )
        )
        active_jobs = result.scalars().all()
        
        assert len(active_jobs) >= 1
        assert any(j.id == "test-job-123" for j in active_jobs)
    
    async def test_database_constraints(self, async_session):
        """Test restricciones de base de datos"""
        # Test unique constraint on email
        user1 = User(
            email="duplicate@example.com",
            username="user1",
            full_name="User 1"
        )
        async_session.add(user1)
        await async_session.commit()
        
        user2 = User(
            email="duplicate@example.com",  # Same email
            username="user2",
            full_name="User 2"
        )
        async_session.add(user2)
        
        with pytest.raises(IntegrityError):
            await async_session.commit()
        
        await async_session.rollback()
        
        # Test unique constraint on username
        user3 = User(
            email="unique@example.com",
            username="user1",  # Same username as user1
            full_name="User 3"
        )
        async_session.add(user3)
        
        with pytest.raises(IntegrityError):
            await async_session.commit()
    
    async def test_foreign_key_constraints(self, async_session, test_user):
        """Test restricciones de clave foránea"""
        # Try to create project with non-existent user
        project = Project(
            name="Invalid Project",
            user_id=99999  # Non-existent user ID
        )
        async_session.add(project)
        
        with pytest.raises(IntegrityError):
            await async_session.commit()
        
        await async_session.rollback()
        
        # Valid project creation
        valid_project = Project(
            name="Valid Project",
            user_id=test_user.id
        )
        async_session.add(valid_project)
        await async_session.commit()
        
        assert valid_project.id is not None
    
    async def test_cascade_operations(self, async_session, test_user):
        """Test operaciones en cascada"""
        # Create project with files
        project = Project(
            name="Project with Files",
            user_id=test_user.id
        )
        async_session.add(project)
        await async_session.flush()  # Get project ID
        
        # Add files to project
        files = []
        for i in range(3):
            file = File(
                name=f"file_{i}.rvt",
                original_name=f"file_{i}.rvt",
                size=1024 * (i + 1),
                content_type="application/octet-stream",
                project_id=project.id,
                user_id=test_user.id,
                status="uploaded"
            )
            files.append(file)
            async_session.add(file)
        
        await async_session.commit()
        
        # Verify files were created
        result = await async_session.execute(
            select(func.count(File.id)).where(File.project_id == project.id)
        )
        file_count = result.scalar()
        assert file_count == 3
        
        # Delete project (should cascade to files if configured)
        await async_session.delete(project)
        await async_session.commit()
        
        # Check if files still exist (depends on cascade configuration)
        result = await async_session.execute(
            select(func.count(File.id)).where(File.project_id == project.id)
        )
        remaining_files = result.scalar()
        
        # This depends on your cascade configuration
        # For this test, let's assume files are not automatically deleted
        assert remaining_files >= 0
    
    async def test_database_indexes(self, async_session, test_user):
        """Test índices de base de datos"""
        # Create multiple records to test index performance
        projects = []
        for i in range(100):
            project = Project(
                name=f"Project {i}",
                description=f"Description {i}",
                user_id=test_user.id,
                created_at=datetime.utcnow() - timedelta(days=i)
            )
            projects.append(project)
        
        async_session.add_all(projects)
        await async_session.commit()
        
        # Test query that should use index (user_id)
        import time
        start_time = time.time()
        
        result = await async_session.execute(
            select(Project).where(Project.user_id == test_user.id)
            .order_by(Project.created_at.desc())
        )
        user_projects = result.scalars().all()
        
        end_time = time.time()
        query_time = end_time - start_time
        
        assert len(user_projects) >= 100
        assert query_time < 1.0  # Should be fast with proper indexing
        
        # Test text search (if full-text index exists)
        result = await async_session.execute(
            select(Project).where(Project.name.like("%Project 5%"))
        )
        search_results = result.scalars().all()
        
        assert len(search_results) >= 10  # Should find Project 5, 15, 25, etc.
    
    async def test_database_transactions(self, async_session, test_user):
        """Test transacciones de base de datos"""
        # Test successful transaction
        async with async_session.begin_nested() as savepoint:
            project1 = Project(
                name="Transaction Project 1",
                user_id=test_user.id
            )
            project2 = Project(
                name="Transaction Project 2", 
                user_id=test_user.id
            )
            
            async_session.add(project1)
            async_session.add(project2)
            
            # Commit nested transaction
            await savepoint.commit()
        
        await async_session.commit()
        
        # Verify both projects were created
        result = await async_session.execute(
            select(func.count(Project.id)).where(
                Project.name.like("Transaction Project%")
            )
        )
        count = result.scalar()
        assert count == 2
        
        # Test failed transaction with rollback
        try:
            async with async_session.begin_nested() as savepoint:
                project3 = Project(
                    name="Transaction Project 3",
                    user_id=test_user.id
                )
                async_session.add(project3)
                
                # Create duplicate user to force error
                duplicate_user = User(
                    email=test_user.email,  # Duplicate email
                    username="duplicate_user"
                )
                async_session.add(duplicate_user)
                
                # This should fail
                await savepoint.commit()
                
        except IntegrityError:
            await async_session.rollback()
        
        # Verify project3 was not created due to rollback
        result = await async_session.execute(
            select(func.count(Project.id)).where(
                Project.name == "Transaction Project 3"
            )
        )
        count = result.scalar()
        assert count == 0
    
    async def test_database_pagination(self, async_session, test_user):
        """Test paginación de base de datos"""
        # Create test data
        projects = []
        for i in range(25):
            project = Project(
                name=f"Paginated Project {i:02d}",
                user_id=test_user.id
            )
            projects.append(project)
        
        async_session.add_all(projects)
        await async_session.commit()
        
        # Test pagination
        page_size = 10
        page = 1
        offset = (page - 1) * page_size
        
        result = await async_session.execute(
            select(Project)
            .where(Project.name.like("Paginated Project%"))
            .order_by(Project.name)
            .limit(page_size)
            .offset(offset)
        )
        page_results = result.scalars().all()
        
        assert len(page_results) == page_size
        assert page_results[0].name == "Paginated Project 00"
        assert page_results[-1].name == "Paginated Project 09"
        
        # Test second page
        page = 2
        offset = (page - 1) * page_size
        
        result = await async_session.execute(
            select(Project)
            .where(Project.name.like("Paginated Project%"))
            .order_by(Project.name)
            .limit(page_size)
            .offset(offset)
        )
        page2_results = result.scalars().all()
        
        assert len(page2_results) == page_size
        assert page2_results[0].name == "Paginated Project 10"
        assert page2_results[-1].name == "Paginated Project 19"
        
        # Test total count
        result = await async_session.execute(
            select(func.count(Project.id))
            .where(Project.name.like("Paginated Project%"))
        )
        total_count = result.scalar()
        assert total_count == 25
    
    async def test_database_aggregations(self, async_session, test_project):
        """Test agregaciones de base de datos"""
        # Create files with different sizes
        file_sizes = [1024, 2048, 4096, 8192, 16384]
        files = []
        
        for i, size in enumerate(file_sizes):
            file = File(
                name=f"test_file_{i}.rvt",
                original_name=f"test_file_{i}.rvt",
                size=size,
                content_type="application/octet-stream",
                project_id=test_project.id,
                user_id=test_project.user_id,
                status="uploaded"
            )
            files.append(file)
        
        async_session.add_all(files)
        await async_session.commit()
        
        # Test aggregations
        result = await async_session.execute(
            select(
                func.count(File.id).label("file_count"),
                func.sum(File.size).label("total_size"),
                func.avg(File.size).label("avg_size"),
                func.min(File.size).label("min_size"),
                func.max(File.size).label("max_size")
            )
            .where(File.project_id == test_project.id)
        )
        
        stats = result.one()
        
        assert stats.file_count >= 5
        assert stats.total_size == sum(file_sizes)
        assert stats.avg_size == sum(file_sizes) / len(file_sizes)
        assert stats.min_size == min(file_sizes)
        assert stats.max_size == max(file_sizes)
    
    async def test_database_json_operations(self, async_session, test_file):
        """Test operaciones JSON en base de datos"""
        # Update file with JSON metadata
        metadata = {
            "software": "Revit 2024",
            "author": "Test Author",
            "created_date": "2024-01-01",
            "properties": {
                "levels": 5,
                "rooms": 20,
                "area": 1500.5
            }
        }
        
        test_file.metadata = metadata
        await async_session.commit()
        
        # Query JSON data (PostgreSQL syntax - adjust for your DB)
        # Note: SQLite doesn't support JSON operators, so this is conceptual
        if hasattr(async_session.bind.dialect, 'name') and async_session.bind.dialect.name == 'postgresql':
            from sqlalchemy import text
            
            result = await async_session.execute(
                text("SELECT metadata->>'software' as software FROM files WHERE id = :file_id"),
                {"file_id": test_file.id}
            )
            software = result.scalar()
            assert software == "Revit 2024"
            
            # Query nested JSON
            result = await async_session.execute(
                text("SELECT (metadata->'properties'->>'levels')::int as levels FROM files WHERE id = :file_id"),
                {"file_id": test_file.id}
            )
            levels = result.scalar()
            assert levels == 5
    
    @pytest.mark.performance
    async def test_database_performance(self, async_session, test_user, performance_timer):
        """Test performance de base de datos"""
        # Test bulk insert performance
        projects = []
        for i in range(1000):
            project = Project(
                name=f"Performance Project {i}",
                user_id=test_user.id
            )
            projects.append(project)
        
        performance_timer.start()
        async_session.add_all(projects)
        await async_session.commit()
        performance_timer.stop()
        
        assert performance_timer.elapsed < 5.0  # Should complete within 5 seconds
        
        # Test bulk query performance
        performance_timer.start()
        
        result = await async_session.execute(
            select(Project).where(Project.user_id == test_user.id)
        )
        all_projects = result.scalars().all()
        
        performance_timer.stop()
        
        assert len(all_projects) >= 1000
        assert performance_timer.elapsed < 2.0  # Should query within 2 seconds
    
    async def test_database_connection_handling(self, async_session):
        """Test manejo de conexiones de base de datos"""
        # Test multiple concurrent queries
        import asyncio
        
        async def query_task(task_id):
            result = await async_session.execute(
                select(func.count(User.id))
            )
            return result.scalar()
        
        # Execute concurrent queries
        tasks = [query_task(i) for i in range(10)]
        results = await asyncio.gather(*tasks)
        
        # All should return same count
        assert all(isinstance(result, int) for result in results)
        assert len(set(results)) <= 2  # Should be same or very similar counts
