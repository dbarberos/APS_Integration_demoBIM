import React, { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermissions?: string[]
  adminOnly?: boolean
  fallback?: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  adminOnly = false,
  fallback
}) => {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  // Mostrar loading mientras se verifica la autenticación
  if (isLoading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" text="Verificando autenticación..." />
      </div>
    )
  }

  // Redirigir al login si no está autenticado
  if (!isAuthenticated || !user) {
    return (
      <Navigate 
        to="/auth" 
        state={{ from: location.pathname }}
        replace 
      />
    )
  }

  // Verificar si el usuario está activo
  if (!user.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md text-center">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-yellow-100 dark:bg-yellow-900/40 rounded-full">
              <svg
                className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Cuenta no activada
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Tu cuenta no ha sido activada aún. Por favor, verifica tu email o contacta al administrador.
            </p>
            <button
              onClick={() => window.location.href = '/auth'}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Volver al login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Verificar si se requieren permisos de administrador
  if (adminOnly && !user.is_superuser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md text-center">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/40 rounded-full">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Acceso denegado
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No tienes permisos suficientes para acceder a esta página.
            </p>
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Volver atrás
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Verificar permisos específicos (implementación futura)
  if (requiredPermissions.length > 0) {
    // Aquí se implementaría la lógica de permisos específicos
    // Por ahora, solo verificamos si es usuario activo
    const hasRequiredPermissions = user.is_active
    
    if (!hasRequiredPermissions) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md text-center">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-orange-100 dark:bg-orange-900/40 rounded-full">
                <svg
                  className="w-6 h-6 text-orange-600 dark:text-orange-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Permisos insuficientes
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No tienes los permisos necesarios para acceder a esta funcionalidad.
              </p>
              <div className="space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Permisos requeridos: {requiredPermissions.join(', ')}
                </p>
              </div>
              <button
                onClick={() => window.history.back()}
                className="mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Volver atrás
              </button>
            </div>
          </div>
        </div>
      )
    }
  }

  // Si todas las verificaciones pasan, renderizar los children
  return <>{children}</>
}

// Hook para verificar permisos en componentes
export const usePermissions = () => {
  const { user } = useAuth()

  const hasPermission = React.useCallback((permission: string): boolean => {
    if (!user) return false
    
    // Implementar lógica de permisos específica
    // Por ahora, solo verificamos si es usuario activo
    return user.is_active
  }, [user])

  const hasAnyPermission = React.useCallback((permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission))
  }, [hasPermission])

  const hasAllPermissions = React.useCallback((permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission))
  }, [hasPermission])

  const isAdmin = React.useCallback((): boolean => {
    return user?.is_superuser || false
  }, [user])

  const canCreate = React.useCallback((): boolean => {
    return user?.is_active || false
  }, [user])

  const canEdit = React.useCallback((): boolean => {
    return user?.is_active || false
  }, [user])

  const canDelete = React.useCallback((): boolean => {
    return user?.is_superuser || false
  }, [user])

  return {
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    canCreate,
    canEdit,
    canDelete,
  }
}

// Componente para mostrar contenido condicionalmente basado en permisos
export const PermissionGate: React.FC<{
  permissions?: string[]
  adminOnly?: boolean
  fallback?: React.ReactNode
  children: React.ReactNode
}> = ({ permissions = [], adminOnly = false, fallback = null, children }) => {
  const { hasAllPermissions, isAdmin } = usePermissions()

  // Verificar permisos de administrador
  if (adminOnly && !isAdmin()) {
    return <>{fallback}</>
  }

  // Verificar permisos específicos
  if (permissions.length > 0 && !hasAllPermissions(permissions)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export default ProtectedRoute
