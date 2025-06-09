import React, { useEffect, useState } from 'react'
import { CheckIcon, XMarkIcon, PauseIcon, PlayIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

export interface ProgressBarProps {
  value: number // 0-100
  max?: number
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info'
  size?: 'sm' | 'md' | 'lg'
  showPercentage?: boolean
  showValue?: boolean
  animated?: boolean
  striped?: boolean
  label?: string
  sublabel?: string
  allowPause?: boolean
  allowCancel?: boolean
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  className?: string
  indeterminate?: boolean
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  variant = 'default',
  size = 'md',
  showPercentage = true,
  showValue = false,
  animated = true,
  striped = false,
  label,
  sublabel,
  allowPause = false,
  allowCancel = false,
  onPause,
  onResume,
  onCancel,
  className = '',
  indeterminate = false
}) => {
  const [isPaused, setIsPaused] = useState(false)
  const [animatedValue, setAnimatedValue] = useState(0)

  // Animate value changes
  useEffect(() => {
    if (!animated) {
      setAnimatedValue(value)
      return
    }

    const startValue = animatedValue
    const endValue = Math.min(value, max)
    const duration = 300 // ms
    const startTime = Date.now()

    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      const currentValue = startValue + (endValue - startValue) * progress
      setAnimatedValue(currentValue)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value, max, animated])

  const percentage = Math.min((animatedValue / max) * 100, 100)
  const isComplete = percentage >= 100
  const isError = variant === 'error'

  const getVariantClasses = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      case 'warning':
        return 'bg-yellow-500'
      case 'info':
        return 'bg-blue-500'
      default:
        return 'bg-blue-500'
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-1'
      case 'lg':
        return 'h-4'
      default:
        return 'h-2'
    }
  }

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false)
      onResume?.()
    } else {
      setIsPaused(true)
      onPause?.()
    }
  }

  return (
    <div className={clsx('w-full', className)}>
      {/* Label and controls */}
      {(label || allowPause || allowCancel) && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            {label && (
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
              </div>
            )}
            {sublabel && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {sublabel}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Percentage or value display */}
            {(showPercentage || showValue) && !indeterminate && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {showValue ? `${Math.round(animatedValue)}/${max}` : `${Math.round(percentage)}%`}
              </span>
            )}

            {/* Control buttons */}
            {(allowPause || allowCancel) && !isComplete && !isError && (
              <div className="flex space-x-1">
                {allowPause && onPause && onResume && (
                  <button
                    onClick={handlePauseResume}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    title={isPaused ? 'Reanudar' : 'Pausar'}
                  >
                    {isPaused ? (
                      <PlayIcon className="w-4 h-4" />
                    ) : (
                      <PauseIcon className="w-4 h-4" />
                    )}
                  </button>
                )}

                {allowCancel && onCancel && (
                  <button
                    onClick={onCancel}
                    className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                    title="Cancelar"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Status icons */}
            {isComplete && (
              <CheckIcon className="w-5 h-5 text-green-500" />
            )}
            {isError && (
              <XMarkIcon className="w-5 h-5 text-red-500" />
            )}
          </div>
        </div>
      )}

      {/* Progress bar container */}
      <div className={clsx(
        'w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
        getSizeClasses()
      )}>
        {/* Progress bar fill */}
        <div
          className={clsx(
            'h-full transition-all duration-300 ease-out',
            getVariantClasses(),
            {
              'bg-opacity-50': isPaused,
              'animate-pulse': indeterminate,
              'relative overflow-hidden': striped
            }
          )}
          style={{
            width: indeterminate ? '100%' : `${percentage}%`,
            animation: indeterminate ? 'progress-indeterminate 1.5s infinite linear' : undefined
          }}
        >
          {/* Striped pattern */}
          {striped && !indeterminate && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
        </div>

        {/* Indeterminate animation */}
        {indeterminate && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 animate-pulse" />
        )}
      </div>

      {/* Additional info */}
      {isPaused && (
        <div className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
          En pausa
        </div>
      )}
    </div>
  )
}

