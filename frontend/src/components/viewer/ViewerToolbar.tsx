import React, { useState } from 'react'
import {
  CubeIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  RectangleGroupIcon,
  Square3Stack3DIcon,
  PaintBrushIcon,
  Bars3Icon,
  PhotoIcon,
  ArrowsPointingOutIcon,
  CogIcon,
  HomeIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline'
import { useViewerExtensions } from '@/hooks/useViewerExtensions'
import Button from '@/components/ui/Button'
import { clsx } from 'clsx'

export interface ViewerToolbarProps {
  viewer: any
  className?: string
  orientation?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md' | 'lg'
  onToolChanged?: (tool: string) => void
  onScreenshot?: () => void
  onExplode?: (scale: number) => void
  onResetView?: () => void
}

const ViewerToolbar: React.FC<ViewerToolbarProps> = ({
  viewer,
  className = '',
  orientation = 'horizontal',
  size = 'md',
  onToolChanged,
  onScreenshot,
  onExplode,
  onResetView
}) => {
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [explodeScale, setExplodeScale] = useState<number>(0)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)

  const {
    measurementTools,
    sectionTools,
    loadExtension,
    unloadExtension,
    isExtensionLoaded,
    measurements,
    sectionPlanes
  } = useViewerExtensions(viewer)

  // Cambiar herramienta activa
  const handleToolChange = (tool: string) => {
    // Desactivar herramienta anterior
    if (activeTool) {
      deactivateCurrentTool()
    }

    // Activar nueva herramienta
    if (tool === activeTool) {
      setActiveTool(null)
      onToolChanged?.(null)
    } else {
      setActiveTool(tool)
      activateNewTool(tool)
      onToolChanged?.(tool)
    }
  }

  // Desactivar herramienta actual
  const deactivateCurrentTool = () => {
    switch (activeTool) {
      case 'measure-distance':
      case 'measure-area':
      case 'measure-angle':
        measurementTools.stopMeasurement()
        break
      case 'section':
        // La herramienta de sección no necesita desactivación específica
        break
    }
  }

  // Activar nueva herramienta
  const activateNewTool = (tool: string) => {
    switch (tool) {
      case 'measure-distance':
        if (!isExtensionLoaded('Autodesk.Measure')) {
          loadExtension('Autodesk.Measure')
        }
        setTimeout(() => measurementTools.startDistanceMeasurement(), 100)
        break
      case 'measure-area':
        if (!isExtensionLoaded('Autodesk.Measure')) {
          loadExtension('Autodesk.Measure')
        }
        setTimeout(() => measurementTools.startAreaMeasurement(), 100)
        break
      case 'measure-angle':
        if (!isExtensionLoaded('Autodesk.Measure')) {
          loadExtension('Autodesk.Measure')
        }
        setTimeout(() => measurementTools.startAngleMeasurement(), 100)
        break
      case 'section':
        if (!isExtensionLoaded('Autodesk.Section')) {
          loadExtension('Autodesk.Section')
        }
        break
    }
  }

  // Controles de navegación
  const navigationControls = {
    home: () => {
      if (viewer) {
        viewer.fitToView()
        onResetView?.()
      }
    },
    
    zoomIn: () => {
      if (viewer) {
        const navigation = viewer.navigation
        navigation.setZoomTowardsViewCenter(true)
        navigation.zoom(1.2)
      }
    },
    
    zoomOut: () => {
      if (viewer) {
        const navigation = viewer.navigation
        navigation.setZoomTowardsViewCenter(true)
        navigation.zoom(0.8)
      }
    },
    
    isolate: () => {
      if (viewer) {
        const selection = viewer.getSelection()
        if (selection.length > 0) {
          viewer.isolate(selection)
        }
      }
    },
    
    show: () => {
      if (viewer) {
        const selection = viewer.getSelection()
        if (selection.length > 0) {
          viewer.show(selection)
        } else {
          viewer.showAll()
        }
      }
    },
    
    hide: () => {
      if (viewer) {
        const selection = viewer.getSelection()
        if (selection.length > 0) {
          viewer.hide(selection)
        }
      }
    },
    
    explode: (scale: number) => {
      if (viewer) {
        viewer.explode(scale)
        setExplodeScale(scale)
        onExplode?.(scale)
      }
    },
    
    fullscreen: () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        document.exitFullscreen()
        setIsFullscreen(false)
      }
    },
    
    screenshot: () => {
      if (viewer && onScreenshot) {
        onScreenshot()
      }
    }
  }

  // Limpiar mediciones
  const clearMeasurements = () => {
    measurementTools.clearAllMeasurements()
    setActiveTool(null)
  }

  // Limpiar secciones
  const clearSections = () => {
    sectionTools.clearAllSections()
    setActiveTool(null)
  }

  // Configuración de tamaños
  const sizeConfig = {
    sm: { button: 'h-8 w-8', text: 'text-xs', gap: 'gap-1' },
    md: { button: 'h-10 w-10', text: 'text-sm', gap: 'gap-2' },
    lg: { button: 'h-12 w-12', text: 'text-base', gap: 'gap-3' }
  }

  const config = sizeConfig[size]

  const toolButtons = [
    // Navegación
    {
      id: 'home',
      icon: HomeIcon,
      tooltip: 'Vista inicial',
      action: navigationControls.home,
      group: 'navigation'
    },
    {
      id: 'zoom-in',
      icon: MagnifyingGlassPlusIcon,
      tooltip: 'Acercar',
      action: navigationControls.zoomIn,
      group: 'navigation'
    },
    {
      id: 'zoom-out',
      icon: MagnifyingGlassMinusIcon,
      tooltip: 'Alejar',
      action: navigationControls.zoomOut,
      group: 'navigation'
    },
    
    // Visibilidad
    {
      id: 'isolate',
      icon: CubeIcon,
      tooltip: 'Aislar selección',
      action: navigationControls.isolate,
      group: 'visibility'
    },
    {
      id: 'show',
      icon: EyeIcon,
      tooltip: 'Mostrar selección/todo',
      action: navigationControls.show,
      group: 'visibility'
    },
    {
      id: 'hide',
      icon: EyeSlashIcon,
      tooltip: 'Ocultar selección',
      action: navigationControls.hide,
      group: 'visibility'
    },
    
    // Medición
    {
      id: 'measure-distance',
      icon: AdjustmentsHorizontalIcon,
      tooltip: 'Medir distancia',
      action: () => handleToolChange('measure-distance'),
      active: activeTool === 'measure-distance',
      group: 'measurement'
    },
    {
      id: 'measure-area',
      icon: Square3Stack3DIcon,
      tooltip: 'Medir área',
      action: () => handleToolChange('measure-area'),
      active: activeTool === 'measure-area',
      group: 'measurement'
    },
    {
      id: 'measure-angle',
      icon: RectangleGroupIcon,
      tooltip: 'Medir ángulo',
      action: () => handleToolChange('measure-angle'),
      active: activeTool === 'measure-angle',
      group: 'measurement'
    },
    
    // Sección
    {
      id: 'section',
      icon: PaintBrushIcon,
      tooltip: 'Planos de corte',
      action: () => handleToolChange('section'),
      active: activeTool === 'section',
      group: 'section'
    },
    
    // Utilidades
    {
      id: 'fullscreen',
      icon: ArrowsPointingOutIcon,
      tooltip: isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa',
      action: navigationControls.fullscreen,
      group: 'utilities'
    },
    {
      id: 'screenshot',
      icon: PhotoIcon,
      tooltip: 'Captura de pantalla',
      action: navigationControls.screenshot,
      group: 'utilities'
    }
  ]

  const containerClasses = clsx(
    'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg',
    orientation === 'horizontal' 
      ? `flex items-center ${config.gap} p-2` 
      : `flex flex-col ${config.gap} p-2`,
    className
  )

  return (
    <div className={containerClasses}>
      {/* Botones de herramientas */}
      {toolButtons.map((tool, index) => {
        const isActive = tool.active || activeTool === tool.id
        
        return (
          <React.Fragment key={tool.id}>
            {/* Separador de grupos */}
            {index > 0 && toolButtons[index - 1].group !== tool.group && (
              <div className={clsx(
                'bg-gray-200 dark:bg-gray-600',
                orientation === 'horizontal' ? 'w-px h-6' : 'h-px w-6'
              )} />
            )}
            
            <button
              onClick={tool.action}
              title={tool.tooltip}
              className={clsx(
                config.button,
                'flex items-center justify-center rounded-md transition-colors',
                isActive
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
              )}
            >
              <tool.icon className="h-5 w-5" />
            </button>
          </React.Fragment>
        )
      })}

      {/* Separador para controles de explosión */}
      {orientation === 'horizontal' && (
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />
      )}
      {orientation === 'vertical' && (
        <div className="h-px w-6 bg-gray-200 dark:bg-gray-600" />
      )}

      {/* Control de explosión */}
      <div className={clsx(
        'flex items-center',
        orientation === 'horizontal' ? 'space-x-2' : 'flex-col space-y-2'
      )}>
        <span className={clsx(config.text, 'text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap')}>
          Explotar
        </span>
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          value={explodeScale}
          onChange={(e) => navigationControls.explode(parseFloat(e.target.value))}
          className={clsx(
            'slider',
            orientation === 'horizontal' ? 'w-16' : 'w-8 transform -rotate-90'
          )}
        />
      </div>

      {/* Contadores de mediciones y secciones */}
      {(measurements.length > 0 || sectionPlanes.length > 0) && (
        <>
          <div className={clsx(
            'bg-gray-200 dark:bg-gray-600',
            orientation === 'horizontal' ? 'w-px h-6' : 'h-px w-6'
          )} />
          
          <div className={clsx(
            'flex items-center',
            orientation === 'horizontal' ? 'space-x-2' : 'flex-col space-y-1'
          )}>
            {measurements.length > 0 && (
              <div className="flex items-center space-x-1">
                <span className={clsx(config.text, 'text-gray-600 dark:text-gray-400')}>
                  M: {measurements.length}
                </span>
                <button
                  onClick={clearMeasurements}
                  className={clsx(
                    'text-red-500 hover:text-red-700 transition-colors',
                    config.text
                  )}
                  title="Limpiar mediciones"
                >
                  ×
                </button>
              </div>
            )}
            
            {sectionPlanes.length > 0 && (
              <div className="flex items-center space-x-1">
                <span className={clsx(config.text, 'text-gray-600 dark:text-gray-400')}>
                  S: {sectionPlanes.length}
                </span>
                <button
                  onClick={clearSections}
                  className={clsx(
                    'text-red-500 hover:text-red-700 transition-colors',
                    config.text
                  )}
                  title="Limpiar secciones"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ViewerToolbar
