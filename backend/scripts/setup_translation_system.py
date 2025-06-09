#!/usr/bin/env python3
"""
Script de configuración para el sistema de traducción de modelos
"""
import os
import sys
import asyncio
import argparse
from pathlib import Path
from datetime import datetime

# Agregar el directorio del backend al PYTHONPATH
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import create_tables, SessionLocal
from app.models import (
    TranslationJob, TranslationConfig, TranslationMetrics,
    User, Project, File
)
from app.services.model_derivative import model_derivative_service
from app.services.urn_manager import urn_manager
from app.services.metadata_extractor import metadata_extractor
from app.services.translation_manager import translation_manager
from app.core.config import settings
import structlog

logger = structlog.get_logger()


def create_translation_tables():
    """Crear tablas específicas de traducción"""
    print("🗄️  Creando tablas de traducción...")
    
    try:
        # Crear todas las tablas (incluye las nuevas de traducción)
        create_tables()
        print("   ✅ Tablas de traducción creadas/actualizadas")
        
        # Verificar tablas específicas
        db = SessionLocal()
        try:
            # Test queries para verificar tablas
            db.execute("SELECT COUNT(*) FROM translation_jobs LIMIT 1")
            db.execute("SELECT COUNT(*) FROM translation_configs LIMIT 1")
            db.execute("SELECT COUNT(*) FROM translation_metrics LIMIT 1")
            print("   ✅ Verificación de tablas exitosa")
        finally:
            db.close()
            
    except Exception as e:
        print(f"   ❌ Error creando tablas: {e}")
        raise


def create_default_translation_configs():
    """Crear configuraciones de traducción por defecto"""
    print("⚙️  Creando configuraciones de traducción por defecto...")
    
    db = SessionLocal()
    try:
        # Verificar si ya existen configuraciones
        existing_configs = db.query(TranslationConfig).count()
        if existing_configs > 0:
            print("   ✨ Ya existen configuraciones de traducción")
            return
        
        # Buscar usuario admin
        admin_user = db.query(User).filter(User.email == "admin@aps-integration.com").first()
        if not admin_user:
            print("   ⚠️  Usuario admin no encontrado. Ejecuta init_db.py primero")
            return
        
        # Configuraciones por defecto
        default_configs = [
            {
                'name': 'Revit Standard',
                'description': 'Configuración estándar para archivos Revit (.rvt)',
                'file_extensions': ['.rvt', '.rfa', '.rte'],
                'default_output_formats': ['svf2', 'thumbnail'],
                'svf2_config': {
                    'generateMasterViews': True,
                    'buildingStoreys': True,
                    'spaces': True,
                    'materialProperties': True,
                    'compressionLevel': 6
                },
                'thumbnail_config': {
                    'width': 400,
                    'height': 400
                },
                'advanced_options': {
                    'generateMasterViews': True,
                    'buildingStoreys': True,
                    'materialProperties': True
                },
                'polling_interval': 30,
                'max_retries': 3,
                'is_default': True
            },
            {
                'name': 'IFC Standard',
                'description': 'Configuración estándar para archivos IFC',
                'file_extensions': ['.ifc'],
                'default_output_formats': ['svf2', 'thumbnail'],
                'svf2_config': {
                    'generateMasterViews': True,
                    'materialProperties': True,
                    'openingElements': True,
                    'compressionLevel': 6
                },
                'thumbnail_config': {
                    'width': 400,
                    'height': 400
                },
                'advanced_options': {
                    'generateMasterViews': True,
                    'materialProperties': True,
                    'openingElements': True
                },
                'polling_interval': 45,
                'max_retries': 3
            },
            {
                'name': 'AutoCAD Standard',
                'description': 'Configuración estándar para archivos AutoCAD (.dwg)',
                'file_extensions': ['.dwg', '.dxf'],
                'default_output_formats': ['svf', 'thumbnail'],
                'svf_config': {
                    'generateMasterViews': False,
                    '2dviews': True,
                    'extractThumbnail': True
                },
                'thumbnail_config': {
                    'width': 300,
                    'height': 300
                },
                'advanced_options': {
                    'generateMasterViews': False,
                    '2dviews': True
                },
                'polling_interval': 20,
                'max_retries': 2
            },
            {
                'name': 'Rhino Standard',
                'description': 'Configuración estándar para archivos Rhino (.3dm)',
                'file_extensions': ['.3dm'],
                'default_output_formats': ['svf2', 'thumbnail'],
                'svf2_config': {
                    'generateMasterViews': True,
                    'materialProperties': True,
                    'compressionLevel': 5
                },
                'thumbnail_config': {
                    'width': 400,
                    'height': 400
                },
                'advanced_options': {
                    'generateMasterViews': True,
                    'materialProperties': True
                },
                'polling_interval': 25,
                'max_retries': 3
            },
            {
                'name': 'High Quality',
                'description': 'Configuración de alta calidad para modelos importantes',
                'file_extensions': ['.rvt', '.ifc', '.3dm', '.skp'],
                'default_output_formats': ['svf2', 'thumbnail', 'obj'],
                'svf2_config': {
                    'generateMasterViews': True,
                    'materialProperties': True,
                    'compressionLevel': 3,
                    'buildingStoreys': True,
                    'spaces': True
                },
                'thumbnail_config': {
                    'width': 800,
                    'height': 600
                },
                'advanced_options': {
                    'generateMasterViews': True,
                    'materialProperties': True,
                    'buildingStoreys': True,
                    'spaces': True,
                    'openingElements': True
                },
                'polling_interval': 20,
                'max_retries': 5
            },
            {
                'name': 'Fast Preview',
                'description': 'Configuración rápida para previsualizaciones',
                'file_extensions': ['.rvt', '.dwg', '.ifc', '.3dm', '.skp'],
                'default_output_formats': ['thumbnail'],
                'thumbnail_config': {
                    'width': 200,
                    'height': 200
                },
                'advanced_options': {
                    'generateMasterViews': False,
                    'materialProperties': False
                },
                'polling_interval': 15,
                'max_retries': 2
            }
        ]
        
        # Crear configuraciones
        created_count = 0
        for config_data in default_configs:
            config = TranslationConfig(
                **config_data,
                created_by_id=admin_user.id
            )
            db.add(config)
            created_count += 1
        
        db.commit()
        print(f"   ✅ Creadas {created_count} configuraciones de traducción")
        
    except Exception as e:
        print(f"   ❌ Error creando configuraciones: {e}")
        db.rollback()
        raise
    finally:
        db.close()


