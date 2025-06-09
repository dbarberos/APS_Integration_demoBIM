import React from 'react'
import { HeartIcon } from '@heroicons/react/24/solid'

const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-4">
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-4">
          <span>
            © 2024 APS Integration Platform. Todos los derechos reservados.
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          <span>Desarrollado con</span>
          <HeartIcon className="h-4 w-4 text-red-500" />
          <span>usando Autodesk Platform Services</span>
        </div>
      </div>
    </footer>
  )
}

export default Footer
