import React, { useEffect } from 'react'
import { useUI } from '@/hooks/useUI'
import { CogIcon } from '@heroicons/react/24/outline'

const SettingsPage: React.FC = () => {
  const { setCurrentPage, addBreadcrumb } = useUI()

  useEffect(() => {
    setCurrentPage('settings')
    addBreadcrumb({ label: 'Configuración', path: '/settings' })
  }, [setCurrentPage, addBreadcrumb])

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Encabezado */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Configuración
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Personaliza tu experiencia en la plataforma
          </p>
        </div>

        {/* Contenido temporal */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-12 text-center">
            <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Próximamente
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              La página de configuración estará disponible próximamente
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
