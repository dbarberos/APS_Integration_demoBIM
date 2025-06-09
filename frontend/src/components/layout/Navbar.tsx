import React, { Fragment } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Disclosure, Menu, Transition } from '@headlessui/react'
import { 
  Bars3Icon, 
  XMarkIcon,
  BellIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '@/hooks/useAuth'
import { useUI } from '@/hooks/useUI'
import { useNotifications, useTheme } from '@/hooks/redux'
import Button from '@/components/ui/Button'
import { formatRelativeTime } from '@/utils/format'
import { clsx } from 'clsx'

// Configuración de navegación
const navigation = [
  { name: 'Dashboard', href: '/', current: false },
  { name: 'Archivos', href: '/files', current: false },
  { name: 'Proyectos', href: '/projects', current: false },
  { name: 'Traducciones', href: '/translations', current: false },
]

const userNavigation = [
  { name: 'Mi Perfil', href: '/profile', icon: UserCircleIcon },
  { name: 'Configuración', href: '/settings', icon: CogIcon },
]

interface NavbarProps {
  onMobileMenuToggle?: () => void
  showMobileMenu?: boolean
}

const Navbar: React.FC<NavbarProps> = ({ 
  onMobileMenuToggle,
  showMobileMenu = false 
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { 
    toggleGlobalSearch, 
    setTheme,
    showSuccessToast 
  } = useUI()
  const { notifications, unreadCount } = useNotifications()
  const { theme } = useTheme()

  // Determinar si una ruta está activa
  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  // Actualizar estado activo de navegación
  const updatedNavigation = navigation.map(item => ({
    ...item,
    current: isActiveRoute(item.href)
  }))

  const handleLogout = async () => {
    try {
      await logout()
      showSuccessToast('Sesión cerrada correctamente')
      navigate('/auth')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'dark':
        return <MoonIcon className="h-5 w-5" />
      case 'light':
        return <SunIcon className="h-5 w-5" />
      case 'system':
      default:
        return <ComputerDesktopIcon className="h-5 w-5" />
    }
  }

  return (
    <Disclosure as="nav" className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between">
              {/* Logo y navegación principal */}
              <div className="flex">
                {/* Logo */}
                <div className="flex flex-shrink-0 items-center">
                  <Link to="/" className="flex items-center space-x-2">
                    <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">APS</span>
                    </div>
                    <span className="hidden sm:block text-xl font-semibold text-gray-900 dark:text-white">
                      APS Platform
                    </span>
                  </Link>
                </div>

                {/* Navegación desktop */}
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  {updatedNavigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={clsx(
                        item.current
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white',
                        'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition-colors'
                      )}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Acciones del lado derecho */}
              <div className="flex items-center space-x-4">
                {/* Búsqueda global */}
                <button
                  onClick={toggleGlobalSearch}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                >
                  <MagnifyingGlassIcon className="h-5 w-5" />
                  <span className="hidden sm:inline">Buscar...</span>
                  <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">
                    ⌘K
                  </kbd>
                </button>

                {/* Notificaciones */}
                <Menu as="div" className="relative">
                  <Menu.Button className="relative rounded-full p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                    <span className="sr-only">Ver notificaciones</span>
                    <BellIcon className="h-6 w-6" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 block h-4 w-4 rounded-full bg-red-400 text-center text-xs font-medium leading-4 text-white">
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
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
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
                                  className={clsx(
                                    active ? 'bg-gray-50 dark:bg-gray-700' : '',
                                    !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : '',
                                    'px-4 py-3 cursor-pointer'
                                  )}
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
                          <Link
                            to="/notifications"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                          >
                            Ver todas las notificaciones
                          </Link>
                        </div>
                      )}
                    </Menu.Items>
                  </Transition>
                </Menu>

                {/* Selector de tema */}
                <Menu as="div" className="relative">
                  <Menu.Button className="rounded-full p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                    <span className="sr-only">Cambiar tema</span>
                    {getThemeIcon()}
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
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-36 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={() => handleThemeChange('light')}
                            className={clsx(
                              active ? 'bg-gray-100 dark:bg-gray-700' : '',
                              theme === 'light' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200',
                              'flex w-full items-center px-4 py-2 text-sm'
                            )}
                          >
                            <SunIcon className="mr-3 h-4 w-4" />
                            Claro
                          </button>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={() => handleThemeChange('dark')}
                            className={clsx(
                              active ? 'bg-gray-100 dark:bg-gray-700' : '',
                              theme === 'dark' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200',
                              'flex w-full items-center px-4 py-2 text-sm'
                            )}
                          >
                            <MoonIcon className="mr-3 h-4 w-4" />
                            Oscuro
                          </button>
                        )}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={() => handleThemeChange('system')}
                            className={clsx(
                              active ? 'bg-gray-100 dark:bg-gray-700' : '',
                              theme === 'system' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200',
                              'flex w-full items-center px-4 py-2 text-sm'
                            )}
                          >
                            <ComputerDesktopIcon className="mr-3 h-4 w-4" />
                            Sistema
                          </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>

                {/* Menú de usuario */}
                <Menu as="div" className="relative">
                  <div>
                    <Menu.Button className="flex max-w-xs items-center rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                      <span className="sr-only">Abrir menú de usuario</span>
                      <div className="flex items-center space-x-3">
                        <div className="hidden sm:flex sm:flex-col sm:items-end">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            {user?.first_name} {user?.last_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {user?.email}
                          </p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            {user?.first_name?.[0]}{user?.last_name?.[0]}
                          </span>
                        </div>
                      </div>
                    </Menu.Button>
                  </div>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      {userNavigation.map((item) => (
                        <Menu.Item key={item.name}>
                          {({ active }) => (
                            <Link
                              to={item.href}
                              className={clsx(
                                active ? 'bg-gray-100 dark:bg-gray-700' : '',
                                'flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200'
                              )}
                            >
                              <item.icon className="mr-3 h-4 w-4 text-gray-400" />
                              {item.name}
                            </Link>
                          )}
                        </Menu.Item>
                      ))}
                      <div className="border-t border-gray-100 dark:border-gray-600"></div>
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleLogout}
                            className={clsx(
                              active ? 'bg-gray-100 dark:bg-gray-700' : '',
                              'flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200'
                            )}
                          >
                            <ArrowRightOnRectangleIcon className="mr-3 h-4 w-4 text-gray-400" />
                            Cerrar sesión
                          </button>
                        )}
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>

                {/* Botón de menú móvil */}
                <div className="flex items-center sm:hidden">
                  <Disclosure.Button
                    className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                    onClick={onMobileMenuToggle}
                  >
                    <span className="sr-only">Abrir menú principal</span>
                    {open ? (
                      <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                    )}
                  </Disclosure.Button>
                </div>
              </div>
            </div>
          </div>

          {/* Menú móvil */}
          <Disclosure.Panel className="sm:hidden">
            <div className="space-y-1 pb-3 pt-2">
              {updatedNavigation.map((item) => (
                <Disclosure.Button
                  key={item.name}
                  as={Link}
                  to={item.href}
                  className={clsx(
                    item.current
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
                    'block border-l-4 py-2 pl-3 pr-4 text-base font-medium'
                  )}
                >
                  {item.name}
                </Disclosure.Button>
              ))}
            </div>
            
            {/* Información del usuario en móvil */}
            <div className="border-t border-gray-200 dark:border-gray-600 pb-3 pt-4">
              <div className="flex items-center px-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {user?.first_name?.[0]}{user?.last_name?.[0]}
                    </span>
                  </div>
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800 dark:text-gray-200">
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {user?.email}
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {userNavigation.map((item) => (
                  <Disclosure.Button
                    key={item.name}
                    as={Link}
                    to={item.href}
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    {item.name}
                  </Disclosure.Button>
                ))}
                <Disclosure.Button
                  as="button"
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                >
                  Cerrar sesión
                </Disclosure.Button>
              </div>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  )
}

export default Navbar
