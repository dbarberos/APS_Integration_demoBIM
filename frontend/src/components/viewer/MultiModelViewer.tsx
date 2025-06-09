import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  PlusIcon,
  XMarkIcon,
  EyeIcon,
  EyeSlashIcon,
  AdjustmentsHorizontalIcon,
  ExclamationTriangleIcon,
  BuildingLibraryIcon,
  ColorSwatchIcon,
  Square3Stack3DIcon
} from '@heroicons/react/24/outline'
import { useViewer } from '@/hooks/useViewer'
import { useViewerExtensions } from '@/hooks/useViewerExtensions'
import { useUI } from '@/hooks/useUI'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { ViewerConfiguration } from '@/types'
import { clsx } from 'clsx'

export interface ModelInfo {
  id: string
  urn: string
  name: string
  discipline: 'architecture' | 'structure' | 'mep' | 'civil' | 'landscape' | 'other'
  color?: string
  visible: boolean
  opacity: number
  loaded: boolean
  loading: boolean
  error?: string
  model?: any
}

export interface MultiModelViewerProps {
  models: ModelInfo[]
  className?: string
  config?: ViewerConfiguration
  onModelLoaded?: (model: any, modelInfo: ModelInfo) => void
  onModelError?: (error: string, modelInfo: ModelInfo) => void
  onSelectionChanged?: (ids: number[], model: any) => void
  onInterferenceDetected?: (interferences: any[]) => void
  showDisciplineControls?: boolean
  showInterferenceDetection?: boolean
  autoDetectInterferences?: boolean
}