async def test_model_derivative_connection():
    """Probar conexión con Model Derivative API"""
    print("🔗 Probando conexión con Model Derivative API...")
    
    if not settings.APS_CLIENT_ID or not settings.APS_CLIENT_SECRET:
        print("   ⚠️  Credenciales APS no configuradas")
        return False
    
    try:
        # Probar obtención de formatos soportados
        formats = await model_derivative_service.check_supported_formats()
        
        if formats and ('input_formats' in formats or 'output_formats' in formats):
            input_count = len(formats.get('input_formats', []))
            output_count = len(formats.get('output_formats', []))
            print(f"   ✅ Conexión exitosa - {input_count} formatos de entrada, {output_count} de salida")
            return True
        else:
            print("   ❌ Respuesta inesperada de la API")
            return False
            
    except Exception as e:
        print(f"   ❌ Error conectando a Model Derivative API: {e}")
        return False


def test_urn_manager():
    """Probar URN Manager"""
    print("🔐 Probando URN Manager...")
    
    try:
        # Test URN de ejemplo
        test_urn = "urn:adsk.objects:os.object:test-bucket/sample-file.rvt"
        
        # Validar URN
        urn_manager.validate_urn(test_urn)
        print("   ✅ Validación de URN")
        
        # Codificar/decodificar
        encoded = urn_manager.encode_urn(test_urn)
        decoded = urn_manager.decode_urn(encoded)
        assert decoded == test_urn
        print("   ✅ Codificación/decodificación")
        
        # Encriptar/desencriptar
        encrypted = urn_manager.encrypt_urn(test_urn)
        decrypted = urn_manager.decrypt_urn(encrypted)
        assert decrypted == test_urn
        print("   ✅ Encriptación/desencriptación")
        
        # Generar URN de objeto
        generated_urn = urn_manager.generate_object_urn("test-bucket", "sample-file.rvt")
        assert "test-bucket" in generated_urn
        assert "sample-file.rvt" in generated_urn
        print("   ✅ Generación de URN")
        
        # URN firmado
        signed_urn = urn_manager.create_signed_urn(test_urn, expires_in=3600)
        original_urn, is_valid = urn_manager.verify_signed_urn(signed_urn)
        assert is_valid and original_urn == test_urn
        print("   ✅ URN firmado")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error en URN Manager: {e}")
        return False


