import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  CubeIcon,
  FunnelIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import { useViewerExtensions } from '@/hooks/useViewerExtensions'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import type { ModelTreeNode } from '@/types'
import { clsx } from 'clsx'

export interface ModelTreeProps {
  viewer: any
  className?: string
  selectedIds?: number[]
  onSelectionChange?: (ids: number[]) => void
  onNodeClick?: (node: ModelTreeNode) => void
  onNodeDoubleClick?: (node: ModelTreeNode) => void
  showSearch?: boolean
  showFilter?: boolean
  multiSelect?: boolean
}

const ModelTree: React.FC<ModelTreeProps> = ({
  viewer,
  className = '',
  selectedIds = [],
  onSelectionChange,
  onNodeClick,
  onNodeDoubleClick,
  showSearch = true,
  showFilter = true,
  multiSelect = true
}) => {
  const { modelStructureTools } = useViewerExtensions(viewer)
  
  const [treeData, setTreeData] = useState<ModelTreeNode[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())
  const [hiddenNodes, setHiddenNodes] = useState<Set<number>>(new Set())
  const [isolatedNodes, setIsolatedNodes] = useState<Set<number>>(new Set())
  const [filterType, setFilterType] = useState<string>('')
  const [internalSelection, setInternalSelection] = useState<Set<number>>(new Set(selectedIds))

  // Sincronizar selección interna con props
  useEffect(() => {
    setInternalSelection(new Set(selectedIds))
  }, [selectedIds])

  // Cargar árbol del modelo
  useEffect(() => {
    const loadModelTree = async () => {
      if (!viewer || !viewer.model) return

      setIsLoading(true)
      try {
        // Obtener la instancia del árbol del modelo
        const tree = viewer.model.getInstanceTree()
        if (!tree) {
          setTreeData([])
          return
        }

        // Construir el árbol de nodos
        const buildTreeNode = (nodeId: number): ModelTreeNode => {
          const name = tree.getNodeName(nodeId) || `Nodo ${nodeId}`
          const childrenIds = tree.getChildCount(nodeId) > 0 ? [] : undefined
          
          if (childrenIds !== undefined) {
            tree.enumNodeChildren(nodeId, (childId: number) => {
              childrenIds.push(childId)
            })
          }

          return {
            dbId: nodeId,
            name,
            type: tree.getNodeType(nodeId) || 'object',
            children: childrenIds?.map(buildTreeNode),
            parent: tree.getNodeParent(nodeId),
            visible: true,
            selected: selectedIds.includes(nodeId)
          }
        }

        // Obtener nodos raíz
        const rootId = tree.getRootId()
        const rootNode = buildTreeNode(rootId)
        
        setTreeData(rootNode.children || [])
        
        // Expandir primer nivel por defecto
        const firstLevelIds = new Set<number>()
        if (rootNode.children) {
          rootNode.children.forEach(child => firstLevelIds.add(child.dbId))
        }
        setExpandedNodes(firstLevelIds)

      } catch (error) {
        console.error('Error loading model tree:', error)
        setTreeData([])
      } finally {
        setIsLoading(false)
      }
    }

    loadModelTree()
  }, [viewer, selectedIds])

  // Filtrar nodos por búsqueda y tipo
  const filteredTreeData = useMemo(() => {
    if (!searchQuery && !filterType) return treeData

    const filterNode = (node: ModelTreeNode): ModelTreeNode | null => {
      const matchesSearch = !searchQuery || 
        node.name.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesType = !filterType || node.type === filterType

      const filteredChildren = node.children
        ?.map(filterNode)
        .filter(Boolean) as ModelTreeNode[]

      if (matchesSearch && matchesType) {
        return {
          ...node,
          children: filteredChildren
        }
      }

      if (filteredChildren?.length > 0) {
        return {
          ...node,
          children: filteredChildren
        }
      }

      return null
    }

    return treeData.map(filterNode).filter(Boolean) as ModelTreeNode[]
  }, [treeData, searchQuery, filterType])

  // Obtener tipos únicos para el filtro
  const nodeTypes = useMemo(() => {
    const types = new Set<string>()
    
    const collectTypes = (nodes: ModelTreeNode[]) => {
      nodes.forEach(node => {
        types.add(node.type)
        if (node.children) {
          collectTypes(node.children)
        }
      })
    }
    
    collectTypes(treeData)
    return Array.from(types).sort()
  }, [treeData])

  // Toggle expansión de nodo
  const toggleExpanded = useCallback((nodeId: number) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }, [])

  // Seleccionar/deseleccionar nodo
  const toggleSelection = useCallback((nodeId: number, event?: React.MouseEvent) => {
    if (!multiSelect) {
      const newSelection = new Set([nodeId])
      setInternalSelection(newSelection)
      onSelectionChange?.(Array.from(newSelection))
      return
    }

    if (event?.ctrlKey || event?.metaKey) {
      // Ctrl+click: toggle individual
      setInternalSelection(prev => {
        const newSet = new Set(prev)
        if (newSet.has(nodeId)) {
          newSet.delete(nodeId)
        } else {
          newSet.add(nodeId)
        }
        onSelectionChange?.(Array.from(newSet))
        return newSet
      })
    } else if (event?.shiftKey && internalSelection.size > 0) {
      // Shift+click: selección de rango (implementación básica)
      const allNodeIds = getAllNodeIds(treeData)
      const lastSelected = Array.from(internalSelection)[internalSelection.size - 1]
      const startIndex = allNodeIds.indexOf(lastSelected)
      const endIndex = allNodeIds.indexOf(nodeId)
      
      if (startIndex !== -1 && endIndex !== -1) {
        const rangeStart = Math.min(startIndex, endIndex)
        const rangeEnd = Math.max(startIndex, endIndex)
        const rangeIds = allNodeIds.slice(rangeStart, rangeEnd + 1)
        
        setInternalSelection(prev => {
          const newSet = new Set(prev)
          rangeIds.forEach(id => newSet.add(id))
          onSelectionChange?.(Array.from(newSet))
          return newSet
        })
      }
    } else {
      // Click normal: selección única
      const newSelection = new Set([nodeId])
      setInternalSelection(newSelection)
      onSelectionChange?.(Array.from(newSelection))
    }
  }, [multiSelect, internalSelection, onSelectionChange, treeData])

  // Obtener todos los IDs de nodos (para selección de rango)
  const getAllNodeIds = useCallback((nodes: ModelTreeNode[]): number[] => {
    const ids: number[] = []
    
    const collectIds = (nodeList: ModelTreeNode[]) => {
      nodeList.forEach(node => {
        ids.push(node.dbId)
        if (node.children) {
          collectIds(node.children)
        }
      })
    }
    
    collectIds(nodes)
    return ids
  }, [])

  // Toggle visibilidad de nodo
  const toggleVisibility = useCallback((nodeId: number, event: React.MouseEvent) => {
    event.stopPropagation()
    
    if (viewer) {
      const isHidden = hiddenNodes.has(nodeId)
      if (isHidden) {
        viewer.show([nodeId])
        setHiddenNodes(prev => {
          const newSet = new Set(prev)
          newSet.delete(nodeId)
          return newSet
        })
      } else {
        viewer.hide([nodeId])
        setHiddenNodes(prev => new Set([...prev, nodeId]))
      }
    }
  }, [viewer, hiddenNodes])

  // Aislar nodo
  const isolateNode = useCallback((nodeId: number, event: React.MouseEvent) => {
    event.stopPropagation()
    
    if (viewer) {
      viewer.isolate([nodeId])
      setIsolatedNodes(new Set([nodeId]))
    }
  }, [viewer])

  // Mostrar todos los nodos
  const showAll = useCallback(() => {
    if (viewer) {
      viewer.showAll()
      setHiddenNodes(new Set())
      setIsolatedNodes(new Set())
    }
  }, [viewer])

  // Handle node click
  const handleNodeClick = useCallback((node: ModelTreeNode, event: React.MouseEvent) => {
    toggleSelection(node.dbId, event)
    onNodeClick?.(node)
    
    // Seleccionar en el viewer
    if (viewer) {
      viewer.select([node.dbId])
    }
  }, [toggleSelection, onNodeClick, viewer])

  // Handle node double click
  const handleNodeDoubleClick = useCallback((node: ModelTreeNode) => {
    onNodeDoubleClick?.(node)
    
    // Fit to view en el viewer
    if (viewer) {
      viewer.fitToView([node.dbId])
    }
  }, [onNodeDoubleClick, viewer])

  // Limpiar filtros
  const clearFilters = () => {
    setSearchQuery('')
    setFilterType('')
  }

  // Renderizar nodo del árbol
  const renderTreeNode = (node: ModelTreeNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.dbId)
    const isSelected = internalSelection.has(node.dbId)
    const isHidden = hiddenNodes.has(node.dbId)
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.dbId} className="select-none">
        <div
          className={clsx(
            'flex items-center py-1 px-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
            isSelected && 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100',
            isHidden && 'opacity-50'
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={(e) => handleNodeClick(node, e)}
          onDoubleClick={() => handleNodeDoubleClick(node)}
        >
          {/* Expandir/contraer */}
          <div className="w-4 h-4 flex items-center justify-center mr-1">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpanded(node.dbId)
                }}
                className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded p-0.5"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-3 w-3 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3 text-gray-500" />
                )}
              </button>
            )}
          </div>

          {/* Icono del tipo */}
          <CubeIcon className="h-4 w-4 text-gray-400 mr-2" />

          {/* Nombre del nodo */}
          <span className="flex-1 text-sm truncate">
            {node.name}
          </span>

          {/* Controles de visibilidad */}
          <div className="flex items-center space-x-1 ml-2">
            <button
              onClick={(e) => isolateNode(node.dbId, e)}
              title="Aislar"
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <CheckIcon className="h-3 w-3 text-gray-500" />
            </button>
            <button
              onClick={(e) => toggleVisibility(node.dbId, e)}
              title={isHidden ? "Mostrar" : "Ocultar"}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              {isHidden ? (
                <EyeSlashIcon className="h-3 w-3 text-gray-500" />
              ) : (
                <EyeIcon className="h-3 w-3 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        {/* Nodos hijos */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!viewer) {
    return (
      <div className={clsx('p-4', className)}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Viewer no disponible
        </p>
      </div>
    )
  }

  return (
    <div className={clsx('flex flex-col h-full bg-white dark:bg-gray-800', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Árbol del Modelo
          </h3>
          {internalSelection.size > 0 && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
              {internalSelection.size} seleccionados
            </span>
          )}
        </div>
      </div>

      {/* Búsqueda y filtros */}
      {(showSearch || showFilter) && treeData.length > 0 && (
        <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-700">
          {/* Búsqueda */}
          {showSearch && (
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar en el modelo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Filtro por tipo */}
          {showFilter && nodeTypes.length > 1 && (
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-4 w-4 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="flex-1 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos los tipos</option>
                {nodeTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Controles */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={showAll}
              >
                Mostrar todo
              </Button>
            </div>

            {(searchQuery || filterType) && (
              <Button
                size="sm"
                variant="outline"
                onClick={clearFilters}
                leftIcon={<XMarkIcon className="h-4 w-4" />}
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Contenido del árbol */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner size="md" text="Cargando árbol..." />
          </div>
        ) : filteredTreeData.length === 0 ? (
          <div className="p-8 text-center">
            <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {treeData.length === 0 ? 'Árbol no disponible' : 'Sin resultados'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {treeData.length === 0 
                ? 'No se pudo cargar la estructura del modelo'
                : 'No se encontraron elementos con los filtros aplicados'
              }
            </p>
          </div>
        ) : (
          <div className="p-2 group">
            {filteredTreeData.map(node => renderTreeNode(node))}
          </div>
        )}
      </div>

      {/* Footer con estadísticas */}
      {treeData.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {getAllNodeIds(filteredTreeData).length} elementos
            </span>
            <span>
              {hiddenNodes.size} ocultos
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default ModelTree
