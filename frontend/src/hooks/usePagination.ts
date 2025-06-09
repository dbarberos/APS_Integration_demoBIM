import { useState, useMemo, useCallback } from 'react'

export interface PaginationOptions {
  initialPage?: number
  initialPerPage?: number
  maxPerPage?: number
  minPerPage?: number
  totalItems?: number
}

export interface PaginationState {
  page: number
  perPage: number
  totalItems: number
  totalPages: number
  startIndex: number
  endIndex: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  isFirstPage: boolean
  isLastPage: boolean
}

export interface PaginationControls {
  setPage: (page: number) => void
  setPerPage: (perPage: number) => void
  setTotalItems: (totalItems: number) => void
  nextPage: () => void
  previousPage: () => void
  firstPage: () => void
  lastPage: () => void
  goToPage: (page: number) => void
  reset: () => void
}

export interface UsePaginationReturn {
  pagination: PaginationState
  controls: PaginationControls
  getPageRange: (surroundingPages?: number) => number[]
  getVisibleItems: <T>(items: T[]) => T[]
  getSliceParams: () => { offset: number; limit: number }
}

const usePagination = (options: PaginationOptions = {}): UsePaginationReturn => {
  const {
    initialPage = 1,
    initialPerPage = 10,
    maxPerPage = 100,
    minPerPage = 5,
    totalItems: initialTotalItems = 0
  } = options

  const [page, setPageState] = useState(initialPage)
  const [perPage, setPerPageState] = useState(initialPerPage)
  const [totalItems, setTotalItemsState] = useState(initialTotalItems)

  // Estado de paginación calculado
  const pagination = useMemo((): PaginationState => {
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
    const currentPage = Math.min(page, totalPages)
    const startIndex = (currentPage - 1) * perPage
    const endIndex = Math.min(startIndex + perPage - 1, totalItems - 1)

    return {
      page: currentPage,
      perPage,
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      isFirstPage: currentPage === 1,
      isLastPage: currentPage === totalPages
    }
  }, [page, perPage, totalItems])

  // Controles de paginación
  const setPage = useCallback((newPage: number) => {
    const clampedPage = Math.max(1, Math.min(newPage, pagination.totalPages))
    setPageState(clampedPage)
  }, [pagination.totalPages])

  const setPerPage = useCallback((newPerPage: number) => {
    const clampedPerPage = Math.max(minPerPage, Math.min(newPerPage, maxPerPage))
    setPerPageState(clampedPerPage)
    
    // Ajustar página actual para mantener aproximadamente los mismos elementos visibles
    const currentStartIndex = (pagination.page - 1) * pagination.perPage
    const newPage = Math.max(1, Math.ceil((currentStartIndex + 1) / clampedPerPage))
    setPageState(newPage)
  }, [pagination.page, pagination.perPage, minPerPage, maxPerPage])

  const setTotalItems = useCallback((newTotalItems: number) => {
    setTotalItemsState(Math.max(0, newTotalItems))
    
    // Ajustar página si la actual está fuera del rango
    const newTotalPages = Math.max(1, Math.ceil(newTotalItems / perPage))
    if (page > newTotalPages) {
      setPageState(newTotalPages)
    }
  }, [page, perPage])

  const nextPage = useCallback(() => {
    if (pagination.hasNextPage) {
      setPage(pagination.page + 1)
    }
  }, [pagination.hasNextPage, pagination.page, setPage])

  const previousPage = useCallback(() => {
    if (pagination.hasPreviousPage) {
      setPage(pagination.page - 1)
    }
  }, [pagination.hasPreviousPage, pagination.page, setPage])

  const firstPage = useCallback(() => {
    setPage(1)
  }, [setPage])

  const lastPage = useCallback(() => {
    setPage(pagination.totalPages)
  }, [pagination.totalPages, setPage])

  const goToPage = useCallback((targetPage: number) => {
    setPage(targetPage)
  }, [setPage])

  const reset = useCallback(() => {
    setPageState(initialPage)
    setPerPageState(initialPerPage)
    setTotalItemsState(initialTotalItems)
  }, [initialPage, initialPerPage, initialTotalItems])

  // Obtener rango de páginas para mostrar en la UI
  const getPageRange = useCallback((surroundingPages: number = 2): number[] => {
    const { page: currentPage, totalPages } = pagination
    const start = Math.max(1, currentPage - surroundingPages)
    const end = Math.min(totalPages, currentPage + surroundingPages)
    
    const range: number[] = []
    for (let i = start; i <= end; i++) {
      range.push(i)
    }
    
    return range
  }, [pagination])

  // Obtener elementos visibles de un array
  const getVisibleItems = useCallback(<T,>(items: T[]): T[] => {
    const { startIndex, endIndex } = pagination
    return items.slice(startIndex, endIndex + 1)
  }, [pagination])

  // Obtener parámetros para queries de base de datos
  const getSliceParams = useCallback(() => {
    return {
      offset: pagination.startIndex,
      limit: pagination.perPage
    }
  }, [pagination.startIndex, pagination.perPage])

  const controls: PaginationControls = {
    setPage,
    setPerPage,
    setTotalItems,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    goToPage,
    reset
  }

  return {
    pagination,
    controls,
    getPageRange,
    getVisibleItems,
    getSliceParams
  }
}

