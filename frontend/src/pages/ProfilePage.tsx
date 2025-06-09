import React, { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useUI } from '@/hooks/useUI'
import { UserIcon } from '@heroicons/react/24/outline'

const ProfilePage: React.FC = () => {
  const { user } = useAuth()
  const { setCurrentPage, addBreadcrumb } = useUI()

  useEffect(() => {
    setCurrentPage('profile')
    addBreadcrumb({ label: 'Mi Perfil', path: '/profile' })
  }, [setCurrentPage, addBreadcrumb])

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Encabezado */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Mi Perfil
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Gestiona tu información personal y preferencias
          </p>
        </div>

        {/* Información del usuario */}
        {user && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Información Personal
              </h2>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center space-x-6">
                <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-xl font-medium text-gray-700 dark:text-gray-200">
                    {user.first_name?.[0]}{user.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {user.first_name} {user.last_name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user.is_superuser ? 'Administrador' : 'Usuario'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contenido temporal */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-12 text-center">
            <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Próximamente
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              La edición completa del perfil estará disponible próximamente
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
