import React, { useState } from 'react'
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import Button from './Button'
import { clsx } from 'clsx'

export interface RetryButtonProps {
  onRetry: () => Promise<void> | void
  maxRetries?: number
  retryDelay?: number
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  fullWidth?: boolean
  className?: string
  children?: React.ReactNode
  showRetryCount?: boolean
  exponentialBackoff?: boolean
}

const RetryButton: React.FC<RetryButtonProps> = ({
  onRetry,
  maxRetries = 3,
  retryDelay = 1000,
  disabled = false,
  loading = false,
  size = 'md',
  variant = 'outline',
  fullWidth = false,
  className = '',
  children,
  showRetryCount = true,
  exponentialBackoff = true
}) => {
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const calculateDelay = (attempt: number): number => {
    if (!exponentialBackoff) return retryDelay
    return retryDelay * Math.pow(2, attempt - 1)
  }

  const handleRetry = async () => {
    if (isRetrying || disabled || retryCount >= maxRetries) return

    setIsRetrying(true)
    setLastError(null)

    try {
      await onRetry()
      // Si el retry fue exitoso, resetear el contador
      setRetryCount(0)
    } catch (error: any) {
      const newRetryCount = retryCount + 1
      setRetryCount(newRetryCount)
      setLastError(error.message || 'Error desconocido')

      if (newRetryCount < maxRetries) {
        // Programar siguiente intento con delay
        const delay = calculateDelay(newRetryCount)
        setTimeout(() => {
          setIsRetrying(false)
        }, delay)
      } else {
        setIsRetrying(false)
      }
    }

    if (retryCount + 1 >= maxRetries) {
      setIsRetrying(false)
    }
  }

  const canRetry = !disabled && !loading && !isRetrying && retryCount < maxRetries
  const hasReachedMaxRetries = retryCount >= maxRetries

  return (
    <div className={clsx('space-y-2', className)}>
      <Button
        onClick={handleRetry}
        disabled={!canRetry}
        loading={isRetrying || loading}
        size={size}
        variant={hasReachedMaxRetries ? 'secondary' : variant}
        fullWidth={fullWidth}
        leftIcon={
          hasReachedMaxRetries ? (
            <ExclamationTriangleIcon className="w-4 h-4" />
          ) : (
            <ArrowPathIcon className={clsx('w-4 h-4', isRetrying && 'animate-spin')} />
          )
        }
      >
        {children || (
          <>
            {hasReachedMaxRetries ? (
              'Máximo de intentos alcanzado'
            ) : isRetrying ? (
              `Reintentando${retryCount > 0 ? ` (${retryCount + 1}/${maxRetries})` : ''}...`
            ) : (
              'Intentar de nuevo'
            )}
          </>
        )}
      </Button>

      {/* Mostrar información de reintentos */}
      {showRetryCount && retryCount > 0 && !hasReachedMaxRetries && (
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Intento {retryCount} de {maxRetries}
            {isRetrying && (
              <span className="ml-1">
                (próximo intento en {Math.ceil(calculateDelay(retryCount) / 1000)}s)
              </span>
            )}
          </p>
        </div>
      )}

      {/* Mostrar último error */}
      {lastError && (
        <div className="p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded text-center">
          <p className="text-xs text-red-600 dark:text-red-400">
            {lastError}
          </p>
        </div>
      )}

      {/* Mensaje cuando se alcanza el máximo de reintentos */}
      {hasReachedMaxRetries && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded text-center">
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Se alcanzó el máximo de intentos. 
            <button
              onClick={() => {
                setRetryCount(0)
                setLastError(null)
              }}
              className="ml-1 underline hover:no-underline"
            >
              Resetear contador
            </button>
          </p>
        </div>
      )}
    </div>
  )
}

// Hook para manejo de reintentos
export const useRetry = (
  operation: () => Promise<void>,
  maxRetries: number = 3,
  delay: number = 1000
) => {
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const retry = async () => {
    if (isRetrying || retryCount >= maxRetries) return

    setIsRetrying(true)
    setError(null)

    try {
      await operation()
      setRetryCount(0) // Reset on success
    } catch (err: any) {
      const newRetryCount = retryCount + 1
      setRetryCount(newRetryCount)
      setError(err)

      if (newRetryCount < maxRetries) {
        // Wait before allowing next retry
        setTimeout(() => {
          setIsRetrying(false)
        }, delay * Math.pow(2, newRetryCount - 1)) // Exponential backoff
      } else {
        setIsRetrying(false)
      }
    }
  }

  const reset = () => {
    setRetryCount(0)
    setError(null)
    setIsRetrying(false)
  }

  return {
    retry,
    reset,
    retryCount,
    isRetrying,
    error,
    canRetry: !isRetrying && retryCount < maxRetries,
    hasReachedMaxRetries: retryCount >= maxRetries
  }
}

export default RetryButton
