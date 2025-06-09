import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { translationService } from '@/services/translationService'
import { useGlobalLoaderContext } from '@/components/ui/GlobalLoader'
import { useWebSocketSubscription } from '@/components/realtime/WebSocketProvider'
import type { TranslationJob, PaginatedResponse } from '@/types'

// Query keys para React Query
export const translationKeys = {
  all: ['translations'] as const,
  lists: () => [...translationKeys.all, 'list'] as const,
  list: (params: any) => [...translationKeys.lists(), params] as const,
  details: () => [...translationKeys.all, 'detail'] as const,
  detail: (id: string) => [...translationKeys.details(), id] as const,
  status: (id: string) => [...translationKeys.all, 'status', id] as const,
  manifest: (id: string) => [...translationKeys.all, 'manifest', id] as const,
  metadata: (id: string) => [...translationKeys.all, 'metadata', id] as const,
  hierarchy: (id: string) => [...translationKeys.all, 'hierarchy', id] as const,
  metrics: (id: string) => [...translationKeys.all, 'metrics', id] as const,
  stats: () => [...translationKeys.all, 'stats'] as const,
  active: () => [...translationKeys.all, 'active'] as const,
  recent: () => [...translationKeys.all, 'recent'] as const,
  formats: () => [...translationKeys.all, 'formats'] as const,
}

interface TranslationSearchParams {
  page?: number
  perPage?: number
  search?: string
  filters?: {
    status?: string[]
    priority?: string[]
    dateRange?: {
      start?: string | null
      end?: string | null
    }
    fileTypes?: string[]
    userId?: number | null
  }
  sorting?: {
    field?: 'created_at' | 'status' | 'priority' | 'progress' | 'estimated_duration'
    direction?: 'asc' | 'desc'
  }
}

// Hook para obtener lista de trabajos de traducción
export const useTranslationJobs = (params: TranslationSearchParams = {}) => {
  return useQuery({
    queryKey: translationKeys.list(params),
    queryFn: () => translationService.getTranslationJobs(params),
    keepPreviousData: true,
    staleTime: 1 * 60 * 1000, // 1 minuto
  })
}

