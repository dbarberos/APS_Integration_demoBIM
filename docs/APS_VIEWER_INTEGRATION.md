# Integración APS Viewer v7 - Documentación Completa

## Resumen

La integración del APS (Autodesk Platform Services) Viewer v7 proporciona capacidades avanzadas de visualización 3D para modelos CAD y BIM dentro de la aplicación React. Esta implementación incluye herramientas completas de navegación, medición, sección y análisis de propiedades.

## Arquitectura de Componentes

### Componentes Principales

#### `ModelViewer.tsx`
Componente principal que encapsula la funcionalidad del APS Viewer.

**Características:**
- Inicialización automática del viewer
- Manejo de estados de carga y error
- Soporte para configuraciones personalizadas
- Gestión de eventos del viewer
- Atajos de teclado integrados

**Uso:**
```tsx
<ModelViewer
  urn="modelo-urn"
  config={{
    theme: 'bim-theme',
    extensions: ['Autodesk.Section', 'Autodesk.Measure']
  }}
  onModelLoaded={handleModelLoaded}
  onSelectionChanged={handleSelection}
/>
```

#### `ViewerContainer.tsx`
Contenedor completo que integra el viewer con paneles de navegación y propiedades.

**Características:**
- Layout responsivo con paneles colapsables
- Integración de toolbar y controles
- Gestión de estado centralizada
- Configuración flexible de UI

#### `MultiModelViewer.tsx`
Componente avanzado para visualización de múltiples modelos simultáneos.

**Características:**
- Carga de múltiples modelos BIM/CAD
- Gestión por disciplinas (Arquitectura, Estructura, MEP, etc.)
- Control de visibilidad y opacidad por modelo
- Detección de interferencias entre modelos
- Aislamiento y navegación entre modelos
- Coordinación de múltiples disciplinas

#### `ViewerToolbar.tsx`
Barra de herramientas con controles de visualización y medición.

**Herramientas incluidas:**
- Navegación (Home, Zoom, Pan)
- Visibilidad (Aislar, Ocultar, Mostrar)
- Medición (Distancia, Área, Ángulos)
- Sección (Planos de corte)
- Explosión de modelo
- Captura de pantalla

### Componentes de Navegación

#### `ModelTree.tsx`
Árbol jerárquico de navegación del modelo.

**Funcionalidades:**
- Navegación por jerarquía completa
- Búsqueda y filtrado
- Selección múltiple
- Controles de visibilidad por nodo
- Expansión/colapso de ramas

#### `PropertiesPanel.tsx`
Panel de propiedades de objetos seleccionados.

**Características:**
- Visualización organizada por categorías
- Búsqueda en propiedades
- Copia de valores al portapapeles
- Filtrado por tipo de propiedad
- Soporte para múltiples objetos

#### `LayersPanel.tsx`
Panel avanzado de gestión de capas y visibilidad.

**Características:**
- Gestión jerárquica de capas
- Control de visibilidad por capa
- Filtrado por disciplina y categoría
- Búsqueda avanzada de capas
- Controles de opacidad granulares
- Operaciones en lote para múltiples capas
- Aislamiento de capas específicas

### Componentes de UI

#### `LoadingOverlay.tsx`
Overlay de carga con indicadores de progreso específicos.

**Estados soportados:**
- Inicializando viewer
- Descargando modelo
- Procesando geometría
- Renderizando visualización

## Hooks Personalizados

### `useViewer.ts`
Hook principal para gestión del viewer.

**Funcionalidades:**
- Inicialización automática del viewer
- Carga de modelos por URN
- Gestión de tokens de acceso
- Control de navegación y selección
- Manejo de errores

**Ejemplo de uso:**
```tsx
const {
  viewer,
  isLoading,
  isInitialized,
  selectedIds,
  loadModel,
  fitToView,
  select,
  isolate
} = useViewer(urn, config)
```

### `useViewerExtensions.ts`
Hook para gestión de extensiones del viewer.

**Capacidades:**
- Carga dinámica de extensiones
- Herramientas de medición
- Planos de corte
- Navegación por modelo
- Análisis de propiedades

### `useModelState.ts`
Hook para gestión de estado del modelo.

**Estado gestionado:**
- Selección de objetos
- Visibilidad y aislamiento
- Planos de corte activos
- Escala de explosión
- Posición de cámara

### `useViewerEvents.ts`
Hook para manejo de eventos del viewer.

