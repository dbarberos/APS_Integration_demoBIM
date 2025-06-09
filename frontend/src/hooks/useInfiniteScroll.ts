import { useState, useEffect, useCallback, useRef } from 'react'

export interface InfiniteScrollOptions {
  threshold?: number // px from bottom to trigger load
  rootMargin?: string
  enabled?: boolean
  initialLoad?: boolean
  retryCount?: number
  retryDelay?: number
}

export interface UseInfiniteScrollReturn<T> {
  // Data state
  data: T[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  
  // Controls
  loadMore: () => Promise<void>
  reload: () => Promise<void>
  reset: () => void
  retry: () => Promise<void>
  
  // Refs for manual triggering
  triggerRef: React.RefObject<HTMLElement>
  observerRef: React.RefObject<HTMLElement>
  
  // Stats
  totalLoaded: number
  currentPage: number
  failedAttempts: number
}

export interface InfiniteScrollData<T> {
  data: T[]
  hasMore: boolean
  nextCursor?: string | number
  total?: number
}

const useInfiniteScroll = <T = any>(
  fetchFunction: (page: number, cursor?: string | number) => Promise<InfiniteScrollData<T>>,
  options: InfiniteScrollOptions = {}
): UseInfiniteScrollReturn<T> => {
  const {
    threshold = 100,
    rootMargin = '100px',
    enabled = true,
    initialLoad = true,
    retryCount = 3,
    retryDelay = 1000
  } = options

  // State
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | number | undefined>()
  const [failedAttempts, setFailedAttempts] = useState(0)

  // Refs
  const triggerRef = useRef<HTMLElement>(null)
  const observerRef = useRef<HTMLElement>(null)
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null)
  const isLoadingRef = useRef(false)
  const mountedRef = useRef(true)

  // Load more data
  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingRef.current || !hasMore) {
      return
    }

    const isInitial = currentPage === 0
    isLoadingRef.current = true
    
    if (isInitial) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }
    
    setError(null)

    try {
      const result = await fetchFunction(currentPage + 1, nextCursor)
      
      if (!mountedRef.current) return

      setData(prev => isInitial ? result.data : [...prev, ...result.data])
      setHasMore(result.hasMore)
      setCurrentPage(prev => prev + 1)
      setNextCursor(result.nextCursor)
      setFailedAttempts(0)

    } catch (err: any) {
      if (!mountedRef.current) return
      
      console.error('Error loading more data:', err)
      setError(err.message || 'Error al cargar datos')
      setFailedAttempts(prev => prev + 1)
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
        setIsLoadingMore(false)
        isLoadingRef.current = false
      }
    }
  }, [enabled, hasMore, currentPage, nextCursor, fetchFunction])

  // Retry failed request
  const retry = useCallback(async () => {
    if (failedAttempts >= retryCount) {
      return
    }

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, retryDelay * failedAttempts))
    await loadMore()
  }, [failedAttempts, retryCount, retryDelay, loadMore])

  // Reload from beginning
  const reload = useCallback(async () => {
    reset()
    await loadMore()
  }, [loadMore])

  // Reset all state
  const reset = useCallback(() => {
    setData([])
    setIsLoading(false)
    setIsLoadingMore(false)
    setHasMore(true)
    setError(null)
    setCurrentPage(0)
    setNextCursor(undefined)
    setFailedAttempts(0)
    isLoadingRef.current = false
  }, [])

  // Setup intersection observer
  useEffect(() => {
    if (!enabled || !triggerRef.current) return

    const target = triggerRef.current

    intersectionObserverRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !isLoadingRef.current) {
          loadMore()
        }
      },
      {
        root: observerRef.current,
        rootMargin,
        threshold: 0.1
      }
    )

    intersectionObserverRef.current.observe(target)

    return () => {
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect()
      }
    }
  }, [enabled, hasMore, loadMore, rootMargin])

  // Setup scroll listener for threshold-based loading
  useEffect(() => {
    if (!enabled || threshold <= 0) return

    const handleScroll = () => {
      const scrollElement = observerRef.current || window
      const scrollTop = scrollElement === window 
        ? window.pageYOffset 
        : (scrollElement as HTMLElement).scrollTop
      
      const scrollHeight = scrollElement === window
        ? document.documentElement.scrollHeight
        : (scrollElement as HTMLElement).scrollHeight
      
      const clientHeight = scrollElement === window
        ? window.innerHeight
        : (scrollElement as HTMLElement).clientHeight

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight

      if (distanceFromBottom < threshold && hasMore && !isLoadingRef.current) {
        loadMore()
      }
    }

    const scrollElement = observerRef.current || window
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [enabled, threshold, hasMore, loadMore])

  // Initial load
  useEffect(() => {
    if (initialLoad && enabled && currentPage === 0) {
      loadMore()
    }
  }, [initialLoad, enabled])

  // Auto-retry on error
  useEffect(() => {
    if (error && failedAttempts > 0 && failedAttempts < retryCount) {
      const timeoutId = setTimeout(retry, retryDelay * failedAttempts)
      return () => clearTimeout(timeoutId)
    }
  }, [error, failedAttempts, retryCount, retryDelay, retry])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect()
      }
    }
  }, [])

  return {
    // Data state
    data,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    
    // Controls
    loadMore,
    reload,
    reset,
    retry,
    
    // Refs
    triggerRef,
    observerRef,
    
    // Stats
    totalLoaded: data.length,
    currentPage,
    failedAttempts
  }
}