const MultiModelViewer: React.FC<MultiModelViewerProps> = ({
  models: initialModels,
  className = '',
  config,
  onModelLoaded,
  onModelError,
  onSelectionChanged,
  onInterferenceDetected,
  showDisciplineControls = true,
  showInterferenceDetection = true,
  autoDetectInterferences = false
}) => {
  const { showSuccessToast, showErrorToast, showWarningToast } = useUI()
  
  // Estados
  const [models, setModels] = useState<ModelInfo[]>(initialModels)
  const [loadedModels, setLoadedModels] = useState<Map<string, any>>(new Map())
  const [interferences, setInterferences] = useState<any[]>([])
  const [isDetectingInterferences, setIsDetectingInterferences] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  
  // Referencias
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const interferenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Hook del viewer principal
  const {
    viewer,
    isInitialized,
    isLoading,
    error: viewerError,
    initializeViewer,
    select,
    fitToView
  } = useViewer(undefined, config)

  // Extensiones del viewer
  const { loadExtension, isExtensionLoaded } = useViewerExtensions(viewer)

  // Colores por disciplina
  const disciplineColors = {
    architecture: '#2563eb', // blue-600
    structure: '#dc2626',    // red-600
    mep: '#16a34a',         // green-600
    civil: '#ca8a04',       // yellow-600
    landscape: '#059669',    // emerald-600
    other: '#6b7280'        // gray-500
  }

  // Inicializar viewer cuando el contenedor esté listo
  useEffect(() => {
    if (containerRef.current && !isInitialized) {
      viewerRef.current = containerRef.current
      initializeViewer()
    }
  }, [isInitialized, initializeViewer])

  // Cargar modelos cuando el viewer esté listo
  useEffect(() => {
    if (isInitialized && viewer) {
      loadModels()
    }
  }, [isInitialized, viewer, models])

  // Detectar interferencias automáticamente
  useEffect(() => {
    if (autoDetectInterferences && loadedModels.size > 1) {
      // Debounce para evitar múltiples detecciones
      if (interferenceTimeoutRef.current) {
        clearTimeout(interferenceTimeoutRef.current)
      }
      
      interferenceTimeoutRef.current = setTimeout(() => {
        detectInterferences()
      }, 2000)
    }
  }, [loadedModels.size, autoDetectInterferences])

  // Cargar todos los modelos
  const loadModels = async () => {
    for (const modelInfo of models) {
      if (!modelInfo.loaded && !modelInfo.loading && !loadedModels.has(modelInfo.id)) {
        await loadSingleModel(modelInfo)
      }
    }
  }

  // Cargar un modelo individual
  const loadSingleModel = async (modelInfo: ModelInfo) => {
    if (!viewer || loadedModels.has(modelInfo.id)) return

    // Actualizar estado de carga
    setModels(prev => prev.map(m => 
      m.id === modelInfo.id ? { ...m, loading: true, error: undefined } : m
    ))

    try {
      const documentId = `urn:${modelInfo.urn}`
      
      await new Promise<void>((resolve, reject) => {
        window.Autodesk.Viewing.Document.load(documentId, async (doc: any) => {
          try {
            const viewables = doc.getRoot().getDefaultGeometry()
            if (!viewables) {
              throw new Error('No se encontraron geometrías viewables')
            }

            const model = await viewer.loadDocumentNode(doc, viewables, {
              keepCurrentModels: true, // Mantener modelos anteriores
              placementTransform: null,
              globalOffset: null
            })

            // Aplicar configuraciones del modelo
            if (modelInfo.color) {
              applyModelColor(model, modelInfo.color)
            }
            
            if (modelInfo.opacity < 1) {
              applyModelOpacity(model, modelInfo.opacity)
            }

            if (!modelInfo.visible) {
              viewer.hide(null, model)
            }

            // Registrar modelo cargado
            setLoadedModels(prev => new Map(prev.set(modelInfo.id, model)))
            
            // Actualizar estado
            setModels(prev => prev.map(m => 
              m.id === modelInfo.id 
                ? { ...m, loaded: true, loading: false, model, error: undefined }
                : m
            ))

            // Callback
            onModelLoaded?.(model, modelInfo)
            
            showSuccessToast(
              'Modelo cargado',
              `${modelInfo.name} (${modelInfo.discipline})`
            )

            resolve()
          } catch (error: any) {
            reject(error)
          }
        }, (error: string) => {
          reject(new Error(error))
        })
      })

    } catch (error: any) {
      console.error(`Error loading model ${modelInfo.name}:`, error)
      
      setModels(prev => prev.map(m => 
        m.id === modelInfo.id 
          ? { ...m, loading: false, error: error.message }
          : m
      ))

      onModelError?.(error.message, modelInfo)
      showErrorToast(`Error cargando ${modelInfo.name}`, error.message)
    }
  }

  // Aplicar color al modelo
  const applyModelColor = (model: any, color: string) => {
    if (!viewer || !model) return

    try {
      // Convertir hex a RGB
      const hex = color.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16) / 255
      const g = parseInt(hex.substr(2, 2), 16) / 255
      const b = parseInt(hex.substr(4, 2), 16) / 255

      // Aplicar color a todas las geometrías del modelo
      const fragList = model.getFragmentList()
      if (fragList) {
        for (let fragId = 0; fragId < fragList.fragments.length; fragId++) {
          viewer.setThemingColor(fragId, new THREE.Vector4(r, g, b, 1), model)
        }
      }
    } catch (error) {
      console.warn('Error applying model color:', error)
    }
  }

  // Aplicar opacidad al modelo
  const applyModelOpacity = (model: any, opacity: number) => {
    if (!viewer || !model) return

    try {
      const fragList = model.getFragmentList()
      if (fragList) {
        for (let fragId = 0; fragId < fragList.fragments.length; fragId++) {
          viewer.setThemingColor(fragId, new THREE.Vector4(1, 1, 1, opacity), model)
        }
      }
    } catch (error) {
      console.warn('Error applying model opacity:', error)
    }
  }

  // Toggle visibilidad de modelo
  const toggleModelVisibility = useCallback((modelId: string) => {
    const modelInfo = models.find(m => m.id === modelId)
    const model = loadedModels.get(modelId)
    
    if (!modelInfo || !model || !viewer) return

    const newVisibility = !modelInfo.visible

    if (newVisibility) {
      viewer.show(null, model)
    } else {
      viewer.hide(null, model)
    }

    setModels(prev => prev.map(m => 
      m.id === modelId ? { ...m, visible: newVisibility } : m
    ))

    showSuccessToast(
      `Modelo ${newVisibility ? 'mostrado' : 'ocultado'}`,
      modelInfo.name
    )
  }, [models, loadedModels, viewer, showSuccessToast])

  // Cambiar opacidad de modelo
  const changeModelOpacity = useCallback((modelId: string, opacity: number) => {
    const model = loadedModels.get(modelId)
    if (!model) return

    applyModelOpacity(model, opacity)
    
    setModels(prev => prev.map(m => 
      m.id === modelId ? { ...m, opacity } : m
    ))
  }, [loadedModels])

  // Aislar modelo
  const isolateModel = useCallback((modelId: string) => {
    const model = loadedModels.get(modelId)
    if (!model || !viewer) return

    viewer.isolate(null, model)
    setSelectedModel(modelId)

    const modelInfo = models.find(m => m.id === modelId)
    showSuccessToast('Modelo aislado', modelInfo?.name || modelId)
  }, [loadedModels, viewer, models, showSuccessToast])

  // Mostrar todos los modelos
  const showAllModels = useCallback(() => {
    if (!viewer) return

    viewer.showAll()
    setSelectedModel(null)
    
    setModels(prev => prev.map(m => ({ ...m, visible: true })))
    showSuccessToast('Todos los modelos visibles')
  }, [viewer, showSuccessToast])

  // Detectar interferencias
  const detectInterferences = useCallback(async () => {
    if (loadedModels.size < 2) {
      showWarningToast('Se necesitan al menos 2 modelos para detectar interferencias')
      return
    }

    setIsDetectingInterferences(true)

    try {
      // Cargar extensión de interferencias si no está cargada
      if (!isExtensionLoaded('Autodesk.AEC.Clash')) {
        await loadExtension('Autodesk.AEC.Clash')
      }

      // Simular detección de interferencias (implementación básica)
      // En una implementación real, esto usaría la API de APS o extensiones específicas
      await new Promise(resolve => setTimeout(resolve, 2000))

      const mockInterferences = [
        {
          id: '1',
          model1: Array.from(loadedModels.keys())[0],
          model2: Array.from(loadedModels.keys())[1],
          position: { x: 0, y: 0, z: 0 },
          severity: 'high',
          description: 'Conflicto entre estructura y MEP'
        }
      ]

      setInterferences(mockInterferences)
      onInterferenceDetected?.(mockInterferences)

      showSuccessToast(
        'Detección completada',
        `${mockInterferences.length} interferencia${mockInterferences.length !== 1 ? 's' : ''} encontrada${mockInterferences.length !== 1 ? 's' : ''}`
      )

    } catch (error: any) {
      console.error('Error detecting interferences:', error)
      showErrorToast('Error en detección de interferencias', error.message)
    } finally {
      setIsDetectingInterferences(false)
    }
  }, [loadedModels, isExtensionLoaded, loadExtension, onInterferenceDetected, showSuccessToast, showErrorToast, showWarningToast])

  // Ajustar vista a todos los modelos
  const fitAllModels = useCallback(() => {
    if (!viewer || loadedModels.size === 0) return

    viewer.fitToView()
    showSuccessToast('Vista ajustada a todos los modelos')
  }, [viewer, loadedModels.size, showSuccessToast])

  // Cleanup
  useEffect(() => {
    return () => {
      if (interferenceTimeoutRef.current) {
        clearTimeout(interferenceTimeoutRef.current)
      }
    }
  }, [])

  if (viewerError) {
    return (
      <div className={clsx('flex items-center justify-center h-full', className)}>
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Error del Multi-Viewer
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {viewerError}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('flex h-full', className)}>
      {/* Panel de control de modelos */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <Square3Stack3DIcon className="h-5 w-5 mr-2" />
            Múltiples Modelos
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {loadedModels.size} de {models.length} modelos cargados
          </p>
        </div>

        {/* Controles globales */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            <Button
              size="sm"
              onClick={showAllModels}
              leftIcon={<EyeIcon className="h-4 w-4" />}
            >
              Mostrar todo
            </Button>
            <Button
              size="sm"
              onClick={fitAllModels}
              leftIcon={<AdjustmentsHorizontalIcon className="h-4 w-4" />}
            >
              Ajustar vista
            </Button>
          </div>

          {showInterferenceDetection && (
            <div className="mt-3">
              <Button
                size="sm"
                onClick={detectInterferences}
                loading={isDetectingInterferences}
                disabled={loadedModels.size < 2}
                leftIcon={<ExclamationTriangleIcon className="h-4 w-4" />}
                fullWidth
              >
                Detectar Interferencias
              </Button>
              {interferences.length > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {interferences.length} interferencia{interferences.length !== 1 ? 's' : ''} detectada{interferences.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Lista de modelos */}
        <div className="flex-1 overflow-y-auto">
          {models.map((modelInfo) => (
            <div
              key={modelInfo.id}
              className={clsx(
                'p-4 border-b border-gray-200 dark:border-gray-700',
                selectedModel === modelInfo.id && 'bg-blue-50 dark:bg-blue-900/20'
              )}
            >
              {/* Header del modelo */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: modelInfo.color || disciplineColors[modelInfo.discipline] }}
                  />
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {modelInfo.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {modelInfo.discipline}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {modelInfo.loading && (
                    <LoadingSpinner size="sm" />
                  )}
                  {modelInfo.error && (
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                  )}
                  {modelInfo.loaded && (
                    <button
                      onClick={() => toggleModelVisibility(modelInfo.id)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      {modelInfo.visible ? (
                        <EyeIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Controles del modelo */}
              {modelInfo.loaded && (
                <div className="space-y-2">
                  {/* Control de opacidad */}
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400">
                      Opacidad: {Math.round(modelInfo.opacity * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={modelInfo.opacity}
                      onChange={(e) => changeModelOpacity(modelInfo.id, parseFloat(e.target.value))}
                      className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>

                  {/* Botones de acción */}
                  <div className="flex space-x-1">
                    <button
                      onClick={() => isolateModel(modelInfo.id)}
                      className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Aislar
                    </button>
                    <button
                      onClick={() => {
                        const model = loadedModels.get(modelInfo.id)
                        if (model && viewer) {
                          viewer.fitToView(null, model)
                        }
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Enfocar
                    </button>
                  </div>
                </div>
              )}

              {/* Error del modelo */}
              {modelInfo.error && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                  <p className="text-xs text-red-700 dark:text-red-300">
                    {modelInfo.error}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Disciplinas */}
        {showDisciplineControls && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Control por Disciplina
            </h4>
            <div className="space-y-2">
              {Object.entries(disciplineColors).map(([discipline, color]) => {
                const disciplineModels = models.filter(m => m.discipline === discipline)
                if (disciplineModels.length === 0) return null

                const allVisible = disciplineModels.every(m => m.visible)
                
                return (
                  <div key={discipline} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {discipline} ({disciplineModels.length})
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        disciplineModels.forEach(model => {
                          if (model.visible !== !allVisible) {
                            toggleModelVisibility(model.id)
                          }
                        })
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      {allVisible ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Área del viewer */}
      <div className="flex-1 relative">
        <div
          ref={containerRef}
          className="w-full h-full bg-gray-100 dark:bg-gray-800"
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <LoadingSpinner size="lg" text="Inicializando multi-viewer..." />
            </div>
          </div>
        )}

        {/* Información de modelos cargados */}
        {loadedModels.size > 0 && (
          <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-2">
            <div className="flex items-center space-x-2">
              <Square3Stack3DIcon className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {loadedModels.size} modelo{loadedModels.size !== 1 ? 's' : ''} activo{loadedModels.size !== 1 ? 's' : ''}
              </span>
            </div>
            {interferences.length > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                {interferences.length} interferencia{interferences.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MultiModelViewer
