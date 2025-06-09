# Guía de Desarrollo - Plataforma de Integración APS

Esta guía proporciona información detallada para desarrolladores que deseen extender, personalizar o contribuir al desarrollo de la Plataforma de Integración APS.

## Índice de Contenidos

1. [Introducción](#introducción)
2. [Configuración del Entorno de Desarrollo](#configuración-del-entorno-de-desarrollo)
3. [Arquitectura del Código](#arquitectura-del-código)
4. [Backend (FastAPI)](#backend-fastapi)
5. [Frontend (React)](#frontend-react)
6. [Integración con APS](#integración-con-aps)
7. [Flujos de Trabajo de Desarrollo](#flujos-de-trabajo-de-desarrollo)
8. [Testing](#testing)
9. [Despliegue](#despliegue)
10. [Mejores Prácticas](#mejores-prácticas)
11. [Contribuciones](#contribuciones)

## Introducción

Esta guía está diseñada para desarrolladores que deseen trabajar con el código de la Plataforma de Integración APS, ya sea para customizaciones, extensiones o contribuciones al proyecto principal.

### Requisitos Previos

Conocimientos recomendados:
- Python (FastAPI, SQLAlchemy)
- JavaScript/TypeScript (React, Redux)
- Docker y contenedores
- API REST
- Autodesk Platform Services (básico)

### Visión General de la Plataforma

La Plataforma de Integración APS es una aplicación full-stack que consta de:
- **Backend**: API REST con FastAPI (Python)
- **Frontend**: Aplicación SPA con React y TypeScript
- **Base de Datos**: PostgreSQL para almacenamiento persistente
- **Cache**: Redis para almacenamiento en caché y colas
- **Workers**: Celery para procesamiento asíncrono
- **Integración**: Autodesk Platform Services para CAD/BIM

## Configuración del Entorno de Desarrollo

### Clonar el Repositorio

```bash
git clone https://github.com/su-empresa/aps-integration-platform.git
cd aps-integration-platform
```

### Configuración Local con Docker

El método recomendado para desarrollo es usar Docker Compose:

```bash
# Copiar archivo de entorno para desarrollo
cp infra/config/development.env .env

# Editar variables de entorno (especialmente credenciales APS)
nano .env

# Iniciar servicios en modo desarrollo
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Configuración Manual (Desarrollo Avanzado)

Para desarrollo más granular, puede configurar los componentes individualmente:

#### Backend

```bash
# Crear entorno virtual
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Iniciar en modo desarrollo
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
# Instalar dependencias
cd frontend
npm install

# Iniciar en modo desarrollo
npm run dev
```

#### Servicios Dependientes

También necesitará:
- PostgreSQL (local o Docker)
- Redis (local o Docker)
- S3-compatible storage (opcional, puede usar local storage)

## Arquitectura del Código

### Estructura de Directorios

```
/
├── backend/               # API FastAPI
│   ├── app/              # Código principal
│   │   ├── api/          # Endpoints de API
│   │   ├── core/         # Configuración central
│   │   ├── models/       # Modelos de datos
│   │   ├── schemas/      # Schemas Pydantic
│   │   ├── services/     # Lógica de negocio
│   │   └── tasks/        # Tareas asíncronas
│   ├── tests/            # Tests unitarios e integración
│   └── scripts/          # Scripts de utilidad
├── frontend/              # Aplicación React
│   ├── public/           # Activos estáticos
│   ├── src/              # Código fuente
│   │   ├── components/   # Componentes React
│   │   ├── hooks/        # Hooks personalizados
│   │   ├── pages/        # Componentes de página
│   │   ├── services/     # Servicios de API
│   │   └── store/        # Estado global (Redux)
│   └── tests/            # Tests unitarios y E2E
├── infra/                 # Infraestructura
│   ├── docker/           # Configuración Docker
│   └── terraform/        # IaC para despliegue
└── scripts/               # Scripts globales
```

### Patrones de Diseño

La plataforma implementa varios patrones de diseño clave:

1. **Arquitectura en Capas (Backend)**:
   - API Layer (endpoints)
   - Service Layer (lógica de negocio)
   - Data Access Layer (modelos y repositorios)

2. **Patrones Frontend**:
   - Component-based architecture
   - Container/Presentational pattern
   - Custom hooks para lógica reutilizable
   - Redux para estado global
   - React Query para gestión de datos

3. **Principios SOLID**:
   - Single Responsibility
   - Open/Closed
   - Liskov Substitution
   - Interface Segregation
   - Dependency Inversion

## Backend (FastAPI)

### Estructura de API

El backend sigue una estructura modular:

```
app/
├── api/                 # Endpoints API
│   └── v1/              # API versión 1
│       ├── api.py       # Router principal
│       └── endpoints/   # Endpoints específicos
├── core/                # Configuración central
│   ├── config.py        # Configuración de la app
│   ├── database.py      # Configuración de BD
│   └── security.py      # Autenticación y autorización
├── models/              # Modelos SQLAlchemy
├── schemas/             # Schemas Pydantic
├── services/            # Servicios de negocio
│   ├── aps_auth.py      # Autenticación APS
│   ├── file_manager.py  # Gestión de archivos
│   └── ...
└── tasks/               # Tareas Celery
    ├── translation_tasks.py  # Tareas de traducción
    └── ...
```

### Extensión de la API

Para añadir nuevos endpoints:

1. Cree un nuevo archivo en `app/api/v1/endpoints/`
2. Defina sus endpoints usando FastAPI:

```python
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.schemas.your_schema import YourSchema, YourResponse

router = APIRouter()

@router.get("/your-endpoint", response_model=list[YourResponse])
async def get_items(
    skip: int = 0, 
    limit: int = 100,
    current_user = Depends(get_current_user)
):
    # Su lógica aquí
    return items

@router.post("/your-endpoint", response_model=YourResponse)
async def create_item(
    item: YourSchema,
    current_user = Depends(get_current_user)
):
    # Su lógica aquí
    return created_item
```

3. Incluya su router en `app/api/v1/api.py`:

```python
from app.api.v1.endpoints import your_module

api_router.include_router(
    your_module.router,
    prefix="/your-prefix",
    tags=["Your Tag"]
)
```

### Creación de Servicios

Los servicios contienen la lógica de negocio principal:

1. Cree un nuevo archivo en `app/services/`
2. Implemente su servicio como una clase:

```python
from app.core.database import get_db
from app.models.your_model import YourModel

class YourService:
    def __init__(self, db=None):
        self.db = db or next(get_db())
    
    def get_items(self, skip=0, limit=100, user_id=None):
        query = self.db.query(YourModel)
        if user_id:
            query = query.filter(YourModel.user_id == user_id)
        return query.offset(skip).limit(limit).all()
    
    def create_item(self, item_data, user_id):
        db_item = YourModel(**item_data.dict(), user_id=user_id)
        self.db.add(db_item)
        self.db.commit()
        self.db.refresh(db_item)
        return db_item
```

3. Use el servicio en sus endpoints:

```python
from app.services.your_service import YourService

@router.get("/items")
async def get_items(
    skip: int = 0, 
    limit: int = 100,
    current_user = Depends(get_current_user)
):
    service = YourService()
    return service.get_items(skip, limit, current_user.id)
```

### Tareas Asíncronas

Para procesamiento en segundo plano:

1. Cree un nuevo archivo en `app/tasks/`
2. Defina sus tareas Celery:

```python
from app.core.celery_app import celery_app
from app.services.your_service import YourService

@celery_app.task(name="your_task_name")
def your_background_task(item_id: int):
    service = YourService()
    # Lógica de procesamiento en segundo plano
    result = service.process_item(item_id)
    return result
```

3. Invoque tareas desde su API:

```python
from app.tasks.your_tasks import your_background_task

@router.post("/process/{item_id}")
async def start_processing(
    item_id: int,
    current_user = Depends(get_current_user)
):
    # Iniciar tarea en segundo plano
    task = your_background_task.delay(item_id)
    return {"task_id": task.id, "status": "started"}
```

## Frontend (React)

### Estructura de Componentes

El frontend sigue una estructura orientada a componentes:

```
src/
├── components/          # Componentes reutilizables
│   ├── ui/              # Componentes de UI básicos
│   ├── layout/          # Componentes de estructura
│   ├── viewer/          # Componentes del visualizador
│   └── ...
├── hooks/               # Hooks personalizados
├── pages/               # Componentes de página
├── services/            # Servicios de API
├── store/               # Estado global (Redux)
└── utils/               # Utilidades
```

### Creación de Componentes

Siga el patrón de componentes funcionales con hooks:

```tsx
import React, { useState, useEffect } from 'react';
import { useFiles } from '@/hooks/useFiles';
import { Button } from '@/components/ui/Button';

interface YourComponentProps {
  projectId: number;
  onItemSelect: (item: any) => void;
}

export const YourComponent: React.FC<YourComponentProps> = ({ 
  projectId, 
  onItemSelect 
}) => {
  const { files, isLoading, error } = useFiles(projectId);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  useEffect(() => {
    // Lógica del efecto
  }, [projectId]);
  
  const handleSelect = (item: any) => {
    setSelectedItem(item);
    onItemSelect(item);
  };
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div className="your-component">
      <h2>Your Component</h2>
      <div className="items-list">
        {files.map(item => (
          <div 
            key={item.id} 
            className={`item ${selectedItem?.id === item.id ? 'selected' : ''}`}
            onClick={() => handleSelect(item)}
          >
            {item.name}
          </div>
        ))}
      </div>
      <Button onClick={() => console.log('Action')}>
        Action Button
      </Button>
    </div>
  );
};
```

### Hooks Personalizados

Cree hooks para lógica reutilizable:

```tsx
// hooks/useCustomHook.ts
import { useState, useEffect } from 'react';
import { yourApiService } from '@/services/yourApiService';

export function useCustomHook(param: string) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await yourApiService.getData(param);
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [param]);
  
  return { data, isLoading, error };
}
```

### Servicios de API

Para comunicación con el backend:

```tsx
// services/yourApiService.ts
import { api } from './api';

export const yourApiService = {
  async getData(param: string) {
    const response = await api.get(`/your-endpoint?param=${param}`);
    return response.data;
  },
  
  async createItem(data: any) {
    const response = await api.post('/your-endpoint', data);
    return response.data;
  },
  
  async updateItem(id: number, data: any) {
    const response = await api.put(`/your-endpoint/${id}`, data);
    return response.data;
  },
  
  async deleteItem(id: number) {
    const response = await api.delete(`/your-endpoint/${id}`);
    return response.data;
  }
};
```

### Integración con Redux

Para estado global:

```tsx
// store/slices/yourSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { yourApiService } from '@/services/yourApiService';

export const fetchItems = createAsyncThunk(
  'your/fetchItems',
  async (param: string) => {
    const response = await yourApiService.getData(param);
    return response;
  }
);

const yourSlice = createSlice({
  name: 'your',
  initialState: {
    items: [],
    status: 'idle',
    error: null
  },
  reducers: {
    // Reducers síncronos
    addItem: (state, action) => {
      state.items.push(action.payload);
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchItems.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchItems.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      });
  }
});

export const { addItem } = yourSlice.actions;
export default yourSlice.reducer;
```

## Integración con APS

### Autenticación APS

La plataforma utiliza OAuth 2.0 para autenticar con APS:

1. **Flujo de 2 piernas** (credenciales de aplicación):
   - Usado para operaciones de backend
   - Almacenamiento y traducción de modelos

```python
# services/aps_auth.py
from app.core.config import settings
import requests

class APSAuthService:
    def get_2legged_token(self):
        url = "https://developer.api.autodesk.com/authentication/v1/authenticate"
        data = {
            "client_id": settings.APS_CLIENT_ID,
            "client_secret": settings.APS_CLIENT_SECRET,
            "grant_type": "client_credentials",
            "scope": "data:read data:write data:create bucket:read bucket:create"
        }
        response = requests.post(url, data=data)
        return response.json()
```

2. **Flujo de 3 piernas** (autorización de usuario):
   - Usado para acciones específicas del usuario
   - Acceso a modelos privados del usuario

```python
# api/v1/endpoints/auth.py
@router.get("/aps/auth-url")
def get_aps_auth_url(current_user = Depends(get_current_user)):
    aps_service = APSAuthService()
    auth_url = aps_service.get_authorize_url(current_user.id)
    return {"auth_url": auth_url}

@router.post("/aps/callback")
def aps_callback(
    code: str = Body(...),
    current_user = Depends(get_current_user)
):
    aps_service = APSAuthService()
    tokens = aps_service.exchange_code_for_token(code, current_user.id)
    return {"status": "success"}
```

### Operaciones APS Principales

#### 1. Gestión de Buckets y Objetos

```python
# services/aps_storage.py
class APSStorageService:
    def __init__(self):
        self.auth_service = APSAuthService()
    
    def create_bucket(self, bucket_name, policy="transient"):
        token = self.auth_service.get_2legged_token()
        # Implementación para crear bucket
    
    def upload_object(self, bucket_name, object_name, file_content):
        token = self.auth_service.get_2legged_token()
        # Implementación para subir archivo
    
    def get_object_details(self, bucket_name, object_name):
        token = self.auth_service.get_2legged_token()
        # Implementación para obtener detalles
```

#### 2. Traducción de Modelos

```python
# services/model_derivative.py
class ModelDerivativeService:
    def __init__(self):
        self.auth_service = APSAuthService()
    
    def translate_model(self, urn, output_format="svf2"):
        token = self.auth_service.get_2legged_token()
        # Implementación para iniciar traducción
    
    def get_translation_status(self, urn):
        token = self.auth_service.get_2legged_token()
        # Implementación para obtener estado
    
    def get_model_metadata(self, urn):
        token = self.auth_service.get_2legged_token()
        # Implementación para obtener metadatos
```

#### 3. Configuración del Viewer

```tsx
// components/viewer/ModelViewer.tsx
import React, { useEffect } from 'react';
import { useViewer } from '@/hooks/useViewer';

interface ModelViewerProps {
  urn: string;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({ urn }) => {
  const { viewerRef, isLoading, error, loadModel } = useViewer();
  
  useEffect(() => {
    if (urn) {
      loadModel(urn);
    }
  }, [urn, loadModel]);
  
  return (
    <div className="model-viewer">
      {isLoading && <div className="loading-overlay">Loading model...</div>}
      {error && <div className="error-message">Error: {error.message}</div>}
      <div ref={viewerRef} className="viewer-container" />
    </div>
  );
};
```

```tsx
// hooks/useViewer.ts
import { useState, useRef, useCallback } from 'react';
import { viewerService } from '@/services/viewerService';

export function useViewer() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const initViewer = useCallback(async () => {
    if (!viewerRef.current) return;
    
    try {
      const viewerApp = await viewerService.initializeViewer(viewerRef.current);
      setViewer(viewerApp);
      return viewerApp;
    } catch (err) {
      setError(err as Error);
      return null;
    }
  }, []);
  
  const loadModel = useCallback(async (urn: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let viewerApp = viewer;
      if (!viewerApp) {
        viewerApp = await initViewer();
        if (!viewerApp) throw new Error("Failed to initialize viewer");
      }
      
      await viewerService.loadModel(viewerApp, urn);
      setIsLoading(false);
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
    }
  }, [viewer, initViewer]);
  
  return { viewerRef, viewer, isLoading, error, initViewer, loadModel };
}
```

## Flujos de Trabajo de Desarrollo

### Proceso de Desarrollo

1. **Planificación**:
   - Definir requisitos y diseño
   - Crear issues/tickets en sistema de gestión

2. **Desarrollo**:
   - Crear rama feature/bugfix desde main/develop
   - Implementar cambios
   - Escribir tests
   - Verificar calidad de código (linting)

3. **Revisión**:
   - Crear Pull Request
   - Code review
   - Aplicar feedback
   - Ejecutar CI para validar cambios

4. **Integración**:
   - Merge a develop/main
   - Verificar integración
   - Actualizar documentación

### Convenciones de Código

#### Python (Backend)
- Seguir PEP 8
- Docstrings para clases y funciones
- Type hints
- Nombres de variables en snake_case
- Nombres de clases en PascalCase

#### TypeScript (Frontend)
- Prettier + ESLint
- Nombres de componentes en PascalCase
- Nombres de funciones/variables en camelCase
- Props con tipos explícitos
- Evitar any

### Gestión de Ramas

- **main**: Código en producción
- **develop**: Código listo para próxima release
- **feature/xxx**: Nuevas funcionalidades
- **bugfix/xxx**: Correcciones de errores
- **hotfix/xxx**: Correcciones urgentes para producción

### Commits

Seguir convención Conventional Commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Ejemplos:
- `feat(viewer): add measurement tools`
- `fix(auth): resolve token refresh issue`
- `docs(api): update endpoint documentation`
- `chore(deps): update dependencies`

## Testing

### Backend Testing

#### Tests Unitarios

Usar pytest para tests unitarios:

```python
# tests/test_auth_service.py
import pytest
from app.services.aps_auth import APSAuthService
from unittest.mock import patch

def test_get_2legged_token():
    # Arrange
    auth_service = APSAuthService()
    mock_response = {
        "access_token": "test_token",
        "expires_in": 3600
    }
    
    # Act
    with patch('requests.post') as mock_post:
        mock_post.return_value.json.return_value = mock_response
        result = auth_service.get_2legged_token()
    
    # Assert
    assert result == mock_response
    assert mock_post.called
```

#### Tests de Integración

```python
# tests/test_auth_api.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_login():
    # Arrange
    login_data = {
        "username": "test@example.com",
        "password": "password123"
    }
    
    # Act
    response = client.post("/api/v1/auth/login", json=login_data)
    
    # Assert
    assert response.status_code == 200
    assert "access_token" in response.json()
```

### Frontend Testing

#### Tests de Componentes

Usar Vitest y React Testing Library:

```tsx
// components/ui/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDisabled();
  });
});
```

#### Tests End-to-End

Usar Cypress para tests E2E:

```js
// cypress/e2e/auth.cy.js
describe('Authentication', () => {
  it('should login successfully', () => {
    cy.visit('/login');
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
    cy.get('h1').should('contain', 'Dashboard');
  });
  
  it('should show error with invalid credentials', () => {
    cy.visit('/login');
    cy.get('input[name="email"]').type('test@example.com');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    cy.get('.error-message').should('be.visible');
    cy.get('.error-message').should('contain', 'Invalid credentials');
  });
});
```

## Despliegue

### Proceso de CI/CD

La plataforma utiliza GitHub Actions para CI/CD:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r backend/requirements.txt
        pip install -r backend/requirements-dev.txt
    
    - name: Lint with flake8
      run: |
        flake8 backend
    
    - name: Test with pytest
      run: |
        pytest backend/tests
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install frontend dependencies
      run: |
        cd frontend
        npm install
    
    - name: Lint frontend
      run: |
        cd frontend
        npm run lint
    
    - name: Test frontend
      run: |
        cd frontend
        npm test
```

### Despliegue en Producción

El despliegue se gestiona con Terraform y scripts automatizados:

```bash
# Despliegue en AWS
./scripts/deploy.sh --env production --region us-west-1

# Despliegue en Azure
./scripts/deploy.sh --env production --cloud azure --region westus
```

El script de despliegue realiza las siguientes acciones:
1. Construye imágenes Docker
2. Publica en registro de contenedores
3. Aplica configuración Terraform
4. Ejecuta migraciones de base de datos
5. Verifica despliegue exitoso

## Mejores Prácticas

### Seguridad

1. **Autenticación y Autorización**:
   - Usar JWT con expiración corta
   - Implementar refresh tokens
   - Validar permisos en cada endpoint

2. **Validación de Entrada**:
   - Usar Pydantic para validar todos los inputs
   - Sanitizar datos de entrada
   - Evitar inyección SQL con ORM

3. **Seguridad en Frontend**:
   - No almacenar tokens en localStorage (usar httpOnly cookies)
   - Implementar protección CSRF
   - Validar inputs en cliente y servidor

### Rendimiento

1. **Optimización de Base de Datos**:
   - Usar índices apropiados
   - Optimizar queries complejas
   - Implementar paginación

2. **Optimización Frontend**:
   - Lazy loading de componentes
   - Memoization para cálculos costosos
   - Code splitting para reducir bundle size

3. **Caché**:
   - Implementar caché de API con Redis
   - Usar React Query para caché en cliente
   - Configurar correctamente Cache-Control

### Mantenibilidad

1. **Documentación**:
   - Docstrings en funciones y clases
   - README actualizado
   - Comentarios en código complejo

2. **Logging**:
   - Usar logging estructurado
   - Niveles apropiados (debug, info, error)
   - Contexto suficiente en mensajes

3. **Configuración**:
   - Usar variables de entorno
   - Configuración por ambiente
   - Valores por defecto sensatos

## Contribuciones

### Proceso de Contribución

1. **Fork del repositorio**:
   - Cree un fork en GitHub
   - Clone su fork localmente

2. **Configuración**:
   - Configure su entorno de desarrollo
   - Cree una rama para su contribución

3. **Desarrollo**:
   - Implemente sus cambios
   - Siga las convenciones de código
   - Añada tests

4. **Pull Request**:
   - Envíe un PR a la rama develop
   - Complete la plantilla de PR
   - Responda a los comentarios de revisión

### Lineamientos para Contribuciones

- Asegúrese que todos los tests pasen
- Mantenga los cambios enfocados y pequeños
- Actualice la documentación si es necesario
- Siga las convenciones de estilo del proyecto
- Sea respetuoso en las discusiones

### Reporte de Problemas

Al reportar bugs:
- Proporcione pasos detallados para reproducir
- Incluya versión del sistema y navegador
- Adjunte capturas de pantalla si es relevante
- Describa comportamiento esperado vs. actual

## Recursos Adicionales

- [API de Autodesk Platform Services](https://forge.autodesk.com/en/docs/overview/v2)
- [Documentación de FastAPI](https://fastapi.tiangolo.com/)
- [Documentación de React](https://reactjs.org/docs/getting-started.html)
- [Redux Toolkit](https://redux-toolkit.js.org/)
- [React Query](https://tanstack.com/query/latest)
- [SQLAlchemy](https://docs.sqlalchemy.org/)