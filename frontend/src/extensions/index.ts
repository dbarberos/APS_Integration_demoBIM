// Extensiones personalizadas para el APS Viewer
export { InterferenceDetectionExtension } from './InterferenceDetectionExtension'
export { AdvancedMeasureExtension } from './AdvancedMeasureExtension'
export { CollaborationExtension } from './CollaborationExtension'

// Configuración y utilidades para extensiones
export interface ExtensionConfig {
  id: string
  name: string
  className: string
  options?: any
  dependencies?: string[]
  autoLoad?: boolean
}

// Configuraciones por defecto para extensiones personalizadas
export const CUSTOM_EXTENSIONS: ExtensionConfig[] = [
  {
    id: 'InterferenceDetectionExtension',
    name: 'Detección de Interferencias',
    className: 'InterferenceDetectionExtension',
    options: {
      tolerance: 0.01,
      autoDetect: false
    },
    dependencies: [],
    autoLoad: false
  },
  {
    id: 'AdvancedMeasureExtension',
    name: 'Medición Avanzada',
    className: 'AdvancedMeasureExtension',
    options: {
      units: 'metric',
      precision: 2
    },
    dependencies: [],
    autoLoad: false
  },
  {
    id: 'CollaborationExtension',
    name: 'Colaboración en Tiempo Real',
    className: 'CollaborationExtension',
    options: {
      enableCursors: true,
      enableAnnotations: true,
      enableChat: true
    },
    dependencies: [],
    autoLoad: false
  }
]

// Extensiones estándar de Autodesk recomendadas
export const STANDARD_EXTENSIONS: ExtensionConfig[] = [
  {
    id: 'Autodesk.Viewing.MarkupsCore',
    name: 'Markup Core',
    className: 'Autodesk.Viewing.MarkupsCore',
    autoLoad: true
  },
  {
    id: 'Autodesk.Viewing.MarkupsGui',
    name: 'Markup GUI',
    className: 'Autodesk.Viewing.MarkupsGui',
    dependencies: ['Autodesk.Viewing.MarkupsCore'],
    autoLoad: false
  },
  {
    id: 'Autodesk.Section',
    name: 'Section Analysis',
    className: 'Autodesk.Section',
    autoLoad: false
  },
  {
    id: 'Autodesk.Measure',
    name: 'Measure Tool',
    className: 'Autodesk.Measure',
    autoLoad: false
  },
  {
    id: 'Autodesk.ViewCubeUi',
    name: 'View Cube',
    className: 'Autodesk.ViewCubeUi',
    autoLoad: true
  },
  {
    id: 'Autodesk.ModelStructure',
    name: 'Model Structure',
    className: 'Autodesk.ModelStructure',
    autoLoad: false
  },
  {
    id: 'Autodesk.LayerManager',
    name: 'Layer Manager',
    className: 'Autodesk.LayerManager',
    autoLoad: false
  },
  {
    id: 'Autodesk.Properties',
    name: 'Properties Panel',
    className: 'Autodesk.Properties',
    autoLoad: false
  },
  {
    id: 'Autodesk.BIM360Extension',
    name: 'BIM 360 Integration',
    className: 'Autodesk.BIM360Extension',
    autoLoad: false
  },
  {
    id: 'Autodesk.Hypermodeling',
    name: 'Hypermodeling',
    className: 'Autodesk.Hypermodeling',
    autoLoad: false
  },
  {
    id: 'Autodesk.DataVisualization',
    name: 'Data Visualization',
    className: 'Autodesk.DataVisualization',
    autoLoad: false
  },
  {
    id: 'Autodesk.AEC.LevelsExtension',
    name: 'AEC Levels',
    className: 'Autodesk.AEC.LevelsExtension',
    autoLoad: false
  },
  {
    id: 'Autodesk.AEC.Minimap3DExtension',
    name: 'AEC Minimap 3D',
    className: 'Autodesk.AEC.Minimap3DExtension',
    autoLoad: false
  },
  {
    id: 'Autodesk.CompGeom',
    name: 'Computational Geometry',
    className: 'Autodesk.CompGeom',
    autoLoad: false
  }
]

// Utilidad para cargar extensiones
export class ExtensionLoader {
  private viewer: any
  private loadedExtensions: Map<string, any> = new Map()

  constructor(viewer: any) {
    this.viewer = viewer
  }

  // Cargar extensión por configuración
  async loadExtension(config: ExtensionConfig): Promise<any> {
    if (this.loadedExtensions.has(config.id)) {
      console.warn(`Extension ${config.id} already loaded`)
      return this.loadedExtensions.get(config.id)
    }

    try {
      // Cargar dependencias primero
      if (config.dependencies) {
        for (const depId of config.dependencies) {
          const depConfig = [...STANDARD_EXTENSIONS, ...CUSTOM_EXTENSIONS]
            .find(ext => ext.id === depId)
          
          if (depConfig && !this.loadedExtensions.has(depId)) {
            await this.loadExtension(depConfig)
          }
        }
      }

      console.log(`Loading extension: ${config.name}`)
      const extension = await this.viewer.loadExtension(config.id, config.options || {})
      
      this.loadedExtensions.set(config.id, extension)
      console.log(`Extension loaded successfully: ${config.name}`)
      
      return extension
    } catch (error) {
      console.error(`Error loading extension ${config.name}:`, error)
      throw error
    }
  }

