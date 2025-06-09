import React from 'react'
import { 
  Bars3Icon, 
  BellIcon, 
  MagnifyingGlassIcon,
  UserCircleIcon,
  CogIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useUI } from '@/hooks/useUI'
import { useNotifications } from '@/hooks/redux'
import Button from '@/components/ui/Button'
import { formatRelativeTime } from '@/utils/format'

const Header: React.FC = () => {
  const { user, logout } = useAuth()
  const { toggleSidebar, toggleGlobalSearch } = useUI()
  const { notifications, unreadCount } = useNotifications()

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side */}
          <div className="flex items-center space-x-4">
            {/* Sidebar toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="lg:hidden"
            >
              <Bars3Icon className="h-6 w-6" />
            </Button>
            
            {/* Search trigger */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleGlobalSearch}
              className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
              <span className="hidden sm:inline text-sm">Buscar...</span>
              <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">
                ⌘K
              </kbd>
            </Button>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <Menu as="div" className="relative">
              <Menu.Button className="relative p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md">
                <BellIcon className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Menu.Button>
              
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Notificaciones
                      </h3>
                    </div>
                    
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                          No hay notificaciones
                        </div>
                      ) : (
                        notifications.slice(0, 5).map((notification) => (
                          <Menu.Item key={notification.id}>
                            {({ active }) => (
                              <div
                                className={`px-4 py-3 ${
                                  active ? 'bg-gray-50 dark:bg-gray-700' : ''
                                } ${!notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {notification.title}
                                    </p>
                                    {notification.message && (
                                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                        {notification.message}
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                      {formatRelativeTime(notification.timestamp)}
                                    </p>
                                  </div>
                                  {!notification.read && (
                                    <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Menu.Item>
                        ))
                      )}
                    </div>
                    
                    {notifications.length > 0 && (
                      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                        <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                          Ver todas las notificaciones
                        </button>
                      </div>
                    )}
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>

            {/* User menu */}
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center space-x-3 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                <span className="sr-only">Abrir menú de usuario</span>
                <div className="flex items-center space-x-3">
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.email}
                    </p>
                  </div>
                  <UserCircleIcon className="h-8 w-8 text-gray-400" />
                </div>
              </Menu.Button>
              
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <a
                          href="/profile"
                          className={`${
                            active ? 'bg-gray-100 dark:bg-gray-700' : ''
                          } flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                        >
                          <UserCircleIcon className="mr-3 h-5 w-5 text-gray-400" />
                          Mi perfil
                        </a>
                      )}
                    </Menu.Item>
                    
                    <Menu.Item>
                      {({ active }) => (
                        <a
                          href="/settings"
                          className={`${
                            active ? 'bg-gray-100 dark:bg-gray-700' : ''
                          } flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                        >
                          <CogIcon className="mr-3 h-5 w-5 text-gray-400" />
                          Configuración
                        </a>
                      )}
                    </Menu.Item>
                    
                    <div className="border-t border-gray-200 dark:border-gray-600"></div>
                    
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={logout}
                          className={`${
                            active ? 'bg-gray-100 dark:bg-gray-700' : ''
                          } flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 text-left`}
                        >
                          <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-gray-400" />
                          Cerrar sesión
                        </button>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
