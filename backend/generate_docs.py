#!/usr/bin/env python3
"""
Script para generar documentación automática de la API
"""
import json
import sys
from pathlib import Path

# Agregar el directorio del backend al PYTHONPATH
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.main import app

def generate_openapi_spec():
    """Generar especificación OpenAPI"""
    try:
        # Obtener especificación OpenAPI
        openapi_spec = app.openapi()
        
        # Crear directorio docs si no existe
        docs_dir = backend_dir / "docs"
        docs_dir.mkdir(exist_ok=True)
        
        # Guardar especificación en JSON
        spec_file = docs_dir / "openapi.json"
        with open(spec_file, 'w', encoding='utf-8') as f:
            json.dump(openapi_spec, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Especificación OpenAPI guardada en: {spec_file}")
        
        # Generar README de la API
        generate_api_readme(openapi_spec, docs_dir)
        
        return spec_file
        
    except Exception as e:
        print(f"❌ Error al generar especificación OpenAPI: {e}")
        raise

def generate_api_readme(spec, docs_dir):
    """Generar README de la API"""
    try:
        readme_content = f"""# API Documentation - APS Integration

## Información General

- **Título**: {spec['info']['title']}
- **Versión**: {spec['info']['version']}
- **Descripción**: {spec['info']['description']}

## URLs Base

- **Desarrollo**: http://localhost:8000
- **Documentación Interactiva**: http://localhost:8000/docs
- **Especificación OpenAPI**: http://localhost:8000/openapi.json

## Autenticación

La API utiliza autenticación Bearer Token (JWT). Incluye el token en el header:

```
Authorization: Bearer <tu_token_jwt>
```

## Endpoints Principales

"""
        
        # Agrupar endpoints por tags
        endpoints_by_tag = {}
        
        for path, methods in spec['paths'].items():
            for method, details in methods.items():
                if method.upper() in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
                    tags = details.get('tags', ['Sin categoría'])
                    tag = tags[0] if tags else 'Sin categoría'
                    
                    if tag not in endpoints_by_tag:
                        endpoints_by_tag[tag] = []
                    
                    endpoints_by_tag[tag].append({
                        'method': method.upper(),
                        'path': path,
                        'summary': details.get('summary', 'Sin descripción'),
                        'description': details.get('description', '')
                    })
        
        # Agregar endpoints por categoría
        for tag, endpoints in endpoints_by_tag.items():
            readme_content += f"### {tag.title()}\n\n"
            
            for endpoint in endpoints:
                readme_content += f"#### {endpoint['method']} {endpoint['path']}\n"
                readme_content += f"**Resumen**: {endpoint['summary']}\n\n"
                
                if endpoint['description']:
                    readme_content += f"**Descripción**: {endpoint['description']}\n\n"
                
                readme_content += "---\n\n"
        
        # Agregar información adicional
        readme_content += """## Modelos de Datos

### Esquemas Principales

Los esquemas de datos están definidos en los componentes de la especificación OpenAPI.
Consulta la documentación interactiva en `/docs` para ver los modelos detallados.

### Códigos de Estado HTTP

- `200` - OK: Solicitud exitosa
- `201` - Created: Recurso creado exitosamente  
- `204` - No Content: Operación exitosa sin contenido
- `400` - Bad Request: Error en los datos de entrada
- `401` - Unauthorized: Autenticación requerida
- `403` - Forbidden: Permisos insuficientes
- `404` - Not Found: Recurso no encontrado
- `409` - Conflict: Conflicto con el estado actual
- `422` - Unprocessable Entity: Error de validación
- `429` - Too Many Requests: Rate limit excedido
- `500` - Internal Server Error: Error interno del servidor

## Rate Limiting

- **Límite por usuario autenticado**: 100 peticiones por minuto
- **Límite por IP**: Varía según el endpoint

## Ejemplos de Uso

### Autenticación

```bash
# Login
curl -X POST "http://localhost:8000/api/v1/auth/login" \\
     -H "Content-Type: application/x-www-form-urlencoded" \\
     -d "username=admin@aps-integration.com&password=admin"

# Respuesta
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer"
}
```

### Subir Modelo

```bash
# Upload de archivo CAD/BIM
curl -X POST "http://localhost:8000/api/v1/models/upload" \\
     -H "Authorization: Bearer <token>" \\
     -F "file=@modelo.rvt" \\
     -F "project_id=1"
```

### Listar Modelos

```bash
# Obtener lista de modelos
curl -X GET "http://localhost:8000/api/v1/models/" \\
     -H "Authorization: Bearer <token>"
```

## Desarrollo

### Ejecutar Servidor Local

```bash
# Instalar dependencias
pip install -r requirements.txt

# Inicializar base de datos
python init_db.py

# Ejecutar servidor
uvicorn app.main:app --reload --port 8000
```

### Ejecutar Pruebas

```bash
# Ejecutar todas las pruebas
python run_tests.py

# Solo pruebas unitarias
pytest tests/ -v
```

## Soporte

Para soporte técnico o reportar issues, contacta al equipo de desarrollo.

---

*Documentación generada automáticamente el {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
        
        # Guardar README
        readme_file = docs_dir / "API_README.md"
        with open(readme_file, 'w', encoding='utf-8') as f:
            f.write(readme_content)
        
        print(f"✅ README de API generado en: {readme_file}")
        
    except Exception as e:
        print(f"❌ Error al generar README: {e}")
        raise

def generate_postman_collection(spec, docs_dir):
    """Generar colección de Postman"""
    try:
        collection = {
            "info": {
                "name": spec['info']['title'],
                "description": spec['info']['description'],
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "auth": {
                "type": "bearer",
                "bearer": [
                    {
                        "key": "token",
                        "value": "{{access_token}}",
                        "type": "string"
                    }
                ]
            },
            "variable": [
                {
                    "key": "base_url",
                    "value": "http://localhost:8000",
                    "type": "string"
                },
                {
                    "key": "access_token",
                    "value": "",
                    "type": "string"
                }
            ],
            "item": []
        }
        
        # Generar items de la colección
        for path, methods in spec['paths'].items():
            folder_name = path.split('/')[3] if len(path.split('/')) > 3 else 'General'
            
            for method, details in methods.items():
                if method.upper() in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
                    
                    request_item = {
                        "name": details.get('summary', f"{method.upper()} {path}"),
                        "request": {
                            "method": method.upper(),
                            "header": [],
                            "url": {
                                "raw": "{{base_url}}" + path,
                                "host": ["{{base_url}}"],
                                "path": path.split('/')[1:]
                            }
                        }
                    }
                    
                    # Agregar headers si es necesario
                    if method.upper() in ['POST', 'PUT', 'PATCH']:
                        request_item["request"]["header"].append({
                            "key": "Content-Type",
                            "value": "application/json"
                        })
                    
                    collection["item"].append(request_item)
        
        # Guardar colección
        collection_file = docs_dir / "postman_collection.json"
        with open(collection_file, 'w', encoding='utf-8') as f:
            json.dump(collection, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Colección de Postman generada en: {collection_file}")
        
    except Exception as e:
        print(f"❌ Error al generar colección de Postman: {e}")
        raise

def main():
    """Función principal"""
    print("📚 Generando documentación de la API APS Integration...")
    
    try:
        # Generar especificación OpenAPI
        spec_file = generate_openapi_spec()
        
        # Leer especificación para otros formatos
        with open(spec_file, 'r', encoding='utf-8') as f:
            spec = json.load(f)
        
        # Generar colección de Postman
        docs_dir = backend_dir / "docs"
        generate_postman_collection(spec, docs_dir)
        
        print("\n" + "="*60)
        print("🎉 ¡Documentación generada exitosamente!")
        print("="*60)
        print("📁 Archivos generados:")
        print(f"   - Especificación OpenAPI: docs/openapi.json")
        print(f"   - README de API: docs/API_README.md")
        print(f"   - Colección Postman: docs/postman_collection.json")
        print("="*60)
        print("🌐 Para ver la documentación interactiva:")
        print("   http://localhost:8000/docs")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