**Eventos soportados:**
- Cambios de selección
- Movimientos de cámara
- Carga/descarga de modelos
- Errores del viewer
- Progreso de operaciones

## Servicios

### `viewerService.ts`
Servicio principal para interacción con APIs del viewer.

**Métodos principales:**
```typescript
// Autenticación
getViewerToken(): Promise<ViewerToken>

// Metadatos del modelo
getModelManifest(urn: string): Promise<ViewerManifest>
getModelMetadata(urn: string): Promise<ViewerMetadata>
getModelHierarchy(urn: string): Promise<any>

// Propiedades
getObjectProperties(urn: string, dbId: number): Promise<any>
searchObjects(urn: string, query: string): Promise<any>

// Inicialización
initializeViewer(config: ViewerConfiguration): Promise<GuiViewer3D>
loadModel(viewer: GuiViewer3D, urn: string): Promise<Model>
```

## Configuración

### Variables de Entorno
```bash
# Frontend - Configuración del APS Viewer
VITE_API_URL=http://localhost:8000/api/v1
VITE_APS_CLIENT_ID=your_aps_client_id
```

### Configuración del Viewer
```typescript
const viewerConfig: ViewerConfiguration = {
  theme: 'bim-theme',
  extensions: [
    'Autodesk.Section',
    'Autodesk.Measure',
    'Autodesk.ViewCubeUi',
    'Autodesk.ModelStructure',
    'Autodesk.LayerManager',
    'Autodesk.Properties'
  ],
  language: 'es',
  useADP: false
}
```

### Sistema de Gestión de Extensiones

#### ExtensionLoader
Utilidad avanzada para gestión de extensiones con dependencias y configuraciones.

```typescript
import { ExtensionLoader, EXTENSION_PRESETS } from '@/extensions'

const loader = new ExtensionLoader(viewer)

// Cargar preset de extensiones
const architectureExtensions = EXTENSION_PRESETS.architecture
await loader.loadExtensions(
  architectureExtensions.map(id => 
    loader.findExtensionByName(id)
  ).filter(Boolean)
)

// Cargar extensión personalizada
await loader.loadExtension({
  id: 'InterferenceDetectionExtension',
  name: 'Detección de Interferencias',
  options: { tolerance: 0.005 }
})
```

#### Presets de Configuración
```typescript
// Configuraciones predefinidas por tipo de proyecto
export const EXTENSION_PRESETS = {
  basic: ['Autodesk.ViewCubeUi', 'Autodesk.Viewing.MarkupsCore'],
  
  architecture: [
    'Autodesk.ViewCubeUi', 'Autodesk.Section', 'Autodesk.Measure',
    'Autodesk.LayerManager', 'Autodesk.AEC.LevelsExtension'
  ],
  
  engineering: [
    'Autodesk.ViewCubeUi', 'Autodesk.Section', 'AdvancedMeasureExtension',
    'InterferenceDetectionExtension', 'Autodesk.ModelStructure'
  ],
  
  collaboration: [
    'Autodesk.ViewCubeUi', 'Autodesk.Viewing.MarkupsGui',
    'CollaborationExtension', 'Autodesk.Properties'
  ],
  
  bim: [
    'Autodesk.ViewCubeUi', 'Autodesk.Section', 'Autodesk.LayerManager',
    'Autodesk.AEC.LevelsExtension', 'InterferenceDetectionExtension',
    'Autodesk.BIM360Extension'
  ]
}
```

## Extensiones Disponibles

### Extensiones Estándar de Autodesk
- **Autodesk.Section** - Planos de corte
- **Autodesk.Measure** - Herramientas de medición básicas
- **Autodesk.ViewCubeUi** - Cubo de navegación
- **Autodesk.ModelStructure** - Navegación por estructura
- **Autodesk.LayerManager** - Gestión de capas
- **Autodesk.Properties** - Panel de propiedades
- **Autodesk.Viewing.MarkupsCore** - Core de anotaciones
- **Autodesk.Viewing.MarkupsGui** - Interface de anotaciones

### Extensiones Especializadas
- **Autodesk.BIM360Extension** - Integración BIM 360
- **Autodesk.Hypermodeling** - Navegación avanzada
- **Autodesk.DataVisualization** - Visualización de datos
- **Autodesk.AEC.LevelsExtension** - Gestión de niveles AEC
- **Autodesk.AEC.Minimap3DExtension** - Minimapa 3D
- **Autodesk.CompGeom** - Geometría computacional