// Hook para scroll infinito de traducciones
export const useInfiniteTranslationJobs = (params: Omit<TranslationSearchParams, 'page'> = {}) => {
  return useInfiniteQuery({
    queryKey: [...translationKeys.lists(), 'infinite', params],
    queryFn: ({ pageParam = 1 }) => 
      translationService.getTranslationJobs({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage
      return pagination.has_next_page ? pagination.page + 1 : undefined
    },
    keepPreviousData: true,
    staleTime: 1 * 60 * 1000,
  })
}

// Hook para obtener trabajo específico
export const useTranslationJob = (jobId: string, enabled = true) => {
  return useQuery({
    queryKey: translationKeys.detail(jobId),
    queryFn: () => translationService.getTranslationJob(jobId),
    enabled: enabled && !!jobId,
    staleTime: 30 * 1000, // 30 segundos para trabajos activos
  })
}

// Hook para obtener estado de trabajo en tiempo real
export const useTranslationJobStatus = (jobId: string, enabled = true) => {
  const queryClient = useQueryClient()
  
  const query = useQuery({
    queryKey: translationKeys.status(jobId),
    queryFn: () => translationService.getTranslationJobStatus(jobId),
    enabled: enabled && !!jobId,
    refetchInterval: (data) => {
      // Refrescar automáticamente si el trabajo está activo
      const activeStatuses = ['pending', 'inprogress']
      return data?.status && activeStatuses.includes(data.status) ? 5000 : false
    },
    staleTime: 0, // Siempre considerar datos obsoletos para estado
  })

  // Suscribirse a actualizaciones en tiempo real
  useWebSocketSubscription(
    'translation_progress',
    useCallback((data: any) => {
      if (data.job_id === jobId) {
        // Actualizar caché del estado
        queryClient.setQueryData(translationKeys.status(jobId), data)
        
        // Actualizar caché del trabajo completo
        queryClient.setQueryData(translationKeys.detail(jobId), (old: any) => {
          if (old) {
            return { ...old, ...data }
          }
          return old
        })
        
        // Invalidar listas para reflejar cambios
        queryClient.invalidateQueries({ queryKey: translationKeys.lists() })
      }
    }, [jobId, queryClient])
  )

  return query
}

// Hook para obtener manifiesto de traducción
export const useTranslationManifest = (jobId: string, enabled = true) => {
  return useQuery({
    queryKey: translationKeys.manifest(jobId),
    queryFn: () => translationService.getTranslationManifest(jobId),
    enabled: enabled && !!jobId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })
}

// Hook para obtener metadatos de traducción
export const useTranslationMetadata = (jobId: string, enabled = true) => {
  return useQuery({
    queryKey: translationKeys.metadata(jobId),
    queryFn: () => translationService.getTranslationMetadata(jobId),
    enabled: enabled && !!jobId,
    staleTime: 10 * 60 * 1000, // 10 minutos
  })
}

// Hook para obtener jerarquía de modelo
export const useTranslationHierarchy = (jobId: string, enabled = true) => {
  return useQuery({
    queryKey: translationKeys.hierarchy(jobId),
    queryFn: () => translationService.getTranslationHierarchy(jobId),
    enabled: enabled && !!jobId,
    staleTime: 10 * 60 * 1000,
  })
}

// Hook para métricas de trabajo
export const useTranslationMetrics = (jobId: string, enabled = true) => {
  return useQuery({
    queryKey: translationKeys.metrics(jobId),
    queryFn: () => translationService.getTranslationMetrics(jobId),
    enabled: enabled && !!jobId,
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}

// Hook para estadísticas generales
export const useTranslationStats = () => {
  return useQuery({
    queryKey: translationKeys.stats(),
    queryFn: () => translationService.getTranslationStats(),
    staleTime: 5 * 60 * 1000,
  })
}

// Hook para trabajos activos
export const useActiveTranslationJobs = () => {
  const queryClient = useQueryClient()
  
  const query = useQuery({
    queryKey: translationKeys.active(),
    queryFn: () => translationService.getActiveTranslationJobs(),
    refetchInterval: 10000, // Refrescar cada 10 segundos
    staleTime: 30 * 1000,
  })

  // Actualizar con datos en tiempo real
  useWebSocketSubscription(
    'translation_progress',
    useCallback((data: any) => {
      queryClient.invalidateQueries({ queryKey: translationKeys.active() })
    }, [queryClient])
  )

  return query
}

// Hook para trabajos recientes
export const useRecentTranslationJobs = (limit = 10) => {
  return useQuery({
    queryKey: [...translationKeys.recent(), limit],
    queryFn: () => translationService.getRecentTranslationJobs(limit),
    staleTime: 2 * 60 * 1000,
  })
}

// Hook para formatos soportados
export const useSupportedFormats = () => {
  return useQuery({
    queryKey: translationKeys.formats(),
    queryFn: () => translationService.getSupportedFormats(),
    staleTime: 60 * 60 * 1000, // 1 hora
    cacheTime: 24 * 60 * 60 * 1000, // 24 horas
  })
}

// Hook para iniciar traducción
export const useStartTranslation = () => {
  const queryClient = useQueryClient()
  const { showLoader, hideLoader, updateMessage } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async (params: any) => {
      showLoader('Iniciando traducción...')
      updateMessage('Preparando archivo para traducción...')
      
      try {
        const result = await translationService.startTranslation(params)
        return result
      } finally {
        hideLoader()
      }
    },
    onSuccess: (newJob) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: translationKeys.lists() })
      queryClient.invalidateQueries({ queryKey: translationKeys.active() })
      queryClient.invalidateQueries({ queryKey: translationKeys.stats() })
      
      // Agregar nuevo trabajo al caché
      queryClient.setQueryData(translationKeys.detail(newJob.id), newJob)
      
      toast.success(`Traducción iniciada para "${newJob.input_file_name}"`)
    },
    onError: (error: any) => {
      console.error('Error starting translation:', error)
      toast.error(error.message || 'Error al iniciar la traducción')
    }
  })
}

// Hook para reintentar traducción
export const useRetryTranslation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ jobId, params }: { jobId: string; params?: any }) => 
      translationService.retryTranslation(jobId, params),
    onSuccess: (updatedJob, { jobId }) => {
      // Actualizar caché del trabajo
      queryClient.setQueryData(translationKeys.detail(jobId), updatedJob)
      
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: translationKeys.lists() })
      queryClient.invalidateQueries({ queryKey: translationKeys.active() })
      
      toast.success('Traducción reintentada correctamente')
    },
    onError: (error: any) => {
      console.error('Error retrying translation:', error)
      toast.error(error.message || 'Error al reintentar la traducción')
    }
  })
}

// Hook para cancelar traducción
export const useCancelTranslation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ jobId, params }: { jobId: string; params?: any }) => 
      translationService.cancelTranslation(jobId, params),
    onSuccess: (updatedJob, { jobId }) => {
      queryClient.setQueryData(translationKeys.detail(jobId), updatedJob)
      queryClient.invalidateQueries({ queryKey: translationKeys.lists() })
      queryClient.invalidateQueries({ queryKey: translationKeys.active() })
      
      toast.success('Traducción cancelada')
    },
    onError: (error: any) => {
      console.error('Error canceling translation:', error)
      toast.error(error.message || 'Error al cancelar la traducción')
    }
  })
}

