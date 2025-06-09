import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { 
  HomeIcon,
  FolderIcon,
  DocumentIcon,
  ArrowPathIcon,
  EyeIcon,
  CogIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import { 
  HomeIcon as HomeIconSolid,
  FolderIcon as FolderIconSolid,
  DocumentIcon as DocumentIconSolid,
  ArrowPathIcon as ArrowPathIconSolid,
  EyeIcon as EyeIconSolid,
  CogIcon as CogIconSolid,
  UserIcon as UserIconSolid
} from '@heroicons/react/24/solid'
import { useSidebar } from '@/hooks/redux'
import { useUI } from '@/hooks/useUI'
import { useAuth } from '@/hooks/useAuth'
import { clsx } from 'clsx'

// Configuración de navegación
const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: HomeIcon,
    iconSolid: HomeIconSolid,
    count: null,
  },
  {
    name: 'Proyectos',
    href: '/projects',
    icon: FolderIcon,
    iconSolid: FolderIconSolid,
    count: null,
  },
  {
    name: 'Archivos',
    href: '/files',
    icon: DocumentIcon,
    iconSolid: DocumentIconSolid,
    count: null,
  },
  {
    name: 'Traducciones',
    href: '/translations',
    icon: ArrowPathIcon,
    iconSolid: ArrowPathIconSolid,
    count: null,
  },
  {
    name: 'Viewer',
    href: '/viewer',
    icon: EyeIcon,
    iconSolid: EyeIconSolid,
    count: null,
    disabled: true, // Se habilita cuando hay un modelo para ver
  },
]

const secondaryNavigation = [
  {
    name: 'Perfil',
    href: '/profile',
    icon: UserIcon,
    iconSolid: UserIconSolid,
  },
  {
    name: 'Configuración',
    href: '/settings',
    icon: CogIcon,
    iconSolid: CogIconSolid,
  },
]

const Sidebar: React.FC = () => {
  const location = useLocation()
  const { collapsed } = useSidebar()
  const { toggleSidebar } = useUI()
  const { user } = useAuth()

  const isCurrentPath = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  return (
    <>
      {/* Sidebar para desktop */}
      <div className={clsx(
        'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-10',
        'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700',
        'transition-all duration-200 ease-in-out',
        collapsed ? 'lg:w-16' : 'lg:w-64'
      )}>
        {/* Header del sidebar */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">APS</span>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                APS Platform
              </span>
            </div>
          )}
          
          {collapsed && (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">APS</span>
            </div>
          )}
          
          {!collapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navegación principal */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const current = isCurrentPath(item.href)
            const Icon = current ? item.iconSolid : item.icon
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={clsx(
                  'group flex items-center rounded-md text-sm font-medium transition-colors',
                  collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2',
                  current
                    ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700',
                  item.disabled && 'opacity-50 cursor-not-allowed'
                )}
                onClick={(e) => item.disabled && e.preventDefault()}
              >
                <Icon
                  className={clsx(
                    'flex-shrink-0',
                    collapsed ? 'h-6 w-6' : 'h-5 w-5 mr-3',
                    current
                      ? 'text-blue-600 dark:text-blue-300'
                      : 'text-gray-400 group-hover:text-gray-500'
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="truncate">{item.name}</span>
                    {item.count && (
                      <span className="ml-auto min-w-max bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">
                        {item.count}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Navegación secundaria */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-2 py-4 space-y-1">
          {secondaryNavigation.map((item) => {
            const current = isCurrentPath(item.href)
            const Icon = current ? item.iconSolid : item.icon
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={clsx(
                  'group flex items-center rounded-md text-sm font-medium transition-colors',
                  collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2',
                  current
                    ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <Icon
                  className={clsx(
                    'flex-shrink-0',
                    collapsed ? 'h-6 w-6' : 'h-5 w-5 mr-3',
                    current
                      ? 'text-blue-600 dark:text-blue-300'
                      : 'text-gray-400 group-hover:text-gray-500'
                  )}
                />
                {!collapsed && (
                  <span className="truncate">{item.name}</span>
                )}
              </NavLink>
            )
          })}
        </div>

        {/* Usuario y botón para expandir cuando está colapsado */}
        {collapsed && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-2">
            <button
              onClick={toggleSidebar}
              className="w-full p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <ChevronRightIcon className="h-5 w-5 mx-auto" />
            </button>
          </div>
        )}

        {/* Información del usuario */}
        {!collapsed && user && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {user.first_name?.[0]}{user.last_name?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar móvil (se implementaría con un overlay) */}
      {/* Por ahora solo mostramos el desktop sidebar */}
    </>
  )
}

export default Sidebar
