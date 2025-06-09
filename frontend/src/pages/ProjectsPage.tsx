import React, { useEffect } from 'react'
import { useUI } from '@/hooks/useUI'
import { FolderIcon, PlusIcon } from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'

const ProjectsPage: React.FC = () => {
  const { setCurrentPage, addBreadcrumb } = useUI()

  useEffect(() => {
    setCurrentPage('projects')
    addBreadcrumb({ label: 'Proyectos', path: '/projects' })
  }, [setCurrentPage, addBreadcrumb])

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Proyectos
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Organiza tus archivos y traducciones en proyectos
              </p>
            </div>
            <Button
              leftIcon={<PlusIcon className="h-5 w-5" />}
              size="lg"
            >
              Nuevo Proyecto
            </Button>
          </div>
        </div>

        {/* Contenido temporal */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-12 text-center">
            <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Próximamente
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              La gestión completa de proyectos estará disponible próximamente
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectsPage
