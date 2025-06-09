import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: number
  id?: string
}

export interface WebSocketContextType {
  isConnected: boolean
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'
  sendMessage: (message: WebSocketMessage) => void
  subscribe: (eventType: string, handler: (data: any) => void) => () => void
  lastMessage: WebSocketMessage | null
  error: string | null
  reconnect: () => void
  disconnect: () => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export interface WebSocketProviderProps {
  children: React.ReactNode
  url?: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  debug?: boolean
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  url = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
  heartbeatInterval = 30000,
  debug = false
}) => {
  const { user, token } = useAuth()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map())
  const reconnectAttemptsRef = useRef(0)

  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const log = useCallback((...args: any[]) => {
    if (debug) {
      console.log('[WebSocket]', ...args)
    }
  }, [debug])

  // Limpiar timeouts
  const clearTimeouts = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current)
      heartbeatTimeoutRef.current = null
    }
  }, [])

  // Configurar heartbeat
  const setupHeartbeat = useCallback(() => {
    clearTimeouts()
    
    if (heartbeatInterval > 0) {
      heartbeatTimeoutRef.current = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now()
          }))
          setupHeartbeat() // Programar siguiente heartbeat
        }
      }, heartbeatInterval)
    }
  }, [heartbeatInterval, clearTimeouts])

  // Conectar WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('Already connected')
      return
    }

    // Construir URL con autenticación
    const wsUrl = new URL(url)
    if (token) {
      wsUrl.searchParams.set('token', token)
    }
    if (user?.id) {
      wsUrl.searchParams.set('user_id', user.id)
    }

    log('Connecting to:', wsUrl.toString())
    setConnectionState('connecting')
    setError(null)

    try {
      const ws = new WebSocket(wsUrl.toString())
      wsRef.current = ws

      ws.onopen = (event) => {
        log('Connected', event)
        setIsConnected(true)
        setConnectionState('connected')
        setError(null)
        reconnectAttemptsRef.current = 0
        setupHeartbeat()

        // Enviar mensaje de identificación
        ws.send(JSON.stringify({
          type: 'identify',
          data: {
            user_id: user?.id,
            timestamp: Date.now()
          }
        }))
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          log('Message received:', message)
          
          setLastMessage(message)

          // Manejar mensaje de pong
          if (message.type === 'pong') {
            log('Pong received')
            return
          }

          // Notificar a suscriptores
          const subscribers = subscribersRef.current.get(message.type)
          if (subscribers) {
            subscribers.forEach(handler => {
              try {
                handler(message.data)
              } catch (error) {
                console.error('Error in WebSocket subscriber:', error)
              }
            })
          }

          // Notificar a suscriptores de todos los mensajes
          const allSubscribers = subscribersRef.current.get('*')
          if (allSubscribers) {
            allSubscribers.forEach(handler => {
              try {
                handler(message)
              } catch (error) {
                console.error('Error in WebSocket global subscriber:', error)
              }
            })
          }

        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        log('Connection closed:', event.code, event.reason)
        setIsConnected(false)
        setConnectionState('disconnected')
        clearTimeouts()

        // Intentar reconectar si no fue un cierre intencional
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          scheduleReconnect()
        }
      }

      ws.onerror = (event) => {
        log('WebSocket error:', event)
        setError('Error de conexión WebSocket')
        setConnectionState('error')
      }

    } catch (error: any) {
      log('Error creating WebSocket:', error)
      setError(error.message)
      setConnectionState('error')
    }
  }, [url, token, user, log, setupHeartbeat, clearTimeouts, maxReconnectAttempts])

  // Programar reconexión
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      log('Max reconnect attempts reached')
      setError('Máximo número de intentos de reconexión alcanzado')
      return
    }

    reconnectAttemptsRef.current++
    const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttemptsRef.current - 1), 30000)
    
    log(`Scheduling reconnect attempt ${reconnectAttemptsRef.current} in ${delay}ms`)
    
    reconnectTimeoutRef.current = setTimeout(() => {
      log(`Reconnect attempt ${reconnectAttemptsRef.current}`)
      connect()
    }, delay)
  }, [connect, reconnectInterval, maxReconnectAttempts, log])

  // Desconectar WebSocket
  const disconnect = useCallback(() => {
    log('Disconnecting')
    clearTimeouts()
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect')
      wsRef.current = null
    }
    
    setIsConnected(false)
    setConnectionState('disconnected')
    reconnectAttemptsRef.current = 0
  }, [clearTimeouts, log])

  // Reconectar manualmente
  const reconnect = useCallback(() => {
    log('Manual reconnect')
    disconnect()
    setTimeout(connect, 100)
  }, [disconnect, connect, log])

  // Enviar mensaje
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageWithId = {
        ...message,
        id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: message.timestamp || Date.now()
      }
      
      log('Sending message:', messageWithId)
      wsRef.current.send(JSON.stringify(messageWithId))
    } else {
      console.warn('WebSocket not connected, cannot send message:', message)
    }
  }, [log])

  // Suscribirse a eventos
  const subscribe = useCallback((eventType: string, handler: (data: any) => void) => {
    log('Subscribing to:', eventType)
    
    if (!subscribersRef.current.has(eventType)) {
      subscribersRef.current.set(eventType, new Set())
    }
    
    subscribersRef.current.get(eventType)!.add(handler)

    // Retornar función de desuscripción
    return () => {
      log('Unsubscribing from:', eventType)
      const subscribers = subscribersRef.current.get(eventType)
      if (subscribers) {
        subscribers.delete(handler)
        if (subscribers.size === 0) {
          subscribersRef.current.delete(eventType)
        }
      }
    }
  }, [log])

  // Efecto para conectar cuando el componente se monta y hay usuario autenticado
  useEffect(() => {
    if (user && token) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [user, token, connect, disconnect])

  // Efecto para manejar cambios de visibilidad de la página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        log('Page hidden, maintaining connection')
      } else {
        log('Page visible')
        // Verificar conexión cuando la página vuelve a ser visible
        if (!isConnected && user && token) {
          reconnect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isConnected, user, token, reconnect, log])

  // Efecto para manejar conexión/desconexión de red
  useEffect(() => {
    const handleOnline = () => {
      log('Network online')
      if (!isConnected && user && token) {
        reconnect()
      }
    }

    const handleOffline = () => {
      log('Network offline')
      setError('Sin conexión de red')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [isConnected, user, token, reconnect, log])

  const value: WebSocketContextType = {
    isConnected,
    connectionState,
    sendMessage,
    subscribe,
    lastMessage,
    error,
    reconnect,
    disconnect
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

// Hook para usar el WebSocket
export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

// Hook específico para suscribirse a eventos
export const useWebSocketSubscription = (
  eventType: string,
  handler: (data: any) => void,
  dependencies: React.DependencyList = []
) => {
  const { subscribe } = useWebSocket()

  useEffect(() => {
    const unsubscribe = subscribe(eventType, handler)
    return unsubscribe
  }, [subscribe, eventType, ...dependencies])
}

// Hook para enviar mensajes de forma simplificada
export const useWebSocketSender = () => {
  const { sendMessage, isConnected } = useWebSocket()

  const send = useCallback((type: string, data: any) => {
    if (isConnected) {
      sendMessage({ type, data, timestamp: Date.now() })
    } else {
      console.warn('WebSocket not connected, cannot send message')
    }
  }, [sendMessage, isConnected])

  return { send, isConnected }
}

export default WebSocketProvider
