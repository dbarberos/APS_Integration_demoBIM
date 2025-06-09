#!/usr/bin/env python3
"""
Script de configuración para el sistema de gestión de archivos
"""
import os
import sys
import asyncio
import argparse
from pathlib import Path

# Agregar el directorio del backend al PYTHONPATH
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import create_tables, SessionLocal
from app.models import User, Project, File, FileProcessingJob, FileThumbnail, FileMetadataExtended
from app.models.file_metadata import FileShare, FileAccessLog, FileVersion
from app.core.config import settings
from app.services.aps_auth import APSAuthService
import structlog

logger = structlog.get_logger()


def setup_directories():
    """Crear directorios necesarios"""
    directories = [
        settings.UPLOAD_FOLDER,
        "logs",
        "temp",
        "cache",
        "backups"
    ]
    
    print("📁 Creando directorios necesarios...")
    
    for directory in directories:
        dir_path = Path(directory)
        if not dir_path.exists():
            dir_path.mkdir(parents=True, exist_ok=True)
            print(f"   ✅ Creado: {directory}")
        else:
            print(f"   ✨ Ya existe: {directory}")


def setup_database():
    """Configurar base de datos con nuevas tablas"""
    print("🗄️  Configurando base de datos...")
    
    try:
        # Crear todas las tablas
        create_tables()
        print("   ✅ Tablas de base de datos creadas/actualizadas")
        
        # Verificar conexión
        db = SessionLocal()
        try:
            # Test simple query
            db.execute("SELECT 1")
            print("   ✅ Conexión a base de datos verificada")
        finally:
            db.close()
            
    except Exception as e:
        print(f"   ❌ Error configurando base de datos: {e}")
        raise


async def test_aps_connection():
    """Probar conexión con APS"""
    print("🔗 Probando conexión con APS...")
    
    if not settings.APS_CLIENT_ID or not settings.APS_CLIENT_SECRET:
        print("   ⚠️  Credenciales APS no configuradas")
        return False
    
    try:
        auth_service = APSAuthService()
        token = await auth_service.get_application_token()
        
        if token:
            print("   ✅ Conexión APS exitosa")
            return True
        else:
            print("   ❌ No se pudo obtener token APS")
            return False
            
    except Exception as e:
        print(f"   ❌ Error conectando a APS: {e}")
        return False


def setup_redis_connection():
    """Verificar conexión Redis"""
    print("🔴 Verificando conexión Redis...")
    
    try:
        import redis
        
        # Conectar a Redis
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        
        print("   ✅ Conexión Redis exitosa")
        return True
        
    except ImportError:
        print("   ⚠️  Redis no instalado (pip install redis)")
        return False
    except Exception as e:
        print(f"   ❌ Error conectando a Redis: {e}")
        return False


