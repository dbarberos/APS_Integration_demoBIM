import { useCallback } from 'react'
import { useAppDispatch } from './redux'
import { useTranslation } from './redux'
import { useUI } from './useUI'
import { 
  fetchTranslationJobs,
  fetchTranslationJob,
  startTranslation,
  retryTranslationJob,
  cancelTranslationJob,
  fetchTranslationStatus,
  fetchTranslationManifest,
  fetchTranslationMetadata,
  fetchTranslationHierarchy,
  fetchTranslationStats
} from '@/store/slices/translationSlice'
import type { TranslationJobRequest } from '@/types'

export const useTranslations = () => {
  const dispatch = useAppDispatch()
  const translationState = useTranslation()
  const { showSuccessToast, showErrorToast } = useUI()

  // Fetch all translation jobs
  const fetchJobs = useCallback(async (params?: {
    page?: number
    limit?: number
    status?: string
    priority?: string
    search?: string
  }) => {
    try {
      await dispatch(fetchTranslationJobs(params || {})).unwrap()
    } catch (error: any) {
      console.error('Error fetching translation jobs:', error)
      showErrorToast(
        'Error al cargar traducciones',
        error.message || 'Error inesperado'
      )
    }
  }, [dispatch, showErrorToast])

  // Fetch single translation job
  const fetchJob = useCallback(async (jobId: string) => {
    try {
      const job = await dispatch(fetchTranslationJob(jobId)).unwrap()
      return job
    } catch (error: any) {
      console.error('Error fetching translation job:', error)
      showErrorToast(
        'Error al cargar traducción',
        error.message || 'Error inesperado'
      )
      throw error
    }
  }, [dispatch, showErrorToast])

  // Start new translation
  const startNewTranslation = useCallback(async (request: TranslationJobRequest) => {
    try {
      const job = await dispatch(startTranslation(request)).unwrap()
      showSuccessToast(
        'Traducción iniciada',
        `Se ha iniciado la traducción para ${request.input_file_id}`
      )
      return job
    } catch (error: any) {
      console.error('Error starting translation:', error)
      showErrorToast(
        'Error al iniciar traducción',
        error.response?.data?.detail || error.message || 'Error inesperado'
      )
      throw error
    }
  }, [dispatch, showSuccessToast, showErrorToast])

  // Retry translation
  const retryTranslation = useCallback(async (jobId: string) => {
    try {
      const job = await dispatch(retryTranslationJob(jobId)).unwrap()
      showSuccessToast(
        'Traducción reiniciada',
        'El trabajo se ha añadido nuevamente a la cola'
      )
      return job
    } catch (error: any) {
      console.error('Error retrying translation:', error)
      showErrorToast(
        'Error al reiniciar traducción',
        error.response?.data?.detail || error.message || 'Error inesperado'
      )
      throw error
    }
  }, [dispatch, showSuccessToast, showErrorToast])

  // Cancel translation
  const cancelTranslation = useCallback(async (jobId: string) => {
    try {
      await dispatch(cancelTranslationJob(jobId)).unwrap()
      showSuccessToast(
        'Traducción cancelada',
        'El trabajo ha sido cancelado exitosamente'
      )
    } catch (error: any) {
      console.error('Error cancelling translation:', error)
      showErrorToast(
        'Error al cancelar traducción',
        error.response?.data?.detail || error.message || 'Error inesperado'
      )
      throw error
    }
  }, [dispatch, showSuccessToast, showErrorToast])

  // Check translation status
  const checkStatus = useCallback(async (jobId: string) => {
    try {
      const status = await dispatch(fetchTranslationStatus(jobId)).unwrap()
      return status
    } catch (error: any) {
      console.error('Error checking translation status:', error)
      // Don't show error toast for status checks as they might be called frequently
      return null
    }
  }, [dispatch])

  // Get translation manifest
  const getManifest = useCallback(async (jobId: string) => {
    try {
      const manifest = await dispatch(fetchTranslationManifest(jobId)).unwrap()
      return manifest
    } catch (error: any) {
      console.error('Error fetching translation manifest:', error)
      showErrorToast(
        'Error al obtener manifest',
        error.message || 'Error inesperado'
      )
      throw error
    }
  }, [dispatch, showErrorToast])

  // Get translation metadata
  const getMetadata = useCallback(async (jobId: string) => {
    try {
      const metadata = await dispatch(fetchTranslationMetadata(jobId)).unwrap()
      return metadata
    } catch (error: any) {
      console.error('Error fetching translation metadata:', error)
      showErrorToast(
        'Error al obtener metadatos',
        error.message || 'Error inesperado'
      )
      throw error
    }
  }, [dispatch, showErrorToast])

  // Get translation hierarchy
  const getHierarchy = useCallback(async (jobId: string) => {
    try {
      const hierarchy = await dispatch(fetchTranslationHierarchy(jobId)).unwrap()
      return hierarchy
    } catch (error: any) {
      console.error('Error fetching translation hierarchy:', error)
      showErrorToast(
        'Error al obtener jerarquía',
        error.message || 'Error inesperado'
      )
      throw error
    }
  }, [dispatch, showErrorToast])

  // Get translation statistics
  const getStats = useCallback(async () => {
    try {
      const stats = await dispatch(fetchTranslationStats()).unwrap()
      return stats
    } catch (error: any) {
      console.error('Error fetching translation stats:', error)
      showErrorToast(
        'Error al obtener estadísticas',
        error.message || 'Error inesperado'
      )
      throw error
    }
  }, [dispatch, showErrorToast])

  // Download translation result
  const downloadResult = useCallback(async (jobId: string, format: string) => {
    try {
      // Create download URL
      const downloadUrl = `/api/v1/translate/${jobId}/download?format=${format}`
      
      // Open download in new tab
      window.open(downloadUrl, '_blank')
      
      showSuccessToast(
        'Descarga iniciada',
        `Descargando archivo en formato ${format.toUpperCase()}`
      )
    } catch (error: any) {
      console.error('Error downloading translation result:', error)
      showErrorToast(
        'Error al descargar',
        error.message || 'Error inesperado'
      )
    }
  }, [showSuccessToast, showErrorToast])

  // Utility functions
  const getJobById = useCallback((jobId: string) => {
    return translationState.jobs.find(job => job.id === jobId)
  }, [translationState.jobs])

  const getActiveJobs = useCallback(() => {
    return translationState.jobs.filter(job => 
      ['pending', 'inprogress'].includes(job.status)
    )
  }, [translationState.jobs])

  const getCompletedJobs = useCallback(() => {
    return translationState.jobs.filter(job => job.status === 'success')
  }, [translationState.jobs])

  const getFailedJobs = useCallback(() => {
    return translationState.jobs.filter(job => 
      ['failed', 'timeout'].includes(job.status)
    )
  }, [translationState.jobs])

  const getJobsForFile = useCallback((fileId: string) => {
    return translationState.jobs.filter(job => 
      job.input_file?.id === fileId
    )
  }, [translationState.jobs])

  const getTotalProgress = useCallback(() => {
    const activeJobs = getActiveJobs()
    if (activeJobs.length === 0) return 0
    
    const totalProgress = activeJobs.reduce((sum, job) => 
      sum + (job.progress || 0), 0
    )
    
    return Math.round(totalProgress / activeJobs.length)
  }, [getActiveJobs])

  const getEstimatedTimeRemaining = useCallback(() => {
    const activeJobs = getActiveJobs()
    if (activeJobs.length === 0) return null
    
    // Simple estimation based on average progress rate
    // In a real implementation, this would be more sophisticated
    const avgProgress = getTotalProgress()
    if (avgProgress === 0) return null
    
    const avgStartTime = activeJobs.reduce((sum, job) => 
      sum + new Date(job.started_at || job.created_at).getTime(), 0
    ) / activeJobs.length
    
    const elapsed = Date.now() - avgStartTime
    const estimated = (elapsed / avgProgress) * (100 - avgProgress)
    
    return estimated > 0 ? Math.round(estimated / 1000) : null // Return seconds
  }, [getActiveJobs, getTotalProgress])

  // Polling management
  const startPolling = useCallback((interval: number = 5000) => {
    const activeJobs = getActiveJobs()
    
    if (activeJobs.length === 0) return null
    
    const pollInterval = setInterval(() => {
      const currentActiveJobs = getActiveJobs()
      
      if (currentActiveJobs.length === 0) {
        clearInterval(pollInterval)
        return
      }
      
      // Check status for all active jobs
      currentActiveJobs.forEach(job => {
        checkStatus(job.id)
      })
    }, interval)
    
    return pollInterval
  }, [getActiveJobs, checkStatus])

  return {
    // State
    ...translationState,
    
    // Actions
    fetchJobs,
    fetchJob,
    startNewTranslation,
    retryTranslation,
    cancelTranslation,
    checkStatus,
    getManifest,
    getMetadata,
    getHierarchy,
    getStats,
    downloadResult,
    
    // Utilities
    getJobById,
    getActiveJobs,
    getCompletedJobs,
    getFailedJobs,
    getJobsForFile,
    getTotalProgress,
    getEstimatedTimeRemaining,
    startPolling,
  }
}

export default useTranslations
