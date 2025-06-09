import React, { useState, useEffect } from 'react'
import { 
  DocumentIcon,
  EyeIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import { useFiles } from '@/hooks/useFiles'
import { useUI } from '@/hooks/useUI'
import { useDebounce } from '@/hooks/useDebounce'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatBytes, formatRelativeTime, formatFileName } from '@/utils/format'
import type { File } from '@/types'

interface FileListProps {
  projectId?: string
  onFileSelect?: (file: File) => void
  onFileView?: (file: File) => void
  onFileDelete?: (file: File) => void
  showActions?: boolean
  viewMode?: 'grid' | 'list'
  className?: string
}

type SortField = 'name' | 'size' | 'created_at' | 'updated_at' | 'status'
type SortDirection = 'asc' | 'desc'
type FilterStatus = 'all' | 'uploaded' | 'processing' | 'ready' | 'error'
type FilterFormat = 'all' | 'dwg' | 'dxf' | 'rvt' | 'ifc' | 'obj' | 'fbx' | 'gltf'

const FileList: React.FC<FileListProps> = ({
  projectId,
  onFileSelect,
  onFileView,
  onFileDelete,
  showActions = true,
  viewMode: initialViewMode = 'list',
  className = ''
}) => {
  const { 
    files, 
    isLoading, 
    error, 
    fetchFiles, 
    deleteFile,
    downloadFile,
    pagination,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    sorting,
    setSorting
  } = useFiles()
  
  const { showSuccessToast, showErrorToast } = useUI()
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode)
  const [showFilters, setShowFilters] = useState(false)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)
  
  // Debounce search query
  const debouncedSearchQuery = useDebounce(localSearchQuery, 300)

  // Actualizar búsqueda cuando cambie el valor debounced
  useEffect(() => {
    setSearchQuery(debouncedSearchQuery)
  }, [debouncedSearchQuery, setSearchQuery])

  // Cargar archivos cuando cambien los filtros
  useEffect(() => {
    fetchFiles({ projectId })
  }, [fetchFiles, projectId, searchQuery, filters, sorting])

  const handleSort = (field: SortField) => {
    const direction: SortDirection = 
      sorting.field === field && sorting.direction === 'asc' ? 'desc' : 'asc'
    setSorting({ field, direction })
  }

  const handleFilterChange = (key: string, value: any) => {
    setFilters({ ...filters, [key]: value })
  }

  const handleFileAction = async (action: string, file: File) => {
    try {
      switch (action) {
        case 'view':
          if (onFileView) {
            onFileView(file)
          } else {
            // Default: navigate to viewer
            window.open(`/viewer/${file.urn}`, '_blank')
          }
          break
          
        case 'download':
          await downloadFile(file.id)
          showSuccessToast('Descarga iniciada', `Descargando ${file.name}`)
          break
          
        case 'delete':
          if (window.confirm(`¿Estás seguro de que quieres eliminar ${file.name}?`)) {
            await deleteFile(file.id)
            showSuccessToast('Archivo eliminado', `${file.name} ha sido eliminado`)
          }
          break
          
        case 'select':
          if (onFileSelect) {
            onFileSelect(file)
          }
          break
      }
    } catch (error: any) {
      console.error(`Error in ${action}:`, error)
      showErrorToast(
        `Error al ${action === 'delete' ? 'eliminar' : action === 'download' ? 'descargar' : 'procesar'} archivo`,
        error.response?.data?.detail || 'Error inesperado'
      )
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploaded':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'ready':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploaded': return 'Subido'
      case 'processing': return 'Procesando'
      case 'ready': return 'Listo'
      case 'error': return 'Error'
      default: return status
    }
  }

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    // En el futuro se pueden añadir iconos específicos por tipo de archivo
    return DocumentIcon
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sorting.field !== field) {
      return <div className="w-4 h-4" /> // Espacio vacío
    }
    return sorting.direction === 'asc' ? 
      <ChevronUpIcon className="w-4 h-4" /> : 
      <ChevronDownIcon className="w-4 h-4" />
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          Error al cargar archivos
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {error}
        </p>
        <div className="mt-6">
          <Button onClick={() => fetchFiles({ projectId })}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Barra de herramientas */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Búsqueda */}
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar archivos..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Controles */}
        <div className="flex items-center space-x-2">
          {/* Toggle de filtros */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<FunnelIcon className="h-4 w-4" />}
          >
            Filtros
          </Button>

          {/* Toggle de vista */}
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-md">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${
                viewMode === 'list'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <ListBulletIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${
                viewMode === 'grid'
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Squares2X2Icon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro por estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Estado
              </label>
              <select
                value={filters.status || 'all'}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">Todos</option>
                <option value="uploaded">Subidos</option>
                <option value="processing">Procesando</option>
                <option value="ready">Listos</option>
                <option value="error">Con errores</option>
              </select>
            </div>

            {/* Filtro por formato */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Formato
              </label>
              <select
                value={filters.format || 'all'}
                onChange={(e) => handleFilterChange('format', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">Todos</option>
                <option value="dwg">DWG</option>
                <option value="dxf">DXF</option>
                <option value="rvt">RVT</option>
                <option value="ifc">IFC</option>
                <option value="obj">OBJ</option>
                <option value="fbx">FBX</option>
                <option value="gltf">GLTF</option>
              </select>
            </div>

            {/* Filtro por tamaño */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tamaño mínimo
              </label>
              <select
                value={filters.minSize || ''}
                onChange={(e) => handleFilterChange('minSize', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Sin límite</option>
                <option value="1048576">1 MB</option>
                <option value="10485760">10 MB</option>
                <option value="104857600">100 MB</option>
              </select>
            </div>

            {/* Filtro por fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fecha
              </label>
              <select
                value={filters.dateRange || 'all'}
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">Todas</option>
                <option value="today">Hoy</option>
                <option value="week">Última semana</option>
                <option value="month">Último mes</option>
              </select>
            </div>
          </div>
          
          {/* Botón para limpiar filtros */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({})}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" text="Cargando archivos..." />
        </div>
      )}

      {/* Lista/Grid de archivos */}
      {!isLoading && files.length === 0 ? (
        <div className="text-center py-12">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No hay archivos
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchQuery || Object.keys(filters).length > 0 
              ? 'No se encontraron archivos con los filtros aplicados'
              : 'Aún no has subido ningún archivo'
            }
          </p>
        </div>
      ) : !isLoading && viewMode === 'list' ? (
        /* Vista de lista */
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          {/* Header de la tabla */}
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 border-b border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-12 gap-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              <div className="col-span-4 flex items-center space-x-1">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span>Nombre</span>
                  <SortIcon field="name" />
                </button>
              </div>
              <div className="col-span-2 flex items-center space-x-1">
                <button
                  onClick={() => handleSort('size')}
                  className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span>Tamaño</span>
                  <SortIcon field="size" />
                </button>
              </div>
              <div className="col-span-2 flex items-center space-x-1">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span>Estado</span>
                  <SortIcon field="status" />
                </button>
              </div>
              <div className="col-span-2 flex items-center space-x-1">
                <button
                  onClick={() => handleSort('created_at')}
                  className="flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <span>Fecha</span>
                  <SortIcon field="created_at" />
                </button>
              </div>
              {showActions && (
                <div className="col-span-2">
                  <span>Acciones</span>
                </div>
              )}
            </div>
          </div>

          {/* Filas de archivos */}
          <div className="divide-y divide-gray-200 dark:divide-gray-600">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.name)
              
              return (
                <div
                  key={file.id}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => handleFileAction('select', file)}
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* Nombre del archivo */}
                    <div className="col-span-4 flex items-center space-x-3">
                      <FileIcon className="h-6 w-6 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {formatFileName(file.name, 40)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {file.name.split('.').pop()?.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    {/* Tamaño */}
                    <div className="col-span-2">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {formatBytes(file.size)}
                      </p>
                    </div>

                    {/* Estado */}
                    <div className="col-span-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(file.status)}`}>
                        {getStatusText(file.status)}
                      </span>
                    </div>

                    {/* Fecha */}
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(file.created_at)}
                      </p>
                    </div>

                    {/* Acciones */}
                    {showActions && (
                      <div className="col-span-2 flex items-center space-x-2">
                        {file.status === 'ready' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleFileAction('view', file)
                            }}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            title="Ver en 3D"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFileAction('download', file)
                          }}
                          className="text-gray-600 hover:text-gray-700 dark:text-gray-400"
                          title="Descargar"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFileAction('delete', file)
                          }}
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                          title="Eliminar"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : !isLoading && viewMode === 'grid' ? (
        /* Vista de grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {files.map((file) => {
            const FileIcon = getFileIcon(file.name)
            
            return (
              <div
                key={file.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleFileAction('select', file)}
              >
                <div className="p-6">
                  {/* Icono y estado */}
                  <div className="flex items-center justify-between mb-4">
                    <FileIcon className="h-8 w-8 text-gray-400" />
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(file.status)}`}>
                      {getStatusText(file.status)}
                    </span>
                  </div>

                  {/* Información del archivo */}
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate" title={file.name}>
                      {formatFileName(file.name, 30)}
                    </h3>
                    <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{file.name.split('.').pop()?.toUpperCase()}</span>
                      <span>•</span>
                      <span>{formatBytes(file.size)}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatRelativeTime(file.created_at)}
                    </p>
                  </div>

                  {/* Acciones */}
                  {showActions && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
                      {file.status === 'ready' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFileAction('view', file)
                          }}
                          leftIcon={<EyeIcon className="h-4 w-4" />}
                        >
                          Ver
                        </Button>
                      ) : (
                        <div></div>
                      )}

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFileAction('download', file)
                          }}
                          className="text-gray-600 hover:text-gray-700 dark:text-gray-400"
                          title="Descargar"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFileAction('delete', file)
                          }}
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                          title="Eliminar"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Paginación */}
      {pagination && pagination.total > pagination.limit && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <Button
              variant="outline"
              disabled={!pagination.hasPrevious}
              onClick={() => {/* TODO: Implement pagination */}}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={!pagination.hasNext}
              onClick={() => {/* TODO: Implement pagination */}}
            >
              Siguiente
            </Button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Mostrando <span className="font-medium">{pagination.offset + 1}</span> a{' '}
                <span className="font-medium">
                  {Math.min(pagination.offset + pagination.limit, pagination.total)}
                </span>{' '}
                de <span className="font-medium">{pagination.total}</span> resultados
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrevious}
                  onClick={() => {/* TODO: Implement pagination */}}
                  className="rounded-r-none"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNext}
                  onClick={() => {/* TODO: Implement pagination */}}
                  className="rounded-l-none"
                >
                  Siguiente
                </Button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FileList
