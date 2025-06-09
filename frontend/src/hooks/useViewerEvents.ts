import { useCallback, useRef, useEffect } from 'react'

export interface ViewerEventHandlers {
  onSelectionChanged?: (event: any) => void
  onCameraChanged?: (event: any) => void
  onModelLoaded?: (event: any) => void
  onModelUnloaded?: (event: any) => void
  onIsolateChanged?: (event: any) => void
  onHideChanged?: (event: any) => void
  onShowChanged?: (event: any) => void
  onCutPlanesChanged?: (event: any) => void
  onExplodeChanged?: (event: any) => void
  onExtensionLoaded?: (event: any) => void
  onExtensionUnloaded?: (event: any) => void
  onViewerError?: (event: any) => void
  onGeometryLoaded?: (event: any) => void
  onObjectTreeCreated?: (event: any) => void
  onPropertyPanelCreated?: (event: any) => void
  onToolbarCreated?: (event: any) => void
  onFullscreenChanged?: (event: any) => void
  onProgressUpdate?: (event: any) => void
}

export const useViewerEvents = (viewer: any, handlers: ViewerEventHandlers = {}) => {
  const listenersRef = useRef<Map<string, (event: any) => void>>(new Map())
  const isSetupRef = useRef<boolean>(false)

  // Configurar eventos del viewer
  const setupEventListeners = useCallback(() => {
    if (!viewer || !window.Autodesk || isSetupRef.current) return

    const Viewing = window.Autodesk.Viewing

    // Limpiar listeners anteriores
    cleanupEventListeners()

    // Selección
    if (handlers.onSelectionChanged) {
      const listener = (event: any) => handlers.onSelectionChanged!(event)
      viewer.addEventListener(Viewing.SELECTION_CHANGED_EVENT, listener)
      listenersRef.current.set(Viewing.SELECTION_CHANGED_EVENT, listener)
    }

    // Cámara
    if (handlers.onCameraChanged) {
      const listener = (event: any) => handlers.onCameraChanged!(event)
      viewer.addEventListener(Viewing.CAMERA_CHANGE_EVENT, listener)
      listenersRef.current.set(Viewing.CAMERA_CHANGE_EVENT, listener)
    }

    // Modelo
    if (handlers.onModelLoaded) {
      const listener = (event: any) => handlers.onModelLoaded!(event)
      viewer.addEventListener(Viewing.MODEL_ADDED_EVENT, listener)
      listenersRef.current.set(Viewing.MODEL_ADDED_EVENT, listener)
    }

    if (handlers.onModelUnloaded) {
      const listener = (event: any) => handlers.onModelUnloaded!(event)
      viewer.addEventListener(Viewing.MODEL_REMOVED_EVENT, listener)
      listenersRef.current.set(Viewing.MODEL_REMOVED_EVENT, listener)
    }

    // Aislamiento
    if (handlers.onIsolateChanged) {
      const listener = (event: any) => handlers.onIsolateChanged!(event)
      viewer.addEventListener(Viewing.ISOLATE_EVENT, listener)
      listenersRef.current.set(Viewing.ISOLATE_EVENT, listener)
    }

    // Visibilidad
    if (handlers.onHideChanged) {
      const listener = (event: any) => handlers.onHideChanged!(event)
      viewer.addEventListener(Viewing.HIDE_EVENT, listener)
      listenersRef.current.set(Viewing.HIDE_EVENT, listener)
    }

    if (handlers.onShowChanged) {
      const listener = (event: any) => handlers.onShowChanged!(event)
      viewer.addEventListener(Viewing.SHOW_EVENT, listener)
      listenersRef.current.set(Viewing.SHOW_EVENT, listener)
    }

    // Planos de corte
    if (handlers.onCutPlanesChanged) {
      const listener = (event: any) => handlers.onCutPlanesChanged!(event)
      viewer.addEventListener(Viewing.CUTPLANES_CHANGE_EVENT, listener)
      listenersRef.current.set(Viewing.CUTPLANES_CHANGE_EVENT, listener)
    }

    // Explosión
    if (handlers.onExplodeChanged) {
      const listener = (event: any) => handlers.onExplodeChanged!(event)
      viewer.addEventListener(Viewing.EXPLODE_CHANGE_EVENT, listener)
      listenersRef.current.set(Viewing.EXPLODE_CHANGE_EVENT, listener)
    }

    // Extensiones
    if (handlers.onExtensionLoaded) {
      const listener = (event: any) => handlers.onExtensionLoaded!(event)
      viewer.addEventListener(Viewing.EXTENSION_LOADED_EVENT, listener)
      listenersRef.current.set(Viewing.EXTENSION_LOADED_EVENT, listener)
    }

    if (handlers.onExtensionUnloaded) {
      const listener = (event: any) => handlers.onExtensionUnloaded!(event)
      viewer.addEventListener(Viewing.EXTENSION_UNLOADED_EVENT, listener)
      listenersRef.current.set(Viewing.EXTENSION_UNLOADED_EVENT, listener)
    }

    // Errores
    if (handlers.onViewerError) {
      const listener = (event: any) => handlers.onViewerError!(event)
      viewer.addEventListener(Viewing.ERROR_EVENT, listener)
      listenersRef.current.set(Viewing.ERROR_EVENT, listener)
    }

    // Geometría
    if (handlers.onGeometryLoaded) {
      const listener = (event: any) => handlers.onGeometryLoaded!(event)
      viewer.addEventListener(Viewing.GEOMETRY_LOADED_EVENT, listener)
      listenersRef.current.set(Viewing.GEOMETRY_LOADED_EVENT, listener)
    }

    // Árbol de objetos
    if (handlers.onObjectTreeCreated) {
      const listener = (event: any) => handlers.onObjectTreeCreated!(event)
      viewer.addEventListener(Viewing.OBJECT_TREE_CREATED_EVENT, listener)
      listenersRef.current.set(Viewing.OBJECT_TREE_CREATED_EVENT, listener)
    }

    // Panel de propiedades
    if (handlers.onPropertyPanelCreated) {
      const listener = (event: any) => handlers.onPropertyPanelCreated!(event)
      viewer.addEventListener(Viewing.TOOLBAR_CREATED_EVENT, listener)
      listenersRef.current.set(Viewing.TOOLBAR_CREATED_EVENT, listener)
    }

    // Pantalla completa
    if (handlers.onFullscreenChanged) {
      const listener = (event: any) => handlers.onFullscreenChanged!(event)
      viewer.addEventListener(Viewing.FULLSCREEN_MODE_EVENT, listener)
      listenersRef.current.set(Viewing.FULLSCREEN_MODE_EVENT, listener)
    }

    // Progreso
    if (handlers.onProgressUpdate) {
      const listener = (event: any) => handlers.onProgressUpdate!(event)
      viewer.addEventListener(Viewing.PROGRESS_UPDATE_EVENT, listener)
      listenersRef.current.set(Viewing.PROGRESS_UPDATE_EVENT, listener)
    }

    isSetupRef.current = true
  }, [viewer, handlers])

  // Limpiar event listeners
  const cleanupEventListeners = useCallback(() => {
    if (!viewer || listenersRef.current.size === 0) return

    listenersRef.current.forEach((listener, eventType) => {
      try {
        viewer.removeEventListener(eventType, listener)
      } catch (error) {
        console.warn(`Error removing event listener for ${eventType}:`, error)
      }
    })

    listenersRef.current.clear()
    isSetupRef.current = false
  }, [viewer])

  // Agregar listener personalizado
  const addEventListener = useCallback((eventType: string, listener: (event: any) => void) => {
    if (!viewer) return

    viewer.addEventListener(eventType, listener)
    listenersRef.current.set(eventType, listener)
  }, [viewer])

  // Remover listener personalizado
  const removeEventListener = useCallback((eventType: string) => {
    if (!viewer) return

    const listener = listenersRef.current.get(eventType)
    if (listener) {
      viewer.removeEventListener(eventType, listener)
      listenersRef.current.delete(eventType)
    }
  }, [viewer])

  // Disparar evento personalizado
  const fireEvent = useCallback((eventType: string, data?: any) => {
    if (!viewer) return

    const event = {
      type: eventType,
      target: viewer,
      data: data || {},
      timestamp: Date.now()
    }

    viewer.fireEvent(event)
  }, [viewer])

  // Obtener lista de eventos activos
  const getActiveEvents = useCallback(() => {
    return Array.from(listenersRef.current.keys())
  }, [])

  // Verificar si un evento está registrado
  const hasEventListener = useCallback((eventType: string) => {
    return listenersRef.current.has(eventType)
  }, [])

  // Configurar automáticamente cuando el viewer esté disponible
  useEffect(() => {
    if (viewer && window.Autodesk) {
      setupEventListeners()
    }

    return () => {
      cleanupEventListeners()
    }
  }, [viewer, setupEventListeners, cleanupEventListeners])

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      cleanupEventListeners()
    }
  }, [cleanupEventListeners])

  return {
    // Gestión de eventos
    setupEventListeners,
    cleanupEventListeners,
    addEventListener,
    removeEventListener,
    fireEvent,
    
    // Información
    getActiveEvents,
    hasEventListener,
    isSetup: isSetupRef.current,
    activeEventCount: listenersRef.current.size
  }
}

export default useViewerEvents