  // Descargar extensión
  async unloadExtension(extensionId: string): Promise<boolean> {
    if (!this.loadedExtensions.has(extensionId)) {
      console.warn(`Extension ${extensionId} not loaded`)
      return false
    }

    try {
      const result = this.viewer.unloadExtension(extensionId)
      this.loadedExtensions.delete(extensionId)
      console.log(`Extension unloaded: ${extensionId}`)
      return result
    } catch (error) {
      console.error(`Error unloading extension ${extensionId}:`, error)
      return false
    }
  }

  // Cargar múltiples extensiones
  async loadExtensions(configs: ExtensionConfig[]): Promise<Map<string, any>> {
    const results = new Map<string, any>()
    
    for (const config of configs) {
      try {
        const extension = await this.loadExtension(config)
        results.set(config.id, extension)
      } catch (error) {
        console.error(`Failed to load extension ${config.id}:`, error)
        results.set(config.id, null)
      }
    }
    
    return results
  }

  // Cargar extensiones automáticas
  async loadAutoExtensions(): Promise<void> {
    const autoExtensions = [...STANDARD_EXTENSIONS, ...CUSTOM_EXTENSIONS]
      .filter(ext => ext.autoLoad)
    
    await this.loadExtensions(autoExtensions)
  }

  // Obtener extensión cargada
  getExtension(extensionId: string): any | null {
    return this.loadedExtensions.get(extensionId) || null
  }

  // Verificar si extensión está cargada
  isExtensionLoaded(extensionId: string): boolean {
    return this.loadedExtensions.has(extensionId)
  }

  // Obtener todas las extensiones cargadas
  getLoadedExtensions(): Map<string, any> {
    return new Map(this.loadedExtensions)
  }

  // Limpiar todas las extensiones
  async unloadAllExtensions(): Promise<void> {
    const extensionIds = Array.from(this.loadedExtensions.keys())
    
    for (const extensionId of extensionIds) {
      await this.unloadExtension(extensionId)
    }
  }

  // Obtener información de extensiones disponibles
  getAvailableExtensions(): ExtensionConfig[] {
    return [...STANDARD_EXTENSIONS, ...CUSTOM_EXTENSIONS]
  }

  // Filtrar extensiones por categoría
  getExtensionsByCategory(category: 'standard' | 'custom'): ExtensionConfig[] {
    return category === 'standard' ? STANDARD_EXTENSIONS : CUSTOM_EXTENSIONS
  }

  // Buscar extensión por nombre
  findExtensionByName(name: string): ExtensionConfig | null {
    return [...STANDARD_EXTENSIONS, ...CUSTOM_EXTENSIONS]
      .find(ext => ext.name.toLowerCase().includes(name.toLowerCase())) || null
  }
}

// Hook de utilidad para gestión de extensiones
export const useExtensionLoader = (viewer: any) => {
  const loader = new ExtensionLoader(viewer)
  
  return {
    loadExtension: loader.loadExtension.bind(loader),
    unloadExtension: loader.unloadExtension.bind(loader),
    loadExtensions: loader.loadExtensions.bind(loader),
    loadAutoExtensions: loader.loadAutoExtensions.bind(loader),
    getExtension: loader.getExtension.bind(loader),
    isExtensionLoaded: loader.isExtensionLoaded.bind(loader),
    getLoadedExtensions: loader.getLoadedExtensions.bind(loader),
    unloadAllExtensions: loader.unloadAllExtensions.bind(loader),
    getAvailableExtensions: loader.getAvailableExtensions.bind(loader),
    getExtensionsByCategory: loader.getExtensionsByCategory.bind(loader),
    findExtensionByName: loader.findExtensionByName.bind(loader)
  }
}

// Presets de configuración comunes
export const EXTENSION_PRESETS = {
  basic: [
    'Autodesk.ViewCubeUi',
    'Autodesk.Viewing.MarkupsCore'
  ],
  
  architecture: [
    'Autodesk.ViewCubeUi',
    'Autodesk.Viewing.MarkupsCore',
    'Autodesk.Viewing.MarkupsGui',
    'Autodesk.Section',
    'Autodesk.Measure',
    'Autodesk.LayerManager',
    'Autodesk.AEC.LevelsExtension'
  ],
  
  engineering: [
    'Autodesk.ViewCubeUi',
    'Autodesk.Viewing.MarkupsCore',
    'Autodesk.Section',
    'Autodesk.Measure',
    'AdvancedMeasureExtension',
    'InterferenceDetectionExtension',
    'Autodesk.ModelStructure'
  ],
  
  collaboration: [
    'Autodesk.ViewCubeUi',
    'Autodesk.Viewing.MarkupsCore',
    'Autodesk.Viewing.MarkupsGui',
    'CollaborationExtension',
    'Autodesk.Properties'
  ],
  
  bim: [
    'Autodesk.ViewCubeUi',
    'Autodesk.Viewing.MarkupsCore',
    'Autodesk.Section',
    'Autodesk.Measure',
    'Autodesk.LayerManager',
    'Autodesk.ModelStructure',
    'Autodesk.Properties',
    'Autodesk.AEC.LevelsExtension',
    'Autodesk.BIM360Extension',
    'InterferenceDetectionExtension'
  ],
  
  full: [
    ...STANDARD_EXTENSIONS.map(ext => ext.id),
    ...CUSTOM_EXTENSIONS.map(ext => ext.id)
  ]
}

export default {
  CUSTOM_EXTENSIONS,
  STANDARD_EXTENSIONS,
  ExtensionLoader,
  useExtensionLoader,
  EXTENSION_PRESETS
}