// Hook for virtualized infinite scroll (for large lists)
export const useVirtualizedInfiniteScroll = <T = any>(
  fetchFunction: (page: number, cursor?: string | number) => Promise<InfiniteScrollData<T>>,
  itemHeight: number,
  containerHeight: number,
  options: InfiniteScrollOptions = {}
) => {
  const infiniteScroll = useInfiniteScroll(fetchFunction, options)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerRef, setContainerRef] = useState<HTMLElement | null>(null)

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      infiniteScroll.data.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    )
    
    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, infiniteScroll.data.length])

  // Get visible items
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange
    return infiniteScroll.data.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index,
      style: {
        position: 'absolute' as const,
        top: (startIndex + index) * itemHeight,
        height: itemHeight,
        width: '100%'
      }
    }))
  }, [infiniteScroll.data, visibleRange, itemHeight])

  // Handle scroll
  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  // Check if we need to load more items
  useEffect(() => {
    const { endIndex } = visibleRange
    const buffer = Math.ceil(containerHeight / itemHeight) * 2 // Load 2 screens ahead
    
    if (endIndex + buffer >= infiniteScroll.data.length - 1 && infiniteScroll.hasMore) {
      infiniteScroll.loadMore()
    }
  }, [visibleRange, containerHeight, itemHeight, infiniteScroll])

  return {
    ...infiniteScroll,
    visibleItems,
    totalHeight: infiniteScroll.data.length * itemHeight,
    containerRef: setContainerRef,
    onScroll: handleScroll,
    visibleRange
  }
}

// Component for infinite scroll trigger
export const InfiniteScrollTrigger: React.FC<{
  isLoading: boolean
  hasMore: boolean
  error: string | null
  onRetry?: () => void
  triggerRef: React.RefObject<HTMLElement>
  className?: string
}> = ({ isLoading, hasMore, error, onRetry, triggerRef, className = '' }) => {
  if (!hasMore && !error) {
    return (
      <div className={`text-center py-4 text-gray-500 dark:text-gray-400 ${className}`}>
        No hay más elementos para cargar
      </div>
    )
  }

  if (error) {
    return (
      <div ref={triggerRef} className={`text-center py-4 ${className}`}>
        <div className="text-red-600 dark:text-red-400 mb-2">{error}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reintentar
          </button>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div ref={triggerRef} className={`text-center py-4 ${className}`}>
        <div className="inline-flex items-center space-x-2 text-gray-600 dark:text-gray-400">
          <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
          <span>Cargando más elementos...</span>
        </div>
      </div>
    )
  }

  return (
    <div ref={triggerRef} className={`h-4 ${className}`} />
  )
}

export default useInfiniteScroll