async def test_metadata_extractor():
    """Probar Metadata Extractor"""
    print("📊 Probando Metadata Extractor...")
    
    try:
        # Test con manifest de ejemplo
        sample_manifest = {
            "type": "manifest",
            "status": "success",
            "derivatives": [
                {
                    "outputType": "svf2",
                    "status": "success",
                    "children": [
                        {
                            "type": "resource",
                            "role": "graphics",
                            "guid": "test-model-guid"
                        }
                    ]
                }
            ]
        }
        
        # Probar extracción de GUID
        guid = metadata_extractor._extract_model_guid(sample_manifest)
        assert guid == "test-model-guid"
        print("   ✅ Extracción de GUID")
        
        # Probar análisis de jerarquía
        object_tree = {
            "data": {
                "objects": [
                    {
                        "name": "Root",
                        "objects": [
                            {"name": "Child1", "objects": []},
                            {"name": "Child2", "objects": []}
                        ]
                    }
                ]
            }
        }
        
        hierarchy_info = metadata_extractor._analyze_hierarchy(object_tree)
        assert hierarchy_info['total_nodes'] == 3
        print("   ✅ Análisis de jerarquía")
        
        # Probar mapeo de disciplinas
        assert metadata_extractor._map_category_to_discipline("Walls") == "Architecture"
        assert metadata_extractor._map_category_to_discipline("Duct Systems") == "MEP"
        print("   ✅ Mapeo de disciplinas")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error en Metadata Extractor: {e}")
        return False