### Extensiones Personalizadas Desarrolladas

#### `InterferenceDetectionExtension`
Extensión avanzada para detección de interferencias entre modelos.

**Funcionalidades:**
- Análisis automático de colisiones entre modelos
- Detección de interferencias por tolerancia configurable
- Visualización de conflictos con marcadores 3D
- Clasificación por severidad (Alta, Media, Baja)
- Cálculo de volúmenes de interferencia
- Exportación de reportes de interferencias
- Navegación directa a conflictos detectados

**Uso:**
```typescript
const extension = await viewer.loadExtension('InterferenceDetectionExtension', {
  tolerance: 0.01,
  onInterferenceDetected: (interferences) => {
    console.log(`${interferences.length} interferencias detectadas`)
  }
})

// Detectar interferencias entre modelos
const interferences = await extension.detectInterferences([model1, model2])
```

#### `AdvancedMeasureExtension`
Extensión de medición avanzada con herramientas especializadas.

**Funcionalidades:**
- Medición de distancias precisas
- Cálculo de áreas de polígonos complejos
- Medición de volúmenes de objetos
- Medición de ángulos entre elementos
- Cálculo de perímetros
- Obtención de coordenadas exactas
- Gestión de múltiples mediciones simultáneas
- Exportación de resultados de medición

**Herramientas disponibles:**
```typescript
const extension = await viewer.loadExtension('AdvancedMeasureExtension')

// Activar herramientas específicas
extension.activate('distance')    // Medición de distancias
extension.activate('area')        // Medición de áreas
extension.activate('volume')      // Medición de volúmenes
extension.activate('angle')       // Medición de ángulos
extension.activate('perimeter')   // Medición de perímetros
extension.activate('coordinate')  // Obtención de coordenadas
```

#### `CollaborationExtension`
Extensión para colaboración en tiempo real entre usuarios.

**Funcionalidades:**
- Cursores de colaboradores en tiempo real
- Anotaciones colaborativas
- Compartición de puntos de vista
- Seguimiento de usuarios
- Chat en contexto 3D
- Sincronización de selecciones
- Gestión de sesiones colaborativas
- Notificaciones de actividad

**Características:**
```typescript
const extension = await viewer.loadExtension('CollaborationExtension', {
  sessionId: 'project-session-123',
  userId: 'user-456',
  enableCursors: true,
  enableAnnotations: true,
  onCollaboratorJoined: (collaborator) => {
    console.log(`${collaborator.name} se unió a la sesión`)
  }
})

// Crear anotación
extension.createAnnotation(position, 'Esta área necesita revisión')

// Compartir punto de vista
extension.shareViewpoint()
```

## Funcionalidades Implementadas

### Navegación 3D
- Órbita, pan y zoom
- Ajuste automático de vista
- Navegación por cubo de vista
- Cámara ortográfica/perspectiva

### Selección y Análisis
- Selección individual y múltiple
- Aislamiento de objetos
- Ocultación/visualización
- Propiedades detalladas

### Herramientas de Medición
- Medición de distancias
- Cálculo de áreas
- Medición de ángulos
- Herramientas personalizadas

### Sección y Análisis
- Planos de corte múltiples
- Secciones dinámicas
- Explosión de modelo
- Análisis de interferencias básico

### Visualización Avanzada
- Temas visuales múltiples
- Renderizado de alta calidad
- Sombras y materiales
- Modo transparencia

### Gestión de Múltiples Modelos
- Carga simultánea de múltiples modelos BIM/CAD
- Gestión por disciplinas (Arquitectura, Estructura, MEP, Civil)
- Control independiente de visibilidad y opacidad
- Detección automática de interferencias
- Coordinación entre disciplinas
- Aislamiento y navegación por modelo
- Análisis de conflictos con reportes detallados

### Gestión Avanzada de Capas
- Control jerárquico de capas por disciplina
- Filtrado inteligente por categoría y disciplina
- Búsqueda avanzada de capas
- Operaciones en lote para múltiples capas
- Control granular de opacidad
- Aislamiento de capas específicas
- Gestión persistente de estados de visibilidad

### Colaboración en Tiempo Real
- Cursores de usuarios en tiempo real
- Anotaciones colaborativas con threading
- Compartición de puntos de vista
- Seguimiento de actividad de usuarios
- Sincronización de selecciones
- Gestión de sesiones colaborativas
- Chat contextual en el modelo 3D

