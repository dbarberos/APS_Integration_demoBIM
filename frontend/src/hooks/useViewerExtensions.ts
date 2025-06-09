import { useState, useCallback, useRef } from 'react'
import type { ViewerExtension, MeasurementResult, SectionPlane } from '@/types'

export const useViewerExtensions = (viewer: any) => {
  const [extensions, setExtensions] = useState<ViewerExtension[]>([])
  const [measurements, setMeasurements] = useState<MeasurementResult[]>([])
  const [sectionPlanes, setSectionPlanes] = useState<SectionPlane[]>([])
  
  const measurementExtRef = useRef<any>(null)
  const sectionExtRef = useRef<any>(null)
  const modelStructureExtRef = useRef<any>(null)
  const propertiesExtRef = useRef<any>(null)

  // Cargar extensión
  const loadExtension = useCallback(async (extensionName: string, options?: any) => {
    if (!viewer) return false

    try {
      const extension = await viewer.loadExtension(extensionName, options)
      
      setExtensions(prev => {
        const existing = prev.find(ext => ext.name === extensionName)
        if (existing) {
          return prev.map(ext => 
            ext.name === extensionName 
              ? { ...ext, loaded: true, enabled: true, instance: extension }
              : ext
          )
        } else {
          return [...prev, {
            name: extensionName,
            enabled: true,
            loaded: true,
            instance: extension
          }]
        }
      })

      // Configurar referencias para extensiones comunes
      switch (extensionName) {
        case 'Autodesk.Measure':
          measurementExtRef.current = extension
          setupMeasurementExtension(extension)
          break
        case 'Autodesk.Section':
          sectionExtRef.current = extension
          setupSectionExtension(extension)
          break
        case 'Autodesk.ModelStructure':
          modelStructureExtRef.current = extension
          break
        case 'Autodesk.Properties':
          propertiesExtRef.current = extension
          break
      }

      return true
    } catch (error) {
      console.error(`Error loading extension ${extensionName}:`, error)
      return false
    }
  }, [viewer])

  // Descargar extensión
  const unloadExtension = useCallback(async (extensionName: string) => {
    if (!viewer) return false

    try {
      const success = await viewer.unloadExtension(extensionName)
      
      if (success) {
        setExtensions(prev => 
          prev.map(ext => 
            ext.name === extensionName 
              ? { ...ext, loaded: false, enabled: false, instance: null }
              : ext
          )
        )

        // Limpiar referencias
        switch (extensionName) {
          case 'Autodesk.Measure':
            measurementExtRef.current = null
            setMeasurements([])
            break
          case 'Autodesk.Section':
            sectionExtRef.current = null
            setSectionPlanes([])
            break
          case 'Autodesk.ModelStructure':
            modelStructureExtRef.current = null
            break
          case 'Autodesk.Properties':
            propertiesExtRef.current = null
            break
        }
      }

      return success
    } catch (error) {
      console.error(`Error unloading extension ${extensionName}:`, error)
      return false
    }
  }, [viewer])

  // Configurar extensión de medición
  const setupMeasurementExtension = useCallback((extension: any) => {
    if (!extension) return

    // Eventos de medición
    extension.addEventListener('measurement.created', (event: any) => {
      const measurement: MeasurementResult = {
        type: event.type,
        value: event.value,
        units: event.units,
        points: event.points,
        precision: event.precision || 2
      }
      
      setMeasurements(prev => [...prev, measurement])
    })

    extension.addEventListener('measurement.deleted', (event: any) => {
      setMeasurements(prev => 
        prev.filter((_, index) => index !== event.index)
      )
    })

    extension.addEventListener('measurement.cleared', () => {
      setMeasurements([])
    })
  }, [])

  // Configurar extensión de sección
  const setupSectionExtension = useCallback((extension: any) => {
    if (!extension) return

    // Eventos de planos de corte
    extension.addEventListener('section.created', (event: any) => {
      const plane: SectionPlane = {
        id: event.id || `plane_${Date.now()}`,
        normal: event.normal,
        distance: event.distance,
        visible: true,
        name: event.name || `Plano ${sectionPlanes.length + 1}`
      }
      
      setSectionPlanes(prev => [...prev, plane])
    })

    extension.addEventListener('section.deleted', (event: any) => {
      setSectionPlanes(prev => 
        prev.filter(plane => plane.id !== event.id)
      )
    })

    extension.addEventListener('section.cleared', () => {
      setSectionPlanes([])
    })
  }, [sectionPlanes.length])

  // Funciones de medición
  const measurementTools = {
    startDistanceMeasurement: useCallback(() => {
      const ext = measurementExtRef.current
      if (ext && ext.setMeasurementMode) {
        ext.setMeasurementMode('distance')
      }
    }, []),

    startAreaMeasurement: useCallback(() => {
      const ext = measurementExtRef.current
      if (ext && ext.setMeasurementMode) {
        ext.setMeasurementMode('area')
      }
    }, []),

    startAngleMeasurement: useCallback(() => {
      const ext = measurementExtRef.current
      if (ext && ext.setMeasurementMode) {
        ext.setMeasurementMode('angle')
      }
    }, []),

    stopMeasurement: useCallback(() => {
      const ext = measurementExtRef.current
      if (ext && ext.setMeasurementMode) {
        ext.setMeasurementMode(null)
      }
    }, []),

    clearAllMeasurements: useCallback(() => {
      const ext = measurementExtRef.current
      if (ext && ext.clearMeasurements) {
        ext.clearMeasurements()
      }
      setMeasurements([])
    }, []),

    deleteMeasurement: useCallback((index: number) => {
      const ext = measurementExtRef.current
      if (ext && ext.deleteMeasurement) {
        ext.deleteMeasurement(index)
      }
    }, [])
  }

  // Funciones de sección
  const sectionTools = {
    createSectionPlane: useCallback((normal: number[], distance: number, name?: string) => {
      const ext = sectionExtRef.current
      if (ext && ext.createSection) {
        ext.createSection(normal, distance, name)
      }
    }, []),

    deleteSectionPlane: useCallback((id: string) => {
      const ext = sectionExtRef.current
      if (ext && ext.deleteSection) {
        ext.deleteSection(id)
      }
    }, []),

    toggleSectionPlane: useCallback((id: string) => {
      setSectionPlanes(prev =>
        prev.map(plane =>
          plane.id === id
            ? { ...plane, visible: !plane.visible }
            : plane
        )
      )
      
      const ext = sectionExtRef.current
      const plane = sectionPlanes.find(p => p.id === id)
      if (ext && plane && ext.toggleSection) {
        ext.toggleSection(id, !plane.visible)
      }
    }, [sectionPlanes]),

    clearAllSections: useCallback(() => {
      const ext = sectionExtRef.current
      if (ext && ext.clearSections) {
        ext.clearSections()
      }
      setSectionPlanes([])
    }, []),

    setSectionPlaneDistance: useCallback((id: string, distance: number) => {
      setSectionPlanes(prev =>
        prev.map(plane =>
          plane.id === id
            ? { ...plane, distance }
            : plane
        )
      )
      
      const ext = sectionExtRef.current
      if (ext && ext.setSectionDistance) {
        ext.setSectionDistance(id, distance)
      }
    }, [])
  }

  // Funciones de estructura del modelo
  const modelStructureTools = {
    getModelTree: useCallback(() => {
      const ext = modelStructureExtRef.current
      if (ext && ext.getModelTree) {
        return ext.getModelTree()
      }
      return null
    }, []),

    expandNode: useCallback((nodeId: number) => {
      const ext = modelStructureExtRef.current
      if (ext && ext.expandNode) {
        ext.expandNode(nodeId)
      }
    }, []),

    collapseNode: useCallback((nodeId: number) => {
      const ext = modelStructureExtRef.current
      if (ext && ext.collapseNode) {
        ext.collapseNode(nodeId)
      }
    }, []),

    searchTree: useCallback((query: string) => {
      const ext = modelStructureExtRef.current
      if (ext && ext.searchTree) {
        return ext.searchTree(query)
      }
      return []
    }, [])
  }

  // Funciones de propiedades
  const propertiesTools = {
    getProperties: useCallback(async (dbId: number) => {
      return new Promise((resolve) => {
        if (viewer && viewer.getProperties) {
          viewer.getProperties(dbId, resolve)
        } else {
          resolve(null)
        }
      })
    }, [viewer]),

    getExternalId: useCallback((dbId: number) => {
      if (viewer && viewer.model && viewer.model.getExternalId) {
        return viewer.model.getExternalId(dbId)
      }
      return null
    }, [viewer]),

    searchProperties: useCallback(async (query: string) => {
      return new Promise((resolve) => {
        if (viewer && viewer.search) {
          viewer.search(query, resolve, () => resolve([]))
        } else {
          resolve([])
        }
      })
    }, [viewer])
  }

  // Obtener extensión por nombre
  const getExtension = useCallback((name: string) => {
    return extensions.find(ext => ext.name === name)
  }, [extensions])

  // Verificar si una extensión está cargada
  const isExtensionLoaded = useCallback((name: string) => {
    const ext = getExtension(name)
    return ext ? ext.loaded : false
  }, [getExtension])

  // Verificar si una extensión está habilitada
  const isExtensionEnabled = useCallback((name: string) => {
    const ext = getExtension(name)
    return ext ? ext.enabled : false
  }, [getExtension])

  return {
    // Estado
    extensions,
    measurements,
    sectionPlanes,
    
    // Gestión de extensiones
    loadExtension,
    unloadExtension,
    getExtension,
    isExtensionLoaded,
    isExtensionEnabled,
    
    // Herramientas de medición
    measurementTools,
    
    // Herramientas de sección
    sectionTools,
    
    // Herramientas de estructura del modelo
    modelStructureTools,
    
    // Herramientas de propiedades
    propertiesTools
  }
}

export default useViewerExtensions
