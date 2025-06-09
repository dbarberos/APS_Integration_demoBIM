import React from 'react'
import { clsx } from 'clsx'

export interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'white' | 'gray'
  overlay?: boolean
  text?: string
  className?: string
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16'
}

const colorClasses = {
  primary: 'text-blue-600',
  secondary: 'text-gray-600',
  white: 'text-white',
  gray: 'text-gray-400'
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  overlay = false,
  text,
  className
}) => {
  const spinner = (
    <div className={clsx(
      'flex items-center justify-center',
      overlay && 'min-h-[200px]',
      className
    )}>
      <div className="flex flex-col items-center space-y-3">
        <svg
          className={clsx(
            'animate-spin',
            sizeClasses[size],
            colorClasses[color]
          )}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        
        {text && (
          <p className={clsx(
            'text-sm font-medium',
            color === 'white' ? 'text-white' : 'text-gray-600 dark:text-gray-400'
          )}>
            {text}
          </p>
        )}
      </div>
    </div>
  )

  if (overlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
          {spinner}
        </div>
      </div>
    )
  }

  return spinner
}

// Componente específico para carga de página completa
export const FullPageLoader: React.FC<{ text?: string }> = ({ text = 'Cargando...' }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <LoadingSpinner size="lg" text={text} />
  </div>
)

// Componente para carga inline
export const InlineLoader: React.FC<{ text?: string; size?: LoadingSpinnerProps['size'] }> = ({ 
  text, 
  size = 'sm' 
}) => (
  <div className="flex items-center space-x-2">
    <LoadingSpinner size={size} />
    {text && (
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {text}
      </span>
    )}
  </div>
)

// Componente para botones con carga
export const ButtonLoader: React.FC = () => (
  <LoadingSpinner size="xs" color="white" />
)

// Componente para tablas con carga
export const TableLoader: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="animate-pulse">
        <div className="flex space-x-4">
          <div className="rounded-full bg-gray-300 dark:bg-gray-600 h-10 w-10"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
)

// Componente para tarjetas con carga
export const CardLoader: React.FC = () => (
  <div className="animate-pulse">
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="space-y-4">
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
        </div>
        <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
      </div>
    </div>
  </div>
)

// Componente para grid de tarjetas
export const GridLoader: React.FC<{ items?: number }> = ({ items = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: items }).map((_, index) => (
      <CardLoader key={index} />
    ))}
  </div>
)

// Componente para contenido de texto
export const TextLoader: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="animate-pulse space-y-2">
    {Array.from({ length: lines }).map((_, index) => (
      <div
        key={index}
        className={clsx(
          'h-4 bg-gray-300 dark:bg-gray-600 rounded',
          index === lines - 1 ? 'w-3/4' : 'w-full'
        )}
      />
    ))}
  </div>
)

// Hook para mostrar loader global
export const useGlobalLoader = () => {
  const [isLoading, setIsLoading] = React.useState(false)

  const showLoader = React.useCallback(() => setIsLoading(true), [])
  const hideLoader = React.useCallback(() => setIsLoading(false), [])

  return {
    isLoading,
    showLoader,
    hideLoader,
    LoaderComponent: isLoading ? (
      <LoadingSpinner overlay text="Procesando..." />
    ) : null
  }
}

export default LoadingSpinner
