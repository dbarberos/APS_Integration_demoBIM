#!/usr/bin/env python3
"""
Script de inicialización de base de datos
"""
import sys
import os
from pathlib import Path

# Agregar el directorio del backend al PYTHONPATH
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.core.database import create_tables, drop_tables, SessionLocal
from app.models import User, Project, File, ViewerSession
from app.core.security import get_password_hash
import structlog

logger = structlog.get_logger()

def create_default_admin_user():
    """Crear usuario administrador por defecto"""
    try:
        db = SessionLocal()
        
        # Verificar si ya existe un admin
        existing_admin = db.query(User).filter(User.email == "admin@aps-integration.com").first()
        
        if existing_admin:
            logger.info("Usuario administrador ya existe")
            return existing_admin
        
        # Crear nuevo admin
        admin_user = User(
            email="admin@aps-integration.com",
            hashed_password=get_password_hash("admin"),
            full_name="Administrador",
            is_active=True,
            is_superuser=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        logger.info("Usuario administrador creado", user_id=admin_user.id)
        return admin_user
        
    except Exception as e:
        logger.error("Error al crear usuario administrador", error=str(e))
        db.rollback()
        raise
    finally:
        db.close()

def create_sample_data():
    """Crear datos de ejemplo para desarrollo"""
    try:
        db = SessionLocal()
        
        # Obtener usuario admin
        admin_user = db.query(User).filter(User.email == "admin@aps-integration.com").first()
        if not admin_user:
            logger.error("Usuario administrador no encontrado")
            return
        
        # Verificar si ya existen proyectos
        existing_projects = db.query(Project).filter(Project.user_id == admin_user.id).count()
        if existing_projects > 0:
            logger.info("Datos de ejemplo ya existen")
            return
        
        # Crear proyecto de ejemplo
        sample_project = Project(
            name="Proyecto de Ejemplo",
            description="Proyecto de demostración para desarrollo",
            bucket_key=f"ejemplo-proyecto-{admin_user.id}",
            user_id=admin_user.id,
            aps_bucket_policy="temporary"
        )
        
        db.add(sample_project)
        db.commit()
        db.refresh(sample_project)
        
        logger.info("Proyecto de ejemplo creado", project_id=sample_project.id)
        
        # Crear archivo de ejemplo (simulado)
        sample_file = File(
            name="modelo-ejemplo.rvt",
            original_filename="Modelo de Ejemplo.rvt",
            content_type="application/octet-stream",
            size=5242880,  # 5MB
            urn="dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6ZWplbXBsby1wcm95ZWN0by0xL21vZGVsby1lamVtcGxvLnJ2dA",
            object_key="modelo-ejemplo.rvt",
            bucket_key=sample_project.bucket_key,
            status="ready",
            project_id=sample_project.id
        )
        
        db.add(sample_file)
        db.commit()
        
        logger.info("Archivo de ejemplo creado", file_id=sample_file.id)
        
    except Exception as e:
        logger.error("Error al crear datos de ejemplo", error=str(e))
        db.rollback()
        raise
    finally:
        db.close()

def init_database(reset=False):
    """Inicializar base de datos"""
    try:
        if reset:
            logger.warning("Eliminando todas las tablas existentes")
            drop_tables()
        
        logger.info("Creando tablas de base de datos")
        create_tables()
        
        logger.info("Creando usuario administrador por defecto")
        create_default_admin_user()
        
        logger.info("Creando datos de ejemplo")
        create_sample_data()
        
        logger.info("✅ Inicialización de base de datos completada exitosamente")
        
    except Exception as e:
        logger.error("❌ Error durante inicialización de base de datos", error=str(e))
        raise

def main():
    """Función principal"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Inicializar base de datos APS Integration")
    parser.add_argument(
        "--reset", 
        action="store_true", 
        help="Eliminar y recrear todas las tablas"
    )
    parser.add_argument(
        "--no-sample-data",
        action="store_true",
        help="No crear datos de ejemplo"
    )
    
    args = parser.parse_args()
    
    if args.reset:
        confirm = input("⚠️  ¿Estás seguro de que quieres eliminar todas las tablas? (y/N): ")
        if confirm.lower() != 'y':
            print("Operación cancelada")
            return
    
    print("🚀 Inicializando base de datos APS Integration...")
    
    try:
        init_database(reset=args.reset)
        
        print("\n" + "="*60)
        print("🎉 Base de datos inicializada correctamente!")
        print("="*60)
        print("📋 Credenciales de administrador:")
        print("   Email: admin@aps-integration.com")
        print("   Password: admin")
        print("="*60)
        
        if not args.no_sample_data:
            print("📦 Datos de ejemplo creados:")
            print("   - Proyecto: 'Proyecto de Ejemplo'")
            print("   - Archivo: 'modelo-ejemplo.rvt'")
            print("="*60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