// Hook específico para paginación de servidor
export const useServerPagination = (
  fetchData: (page: number, perPage: number) => Promise<{ data: any[], total: number }>,
  options: PaginationOptions = {}
) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any[]>([])
  
  const pagination = usePagination(options)

  const loadData = useCallback(async (page?: number, perPage?: number) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await fetchData(
        page ?? pagination.pagination.page,
        perPage ?? pagination.pagination.perPage
      )
      
      setData(result.data)
      pagination.controls.setTotalItems(result.total)
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos')
      setData([])
    } finally {
      setIsLoading(false)
    }
  }, [fetchData, pagination])

  // Cargar datos cuando cambian los parámetros de paginación
  const { page, perPage } = pagination.pagination
  React.useEffect(() => {
    loadData()
  }, [page, perPage])

  return {
    ...pagination,
    data,
    isLoading,
    error,
    reload: () => loadData(),
    refetch: loadData
  }
}

// Hook para paginación infinita (scroll infinito)
export const useInfiniteScroll = <T = any>(
  fetchData: (page: number, perPage: number) => Promise<{ data: T[], total: number, hasMore: boolean }>,
  options: PaginationOptions & { enabled?: boolean } = {}
) => {
  const { enabled = true, ...paginationOptions } = options
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<T[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [perPage] = useState(paginationOptions.initialPerPage || 20)

  const loadInitialData = useCallback(async () => {
    if (!enabled) return
    
    setIsLoading(true)
    setError(null)
    setPage(1)
    
    try {
      const result = await fetchData(1, perPage)
      setData(result.data)
      setHasMore(result.hasMore)
      setPage(2)
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos')
      setData([])
      setHasMore(false)
    } finally {
      setIsLoading(false)
    }
  }, [fetchData, perPage, enabled])

  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingMore || !hasMore) return
    
    setIsLoadingMore(true)
    setError(null)
    
    try {
      const result = await fetchData(page, perPage)
      setData(prev => [...prev, ...result.data])
      setHasMore(result.hasMore)
      setPage(prev => prev + 1)
    } catch (err: any) {
      setError(err.message || 'Error al cargar más datos')
    } finally {
      setIsLoadingMore(false)
    }
  }, [fetchData, page, perPage, enabled, isLoadingMore, hasMore])

  // Cargar datos iniciales
  React.useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  return {
    data,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    reload: loadInitialData,
    reset: () => {
      setData([])
      setPage(1)
      setHasMore(true)
      setError(null)
    }
  }
}

// Componente de controles de paginación reutilizable
export interface PaginationControlsProps {
  pagination: PaginationState
  controls: PaginationControls
  showPerPageSelector?: boolean
  showPageInfo?: boolean
  showFirstLast?: boolean
  perPageOptions?: number[]
  className?: string
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  pagination,
  controls,
  showPerPageSelector = true,
  showPageInfo = true,
  showFirstLast = true,
  perPageOptions = [5, 10, 20, 50, 100],
  className = ''
}) => {
  const pageRange = usePagination().getPageRange(2)

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* Información de página */}
      {showPageInfo && (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Mostrando {pagination.startIndex + 1} a {pagination.endIndex + 1} de {pagination.totalItems} resultados
        </div>
      )}

      {/* Controles de paginación */}
      <div className="flex items-center space-x-2">
        {/* Selector de elementos por página */}
        {showPerPageSelector && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">Por página:</span>
            <select
              value={pagination.perPage}
              onChange={(e) => controls.setPerPage(Number(e.target.value))}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
            >
              {perPageOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        )}

        {/* Botones de navegación */}
        <div className="flex items-center space-x-1">
          {showFirstLast && (
            <button
              onClick={controls.firstPage}
              disabled={pagination.isFirstPage}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
            >
              Primera
            </button>
          )}
          
          <button
            onClick={controls.previousPage}
            disabled={!pagination.hasPreviousPage}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
          >
            Anterior
          </button>

          {/* Números de página */}
          {pageRange.map(pageNum => (
            <button
              key={pageNum}
              onClick={() => controls.goToPage(pageNum)}
              className={`px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded ${
                pageNum === pagination.page
                  ? 'bg-blue-500 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {pageNum}
            </button>
          ))}

          <button
            onClick={controls.nextPage}
            disabled={!pagination.hasNextPage}
            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
          >
            Siguiente
          </button>

          {showFirstLast && (
            <button
              onClick={controls.lastPage}
              disabled={pagination.isLastPage}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
            >
              Última
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default usePagination
