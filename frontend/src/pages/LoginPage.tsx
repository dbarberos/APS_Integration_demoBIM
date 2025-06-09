import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import LoginForm from '@/components/auth/LoginForm'

const LoginPage: React.FC = () => {
  const location = useLocation()
  const { isAuthenticated } = useAuth()

  // Redirigir si ya está autenticado
  if (isAuthenticated) {
    const from = (location.state as any)?.from || '/'
    return <Navigate to={from} replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">APS</span>
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            APS Integration Platform
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Plataforma de integración con Autodesk Platform Services
          </p>
        </div>

        {/* Formulario de Login/Registro */}
        <LoginForm />

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Traducción y visualización de modelos CAD/BIM con tecnología APS
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
