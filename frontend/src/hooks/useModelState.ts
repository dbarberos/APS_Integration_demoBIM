import { useState, useCallback, useRef } from 'react'
import type { ViewerState } from '@/types'

export const useModelState = () => {
  const [modelState, setModelState] = useState<ViewerState>({
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

  const stateHistoryRef = useRef<ViewerState[]>([])
  const maxHistorySize = 20

  // Actualizar estado y mantener historial
  const updateState = useCallback((updates: Partial<ViewerState>) => {
    setModelState(prevState => {
      const newState = { ...prevState, ...updates }
      
      // Agregar al historial
      stateHistoryRef.current.push(prevState)
      if (stateHistoryRef.current.length > maxHistorySize) {
        stateHistoryRef.current.shift()
      }
      
      return newState
    })
  }, [])

  // Funciones de actualización específicas
  const setLoading = useCallback((isLoading: boolean) => {
    updateState({ isLoading })
  }, [updateState])

  const setError = useCallback((error: string | null) => {
    updateState({ error })
  }, [updateState])

  const setViewer = useCallback((viewer: any) => {
    updateState({ 
      viewer, 
      isInitialized: !!viewer,
      error: viewer ? null : 'Error al inicializar viewer'
    })
  }, [updateState])

  const setCurrentModel = useCallback((model: any, urn?: string) => {
    updateState({ 
      currentModel: model, 
      currentUrn: urn || modelState.currentUrn 
    })
  }, [updateState, modelState.currentUrn])

  const setSelection = useCallback((selectedIds: number[]) => {
    updateState({ selectedIds })
  }, [updateState])

  const setIsolation = useCallback((isolatedIds: number[]) => {
    updateState({ isolatedIds })
  }, [updateState])

  const setHiddenNodes = useCallback((hiddenIds: number[]) => {
    updateState({ hiddenIds })
  }, [updateState])

  const setCutPlanes = useCallback((cutPlanes: any[]) => {
    updateState({ cutPlanes })
  }, [updateState])

  const setExplodeScale = useCallback((explodeScale: number) => {
    updateState({ explodeScale })
  }, [updateState])

  const setCamera = useCallback((camera: any) => {
    updateState({ camera })
  }, [updateState])

  // Resetear estado
  const resetState = useCallback(() => {
    setModelState({
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
    stateHistoryRef.current = []
  }, [])

  // Obtener estado anterior
  const getPreviousState = useCallback(() => {
    const history = stateHistoryRef.current
    return history.length > 0 ? history[history.length - 1] : null
  }, [])

  // Revertir al estado anterior
  const revertToPreviousState = useCallback(() => {
    const previousState = stateHistoryRef.current.pop()
    if (previousState) {
      setModelState(previousState)
    }
  }, [])

  // Obtener estadísticas del estado
  const getStateStats = useCallback(() => {
    return {
      selectedCount: modelState.selectedIds.length,
      isolatedCount: modelState.isolatedIds.length,
      hiddenCount: modelState.hiddenIds.length,
      cutPlanesCount: modelState.cutPlanes.length,
      explodeScale: modelState.explodeScale,
      hasModel: !!modelState.currentModel,
      isViewerReady: modelState.isInitialized && !modelState.isLoading && !modelState.error,
      historySize: stateHistoryRef.current.length
    }
  }, [modelState])

  // Validar estado
  const validateState = useCallback(() => {
    const errors: string[] = []
    
    if (modelState.isInitialized && !modelState.viewer) {
      errors.push('Viewer inicializado pero instancia no disponible')
    }
    
    if (modelState.currentModel && !modelState.currentUrn) {
      errors.push('Modelo cargado pero URN no especificado')
    }
    
    if (modelState.selectedIds.length > 0 && !modelState.currentModel) {
      errors.push('Objetos seleccionados sin modelo cargado')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }, [modelState])

  // Serializar estado para debugging
  const serializeState = useCallback(() => {
    return {
      ...modelState,
      viewer: modelState.viewer ? '[Viewer Instance]' : null,
      currentModel: modelState.currentModel ? '[Model Instance]' : null,
      camera: modelState.camera ? '[Camera Object]' : null
    }
  }, [modelState])

  // Estado calculado
  const isReady = modelState.isInitialized && 
    !modelState.isLoading && 
    !modelState.error && 
    !!modelState.viewer

  const hasContent = !!modelState.currentModel

  const hasSelection = modelState.selectedIds.length > 0

  const hasModifications = modelState.isolatedIds.length > 0 || 
    modelState.hiddenIds.length > 0 || 
    modelState.cutPlanes.length > 0 || 
    modelState.explodeScale > 0

  return {
    // Estado
    ...modelState,
    
    // Estado calculado
    isReady,
    hasContent,
    hasSelection,
    hasModifications,
    
    // Funciones de actualización
    updateState,
    setLoading,
    setError,
    setViewer,
    setCurrentModel,
    setSelection,
    setIsolation,
    setHiddenNodes,
    setCutPlanes,
    setExplodeScale,
    setCamera,
    
    // Gestión de estado
    resetState,
    getPreviousState,
    revertToPreviousState,
    
    // Utilidades
    getStateStats,
    validateState,
    serializeState
  }
}

export default useModelState
