import React, { useEffect, useState } from 'react'
import { 
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
  EyeIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline'
import { useTranslation } from '@/hooks/redux'
import { useUI } from '@/hooks/useUI'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { formatDuration, formatRelativeTime, formatPercentage } from '@/utils/format'
import type { TranslationJob } from '@/types'

interface TranslationStatusProps {
  jobId?: string
  job?: TranslationJob
  showActions?: boolean
  showDetails?: boolean
  onRetry?: (job: TranslationJob) => void
  onCancel?: (job: TranslationJob) => void
  onView?: (job: TranslationJob) => void
  onDownload?: (job: TranslationJob, format: string) => void
  className?: string
}

const TranslationStatus: React.FC<TranslationStatusProps> = ({
  jobId,
  job: externalJob,
  showActions = true,
  showDetails = false,
  onRetry,
  onCancel,
  onView,
  onDownload,
  className = ''
}) => {
  const { 
    jobs, 
    currentJob, 
    isLoading,
    fetchTranslationStatus,
    retryTranslation,
    cancelTranslation
  } = useTranslation()
  
  const { showSuccessToast, showErrorToast } = useUI()
  
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  
  // Determinar qué job usar
  const job = externalJob || (jobId ? jobs.find(j => j.id === jobId) : currentJob)

  // Polling para jobs activos
  useEffect(() => {
    if (job && ['pending', 'inprogress'].includes(job.status)) {
      const interval = setInterval(() => {
        if (jobId || job.id) {
          fetchTranslationStatus(jobId || job.id)
        }
      }, 5000) // Poll cada 5 segundos

      setPollingInterval(interval)
      
      return () => {
        if (interval) {
          clearInterval(interval)
        }
      }
    } else {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        setPollingInterval(null)
      }
    }
  }, [job?.status, job?.id, jobId, fetchTranslationStatus])

  // Limpiar polling al desmontar
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />
      case 'inprogress':
        return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'failed':
      case 'timeout':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
      case 'cancelled':
        return <StopIcon className="h-5 w-5 text-gray-500" />
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'En cola'
      case 'inprogress':
        return 'Procesando'
      case 'success':
        return 'Completado'
      case 'failed':
        return 'Error'
      case 'timeout':
        return 'Tiempo agotado'
      case 'cancelled':
        return 'Cancelado'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'inprogress':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300'
      case 'success':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-300'
      case 'failed':
      case 'timeout':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-300'
      case 'cancelled':
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-300'
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const handleRetry = async () => {
    if (!job) return
    
    try {
      await retryTranslation(job.id)
      showSuccessToast('Traducción reiniciada', 'El trabajo se ha añadido nuevamente a la cola')
      
      if (onRetry) {
        onRetry(job)
      }
    } catch (error: any) {
      console.error('Error retrying translation:', error)
      showErrorToast(
        'Error al reiniciar traducción',
        error.response?.data?.detail || 'Error inesperado'
      )
    }
  }

  const handleCancel = async () => {
    if (!job) return
    
    if (!window.confirm('¿Estás seguro de que quieres cancelar esta traducción?')) {
      return
    }
    
    try {
      await cancelTranslation(job.id)
      showSuccessToast('Traducción cancelada', 'El trabajo ha sido cancelado')
      
      if (onCancel) {
        onCancel(job)
      }
    } catch (error: any) {
      console.error('Error cancelling translation:', error)
      showErrorToast(
        'Error al cancelar traducción',
        error.response?.data?.detail || 'Error inesperado'
      )
    }
  }

  const handleView = () => {
    if (!job) return
    
    if (onView) {
      onView(job)
    } else {
      // Default: abrir en nueva pestaña
      window.open(`/viewer/${job.urn}`, '_blank')
    }
  }

  const handleDownload = (format: string) => {
    if (!job) return
    
    if (onDownload) {
      onDownload(job, format)
    } else {
      // Default: download logic
      window.open(`/api/v1/translate/${job.id}/download?format=${format}`, '_blank')
    }
  }

  const calculateProgress = () => {
    if (!job) return 0
    
    switch (job.status) {
      case 'pending':
        return 0
      case 'inprogress':
        return job.progress || 50 // Si no hay progreso específico, mostrar 50%
      case 'success':
        return 100
      case 'failed':
      case 'timeout':
      case 'cancelled':
        return 0
      default:
        return 0
    }
  }

  const getEstimatedTime = () => {
    if (!job || job.status !== 'inprogress') return null
    
    const progress = job.progress || 0
    if (progress === 0) return null
    
    const elapsed = Date.now() - new Date(job.started_at || job.created_at).getTime()
    const estimated = (elapsed / progress) * 100 - elapsed
    
    return estimated > 0 ? estimated / 1000 : null // Convertir a segundos
  }

  if (isLoading && !job) {
    return (
      <div className="flex items-center justify-center p-4">
        <LoadingSpinner size="sm" text="Cargando estado..." />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center p-4 text-gray-500 dark:text-gray-400">
        No hay información de traducción disponible
      </div>
    )
  }

  const progress = calculateProgress()
  const estimatedTime = getEstimatedTime()

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      {/* Header con estado */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getStatusIcon(job.status)}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {job.input_file?.name || `Traducción ${job.id.slice(0, 8)}`}
            </h3>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(job.status)}`}>
                {getStatusText(job.status)}
              </span>
              {job.priority && job.priority !== 'normal' && (
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300">
                  {job.priority === 'high' ? 'Alta prioridad' : 'Prioridad urgente'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tiempo */}
        <div className="text-right text-sm text-gray-500 dark:text-gray-400">
          <p>Iniciado {formatRelativeTime(job.created_at)}</p>
          {job.completed_at && (
            <p>Completado {formatRelativeTime(job.completed_at)}</p>
          )}
        </div>
      </div>

      {/* Barra de progreso */}
      {['pending', 'inprogress'].includes(job.status) && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Progreso</span>
            <span>{formatPercentage(progress)}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                job.status === 'inprogress' ? 'bg-blue-600' : 'bg-yellow-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {estimatedTime && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Tiempo estimado restante: {formatDuration(estimatedTime)}
            </p>
          )}
        </div>
      )}

      {/* Información detallada */}
      {showDetails && (
        <div className="mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Formatos de salida:</span>
              <div className="mt-1">
                {job.output_formats?.map(format => (
                  <span key={format} className="inline-block bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-xs mr-1 mb-1">
                    {format.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
            
            {job.quality_level && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Calidad:</span>
                <p className="text-gray-600 dark:text-gray-400 capitalize">{job.quality_level}</p>
              </div>
            )}
          </div>

          {job.error_message && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-300">
                <span className="font-medium">Error:</span> {job.error_message}
              </p>
            </div>
          )}
          
          {job.webhook_url && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Webhook configurado:</span> {job.webhook_url}
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      {showActions && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-2">
            {/* Reintentar */}
            {['failed', 'timeout', 'cancelled'].includes(job.status) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                leftIcon={<ArrowPathIcon className="h-4 w-4" />}
              >
                Reintentar
              </Button>
            )}
            
            {/* Cancelar */}
            {['pending', 'inprogress'].includes(job.status) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                leftIcon={<StopIcon className="h-4 w-4" />}
              >
                Cancelar
              </Button>
            )}
          </div>

          {/* Acciones de descarga y visualización */}
          {job.status === 'success' && (
            <div className="flex items-center space-x-2">
              {/* Ver en 3D */}
              {job.urn && (
                <Button
                  size="sm"
                  onClick={handleView}
                  leftIcon={<EyeIcon className="h-4 w-4" />}
                >
                  Ver en 3D
                </Button>
              )}
              
              {/* Downloads por formato */}
              {job.output_formats && job.output_formats.length > 1 ? (
                <div className="relative inline-block text-left">
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<ArrowDownTrayIcon className="h-4 w-4" />}
                    onClick={() => {
                      // TODO: Implementar dropdown de formatos
                      if (job.output_formats && job.output_formats.length > 0) {
                        handleDownload(job.output_formats[0])
                      }
                    }}
                  >
                    Descargar
                  </Button>
                </div>
              ) : job.output_formats && job.output_formats.length === 1 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(job.output_formats![0])}
                  leftIcon={<ArrowDownTrayIcon className="h-4 w-4" />}
                >
                  Descargar {job.output_formats[0].toUpperCase()}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TranslationStatus
