import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useUI } from './useUI'
import viewerService from '@/services/viewerService'
import type { ViewerState, ViewerConfiguration, ViewerToken } from '@/types'

declare global {
  interface Window {
    Autodesk: any
  }
}

export const useViewer = (urn?: string, config?: ViewerConfiguration) => {
  const { user } = useAuth()
  const { showErrorToast, showSuccessToast } = useUI()
  
  const [state, setState] = useState<ViewerState>({
    isLoading: false,
    isInitialized: false,
    error: null,
    currentUrn: null,
    currentModel: null,
    viewer: null,
    selectedIds: [],
    isolatedIds: [],
    hiddenIds: [],
    cutPlanes: [],
    explodeScale: 0,
    camera: null
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const tokenRef = useRef<ViewerToken | null>(null)
  const scriptLoadedRef = useRef<boolean>(false)

  // Cargar el script del Forge Viewer
  const loadForgeScript = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (scriptLoadedRef.current || window.Autodesk) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'
      script.async = true
      
      script.onload = () => {
        scriptLoadedRef.current = true
        resolve()
      }
      
      script.onerror = () => {
        reject(new Error('Error al cargar el script del Forge Viewer'))
      }

      document.head.appendChild(script)

      // También cargar los estilos CSS
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css'
      document.head.appendChild(link)
    })
  }, [])

  // Obtener token del viewer
  const getToken = useCallback(async (): Promise<string> => {
    try {
      if (tokenRef.current && new Date(tokenRef.current.expires_at) > new Date()) {
        return tokenRef.current.access_token
      }

      const tokenData = await viewerService.getViewerToken()
      tokenRef.current = tokenData
      return tokenData.access_token
    } catch (error: any) {
      throw new Error(`Error al obtener token: ${error.message}`)
    }
  }, [])

  // Inicializar el viewer
  const initializeViewer = useCallback(async () => {
    if (!containerRef.current || state.isInitialized) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Cargar script si no está cargado
      await loadForgeScript()

      // Obtener token
      const accessToken = await getToken()

      // Configurar opciones del viewer
      const viewerConfig = {
        accessToken,
        urn: urn || '',
        viewerContainer: containerRef.current,
        options: {
          theme: config?.theme || 'bim-theme',
          extensions: config?.extensions || [
            'Autodesk.Section',
            'Autodesk.Measure',
            'Autodesk.ViewCubeUi',
            'Autodesk.ModelStructure',
            'Autodesk.LayerManager',
            'Autodesk.Properties'
          ],
          disabledExtensions: config?.disabledExtensions || [],
          useADP: config?.useADP || false,
          language: config?.language || 'es'
        }
      }

      // Inicializar el viewer
      const viewer = await viewerService.initializeViewer(viewerConfig)

      // Configurar event listeners
      setupEventListeners(viewer)

      setState(prev => ({
        ...prev,
        isLoading: false,
        isInitialized: true,
        viewer,
        error: null
      }))

      showSuccessToast('Viewer inicializado correctamente')

    } catch (error: any) {
      console.error('Error initializing viewer:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Error al inicializar el viewer'
      }))
      showErrorToast('Error al inicializar viewer', error.message)
    }
  }, [urn, config, loadForgeScript, getToken, showSuccessToast, showErrorToast])

  // Configurar event listeners del viewer
  const setupEventListeners = useCallback((viewer: any) => {
    // Selección de objetos
    viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event: any) => {
      setState(prev => ({
        ...prev,
        selectedIds: event.dbIdArray || []
      }))
    })

    // Aislamiento de objetos
    viewer.addEventListener(window.Autodesk.Viewing.ISOLATE_EVENT, (event: any) => {
      setState(prev => ({
        ...prev,
        isolatedIds: event.nodeIdArray || []
      }))
    })

    // Ocultación de objetos
    viewer.addEventListener(window.Autodesk.Viewing.HIDE_EVENT, (event: any) => {
      setState(prev => ({
        ...prev,
        hiddenIds: event.nodeIdArray || []
      }))
    })

    // Cambio de cámara
    viewer.addEventListener(window.Autodesk.Viewing.CAMERA_CHANGE_EVENT, () => {
      setState(prev => ({
        ...prev,
        camera: viewer.getCamera()
      }))
    })

    // Planos de corte
    viewer.addEventListener(window.Autodesk.Viewing.CUTPLANES_CHANGE_EVENT, () => {
      setState(prev => ({
        ...prev,
        cutPlanes: viewer.getCutPlanes()
      }))
    })

    // Explosión
    viewer.addEventListener(window.Autodesk.Viewing.EXPLODE_CHANGE_EVENT, (event: any) => {
      setState(prev => ({
        ...prev,
        explodeScale: event.scale || 0
      }))
    })

    // Error del viewer
    viewer.addEventListener(window.Autodesk.Viewing.ERROR_EVENT, (event: any) => {
      console.error('Viewer error:', event)
      setState(prev => ({
        ...prev,
        error: event.message || 'Error en el viewer'
      }))
      showErrorToast('Error del viewer', event.message)
    })
  }, [showErrorToast])

  // Cargar modelo
  const loadModel = useCallback(async (modelUrn: string) => {
    if (!state.viewer) {
      throw new Error('Viewer no inicializado')
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const model = await viewerService.loadModel(state.viewer, modelUrn)
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        currentUrn: modelUrn,
        currentModel: model,
        error: null
      }))

      showSuccessToast('Modelo cargado correctamente')
      return model

    } catch (error: any) {
      console.error('Error loading model:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Error al cargar el modelo'
      }))
      showErrorToast('Error al cargar modelo', error.message)
      throw error
    }
  }, [state.viewer, showSuccessToast, showErrorToast])

  // Funciones de control del viewer
  const viewerControls = {
    // Selección
    select: useCallback((ids: number | number[]) => {
      if (state.viewer) {
        state.viewer.select(Array.isArray(ids) ? ids : [ids])
      }
    }, [state.viewer]),

    clearSelection: useCallback(() => {
      if (state.viewer) {
        state.viewer.clearSelection()
      }
    }, [state.viewer]),

    // Aislamiento
    isolate: useCallback((ids: number | number[]) => {
      if (state.viewer) {
        state.viewer.isolate(Array.isArray(ids) ? ids : [ids])
      }
    }, [state.viewer]),

    showAll: useCallback(() => {
      if (state.viewer) {
        state.viewer.showAll()
      }
    }, [state.viewer]),

    // Visibilidad
    hide: useCallback((ids: number | number[]) => {
      if (state.viewer) {
        state.viewer.hide(Array.isArray(ids) ? ids : [ids])
      }
    }, [state.viewer]),

    show: useCallback((ids: number | number[]) => {
      if (state.viewer) {
        state.viewer.show(Array.isArray(ids) ? ids : [ids])
      }
    }, [state.viewer]),

    // Navegación
    fitToView: useCallback((ids?: number | number[]) => {
      if (state.viewer) {
        if (ids) {
          state.viewer.fitToView(Array.isArray(ids) ? ids : [ids])
        } else {
          state.viewer.fitToView()
        }
      }
    }, [state.viewer]),

    // Explosión
    explode: useCallback((scale: number) => {
      if (state.viewer) {
        state.viewer.explode(scale)
      }
    }, [state.viewer]),

    // Cámara
    setCamera: useCallback((camera: any) => {
      if (state.viewer) {
        state.viewer.setViewFromArray(camera)
      }
    }, [state.viewer]),

    // Screenshot
    takeScreenshot: useCallback(async (width = 1920, height = 1080) => {
      if (state.viewer) {
        return viewerService.takeScreenshot(state.viewer, width, height)
      }
      throw new Error('Viewer no disponible')
    }, [state.viewer])
  }

  // Cleanup cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (state.viewer) {
        viewerService.cleanup(state.viewer)
      }
    }
  }, [state.viewer])

  // Auto-inicializar si se proporciona URN
  useEffect(() => {
    if (urn && !state.isInitialized && containerRef.current) {
      initializeViewer()
    }
  }, [urn, state.isInitialized, initializeViewer])

  // Auto-cargar modelo si se proporciona URN después de inicializar
  useEffect(() => {
    if (urn && state.isInitialized && state.viewer && state.currentUrn !== urn) {
      loadModel(urn)
    }
  }, [urn, state.isInitialized, state.viewer, state.currentUrn, loadModel])

  return {
    // Estado
    ...state,
    containerRef,
    
    // Métodos
    initializeViewer,
    loadModel,
    
    // Controles
    ...viewerControls,
    
    // Utilidades
    getToken,
    getViewState: useCallback(() => {
      if (state.viewer) {
        return viewerService.getViewState(state.viewer)
      }
      return null
    }, [state.viewer])
  }
}

export default useViewer
