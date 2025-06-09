import React from 'react'
import { 
  ExclamationTriangleIcon, 
  ArrowPathIcon, 
  HomeIcon,
  ClipboardDocumentIcon 
} from '@heroicons/react/24/outline'
import Button from './Button'

export interface ErrorFallbackProps {
  error?: Error
  resetError?: () => void
  title?: string
  message?: string
  showRetry?: boolean
  showHome?: boolean
  showDetails?: boolean
  className?: string
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  title = 'Error inesperado',
  message = 'Ha ocurrido un problema. Por favor, intenta de nuevo.',
  showRetry = true,
  showHome = true,
  showDetails = false,
  className = ''
}) => {
  const handleCopyError = () => {
    if (!error) return
    
    const errorText = `
Error: ${error.message}
Stack: ${error.stack}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
Timestamp: ${new Date().toISOString()}
    `.trim()

    navigator.clipboard.writeText(errorText).then(() => {
      alert('Detalles del error copiados al portapapeles')
    }).catch(() => {
      console.error('No se pudieron copiar los detalles del error')
    })
  }

  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="max-w-md w-full text-center">
        {/* Icono de error */}
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 bg-red-100 dark:bg-red-900/20 rounded-full">
          <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>

        {/* Título y mensaje */}
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
          {title}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {message}
        </p>

        {/* Detalles del error (solo en desarrollo) */}
        {showDetails && error && process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-left">
            <h4 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
              Detalles técnicos:
            </h4>
            <div className="text-xs text-red-600 dark:text-red-400 space-y-2">
              <div>
                <span className="font-medium">Error:</span> {error.message}
              </div>
              {error.stack && (
                <details>
                  <summary className="cursor-pointer hover:text-red-800 dark:hover:text-red-200">
                    Stack trace
                  </summary>
                  <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="space-y-3">
          {showRetry && resetError && (
            <Button
              onClick={resetError}
              leftIcon={<ArrowPathIcon className="w-4 h-4" />}
              fullWidth
              variant="primary"
            >
              Intentar de nuevo
            </Button>
          )}

          <div className="flex space-x-2">
            {showHome && (
              <Button
                onClick={() => window.location.href = '/'}
                leftIcon={<HomeIcon className="w-4 h-4" />}
                variant="secondary"
                size="sm"
                fullWidth
              >
                Ir al inicio
              </Button>
            )}

            <Button
              onClick={() => window.history.back()}
              variant="outline"
              size="sm"
              fullWidth
            >
              Volver atrás
            </Button>
          </div>

          {/* Botón para copiar error (desarrollo) */}
          {error && process.env.NODE_ENV === 'development' && (
            <Button
              onClick={handleCopyError}
              leftIcon={<ClipboardDocumentIcon className="w-4 h-4" />}
              variant="outline"
              size="sm"
              fullWidth
            >
              Copiar detalles del error
            </Button>
          )}
        </div>

        {/* Texto de ayuda */}
        <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
          Si el problema persiste, contacta al soporte técnico.
        </p>
      </div>
    </div>
  )
}

export default ErrorFallback