// Hook para eliminar trabajo de traducción
export const useDeleteTranslationJob = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobId: string) => translationService.deleteTranslationJob(jobId),
    onSuccess: (_, jobId) => {
      // Remover del caché
      queryClient.removeQueries({ queryKey: translationKeys.detail(jobId) })
      
      // Invalidar listas
      queryClient.invalidateQueries({ queryKey: translationKeys.lists() })
      queryClient.invalidateQueries({ queryKey: translationKeys.stats() })
      
      toast.success('Trabajo de traducción eliminado')
    },
    onError: (error: any) => {
      console.error('Error deleting translation job:', error)
      toast.error(error.message || 'Error al eliminar el trabajo de traducción')
    }
  })
}

// Hook personalizado para gestión completa de traducciones
export const useTranslationManager = () => {
  const startTranslation = useStartTranslation()
  const retryTranslation = useRetryTranslation()
  const cancelTranslation = useCancelTranslation()
  const deleteTranslationJob = useDeleteTranslationJob()

  const isLoading = 
    startTranslation.isLoading ||
    retryTranslation.isLoading ||
    cancelTranslation.isLoading ||
    deleteTranslationJob.isLoading

  const handleBulkOperation = useCallback(async (
    operation: 'cancel' | 'delete' | 'retry',
    jobIds: string[]
  ) => {
    const promises = jobIds.map(jobId => {
      switch (operation) {
        case 'cancel':
          return cancelTranslation.mutateAsync({ jobId })
        case 'delete':
          return deleteTranslationJob.mutateAsync(jobId)
        case 'retry':
          return retryTranslation.mutateAsync({ jobId })
        default:
          return Promise.resolve()
      }
    })

    try {
      const results = await Promise.allSettled(promises)
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      toast.success(`${successful} trabajos procesados correctamente`)
      if (failed > 0) {
        toast.error(`${failed} trabajos no pudieron ser procesados`)
      }

      return { successful, failed }
    } catch (error) {
      console.error('Error in bulk operation:', error)
      throw error
    }
  }, [cancelTranslation, deleteTranslationJob, retryTranslation])

  return {
    // Mutations
    startTranslation: startTranslation.mutate,
    startTranslationAsync: startTranslation.mutateAsync,
    retryTranslation: retryTranslation.mutate,
    retryTranslationAsync: retryTranslation.mutateAsync,
    cancelTranslation: cancelTranslation.mutate,
    cancelTranslationAsync: cancelTranslation.mutateAsync,
    deleteTranslationJob: deleteTranslationJob.mutate,
    deleteTranslationJobAsync: deleteTranslationJob.mutateAsync,
    handleBulkOperation,
    
    // Estados
    isLoading,
    
    // Utilidades
    reset: () => {
      startTranslation.reset()
      retryTranslation.reset()
      cancelTranslation.reset()
      deleteTranslationJob.reset()
    }
  }
}

// Hook para monitorear progreso de traducción en tiempo real
export const useTranslationProgress = (jobId: string) => {
  const queryClient = useQueryClient()

  useWebSocketSubscription(
    'translation_progress',
    useCallback((data: any) => {
      if (data.job_id === jobId) {
        // Actualizar múltiples queries con los nuevos datos
        queryClient.setQueryData(translationKeys.detail(jobId), (old: any) => ({
          ...old,
          ...data,
          updated_at: new Date().toISOString()
        }))
        
        queryClient.setQueryData(translationKeys.status(jobId), data)
        
        // Si el trabajo se completó, invalidar manifiesto y metadatos
        if (data.status === 'success') {
          queryClient.invalidateQueries({ queryKey: translationKeys.manifest(jobId) })
          queryClient.invalidateQueries({ queryKey: translationKeys.metadata(jobId) })
          queryClient.invalidateQueries({ queryKey: translationKeys.hierarchy(jobId) })
        }
      }
    }, [jobId, queryClient])
  )

  // También suscribirse a errores específicos
  useWebSocketSubscription(
    'translation_error',
    useCallback((data: any) => {
      if (data.job_id === jobId) {
        queryClient.setQueryData(translationKeys.detail(jobId), (old: any) => ({
          ...old,
          status: 'failed',
          error: data.error,
          updated_at: new Date().toISOString()
        }))
        
        toast.error(`Error en traducción: ${data.error}`)
      }
    }, [jobId, queryClient])
  )
}

export default useTranslationManager
