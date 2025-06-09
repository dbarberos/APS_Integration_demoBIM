import React, { useState, useEffect, useMemo } from 'react'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
  FunnelIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { useViewerExtensions } from '@/hooks/useViewerExtensions'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import { useUI } from '@/hooks/useUI'
import type { ObjectProperties, PropertyGroup, Property } from '@/types'
import { clsx } from 'clsx'

export interface PropertiesPanelProps {
  viewer: any
  selectedIds: number[]
  className?: string
  defaultCollapsed?: boolean
  showSearch?: boolean
  showFilter?: boolean
  onPropertyClick?: (property: Property) => void
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  viewer,
  selectedIds,
  className = '',
  defaultCollapsed = false,
  showSearch = true,
  showFilter = true,
  onPropertyClick
}) => {
  const { showSuccessToast } = useUI()
  const { propertiesTools } = useViewerExtensions(viewer)
  
  const [properties, setProperties] = useState<ObjectProperties[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [collapsedObjects, setCollapsedObjects] = useState<Set<number>>(new Set())

  // Cargar propiedades cuando cambian los objetos seleccionados
  useEffect(() => {
    const loadProperties = async () => {
      if (!viewer || selectedIds.length === 0) {
        setProperties([])
        return
      }

      setIsLoading(true)
      try {
        const propertiesPromises = selectedIds.map(async (dbId) => {
          const props = await propertiesTools.getProperties(dbId)
          const externalId = propertiesTools.getExternalId(dbId)
          
          return {
            dbId,
            name: props?.name || `Objeto ${dbId}`,
            externalId: externalId || '',
            properties: props?.properties || []
          } as ObjectProperties
        })

        const propertiesResults = await Promise.all(propertiesPromises)
        setProperties(propertiesResults.filter(p => p.properties.length > 0))
        
        // Colapsar grupos por defecto si es necesario
        if (defaultCollapsed) {
          const allGroups = new Set<string>()
          propertiesResults.forEach(obj => {
            obj.properties.forEach(group => {
              allGroups.add(`${obj.dbId}-${group.displayCategory}`)
            })
          })
          setCollapsedGroups(allGroups)
        }
        
      } catch (error) {
        console.error('Error loading properties:', error)
        setProperties([])
      } finally {
        setIsLoading(false)
      }
    }

    loadProperties()
  }, [viewer, selectedIds, propertiesTools, defaultCollapsed])

  // Filtrar propiedades por búsqueda y categoría
  const filteredProperties = useMemo(() => {
    return properties.map(obj => ({
      ...obj,
      properties: obj.properties
        .filter(group => {
          // Filtro por categoría
          if (filterCategory && group.displayCategory !== filterCategory) {
            return false
          }
          
          // Filtro por búsqueda
          if (searchQuery) {
            const query = searchQuery.toLowerCase()
            return (
              group.displayName.toLowerCase().includes(query) ||
              group.displayCategory.toLowerCase().includes(query) ||
              group.properties.some(prop => 
                prop.displayName.toLowerCase().includes(query) ||
                prop.displayValue.toString().toLowerCase().includes(query)
              )
            )
          }
          
          return true
        })
        .map(group => ({
          ...group,
          properties: searchQuery 
            ? group.properties.filter(prop => {
                const query = searchQuery.toLowerCase()
                return (
                  prop.displayName.toLowerCase().includes(query) ||
                  prop.displayValue.toString().toLowerCase().includes(query)
                )
              })
            : group.properties
        }))
        .filter(group => group.properties.length > 0)
    })).filter(obj => obj.properties.length > 0)
  }, [properties, searchQuery, filterCategory])

  // Obtener todas las categorías únicas
  const allCategories = useMemo(() => {
    const categories = new Set<string>()
    properties.forEach(obj => {
      obj.properties.forEach(group => {
        categories.add(group.displayCategory)
      })
    })
    return Array.from(categories).sort()
  }, [properties])

  // Toggle colapso de grupo
  const toggleGroup = (objId: number, category: string) => {
    const key = `${objId}-${category}`
    setCollapsedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  // Toggle colapso de objeto
  const toggleObject = (objId: number) => {
    setCollapsedObjects(prev => {
      const newSet = new Set(prev)
      if (newSet.has(objId)) {
        newSet.delete(objId)
      } else {
        newSet.add(objId)
      }
      return newSet
    })
  }

  // Copiar valor al portapapeles
  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      showSuccessToast('Copiado al portapapeles', value)
    } catch (error) {
      console.error('Error copying to clipboard:', error)
    }
  }

  // Limpiar filtros
  const clearFilters = () => {
    setSearchQuery('')
    setFilterCategory('')
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
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Propiedades
        </h3>
        {selectedIds.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {selectedIds.length} objeto{selectedIds.length > 1 ? 's' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Búsqueda y filtros */}
      {(showSearch || showFilter) && properties.length > 0 && (
        <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-700">
          {/* Búsqueda */}
          {showSearch && (
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar propiedades..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Filtro por categoría */}
          {showFilter && allCategories.length > 1 && (
            <div className="flex items-center space-x-2">
              <FunnelIcon className="h-4 w-4 text-gray-400" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todas las categorías</option>
                {allCategories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Limpiar filtros */}
          {(searchQuery || filterCategory) && (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={clearFilters}
                leftIcon={<XMarkIcon className="h-4 w-4" />}
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner size="md" text="Cargando propiedades..." />
          </div>
        ) : selectedIds.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardDocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Sin selección
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Selecciona un objeto para ver sus propiedades
            </p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="p-8 text-center">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Sin resultados
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No se encontraron propiedades con los filtros aplicados
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredProperties.map((obj) => (
              <div key={obj.dbId} className="p-4">
                {/* Header del objeto */}
                <div
                  className="flex items-center justify-between cursor-pointer mb-3"
                  onClick={() => toggleObject(obj.dbId)}
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    {collapsedObjects.has(obj.dbId) ? (
                      <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {obj.name}
                      </h4>
                      {obj.externalId && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          ID: {obj.externalId}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    #{obj.dbId}
                  </span>
                </div>

                {/* Propiedades del objeto */}
                {!collapsedObjects.has(obj.dbId) && (
                  <div className="ml-6 space-y-3">
                    {obj.properties.map((group) => (
                      <div key={group.displayCategory} className="border border-gray-200 dark:border-gray-600 rounded-md">
                        {/* Header del grupo */}
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer bg-gray-50 dark:bg-gray-700 rounded-t-md"
                          onClick={() => toggleGroup(obj.dbId, group.displayCategory)}
                        >
                          <div className="flex items-center space-x-2">
                            {collapsedGroups.has(`${obj.dbId}-${group.displayCategory}`) ? (
                              <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                            )}
                            <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                              {group.displayName || group.displayCategory}
                            </h5>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {group.properties.length} propiedades
                          </span>
                        </div>

                        {/* Propiedades del grupo */}
                        {!collapsedGroups.has(`${obj.dbId}-${group.displayCategory}`) && (
                          <div className="divide-y divide-gray-200 dark:divide-gray-600">
                            {group.properties
                              .filter(prop => !prop.hidden)
                              .map((prop, propIndex) => (
                                <div
                                  key={propIndex}
                                  className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                                  onClick={() => {
                                    onPropertyClick?.(prop)
                                    copyToClipboard(prop.displayValue?.toString() || '')
                                  }}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="min-w-0 flex-1 mr-3">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {prop.displayName}
                                      </p>
                                      <p className="text-sm text-gray-600 dark:text-gray-300 break-words">
                                        {prop.displayValue}
                                        {prop.units && (
                                          <span className="text-gray-400 ml-1">
                                            {prop.units}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <ClipboardDocumentIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer con estadísticas */}
      {properties.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {filteredProperties.length} objeto{filteredProperties.length !== 1 ? 's' : ''}
            </span>
            <span>
              {filteredProperties.reduce((acc, obj) => 
                acc + obj.properties.reduce((acc2, group) => acc2 + group.properties.length, 0), 0
              )} propiedades
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default PropertiesPanel
