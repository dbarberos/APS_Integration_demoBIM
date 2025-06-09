import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  BellIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { useWebSocketSubscription, useWebSocket } from './WebSocketProvider'
import { useUI } from '@/hooks/useUI'
import { clsx } from 'clsx'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info' | 'progress'
  title: string
  message?: string
  progress?: number
  duration?: number // ms, 0 = persistent
  action?: {
    label: string
    onClick: () => void
  }
  data?: any
  timestamp: number
  read: boolean
  persistent?: boolean
}

export interface NotificationCenterProps {
  maxNotifications?: number
  defaultDuration?: number
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
  className?: string
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  maxNotifications = 5,
  defaultDuration = 5000,
  position = 'top-right',
  className = ''
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const { showSuccessToast, showErrorToast, showWarningToast, showInfoToast } = useUI()
  const { isConnected } = useWebSocket()

  // Limpiar timeouts
  const clearNotificationTimeout = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutsRef.current.delete(id)
    }
  }, [])

  // Agregar notificación
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      read: false,
      duration: notification.duration ?? defaultDuration
    }

    setNotifications(prev => {
      const updated = [newNotification, ...prev]
      // Mantener solo las últimas notificaciones
      return updated.slice(0, maxNotifications)
    })

    // Programar auto-eliminación si no es persistente
    if (newNotification.duration > 0) {
      const timeout = setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
      timeoutsRef.current.set(id, timeout)
    }

    // También mostrar como toast para notificaciones importantes
    if (!notification.persistent) {
      switch (notification.type) {
        case 'success':
          showSuccessToast(notification.title, notification.message)
          break
        case 'error':
          showErrorToast(notification.title, notification.message)
          break
        case 'warning':
          showWarningToast(notification.title, notification.message)
          break
        case 'info':
          showInfoToast(notification.title, notification.message)
          break
      }
    }

    return id
  }, [defaultDuration, maxNotifications, showSuccessToast, showErrorToast, showWarningToast, showInfoToast])

  // Remover notificación
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    clearNotificationTimeout(id)
  }, [clearNotificationTimeout])

  // Marcar como leída
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
  }, [])

  // Actualizar progreso de notificación
  const updateProgress = useCallback((id: string, progress: number) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, progress } : n
    ))
  }, [])

  // Limpiar todas las notificaciones
  const clearAll = useCallback(() => {
    notifications.forEach(n => clearNotificationTimeout(n.id))
    setNotifications([])
  }, [notifications, clearNotificationTimeout])

  // Marcar todas como leídas
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  // Suscripciones a eventos WebSocket
  useWebSocketSubscription('notification', (data) => {
    addNotification(data)
  })

  useWebSocketSubscription('file_upload_progress', (data) => {
    const existingId = notifications.find(n => 
      n.data?.type === 'file_upload' && n.data?.fileId === data.fileId
    )?.id

    if (existingId) {
      updateProgress(existingId, data.progress)
      if (data.progress >= 100) {
        setTimeout(() => removeNotification(existingId), 2000)
      }
    } else {
      addNotification({
        type: 'progress',
        title: 'Subiendo archivo',
        message: data.fileName,
        progress: data.progress,
        duration: 0, // Persistente hasta completar
        data: { type: 'file_upload', fileId: data.fileId }
      })
    }
  })

  useWebSocketSubscription('translation_progress', (data) => {
    const existingId = notifications.find(n => 
      n.data?.type === 'translation' && n.data?.jobId === data.jobId
    )?.id

    if (existingId) {
      updateProgress(existingId, data.progress)
      if (data.status === 'success') {
        removeNotification(existingId)
        addNotification({
          type: 'success',
          title: 'Traducción completada',
          message: data.fileName,
          action: {
            label: 'Ver modelo',
            onClick: () => {
              window.location.href = `/viewer/${data.urn}`
            }
          }
        })
      } else if (data.status === 'failed') {
        removeNotification(existingId)
        addNotification({
          type: 'error',
          title: 'Error en traducción',
          message: data.fileName,
          action: {
            label: 'Reintentar',
            onClick: () => {
              // Lógica para reintentar traducción
            }
          }
        })
      }
    } else if (data.status === 'inprogress') {
      addNotification({
        type: 'progress',
        title: 'Traduciendo modelo',
        message: data.fileName,
        progress: data.progress,
        duration: 0, // Persistente hasta completar
        data: { type: 'translation', jobId: data.jobId }
      })
    }
  })

  // Obtener icono por tipo
  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />
      case 'error':
        return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
      case 'info':
        return <InformationCircleIcon className="w-5 h-5 text-blue-500" />
      case 'progress':
        return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />
      default:
        return <BellIcon className="w-5 h-5 text-gray-500" />
    }
  }

  // Obtener clases de posición
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4'
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2'
      case 'top-right':
        return 'top-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2'
      case 'bottom-right':
        return 'bottom-4 right-4'
      default:
        return 'top-4 right-4'
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout))
    }
  }, [])

  return (
    <>
      {/* Botón del notification center */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          title="Notificaciones"
        >
          <BellIcon className="w-6 h-6" />
          
          {/* Indicador de conexión */}
          <div className={clsx(
            'absolute -top-1 -left-1 w-3 h-3 rounded-full',
            isConnected ? 'bg-green-500' : 'bg-red-500'
          )} />
          
          {/* Badge de notificaciones no leídas */}
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>

        {/* Panel de notificaciones */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Notificaciones
                </h3>
                <div className="flex space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Marcar todas como leídas
                    </button>
                  )}
                  <button
                    onClick={clearAll}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
              
              {/* Estado de conexión */}
              <div className="flex items-center mt-2">
                <div className={clsx(
                  'w-2 h-2 rounded-full mr-2',
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                )} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </div>

            {/* Lista de notificaciones */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <BellIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay notificaciones</p>
                </div>
              ) : (
                <div className="p-2">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={clsx(
                        'p-3 mb-2 rounded-lg border transition-colors cursor-pointer',
                        notification.read
                          ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 shadow-sm'
                      )}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Icono */}
                        <div className="flex-shrink-0 mt-0.5">
                          {getIcon(notification.type)}
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {notification.title}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeNotification(notification.id)
                              }}
                              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>

                          {notification.message && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                              {notification.message}
                            </p>
                          )}

                          {/* Barra de progreso */}
                          {notification.type === 'progress' && notification.progress !== undefined && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <span>Progreso</span>
                                <span>{Math.round(notification.progress)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                                <div
                                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${notification.progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Acción */}
                          {notification.action && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                notification.action!.onClick()
                                removeNotification(notification.id)
                              }}
                              className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              {notification.action.label}
                            </button>
                          )}

                          {/* Timestamp */}
                          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                            {new Date(notification.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Overlay para cerrar */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Notificaciones flotantes */}
      <div className={clsx('fixed z-50 space-y-4', getPositionClasses(), className)}>
        {notifications
          .filter(n => n.persistent && !n.read)
          .slice(0, 3) // Mostrar máximo 3 flotantes
          .map(notification => (
            <div
              key={notification.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm transform transition-all duration-300 ease-in-out"
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {notification.title}
                  </h4>
                  {notification.message && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {notification.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
      </div>
    </>
  )
}

// Hook para usar notificaciones
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      read: false
    }

    setNotifications(prev => [newNotification, ...prev])
    return id
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll
  }
}

export default NotificationCenter
