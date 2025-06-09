"""
Configuración de base de datos y sesiones SQLAlchemy
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import structlog

from app.core.config import settings

logger = structlog.get_logger()

# Crear engine de base de datos
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=settings.LOG_LEVEL == "DEBUG"
)

# Crear SessionLocal
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para modelos
Base = declarative_base()


def get_db() -> Session:
    """
    Dependency para obtener sesión de base de datos
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error("Error en sesión de base de datos", error=str(e))
        db.rollback()
        raise
    finally:
        db.close()


def create_tables():
    """
    Crear todas las tablas en la base de datos
    """
    logger.info("Creando tablas de base de datos")
    Base.metadata.create_all(bind=engine)


def drop_tables():
    """
    Eliminar todas las tablas (solo para desarrollo/testing)
    """
    logger.warning("Eliminando todas las tablas de base de datos")
    Base.metadata.drop_all(bind=engine)
