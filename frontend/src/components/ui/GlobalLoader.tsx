import React, { useEffect, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import LoadingSpinner from './LoadingSpinner'
import { clsx } from 'clsx'

export interface GlobalLoaderProps {
  isVisible: boolean
  message?: string
  progress?: number
  allowCancel?: boolean
  onCancel?: () => void
  backdrop?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'spinner' | 'dots' | 'bars' | 'pulse'
  className?: string
}

const GlobalLoader: React.FC<GlobalLoaderProps> = ({
  isVisible,
  message = 'Cargando...',
  progress,
  allowCancel = false,
  onCancel,
  backdrop = true,
  size = 'md',
  variant = 'spinner',
  className = ''
}) => {
  const [dots, setDots] = useState('')

  // Animación de puntos para el mensaje
  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return ''
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [isVisible])

  // Resetear dots cuando se oculta
  useEffect(() => {
    if (!isVisible) {
      setDots('')
    }
  }, [isVisible])

  if (!isVisible) return null

  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={clsx(
                  'rounded-full bg-blue-500',
                  size === 'sm' && 'w-2 h-2',
                  size === 'md' && 'w-3 h-3',
                  size === 'lg' && 'w-4 h-4',
                  'animate-bounce'
                )}
                style={{
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '0.6s'
                }}
              />
            ))}
          </div>
        )

      case 'bars':
        return (
          <div className="flex space-x-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={clsx(
                  'bg-blue-500 rounded-sm',
                  size === 'sm' && 'w-1 h-4',
                  size === 'md' && 'w-1.5 h-6',
                  size === 'lg' && 'w-2 h-8'
                )}
                style={{
                  animation: `loading-bars 1s ease-in-out infinite ${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )

      case 'pulse':
        return (
          <div
            className={clsx(
              'rounded-full bg-blue-500 animate-pulse',
              size === 'sm' && 'w-8 h-8',
              size === 'md' && 'w-12 h-12',
              size === 'lg' && 'w-16 h-16'
            )}
          />
        )

      default: // spinner
        return <LoadingSpinner size={size} />
    }
  }

  return (
    <>
      {/* Backdrop */}
      {backdrop && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" />
      )}

      {/* Loader container */}
      <div className={clsx(
        'fixed inset-0 flex items-center justify-center z-50 p-4',
        className
      )}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4">
          {/* Loader */}
          <div className="flex justify-center mb-6">
            {renderLoader()}
          </div>

          {/* Message */}
          <div className="text-center space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {message}{dots}
            </h3>

            {/* Progress bar */}
            {progress !== undefined && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Progreso</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Cancel button */}
            {allowCancel && onCancel && (
              <button
                onClick={onCancel}
                className="mt-4 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CSS for bars animation */}
      <style jsx>{`
        @keyframes loading-bars {
          0%, 40%, 100% {
            transform: scaleY(0.4);
          }
          20% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </>
  )
}

// Hook para manejar global loading state
export const useGlobalLoader = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string>('Cargando...')
  const [progress, setProgress] = useState<number | undefined>(undefined)

  const showLoader = (
    loadingMessage?: string, 
    initialProgress?: number
  ) => {
    if (loadingMessage) setMessage(loadingMessage)
    if (initialProgress !== undefined) setProgress(initialProgress)
    setIsLoading(true)
  }

  const hideLoader = () => {
    setIsLoading(false)
    setProgress(undefined)
  }

  const updateProgress = (newProgress: number) => {
    setProgress(newProgress)
  }

  const updateMessage = (newMessage: string) => {
    setMessage(newMessage)
  }

  return {
    isLoading,
    message,
    progress,
    showLoader,
    hideLoader,
    updateProgress,
    updateMessage
  }
}

// Context para global loader
export const GlobalLoaderContext = React.createContext<{
  showLoader: (message?: string, progress?: number) => void
  hideLoader: () => void
  updateProgress: (progress: number) => void
  updateMessage: (message: string) => void
  isLoading: boolean
} | undefined>(undefined)

// Provider del global loader
export const GlobalLoaderProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const globalLoader = useGlobalLoader()

  return (
    <GlobalLoaderContext.Provider value={globalLoader}>
      {children}
      <GlobalLoader
        isVisible={globalLoader.isLoading}
        message={globalLoader.message}
        progress={globalLoader.progress}
      />
    </GlobalLoaderContext.Provider>
  )
}

// Hook para usar el global loader context
export const useGlobalLoaderContext = () => {
  const context = React.useContext(GlobalLoaderContext)
  if (!context) {
    throw new Error('useGlobalLoaderContext must be used within GlobalLoaderProvider')
  }
  return context
}

export default GlobalLoader
