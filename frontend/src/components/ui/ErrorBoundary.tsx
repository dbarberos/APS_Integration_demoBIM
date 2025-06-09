import React, { Component, ErrorInfo, ReactNode } from 'react'
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import Button from './Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    // Actualizar state para mostrar la UI de error
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // Llamar callback personalizado si se proporciona
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // En producción, enviar error a servicio de monitoreo
    if (process.env.NODE_ENV === 'production') {
      // Aquí se podría integrar con Sentry, LogRocket, etc.
      this.logErrorToService(error, errorInfo)
    }
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Implementar logging a servicio externo
    try {
      // Ejemplo: Sentry.captureException(error, { contexts: { react: errorInfo } })
      console.error('Error logged to service:', { error, errorInfo })
    } catch (loggingError) {
      console.error('Failed to log error to service:', loggingError)
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      // Usar fallback personalizado si se proporciona
      if (this.props.fallback) {
        return this.props.fallback
      }

      // UI de error por defecto
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-8">
              <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                ¡Ups! Algo salió mal
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Ha ocurrido un error inesperado. Por favor, intenta de nuevo.
              </p>
            </div>

            <div className="space-y-4">
              <Button
                onClick={this.handleRetry}
                leftIcon={<ArrowPathIcon className="h-5 w-5" />}
                fullWidth
              >
                Intentar de nuevo
              </Button>
              
              <Button
                variant="outline"
                onClick={this.handleReload}
                fullWidth
              >
                Recargar página
              </Button>
            </div>

            {/* Mostrar detalles del error en desarrollo */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-8 text-left">
                <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Detalles del error (desarrollo)
                </summary>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-xs">
                  <div className="mb-4">
                    <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">
                      Error:
                    </h4>
                    <pre className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  
                  {this.state.errorInfo && (
                    <div>
                      <h4 className="font-semibold text-red-600 dark:text-red-400 mb-2">
                        Stack trace:
                      </h4>
                      <pre className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook para capturar errores en componentes funcionales
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const captureError = React.useCallback((error: Error) => {
    setError(error)
    console.error('Error captured by useErrorHandler:', error)
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return { captureError, resetError, hasError: !!error }
}

// Componente de error simple para casos específicos
export const ErrorMessage: React.FC<{
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}> = ({ 
  title = 'Error', 
  message = 'Ha ocurrido un error inesperado',
  onRetry,
  className = ''
}) => (
  <div className={`text-center py-8 ${className}`}>
    <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
      {title}
    </h3>
    <p className="text-gray-600 dark:text-gray-400 mb-4">
      {message}
    </p>
    {onRetry && (
      <Button
        onClick={onRetry}
        variant="outline"
        size="sm"
        leftIcon={<ArrowPathIcon className="h-4 w-4" />}
      >
        Intentar de nuevo
      </Button>
    )}
  </div>
)

// HOC para envolver componentes con error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

export default ErrorBoundary