def create_sample_data():
    """Crear datos de ejemplo para desarrollo"""
    print("📊 Creando datos de ejemplo...")
    
    db = SessionLocal()
    try:
        # Verificar si ya hay datos
        existing_files = db.query(File).count()
        if existing_files > 0:
            print("   ✨ Ya existen datos de ejemplo")
            return
        
        # Buscar usuario admin
        admin_user = db.query(User).filter(User.email == "admin@aps-integration.com").first()
        if not admin_user:
            print("   ⚠️  Usuario admin no encontrado. Ejecuta init_db.py primero")
            return
        
        # Buscar proyecto de ejemplo
        sample_project = db.query(Project).filter(Project.user_id == admin_user.id).first()
        if not sample_project:
            print("   ⚠️  Proyecto de ejemplo no encontrado")
            return
        
        # Crear archivos de ejemplo
        sample_files = [
            {
                "name": "casa-arquitectura.rvt",
                "original_filename": "Casa - Arquitectura.rvt",
                "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6ZXhhbXBsZS1wcm9qZWN0L2Nhc2EtYXJxdWl0ZWN0dXJhLnJ2dA",
                "object_key": "casa-arquitectura.rvt",
                "size": 15728640,
                "status": "ready",
                "content_type": "application/octet-stream"
            },
            {
                "name": "estructura.dwg",
                "original_filename": "Planos Estructura.dwg",
                "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6ZXhhbXBsZS1wcm9qZWN0L2VzdHJ1Y3R1cmEuZHdn",
                "object_key": "estructura.dwg",
                "size": 8945632,
                "status": "ready",
                "content_type": "application/x-dwg"
            },
            {
                "name": "instalaciones.ifc",
                "original_filename": "Instalaciones MEP.ifc",
                "urn": "dXJuOmFkc2s6b2JqZWN0cy5vcy5vYmplY3Q6ZXhhbXBsZS1wcm9qZWN0L2luc3RhbGFjaW9uZXMuaWZj",
                "object_key": "instalaciones.ifc",
                "size": 12582912,
                "status": "translating",
                "content_type": "application/x-step"
            }
        ]
        
        created_files = []
        for file_data in sample_files:
            sample_file = File(
                **file_data,
                bucket_key=sample_project.bucket_key,
                project_id=sample_project.id,
                translation_progress="100%" if file_data["status"] == "ready" else "45%"
            )
            
            db.add(sample_file)
            created_files.append(sample_file)
        
        db.commit()
        
        # Crear metadatos extendidos para uno de los archivos
        for file in created_files:
            db.refresh(file)
            
            if file.name.endswith('.rvt'):
                metadata = FileMetadataExtended(
                    file_id=file.id,
                    original_format="Revit",
                    software_version="2024",
                    units="mm",
                    discipline="Architecture",
                    category="Building",
                    element_count=1250,
                    has_materials=True,
                    has_textures=False,
                    has_lighting=True,
                    tags=["residential", "single-family", "modern"],
                    custom_properties={"project_phase": "design", "level_count": 2}
                )
                db.add(metadata)
        
        db.commit()
        
        print(f"   ✅ Creados {len(sample_files)} archivos de ejemplo")
        
    except Exception as e:
        print(f"   ❌ Error creando datos de ejemplo: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def validate_environment():
    """Validar configuración del entorno"""
    print("🔍 Validando configuración del entorno...")
    
    required_vars = [
        'SECRET_KEY',
        'POSTGRES_SERVER',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_DB'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not getattr(settings, var, None):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"   ❌ Variables de entorno faltantes: {', '.join(missing_vars)}")
        return False
    
    # Verificar configuración de archivos
    if settings.MAX_FILE_SIZE < 1024 * 1024:  # Mínimo 1MB
        print("   ⚠️  MAX_FILE_SIZE muy pequeño")
    
    if not settings.ALLOWED_EXTENSIONS:
        print("   ❌ ALLOWED_EXTENSIONS no configurado")
        return False
    
    print("   ✅ Configuración del entorno válida")
    return True


def generate_test_files():
    """Generar archivos de prueba para testing"""
    print("🧪 Generando archivos de prueba...")
    
    test_dir = Path("test_files")
    test_dir.mkdir(exist_ok=True)
    
    # Crear archivos de prueba pequeños
    test_files = {
        "small_model.rvt": 1024,      # 1KB
        "medium_model.dwg": 1024 * 10, # 10KB
        "large_model.ifc": 1024 * 100, # 100KB
    }
    
    for filename, size in test_files.items():
        file_path = test_dir / filename
        if not file_path.exists():
            # Crear archivo con contenido aleatorio
            with open(file_path, 'wb') as f:
                f.write(os.urandom(size))
            print(f"   ✅ Creado: {filename} ({size} bytes)")
        else:
            print(f"   ✨ Ya existe: {filename}")


def print_configuration_summary():
    """Mostrar resumen de configuración"""
    print("\n" + "="*60)
    print("📋 RESUMEN DE CONFIGURACIÓN")
    print("="*60)
    
    print(f"🌐 Servidor: {settings.SERVER_HOST}:{settings.SERVER_PORT}")
    print(f"🗄️  Base de datos: {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    print(f"🔴 Redis: {settings.REDIS_HOST}:{settings.REDIS_PORT}")
    print(f"📁 Upload folder: {settings.UPLOAD_FOLDER}")
    print(f"📏 Tamaño máximo: {settings.MAX_FILE_SIZE // (1024*1024)}MB")
    print(f"🔧 Chunk size: {settings.CHUNK_SIZE // (1024*1024)}MB")
    print(f"📋 Extensiones: {len(settings.ALLOWED_EXTENSIONS)} tipos soportados")
    
    if settings.APS_CLIENT_ID:
        print(f"🔗 APS Client ID: {settings.APS_CLIENT_ID[:8]}...")
    else:
        print("⚠️  APS no configurado")
    
    if settings.WEBHOOK_SECRET:
        print(f"🪝 Webhook secret: configurado")
    else:
        print("⚠️  Webhook secret no configurado")
    
    print(f"⚡ Rate limit: {settings.RATE_LIMIT_PER_MINUTE}/min")
    print(f"🔄 Auto translate: {settings.AUTO_TRANSLATE_ON_UPLOAD}")
    print(f"🖼️  Auto thumbnails: {settings.AUTO_GENERATE_THUMBNAILS}")
    print(f"📊 Auto metadata: {settings.AUTO_EXTRACT_METADATA}")


async def main():
    """Función principal"""
    parser = argparse.ArgumentParser(description="Configurar sistema de gestión de archivos")
    parser.add_argument("--skip-aps", action="store_true", help="Omitir prueba de APS")
    parser.add_argument("--skip-redis", action="store_true", help="Omitir prueba de Redis")
    parser.add_argument("--no-sample-data", action="store_true", help="No crear datos de ejemplo")
    parser.add_argument("--test-files", action="store_true", help="Generar archivos de prueba")
    
    args = parser.parse_args()
    
    print("🚀 Configurando Sistema de Gestión de Archivos APS")
    print("="*60)
    
    success = True
    
    # 1. Validar entorno
    if not validate_environment():
        success = False
    
    # 2. Crear directorios
    setup_directories()
    
    # 3. Configurar base de datos
    try:
        setup_database()
    except Exception:
        success = False
    
    # 4. Probar Redis
    if not args.skip_redis:
        if not setup_redis_connection():
            success = False
    
    # 5. Probar APS
    if not args.skip_aps:
        if not await test_aps_connection():
            success = False
    
    # 6. Crear datos de ejemplo
    if not args.no_sample_data:
        try:
            create_sample_data()
        except Exception:
            success = False
    
    # 7. Generar archivos de prueba
    if args.test_files:
        generate_test_files()
    
    # 8. Mostrar resumen
    print_configuration_summary()
    
    print("\n" + "="*60)
    if success:
        print("🎉 ¡Configuración completada exitosamente!")
        print("\n📚 Próximos pasos:")
        print("   1. Iniciar el servidor: uvicorn app.main:app --reload")
        print("   2. Abrir docs: http://localhost:8000/docs")
        print("   3. Probar upload: POST /api/v1/files/upload")
        print("   4. Monitorear webhooks: GET /api/v1/webhooks/status")
    else:
        print("❌ Configuración completada con errores.")
        print("   Revisa los mensajes anteriores y corrige los problemas.")
        sys.exit(1)
    
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
