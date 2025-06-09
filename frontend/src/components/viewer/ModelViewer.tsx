import React, { useEffect, useRef } from 'react'
import { useViewer } from '@/hooks/useViewer'
import { useViewerExtensions } from '@/hooks/useViewerExtensions'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import type { ViewerConfiguration } from '@/types'
import { clsx } from 'clsx'

export interface ModelViewerProps {
  urn: string
  className?: string
  config?: ViewerConfiguration
  onModelLoaded?: (model: any) => void
  onError?: (error: string) => void
  onSelectionChanged?: (ids: number[]) => void
  onCameraChanged?: (camera: any) => void
  showToolbar?: boolean
  showLoadingOverlay?: boolean
  autoLoad?: boolean
}

const ModelViewer: React.FC<ModelViewerProps> = ({
  urn,
  className = '',
  config,
  onModelLoaded,
  onError,
  onSelectionChanged,
  onCameraChanged,
  showToolbar = true,
  showLoadingOverlay = true,
  autoLoad = true
}) => {
  const viewerContainerRef = useRef<HTMLDivElement>(null)
  
  const {
    isLoading,
    isInitialized,
    error,
    viewer,
    currentModel,
    selectedIds,
    camera,
    containerRef,
    initializeViewer,
    loadModel,
    fitToView,
    clearSelection
  } = useViewer(autoLoad ? urn : undefined, config)

  const {
    loadExtension,
    extensions,
    measurementTools,
    sectionTools,
    isExtensionLoaded
  } = useViewerExtensions(viewer)

  // Sincronizar ref del contenedor
  useEffect(() => {
    if (viewerContainerRef.current && containerRef) {
      (containerRef as any).current = viewerContainerRef.current
    }
  }, [containerRef])

  // Callbacks cuando el modelo se carga
  useEffect(() => {
    if (currentModel && onModelLoaded) {
      onModelLoaded(currentModel)
    }
  }, [currentModel, onModelLoaded])

  // Callback cuando hay error
  useEffect(() => {
    if (error && onError) {
      onError(error)
    }
  }, [error, onError])

  // Callback cuando cambia la selección
  useEffect(() => {
    if (onSelectionChanged) {
      onSelectionChanged(selectedIds)
    }
  }, [selectedIds, onSelectionChanged])

  // Callback cuando cambia la cámara
  useEffect(() => {
    if (camera && onCameraChanged) {
      onCameraChanged(camera)
    }
  }, [camera, onCameraChanged])

  // Cargar extensiones por defecto cuando el viewer esté inicializado
  useEffect(() => {
    if (isInitialized && viewer && !isExtensionLoaded('Autodesk.ViewCubeUi')) {
      // Cargar extensiones básicas
      const defaultExtensions = [
        'Autodesk.ViewCubeUi',
        'Autodesk.ModelStructure',
        'Autodesk.Properties',
        'Autodesk.LayerManager'
      ]

      defaultExtensions.forEach(extName => {
        if (!isExtensionLoaded(extName)) {
          loadExtension(extName)
        }
      })
    }
  }, [isInitialized, viewer, loadExtension, isExtensionLoaded])

  // Método manual para cargar modelo (si autoLoad está desactivado)
  const handleLoadModel = async () => {
    if (!isInitialized) {
      await initializeViewer()
    }
    if (urn) {
      await loadModel(urn)
    }
  }

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!viewer) return

      switch (event.key) {
        case 'Escape':
          clearSelection()
          event.preventDefault()
          break
        case 'f':
        case 'F':
          if (event.ctrlKey || event.metaKey) {
            fitToView()
            event.preventDefault()
          }
          break
        case 'h':
        case 'H':
          if (selectedIds.length > 0) {
            viewer.hide(selectedIds)
            event.preventDefault()
          }
          break
        case 's':
        case 'S':
          if (selectedIds.length > 0) {
            viewer.show(selectedIds)
            event.preventDefault()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [viewer, selectedIds, clearSelection, fitToView])

  return (
    <div className={clsx('relative w-full h-full', className)}>
      {/* Contenedor del viewer */}
      <div
        ref={viewerContainerRef}
        className="w-full h-full bg-gray-100 dark:bg-gray-800"
        style={{ minHeight: '400px' }}
      />

      {/* Loading Overlay */}
      {showLoadingOverlay && isLoading && (
        <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col items-center space-y-4">
            <LoadingSpinner size="lg" />
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {!isInitialized ? 'Inicializando viewer...' : 'Cargando modelo...'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {!isInitialized ? 'Configurando el entorno 3D' : 'Procesando geometría del modelo'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Error del Viewer
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {error}
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Recargar página
              </button>
              <button
                onClick={handleLoadModel}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carga manual para modelos sin autoLoad */}
      {!autoLoad && !isInitialized && !isLoading && !error && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Listo para cargar modelo
            </h3>
            <button
              onClick={handleLoadModel}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Cargar Modelo 3D
            </button>
          </div>
        </div>
      )}

      {/* Información del modelo cargado */}
      {currentModel && !isLoading && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-2 z-5">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Modelo cargado
            </span>
          </div>
          {selectedIds.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {selectedIds.length} objeto{selectedIds.length > 1 ? 's' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Debug info (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 bg-black/75 text-white text-xs p-2 rounded font-mono">
          <div>URN: {urn}</div>
          <div>Initialized: {isInitialized ? 'Yes' : 'No'}</div>
          <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
          <div>Model: {currentModel ? 'Loaded' : 'None'}</div>
          <div>Extensions: {extensions.filter(e => e.loaded).length}</div>
          <div>Selected: {selectedIds.length}</div>
        </div>
      )}
    </div>
  )
}

export default ModelViewer