// Componente especializado para uploads
export const UploadProgress: React.FC<{
  fileName: string
  progress: number
  uploadSpeed?: string
  timeRemaining?: string
  onCancel?: () => void
  status?: 'uploading' | 'completed' | 'error' | 'paused'
  error?: string
  className?: string
}> = ({
  fileName,
  progress,
  uploadSpeed,
  timeRemaining,
  onCancel,
  status = 'uploading',
  error,
  className = ''
}) => {
  const getStatusVariant = () => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'error':
        return 'error'
      case 'paused':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return 'Completado'
      case 'error':
        return 'Error'
      case 'paused':
        return 'Pausado'
      default:
        return 'Subiendo'
    }
  }

  return (
    <div className={clsx('p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg', className)}>
      <ProgressBar
        value={progress}
        variant={getStatusVariant()}
        label={fileName}
        sublabel={`${getStatusText()}${uploadSpeed ? ` • ${uploadSpeed}` : ''}${timeRemaining ? ` • ${timeRemaining} restante` : ''}`}
        allowCancel={status === 'uploading' && !!onCancel}
        onCancel={onCancel}
        showPercentage={status !== 'error'}
      />
      
      {error && status === 'error' && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}

// Componente especializado para traducciones
export const TranslationProgress: React.FC<{
  jobId: string
  fileName: string
  progress: number
  stage: string
  onCancel?: () => void
  status?: 'pending' | 'inprogress' | 'success' | 'failed' | 'timeout'
  error?: string
  className?: string
}> = ({
  jobId,
  fileName,
  progress,
  stage,
  onCancel,
  status = 'pending',
  error,
  className = ''
}) => {
  const getStatusVariant = () => {
    switch (status) {
      case 'success':
        return 'success'
      case 'failed':
      case 'timeout':
        return 'error'
      case 'inprogress':
        return 'default'
      default:
        return 'info'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'success':
        return 'Completado'
      case 'failed':
        return 'Falló'
      case 'timeout':
        return 'Tiempo agotado'
      case 'inprogress':
        return stage || 'En progreso'
      default:
        return 'Pendiente'
    }
  }

  return (
    <div className={clsx('p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg', className)}>
      <ProgressBar
        value={progress}
        variant={getStatusVariant()}
        label={fileName}
        sublabel={`${getStatusText()} • Job ID: ${jobId}`}
        allowCancel={status === 'inprogress' && !!onCancel}
        onCancel={onCancel}
        showPercentage={status !== 'failed' && status !== 'timeout'}
        indeterminate={status === 'pending'}
      />
      
      {error && (status === 'failed' || status === 'timeout') && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}

// Componente para múltiples progress bars
export const MultiProgress: React.FC<{
  items: Array<{
    id: string
    label: string
    progress: number
    variant?: 'default' | 'success' | 'error' | 'warning' | 'info'
    status?: string
  }>
  onCancel?: (id: string) => void
  className?: string
}> = ({ items, onCancel, className = '' }) => (
  <div className={clsx('space-y-3', className)}>
    {items.map(item => (
      <ProgressBar
        key={item.id}
        value={item.progress}
        variant={item.variant}
        label={item.label}
        sublabel={item.status}
        allowCancel={!!onCancel}
        onCancel={() => onCancel?.(item.id)}
        showPercentage
      />
    ))}
  </div>
)

// CSS para animaciones
const ProgressStyle: React.FC = () => (
  <style jsx global>{`
    @keyframes progress-indeterminate {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }
  `}</style>
)

// Wrapper que incluye estilos
const ProgressBarWithStyles: React.FC<ProgressBarProps> = (props) => (
  <>
    <ProgressStyle />
    <ProgressBar {...props} />
  </>
)

export default ProgressBarWithStyles