def create_sample_translation_jobs():
    """Crear trabajos de traducción de ejemplo para desarrollo"""
    print("📊 Creando trabajos de traducción de ejemplo...")
    
    db = SessionLocal()
    try:
        # Verificar si ya hay trabajos
        existing_jobs = db.query(TranslationJob).count()
        if existing_jobs > 0:
            print("   ✨ Ya existen trabajos de traducción")
            return
        
        # Buscar archivos y usuario de ejemplo
        admin_user = db.query(User).filter(User.email == "admin@aps-integration.com").first()
        sample_files = db.query(File).filter(File.user_id == admin_user.id).limit(3).all()
        
        if not admin_user or not sample_files:
            print("   ⚠️  No se encontraron datos de ejemplo. Ejecuta init_db.py primero")
            return
        
        # Crear trabajos de ejemplo
        sample_jobs = []
        for i, file_obj in enumerate(sample_files):
            # Estados diferentes para mostrar variedad
            statuses = ['success', 'failed', 'inprogress']
            status = statuses[i % len(statuses)]
            
            job = TranslationJob(
                job_id=f"sample-job-{i+1}-{datetime.now().strftime('%Y%m%d')}",
                file_id=file_obj.id,
                user_id=admin_user.id,
                source_urn=file_obj.urn,
                output_formats=['svf2', 'thumbnail'],
                priority='normal',
                status=status,
                progress=100.0 if status == 'success' else (50.0 if status == 'inprogress' else 0.0),
                progress_message='Completado' if status == 'success' else 'En progreso...',
                translation_config={
                    'quality_level': 'medium',
                    'auto_extract_metadata': True
                },
                estimated_duration=300,
                polling_interval=30,
                max_retries=3
            )
            
            if status == 'success':
                job.started_at = datetime.utcnow()
                job.completed_at = datetime.utcnow()
                job.manifest_data = {
                    'status': 'success',
                    'derivatives': [
                        {'outputType': 'svf2', 'status': 'success'},
                        {'outputType': 'thumbnail', 'status': 'success'}
                    ]
                }
                job.quality_metrics = {
                    'overall_quality_score': 0.85 + (i * 0.05),
                    'completeness_score': 0.9,
                    'detail_level_score': 0.8
                }
            elif status == 'failed':
                job.started_at = datetime.utcnow()
                job.completed_at = datetime.utcnow()
                job.error_message = "Error de ejemplo para demostración"
                job.retry_count = 1
            elif status == 'inprogress':
                job.started_at = datetime.utcnow()
            
            db.add(job)
            sample_jobs.append(job)
        
        db.commit()
        
        print(f"   ✅ Creados {len(sample_jobs)} trabajos de traducción de ejemplo")
        
    except Exception as e:
        print(f"   ❌ Error creando trabajos de ejemplo: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def validate_translation_environment():
    """Validar configuración del entorno para traducción"""
    print("🔍 Validando configuración del entorno de traducción...")
    
    required_vars = [
        'SECRET_KEY',
        'APS_CLIENT_ID',
        'APS_CLIENT_SECRET',
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
    
    # Verificar configuraciones específicas de traducción
    if not settings.MAX_FILE_SIZE or settings.MAX_FILE_SIZE < 1024 * 1024:
        print("   ⚠️  MAX_FILE_SIZE no configurado o muy pequeño")
    
    if not settings.ALLOWED_EXTENSIONS:
        print("   ⚠️  ALLOWED_EXTENSIONS no configurado")
    
    print("   ✅ Configuración del entorno válida")
    return True


def print_translation_system_summary():
    """Mostrar resumen del sistema de traducción"""
    print("\n" + "="*70)
    print("📋 RESUMEN DEL SISTEMA DE TRADUCCIÓN")
    print("="*70)
    
    print(f"🔗 Model Derivative API: {settings.APS_CLIENT_ID[:8] + '...' if settings.APS_CLIENT_ID else 'No configurado'}")
    print(f"📏 Tamaño máximo de archivo: {settings.MAX_FILE_SIZE // (1024*1024)}MB")
    print(f"📋 Extensiones soportadas: {len(settings.ALLOWED_EXTENSIONS)} tipos")
    print(f"⏱️  Intervalo de polling por defecto: 30 segundos")
    print(f"🔄 Reintentos máximos por defecto: 3")
    
    # Mostrar formatos de salida disponibles
    output_formats = ['SVF', 'SVF2', 'Thumbnail', 'STL', 'OBJ', 'GLTF', 'STEP', 'IGES']
    print(f"📤 Formatos de salida: {', '.join(output_formats)}")
    
    # Mostrar niveles de calidad
    quality_levels = ['Low', 'Medium', 'High']
    print(f"⭐ Niveles de calidad: {', '.join(quality_levels)}")
    
    # Mostrar disciplinas soportadas
    disciplines = ['Architecture', 'Structure', 'MEP', 'Civil', 'Generic']
    print(f"🏗️  Disciplinas: {', '.join(disciplines)}")
    
    print("\n📚 APIs Disponibles:")
    endpoints = [
        "POST /api/v1/translate - Iniciar traducción",
        "GET /api/v1/translate/{job_id}/status - Estado de traducción",
        "GET /api/v1/translate/{job_id}/manifest - Manifest del modelo",
        "GET /api/v1/translate/{job_id}/metadata - Metadatos extraídos",
        "GET /api/v1/translate/{job_id}/hierarchy - Jerarquía de objetos",
        "POST /api/v1/translate/{job_id}/retry - Reintentar traducción",
        "DELETE /api/v1/translate/{job_id} - Cancelar traducción",
        "GET /api/v1/translate/formats/supported - Formatos soportados",
        "GET /api/v1/translate/stats/overview - Estadísticas"
    ]
    
    for endpoint in endpoints:
        print(f"   • {endpoint}")


async def main():
    """Función principal"""
    parser = argparse.ArgumentParser(description="Configurar sistema de traducción de modelos")
    parser.add_argument("--skip-aps", action="store_true", help="Omitir prueba de APS")
    parser.add_argument("--no-sample-data", action="store_true", help="No crear datos de ejemplo")
    parser.add_argument("--quick", action="store_true", help="Configuración rápida (solo lo esencial)")
    
    args = parser.parse_args()
    
    print("🚀 Configurando Sistema de Traducción de Modelos APS")
    print("="*70)
    
    success = True
    
    # 1. Validar entorno
    if not validate_translation_environment():
        success = False
    
    # 2. Crear tablas de traducción
    try:
        create_translation_tables()
    except Exception:
        success = False
    
    # 3. Crear configuraciones por defecto
    try:
        create_default_translation_configs()
    except Exception:
        success = False
    
    # 4. Probar conexión APS (opcional)
    if not args.skip_aps:
        aps_success = await test_model_derivative_connection()
        if not aps_success:
            success = False
    
    # 5. Probar componentes del sistema
    if not args.quick:
        if not test_urn_manager():
            success = False
        
        if not await test_metadata_extractor():
            success = False
    
    # 6. Crear datos de ejemplo (opcional)
    if not args.no_sample_data:
        try:
            create_sample_translation_jobs()
        except Exception:
            success = False
    
    # 7. Mostrar resumen
    print_translation_system_summary()
    
    print("\n" + "="*70)
    if success:
        print("🎉 ¡Sistema de traducción configurado exitosamente!")
        print("\n📚 Próximos pasos:")
        print("   1. Iniciar el servidor: uvicorn app.main:app --reload")
        print("   2. Abrir docs: http://localhost:8000/docs")
        print("   3. Probar traducción: POST /api/v1/translate")
        print("   4. Monitorear estado: GET /api/v1/translate/{job_id}/status")
        print("   5. Ver metadatos: GET /api/v1/translate/{job_id}/metadata")
        
        if not args.skip_aps:
            print("\n🔄 Para iniciar tareas de fondo:")
            print("   celery -A app.tasks worker --loglevel=info")
            print("   celery -A app.tasks beat --loglevel=info")
    else:
        print("❌ Configuración completada con errores.")
        print("   Revisa los mensajes anteriores y corrige los problemas.")
        sys.exit(1)
    
    print("="*70)


if __name__ == "__main__":
    asyncio.run(main())
