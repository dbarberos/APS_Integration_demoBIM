#!/usr/bin/env python3
"""
Script para ejecutar las pruebas del backend
"""
import os
import sys
import subprocess
from pathlib import Path

def run_command(command, description):
    """Ejecutar comando y mostrar resultado"""
    print(f"\n{'='*60}")
    print(f"🔧 {description}")
    print(f"{'='*60}")
    
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    
    if result.stdout:
        print(result.stdout)
    
    if result.stderr:
        print(f"⚠️  Stderr: {result.stderr}")
    
    if result.returncode != 0:
        print(f"❌ {description} falló con código {result.returncode}")
        return False
    else:
        print(f"✅ {description} completado exitosamente")
        return True

def main():
    """Función principal"""
    print("🚀 Ejecutando suite de pruebas del backend APS Integration")
    
    # Cambiar al directorio del backend
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    # Configurar PYTHONPATH
    os.environ['PYTHONPATH'] = str(backend_dir)
    
    success = True
    
    # 1. Verificar instalación de dependencias
    success &= run_command(
        "python -m pip install -q -r requirements.txt",
        "Instalando dependencias"
    )
    
    # 2. Verificar linting con flake8
    success &= run_command(
        "python -m flake8 app --count --select=E9,F63,F7,F82 --show-source --statistics",
        "Verificando errores críticos de sintaxis"
    )
    
    # 3. Verificar formato con black (modo check)
    success &= run_command(
        "python -m black --check --diff app",
        "Verificando formato de código"
    )
    
    # 4. Ejecutar pruebas unitarias
    success &= run_command(
        "python -m pytest tests/ -v --tb=short",
        "Ejecutando pruebas unitarias"
    )
    
    # 5. Generar reporte de cobertura
    success &= run_command(
        "python -m pytest tests/ --cov=app --cov-report=term-missing --cov-report=html",
        "Generando reporte de cobertura"
    )
    
    # 6. Verificar tipos con mypy (opcional)
    success &= run_command(
        "python -m mypy app --ignore-missing-imports",
        "Verificando tipos estáticos"
    )
    
    print(f"\n{'='*60}")
    if success:
        print("🎉 ¡Todas las verificaciones pasaron exitosamente!")
        print("📊 Reporte de cobertura generado en: htmlcov/index.html")
    else:
        print("❌ Algunas verificaciones fallaron. Revisa los mensajes anteriores.")
        sys.exit(1)
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
