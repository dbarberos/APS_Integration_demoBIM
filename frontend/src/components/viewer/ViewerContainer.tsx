import React, { useState, useCallback, useEffect } from 'react'
import {
  Bars3Icon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  BuildingOffice2Icon,
  PhotoIcon
} from '@heroicons/react/24/outline'
import ModelViewer from './ModelViewer'
import ViewerToolbar from './ViewerToolbar'
import PropertiesPanel from './PropertiesPanel'
import ModelTree from './ModelTree'
import Button from '@/components/ui/Button'
import { useUI } from '@/hooks/useUI'
import { useViewer } from '@/hooks/useViewer'
import type { ViewerConfiguration, ModelTreeNode, Property } from '@/types'
import { clsx } from 'clsx'

export interface ViewerContainerProps {
  urn: string
  className?: string
  config?: ViewerConfiguration
  autoLoad?: boolean
  onModelLoaded?: (model: any) => void
  onError?: (error: string) => void
}

const ViewerContainer: React.FC<ViewerContainerProps> = ({
  urn,
  className = '',
  config,
  autoLoad = true,
  onModelLoaded,
  onError
}) => {
  const { showSuccessToast, showErrorToast } = useUI()
  
  // Estados de la UI
  const [showPropertiesPanel, setShowPropertiesPanel] = useState<boolean>(true)
  const [showModelTree, setShowModelTree] = useState<boolean>(true)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // Estados del viewer (usar hook personalizado si es necesario)
  const viewerHook = useViewer(urn, config)
  const { viewer, isLoading, error, currentModel } = viewerHook

  // Manejar cambios de selección
  const handleSelectionChange = useCallback((ids: number[]) => {
    setSelectedIds(ids)
  }, [])

  // Manejar click en nodo del árbol
  const handleNodeClick = useCallback((node: ModelTreeNode) => {
    if (viewer) {
      viewer.select([node.dbId])
    }
  }, [viewer])

  // Manejar doble click en nodo del árbol
  const handleNodeDoubleClick = useCallback((node: ModelTreeNode) => {
    if (viewer) {
      viewer.fitToView([node.dbId])
      showSuccessToast(`Enfocado en: ${node.name}`)
    }
  }, [viewer, showSuccessToast])

  // Manejar click en propiedad
  const handlePropertyClick = useCallback((property: Property) => {
    if (property.displayValue) {
      showSuccessToast(
        'Propiedad copiada',
        `${property.displayName}: ${property.displayValue}`
      )
    }
  }, [showSuccessToast])

  // Manejar cambio de herramienta
  const handleToolChanged = useCallback((tool: string | null) => {
    setActiveTool(tool)
    if (tool) {
      showSuccessToast(`Herramienta activada: ${tool}`)
    }
  }, [showSuccessToast])

  // Manejar captura de pantalla
  const handleScreenshot = useCallback(async () => {
    if (!viewer) return

    try {
      const dataUrl = await viewerHook.takeScreenshot()
      
      // Crear enlace de descarga
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `modelo-${urn}-${new Date().toISOString().slice(0, 19)}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      showSuccessToast('Captura de pantalla guardada')
    } catch (error: any) {
      showErrorToast('Error al capturar pantalla', error.message)
    }
  }, [viewer, viewerHook, urn, showSuccessToast, showErrorToast])

  // Manejar explosión del modelo
  const handleExplode = useCallback((scale: number) => {
    if (scale > 0) {
      showSuccessToast(`Modelo explotado: ${(scale * 100).toFixed(0)}%`)
    } else {
      showSuccessToast('Modelo recompuesto')
    }
  }, [showSuccessToast])

  // Manejar reset de vista
  const handleResetView = useCallback(() => {
    if (viewer) {
      showSuccessToast('Vista restablecida')
    }
  }, [viewer, showSuccessToast])

  // Toggle panel lateral
  const toggleSidePanel = useCallback((panel: 'properties' | 'tree') => {
    if (panel === 'properties') {
      setShowPropertiesPanel(prev => !prev)
    } else {
      setShowModelTree(prev => !prev)
    }
  }, [])

  // Callbacks para el viewer
  useEffect(() => {
    if (currentModel && onModelLoaded) {
      onModelLoaded(currentModel)
    }
  }, [currentModel, onModelLoaded])

  useEffect(() => {
    if (error && onError) {
      onError(error)
    }
  }, [error, onError])

  return (
    <div className={clsx('flex h-full bg-gray-100 dark:bg-gray-900', className)}>
      {/* Panel lateral izquierdo - Árbol del modelo */}
      {showModelTree && (
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
              <BuildingOffice2Icon className="h-5 w-5 mr-2" />
              Navegación
            </h3>
            <button
              onClick={() => toggleSidePanel('tree')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <ModelTree
            viewer={viewer}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            className="flex-1"
          />
        </div>
      )}

      {/* Área principal del viewer */}
      <div className="flex-1 flex flex-col">
        {/* Barra de herramientas superior */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            {/* Toggle paneles */}
            {!showModelTree && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleSidePanel('tree')}
                leftIcon={<BuildingOffice2Icon className="h-4 w-4" />}
              >
                Árbol
              </Button>
            )}
            
            {!showPropertiesPanel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleSidePanel('properties')}
                leftIcon={<AdjustmentsHorizontalIcon className="h-4 w-4" />}
              >
                Propiedades
              </Button>
            )}
          </div>

          {/* Barra de herramientas central */}
          <div className="flex-1 flex justify-center">
            <ViewerToolbar
              viewer={viewer}
              onToolChanged={handleToolChanged}
              onScreenshot={handleScreenshot}
              onExplode={handleExplode}
              onResetView={handleResetView}
              size="md"
              orientation="horizontal"
            />
          </div>

          {/* Información del modelo */}
          <div className="flex items-center space-x-4">
            {currentModel && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Modelo cargado</span>
                {selectedIds.length > 0 && (
                  <span className="ml-2">
                    • {selectedIds.length} seleccionado{selectedIds.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
            
            {activeTool && (
              <div className="text-sm text-blue-600 dark:text-blue-400">
                <span className="font-medium">Herramienta: {activeTool}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contenedor principal del viewer */}
        <div className="flex-1 relative">
          <ModelViewer
            urn={urn}
            config={config}
            autoLoad={autoLoad}
            onModelLoaded={onModelLoaded}
            onError={onError}
            onSelectionChanged={handleSelectionChange}
            showLoadingOverlay={true}
            className="w-full h-full"
          />

          {/* Overlay de herramientas floating (si es necesario) */}
          {activeTool && (
            <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {activeTool === 'measure-distance' && 'Medir distancia'}
                  {activeTool === 'measure-area' && 'Medir área'}
                  {activeTool === 'measure-angle' && 'Medir ángulo'}
                  {activeTool === 'section' && 'Planos de corte'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {activeTool.startsWith('measure') && 'Haz clic en el modelo para medir'}
                {activeTool === 'section' && 'Haz clic y arrastra para crear un plano de corte'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Panel lateral derecho - Propiedades */}
      {showPropertiesPanel && (
        <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
              <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2" />
              Propiedades
            </h3>
            <button
              onClick={() => toggleSidePanel('properties')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <PropertiesPanel
            viewer={viewer}
            selectedIds={selectedIds}
            onPropertyClick={handlePropertyClick}
            className="flex-1"
          />
        </div>
      )}

      {/* Atajos de teclado - Overlay informativo */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 right-4 bg-black/75 text-white text-xs p-3 rounded-lg font-mono max-w-xs">
          <div className="font-semibold mb-2">Atajos de teclado:</div>
          <div>F - Encuadrar vista</div>
          <div>H - Ocultar selección</div>
          <div>S - Mostrar selección</div>
          <div>Esc - Limpiar selección</div>
          <div>Ctrl+Click - Selección múltiple</div>
        </div>
      )}
    </div>
  )
}

export default ViewerContainer
