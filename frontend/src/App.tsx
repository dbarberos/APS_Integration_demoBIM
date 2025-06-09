/**
 * Aplicación principal React para integración con Autodesk Platform Services
 */
import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'

import { store } from '@/store/store'
import Layout from '@/components/layout/Layout'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import FilesPage from '@/pages/FilesPage'
import ProjectsPage from '@/pages/ProjectsPage'
import ViewerPage from '@/pages/ViewerPage'
import TranslationsPage from '@/pages/TranslationsPage'
import SettingsPage from '@/pages/SettingsPage'
import ProfilePage from '@/pages/ProfilePage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { GlobalLoaderProvider } from '@/components/ui/GlobalLoader'
import { WebSocketProvider } from '@/components/realtime/WebSocketProvider'
import NotificationCenter from '@/components/realtime/NotificationCenter'

import '@/index.css'

// Configuración de React Query para caché optimizado
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // No reintentar en errores 4xx (excepto 429 - rate limit)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return error?.response?.status === 429 && failureCount < 3
        }
        // Reintentar hasta 3 veces para errores de servidor/red
        return failureCount < 3
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutos antes de considerar datos obsoletos
      cacheTime: 10 * 60 * 1000, // 10 minutos en caché
      refetchOnWindowFocus: false,
      refetchOnMount: 'always',
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // No reintentar mutations en errores de cliente
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false
        }
        return failureCount < 2
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
})

function App() {
  useEffect(() => {
    // Configurar título de la aplicación
    document.title = 'APS Integration Platform'
    
    // Aplicar tema inicial basado en preferencias del sistema
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) {
      document.documentElement.classList.add('dark')
    }

    // Configurar variables CSS para tema dinámico
    const updateThemeVariables = () => {
      const isDark = document.documentElement.classList.contains('dark')
      const root = document.documentElement.style

      if (isDark) {
        root.setProperty('--toast-bg', '#374151')
        root.setProperty('--toast-color', '#f9fafb')
        root.setProperty('--toast-border', '#4b5563')
      } else {
        root.setProperty('--toast-bg', '#ffffff')
        root.setProperty('--toast-color', '#111827')
        root.setProperty('--toast-border', '#d1d5db')
      }
    }

    // Observar cambios en el tema
    const observer = new MutationObserver(updateThemeVariables)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    updateThemeVariables()

    // Manejar errores no capturados globalmente
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
      // Aquí se podría enviar a un servicio de logging como Sentry
    }

    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error)
      // Aquí se podría enviar a un servicio de logging como Sentry
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    return () => {
      observer.disconnect()
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [])

  return (
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <GlobalLoaderProvider>
            <WebSocketProvider
              reconnectInterval={3000}
              maxReconnectAttempts={5}
              heartbeatInterval={30000}
              debug={process.env.NODE_ENV === 'development'}
            >
              <Router>
                <div className="App min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
                  <Routes>
                    {/* Rutas públicas */}
                    <Route path="/auth" element={<LoginPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    
                    {/* Rutas protegidas */}
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <Layout />
                        </ProtectedRoute>
                      }
                    >
                      {/* Dashboard */}
                      <Route index element={<HomePage />} />
                      
                      {/* Gestión de archivos */}
                      <Route path="files" element={<FilesPage />} />
                      <Route path="files/upload" element={<FilesPage />} />
                      <Route path="files/:id" element={<FilesPage />} />
                      
                      {/* Proyectos */}
                      <Route path="projects" element={<ProjectsPage />} />
                      <Route path="projects/:id" element={<ProjectsPage />} />
                      
                      {/* Viewer */}
                      <Route path="viewer" element={<ViewerPage />} />
                      <Route path="viewer/:urn" element={<ViewerPage />} />
                      <Route path="view/:urn" element={<ViewerPage />} />
                      
                      {/* Traducciones */}
                      <Route path="translations" element={<TranslationsPage />} />
                      <Route path="translations/:id" element={<TranslationsPage />} />
                      <Route path="jobs" element={<TranslationsPage />} />
                      <Route path="jobs/:id" element={<TranslationsPage />} />
                      
                      {/* Configuración y perfil */}
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="account" element={<ProfilePage />} />
                      <Route path="settings" element={<SettingsPage />} />
                      <Route path="config" element={<SettingsPage />} />
                    </Route>
                    
                    {/* Ruta 404 */}
                    <Route path="*" element={
                      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                        <div className="text-center">
                          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            404
                          </h1>
                          <p className="text-gray-600 dark:text-gray-400 mb-8">
                            Página no encontrada
                          </p>
                          <a
                            href="/"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Ir al inicio
                          </a>
                        </div>
                      </div>
                    } />
                  </Routes>
                  
                  {/* Componentes globales */}
                  <Toaster
                    position="top-right"
                    containerClassName="z-50"
                    toastOptions={{
                      duration: 4000,
                      className: 'dark:bg-gray-800 dark:text-white',
                      style: {
                        background: 'var(--toast-bg)',
                        color: 'var(--toast-color)',
                        border: '1px solid var(--toast-border)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        maxWidth: '400px',
                      },
                      success: {
                        duration: 3000,
                        iconTheme: {
                          primary: '#10b981',
                          secondary: '#fff',
                        },
                      },
                      error: {
                        duration: 6000,
                        iconTheme: {
                          primary: '#ef4444',
                          secondary: '#fff',
                        },
                      },
                      loading: {
                        duration: Infinity,
                        iconTheme: {
                          primary: '#3b82f6',
                          secondary: '#fff',
                        },
                      },
                    }}
                  />
                  
                  {/* Centro de notificaciones */}
                  <NotificationCenter 
                    maxNotifications={10}
                    defaultDuration={5000}
                    position="top-right"
                  />
                  
                  {/* Loading global overlay */}
                  <React.Suspense fallback={<LoadingSpinner />}>
                    {/* Componentes lazy-loaded se renderizan aquí */}
                  </React.Suspense>
                </div>
              </Router>
              
              {/* React Query Devtools (solo en desarrollo) */}
              {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools 
                  initialIsOpen={false} 
                  position="bottom-right"
                />
              )}
            </WebSocketProvider>
          </GlobalLoaderProvider>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  )
}

export default App