### Medición Avanzada
- Medición de distancias con precisión configurable
- Cálculo de áreas de polígonos complejos
- Medición de volúmenes de objetos seleccionados
- Medición de ángulos entre elementos
- Cálculo de perímetros cerrados
- Obtención de coordenadas exactas
- Gestión de múltiples mediciones simultáneas
- Exportación de resultados en CSV/JSON

### Detección de Interferencias
- Análisis automático de colisiones entre modelos
- Configuración de tolerancias por disciplina
- Visualización de conflictos con marcadores 3D
- Clasificación por severidad (Alta, Media, Baja)
- Cálculo de volúmenes de interferencia
- Reportes detallados de conflictos
- Navegación directa a interferencias detectadas

## Integración con Backend

### Endpoints Utilizados
```
GET /api/v1/viewer/token - Obtener token de acceso
GET /api/v1/viewer/manifest/{urn} - Manifest del modelo
GET /api/v1/viewer/metadata/{urn} - Metadatos del modelo
GET /api/v1/viewer/hierarchy/{urn} - Jerarquía del modelo
GET /api/v1/viewer/properties/{urn}/{dbId} - Propiedades de objeto
GET /api/v1/viewer/search/{urn} - Búsqueda en modelo
```

### Flujo de Autenticación
1. El frontend solicita token al backend
2. Backend obtiene token de APS
3. Token se utiliza para autenticar viewer
4. Renovación automática de tokens

## Optimizaciones

### Performance
- Carga progresiva de modelos
- Caché de propiedades
- Renderizado optimizado
- Gestión de memoria

### UX/UI
- Estados de carga informativos
- Mensajes de error descriptivos
- Atajos de teclado
- Interfaz responsiva

## Troubleshooting

### Problemas Comunes

#### Modelo no carga
```
Error: "Document failed to load"
Solución: Verificar URN y estado de traducción
```

#### Token expirado
```
Error: "Unauthorized access"
Solución: Renovar token automáticamente
```

#### Extensión no disponible
```
Error: "Extension failed to load"
Solución: Verificar configuración y dependencias
```

### Debug Mode
```typescript
// Activar en desarrollo
const config = {
  logLevel: 1, // 0=None, 1=Error, 2=Warn, 3=Info, 4=Debug
  // ... otras opciones
}
```

## Estado de Implementación

### Funcionalidades Completadas ✅
- ✅ Colaboración en tiempo real (CollaborationExtension)
- ✅ Anotaciones y markup colaborativo
- ✅ Gestión de múltiples modelos (MultiModelViewer)
- ✅ Detección de interferencias (InterferenceDetectionExtension)
- ✅ Medición avanzada (AdvancedMeasureExtension)
- ✅ Gestión avanzada de capas (LayersPanel)
- ✅ API de extensiones personalizada (ExtensionLoader)
- ✅ Sistema de presets por disciplina

### Próximas Mejoras Planificadas
- [ ] Versionado de modelos con control de cambios
- [ ] Integración con realidad virtual/aumentada
- [ ] Análisis BIM 4D (tiempo) y 5D (costos)
- [ ] Machine Learning para detección automática de problemas
- [ ] Integración con drones para captura de realidad
- [ ] API de extensiones con SDK completo

### Optimizaciones Futuras
- [ ] WebGL2 optimization para rendering avanzado
- [ ] Progressive loading con streaming
- [ ] Offline capabilities con cache inteligente
- [ ] Mobile optimization para tablets
- [ ] WebAssembly para cálculos complejos
- [ ] GPU computing para análisis masivos

## Referencias

- [APS Viewer Documentation](https://aps.autodesk.com/developer/documentation)
- [Forge Viewer API Reference](https://aps.autodesk.com/developer/documentation/viewer/v7)
- [Model Derivative API](https://aps.autodesk.com/developer/documentation/model-derivative)

## Soporte

Para problemas específicos del viewer:
1. Verificar console del navegador
2. Revisar estado de red (Network tab)
3. Validar configuración de APS
4. Contactar soporte técnico

---

**Versión:** 2.0  
**Última actualización:** 2025-01-25  
**Compatibilidad:** APS Viewer v7.87+  
**Extensiones:** 3 extensiones personalizadas implementadas  
**Componentes:** 7 componentes principales + MultiModelViewer + LayersPanel
