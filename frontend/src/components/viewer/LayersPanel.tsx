import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  EyeIcon,
  EyeSlashIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
  ColorSwatchIcon,
  Squares2X2Icon,
  FunnelIcon,
  CheckIcon,
  MinusIcon
} from '@heroicons/react/24/outline'
import { useUI } from '@/hooks/useUI'
import Button from '@/components/ui/Button'
import { clsx } from 'clsx'

export interface LayerInfo {
  id: string
  name: string
  discipline: string
  category: string
  visible: boolean
  opacity: number
  color?: string
  locked: boolean
  objectIds: number[]
  parent?: string
  children?: LayerInfo[]
  expanded?: boolean
}

export interface LayersPanelProps {
  layers: LayerInfo[]
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void
  onLayerOpacityChange?: (layerId: string, opacity: number) => void
  onLayerColorChange?: (layerId: string, color: string) => void
  onLayerLockChange?: (layerId: string, locked: boolean) => void
  onLayerSelect?: (layerId: string) => void
  onLayerIsolate?: (layerId: string) => void
  className?: string
  showSearch?: boolean
  showFilters?: boolean
  showBatchControls?: boolean
  viewer?: any
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  layers: initialLayers,
  onLayerVisibilityChange,
  onLayerOpacityChange,
  onLayerColorChange,
  onLayerLockChange,
  onLayerSelect,
  onLayerIsolate,
  className = '',
  showSearch = true,
  showFilters = true,
  showBatchControls = true,
  viewer
}) => {
  const { showSuccessToast } = useUI()

  // Estados
  const [layers, setLayers] = useState<LayerInfo[]>(initialLayers)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(new Set())
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Sincronizar props con estado local
  useEffect(() => {
    setLayers(initialLayers)
  }, [initialLayers])

  // Categorías y disciplinas únicas
  const { categories, disciplines } = useMemo(() => {
    const cats = new Set<string>()
    const discs = new Set<string>()
    
    const processLayer = (layer: LayerInfo) => {
      cats.add(layer.category)
      discs.add(layer.discipline)
      layer.children?.forEach(processLayer)
    }
    
    layers.forEach(processLayer)
    
    return {
      categories: Array.from(cats),
      disciplines: Array.from(discs)
    }
  }, [layers])

  // Filtrar y buscar capas
  const filteredLayers = useMemo(() => {
    const filterLayer = (layer: LayerInfo): LayerInfo | null => {
      // Filtro de búsqueda
      const matchesSearch = !searchQuery || 
        layer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        layer.discipline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        layer.category.toLowerCase().includes(searchQuery.toLowerCase())

      // Filtro de categoría
      const matchesFilter = selectedFilter === 'all' ||
        (selectedFilter === 'visible' && layer.visible) ||
        (selectedFilter === 'hidden' && !layer.visible) ||
        (selectedFilter === 'locked' && layer.locked) ||
        layer.discipline === selectedFilter ||
        layer.category === selectedFilter

      // Procesar hijos
      const filteredChildren = layer.children
        ?.map(filterLayer)
        .filter(Boolean) as LayerInfo[]

      // Incluir si coincide o tiene hijos que coinciden
      if (matchesSearch && matchesFilter) {
        return {
          ...layer,
          children: filteredChildren
        }
      } else if (filteredChildren && filteredChildren.length > 0) {
        return {
          ...layer,
          children: filteredChildren
        }
      }

      return null
    }

    return layers.map(filterLayer).filter(Boolean) as LayerInfo[]
  }, [layers, searchQuery, selectedFilter])

  // Toggle visibilidad de capa
  const toggleLayerVisibility = useCallback((layerId: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    
    const updateLayerVisibility = (layers: LayerInfo[]): LayerInfo[] => {
      return layers.map(layer => {
        if (layer.id === layerId) {
          const newVisible = !layer.visible
          onLayerVisibilityChange?.(layerId, newVisible)
          
          // Si tiene viewer, aplicar cambios
          if (viewer && layer.objectIds.length > 0) {
            if (newVisible) {
              viewer.show(layer.objectIds)
            } else {
              viewer.hide(layer.objectIds)
            }
          }
          
          return { ...layer, visible: newVisible }
        }
        
        if (layer.children) {
          return { ...layer, children: updateLayerVisibility(layer.children) }
        }
        
        return layer
      })
    }

    setLayers(updateLayerVisibility)
  }, [onLayerVisibilityChange, viewer])

  // Cambiar opacidad de capa
  const changeLayerOpacity = useCallback((layerId: string, opacity: number) => {
    const updateLayerOpacity = (layers: LayerInfo[]): LayerInfo[] => {
      return layers.map(layer => {
        if (layer.id === layerId) {
          onLayerOpacityChange?.(layerId, opacity)
          
          // Aplicar en viewer si está disponible
          if (viewer && layer.objectIds.length > 0) {
            layer.objectIds.forEach(objId => {
              viewer.setThemingColor(objId, new THREE.Vector4(1, 1, 1, opacity))
            })
          }
          
          return { ...layer, opacity }
        }
        
        if (layer.children) {
          return { ...layer, children: updateLayerOpacity(layer.children) }
        }
        
        return layer
      })
    }

    setLayers(updateLayerOpacity)
  }, [onLayerOpacityChange, viewer])

  // Toggle expansión de nodo
  const toggleNodeExpansion = useCallback((layerId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(layerId)) {
        newSet.delete(layerId)
      } else {
        newSet.add(layerId)
      }
      return newSet
    })
  }, [])

  // Seleccionar capa
  const selectLayer = useCallback((layerId: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    
    if (event?.ctrlKey || event?.metaKey) {
      // Selección múltiple
      setSelectedLayers(prev => {
        const newSet = new Set(prev)
        if (newSet.has(layerId)) {
          newSet.delete(layerId)
        } else {
          newSet.add(layerId)
        }
        return newSet
      })
    } else {
      // Selección única
      setSelectedLayers(new Set([layerId]))
    }
    
    onLayerSelect?.(layerId)
  }, [onLayerSelect])

  // Aislar capa
  const isolateLayer = useCallback((layerId: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    
    const layer = findLayerById(layers, layerId)
    if (!layer || !viewer) return

    if (layer.objectIds.length > 0) {
      viewer.isolate(layer.objectIds)
      onLayerIsolate?.(layerId)
      showSuccessToast('Capa aislada', layer.name)
    }
  }, [layers, viewer, onLayerIsolate, showSuccessToast])

  // Buscar capa por ID
  const findLayerById = useCallback((layers: LayerInfo[], id: string): LayerInfo | null => {
    for (const layer of layers) {
      if (layer.id === id) return layer
      if (layer.children) {
        const found = findLayerById(layer.children, id)
        if (found) return found
      }
    }
    return null
  }, [])

  // Controles de lote para capas seleccionadas
  const batchShowSelected = useCallback(() => {
    selectedLayers.forEach(layerId => {
      const layer = findLayerById(layers, layerId)
      if (layer && !layer.visible) {
        toggleLayerVisibility(layerId)
      }
    })
    showSuccessToast(`${selectedLayers.size} capas mostradas`)
  }, [selectedLayers, layers, findLayerById, toggleLayerVisibility, showSuccessToast])

  const batchHideSelected = useCallback(() => {
    selectedLayers.forEach(layerId => {
      const layer = findLayerById(layers, layerId)
      if (layer && layer.visible) {
        toggleLayerVisibility(layerId)
      }
    })
    showSuccessToast(`${selectedLayers.size} capas ocultadas`)
  }, [selectedLayers, layers, findLayerById, toggleLayerVisibility, showSuccessToast])

  const batchIsolateSelected = useCallback(() => {
    if (selectedLayers.size === 0 || !viewer) return

    const objectIds: number[] = []
    selectedLayers.forEach(layerId => {
      const layer = findLayerById(layers, layerId)
      if (layer) {
        objectIds.push(...layer.objectIds)
      }
    })

    if (objectIds.length > 0) {
      viewer.isolate(objectIds)
      showSuccessToast(`${selectedLayers.size} capas aisladas`)
    }
  }, [selectedLayers, layers, findLayerById, viewer, showSuccessToast])

  // Limpiar selección
  const clearSelection = useCallback(() => {
    setSelectedLayers(new Set())
  }, [])

  // Mostrar/ocultar todas las capas
  const showAllLayers = useCallback(() => {
    const updateAllLayers = (layers: LayerInfo[]): LayerInfo[] => {
      return layers.map(layer => ({
        ...layer,
        visible: true,
        children: layer.children ? updateAllLayers(layer.children) : undefined
      }))
    }

    setLayers(updateAllLayers)
    
    if (viewer) {
      viewer.showAll()
    }
    
    showSuccessToast('Todas las capas mostradas')
  }, [viewer, showSuccessToast])

  const hideAllLayers = useCallback(() => {
    const updateAllLayers = (layers: LayerInfo[]): LayerInfo[] => {
      return layers.map(layer => ({
        ...layer,
        visible: false,
        children: layer.children ? updateAllLayers(layer.children) : undefined
      }))
    }

    setLayers(updateAllLayers)
    
    if (viewer) {
      viewer.hideAll()
    }
    
    showSuccessToast('Todas las capas ocultadas')
  }, [viewer, showSuccessToast])

  // Renderizar capa individual
  const renderLayer = useCallback((layer: LayerInfo, level: number = 0) => {
    const isSelected = selectedLayers.has(layer.id)
    const isExpanded = expandedNodes.has(layer.id)
    const hasChildren = layer.children && layer.children.length > 0

    return (
      <div key={layer.id} className="select-none">
        {/* Nodo de la capa */}
        <div
          className={clsx(
            'flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group',
            isSelected && 'bg-blue-50 dark:bg-blue-900/20',
            layer.locked && 'opacity-50'
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={(e) => selectLayer(layer.id, e)}
        >
          {/* Icono de expansión */}
          <div className="w-4 h-4 mr-1">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleNodeExpansion(layer.id)
                }}
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-3 w-3" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3" />
                )}
              </button>
            )}
          </div>

          {/* Color de la capa */}
          <div
            className="w-3 h-3 rounded-sm mr-2 border border-gray-300 dark:border-gray-600"
            style={{ backgroundColor: layer.color || '#6b7280' }}
          />

          {/* Nombre de la capa */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {layer.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {layer.discipline} • {layer.category} • {layer.objectIds.length} objetos
            </div>
          </div>

          {/* Controles */}
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Control de opacidad */}
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round(layer.opacity * 100)}%
              </span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={layer.opacity}
                onChange={(e) => changeLayerOpacity(layer.id, parseFloat(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="w-12 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Botón de aislamiento */}
            <button
              onClick={(e) => isolateLayer(layer.id, e)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              title="Aislar capa"
            >
              <Squares2X2Icon className="h-3 w-3 text-gray-500" />
            </button>

            {/* Toggle de visibilidad */}
            <button
              onClick={(e) => toggleLayerVisibility(layer.id, e)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              title={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}
            >
              {layer.visible ? (
                <EyeIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              ) : (
                <EyeSlashIcon className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Capas hijas */}
        {hasChildren && isExpanded && layer.children && (
          <div>
            {layer.children.map(child => renderLayer(child, level + 1))}
          </div>
        )}
      </div>
    )
  }, [selectedLayers, expandedNodes, selectLayer, toggleNodeExpansion, changeLayerOpacity, isolateLayer, toggleLayerVisibility])

  return (
    <div className={clsx('flex flex-col h-full bg-white dark:bg-gray-800', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
          <ColorSwatchIcon className="h-5 w-5 mr-2" />
          Gestión de Capas
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {layers.length} capas • {selectedLayers.size} seleccionadas
        </p>
      </div>

      {/* Búsqueda */}
      {showSearch && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar capas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filtros */}
      {showFilters && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filtros
            </span>
            <FunnelIcon className="h-4 w-4 text-gray-400" />
          </div>
          
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todas las capas</option>
            <option value="visible">Solo visibles</option>
            <option value="hidden">Solo ocultas</option>
            <option value="locked">Solo bloqueadas</option>
            <optgroup label="Disciplinas">
              {disciplines.map(discipline => (
                <option key={discipline} value={discipline}>
                  {discipline}
                </option>
              ))}
            </optgroup>
            <optgroup label="Categorías">
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      )}

      {/* Controles de lote */}
      {showBatchControls && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Button size="sm" onClick={showAllLayers} leftIcon={<EyeIcon className="h-4 w-4" />}>
              Mostrar todo
            </Button>
            <Button size="sm" onClick={hideAllLayers} leftIcon={<EyeSlashIcon className="h-4 w-4" />}>
              Ocultar todo
            </Button>
          </div>

          {selectedLayers.size > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                Acciones para {selectedLayers.size} capas seleccionadas:
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={batchShowSelected}
                  className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors"
                >
                  Mostrar
                </button>
                <button
                  onClick={batchHideSelected}
                  className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                >
                  Ocultar
                </button>
                <button
                  onClick={batchIsolateSelected}
                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                >
                  Aislar
                </button>
              </div>
              <button
                onClick={clearSelection}
                className="w-full px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Limpiar selección
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lista de capas */}
      <div className="flex-1 overflow-y-auto">
        {filteredLayers.length > 0 ? (
          <div className="pb-4">
            {filteredLayers.map(layer => renderLayer(layer))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <ColorSwatchIcon className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">
                {searchQuery || selectedFilter !== 'all' 
                  ? 'No se encontraron capas con los filtros aplicados'
                  : 'No hay capas disponibles'
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer con estadísticas */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Total: {layers.length}</span>
          <span>Visibles: {layers.filter(l => l.visible).length}</span>
          <span>Ocultas: {layers.filter(l => !l.visible).length}</span>
        </div>
      </div>
    </div>
  )
}

export default LayersPanel
