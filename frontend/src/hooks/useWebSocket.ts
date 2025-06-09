import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'

export interface UseWebSocketOptions {
  url?: string
  protocols?: string | string[]
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  onOpen?: (event: Event) => void
  onMessage?: (event: MessageEvent) => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
  onReconnect?: (attempt: number) => void
  filter?: (message: any) => boolean
  parser?: (data: string) => any
  serializer?: (data: any) => string
  debug?: boolean
}

export interface UseWebSocketReturn {
  // Estados
  readyState: WebSocket['readyState']
  lastMessage: MessageEvent | null
  lastJsonMessage: any
  
  // Métodos
  sendMessage: (message: string | ArrayBufferLike | Blob | ArrayBufferView) => void
  sendJsonMessage: (message: any) => void
  getWebSocket: () => WebSocket | null
  
  // Control de conexión
  connect: () => void
  disconnect: () => void
  reconnect: () => void
  
  // Estados calculados
  isConnecting: boolean
  isConnected: boolean
  isDisconnected: boolean
  isError: boolean
  
  // Información adicional
  connectionAttempts: number
  error: string | null
}

const useWebSocket = (
  url: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn => {
  const {
    protocols,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000,
    onOpen,
    onMessage,
    onClose,
    onError,
    onReconnect,
    filter,
    parser = JSON.parse,
    serializer = JSON.stringify,
    debug = false
  } = options

  const { user, token } = useAuth()
  
  // Referencias
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionAttemptsRef = useRef(0)
  const mountedRef = useRef(true)
  
  // Estados
  const [readyState, setReadyState] = useState<WebSocket['readyState']>(WebSocket.CLOSED)
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null)
  const [lastJsonMessage, setLastJsonMessage] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Logging helper
  const log = useCallback((...args: any[]) => {
    if (debug) {
      console.log('[useWebSocket]', ...args)
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
    if (heartbeatInterval <= 0) return

    clearTimeouts()
    
    heartbeatTimeoutRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(serializer({ type: 'ping', timestamp: Date.now() }))
          log('Heartbeat sent')
          setupHeartbeat() // Programar siguiente heartbeat
        } catch (error) {
          log('Error sending heartbeat:', error)
        }
      }
    }, heartbeatInterval)
  }, [heartbeatInterval, serializer, log, clearTimeouts])

  // Conectar WebSocket
  const connect = useCallback(() => {
    if (!mountedRef.current) return
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('Already connected')
      return
    }

    try {
      // Construir URL con parámetros de autenticación
      const wsUrl = new URL(url, window.location.origin)
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      
      if (token) {
        wsUrl.searchParams.set('token', token)
      }
      if (user?.id) {
        wsUrl.searchParams.set('user_id', user.id)
      }

      log('Connecting to:', wsUrl.toString())
      setError(null)
      
      const ws = new WebSocket(wsUrl.toString(), protocols)
      wsRef.current = ws

      ws.onopen = (event) => {
        if (!mountedRef.current) return
        
        log('Connected')
        setReadyState(WebSocket.OPEN)
        setError(null)
        connectionAttemptsRef.current = 0
        setupHeartbeat()
        onOpen?.(event)
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return

        log('Message received:', event.data)
        setLastMessage(event)

        // Parsear JSON si es posible
        try {
          const jsonData = parser(event.data)
          
          // Aplicar filtro si está definido
          if (!filter || filter(jsonData)) {
            setLastJsonMessage(jsonData)
          }
          
          // Manejar pong de heartbeat
          if (jsonData?.type === 'pong') {
            log('Pong received')
            return
          }
          
        } catch (parseError) {
          log('Error parsing message:', parseError)
        }

        onMessage?.(event)
      }

      ws.onclose = (event) => {
        if (!mountedRef.current) return
        
        log('Connection closed:', event.code, event.reason)
        setReadyState(WebSocket.CLOSED)
        clearTimeouts()
        
        // Intentar reconectar si no fue un cierre intencional
        if (event.code !== 1000 && connectionAttemptsRef.current < maxReconnectAttempts) {
          scheduleReconnect()
        }
        
        onClose?.(event)
      }

      ws.onerror = (event) => {
        if (!mountedRef.current) return
        
        log('WebSocket error:', event)
        setError('Error de conexión WebSocket')
        onError?.(event)
      }

      // Actualizar readyState inmediatamente
      setReadyState(ws.readyState)

    } catch (error: any) {
      log('Error creating WebSocket:', error)
      setError(error.message)
      setReadyState(WebSocket.CLOSED)
    }
  }, [url, protocols, token, user, log, setupHeartbeat, onOpen, onMessage, onClose, onError, parser, filter, maxReconnectAttempts])

  // Programar reconexión
  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return
    
    if (connectionAttemptsRef.current >= maxReconnectAttempts) {
      log('Max reconnect attempts reached')
      setError('Máximo número de intentos de reconexión alcanzado')
      return
    }

    connectionAttemptsRef.current++
    const delay = Math.min(reconnectInterval * Math.pow(2, connectionAttemptsRef.current - 1), 30000)
    
    log(`Scheduling reconnect attempt ${connectionAttemptsRef.current} in ${delay}ms`)
    onReconnect?.(connectionAttemptsRef.current)
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        log(`Reconnect attempt ${connectionAttemptsRef.current}`)
        connect()
      }
    }, delay)
  }, [connect, reconnectInterval, maxReconnectAttempts, log, onReconnect])

  // Desconectar WebSocket
  const disconnect = useCallback(() => {
    log('Disconnecting')
    clearTimeouts()
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
    }
    
    setReadyState(WebSocket.CLOSED)
    connectionAttemptsRef.current = 0
  }, [clearTimeouts, log])

  // Reconectar manualmente
  const reconnect = useCallback(() => {
    log('Manual reconnect')
    disconnect()
    setTimeout(connect, 100)
  }, [disconnect, connect, log])

  // Enviar mensaje
  const sendMessage = useCallback((message: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(message)
        log('Message sent:', message)
      } catch (error) {
        log('Error sending message:', error)
        setError('Error al enviar mensaje')
      }
    } else {
      log('Cannot send message, WebSocket not connected')
      setError('WebSocket no conectado')
    }
  }, [log])

  // Enviar mensaje JSON
  const sendJsonMessage = useCallback((message: any) => {
    try {
      const serializedMessage = serializer(message)
      sendMessage(serializedMessage)
    } catch (error: any) {
      log('Error serializing message:', error)
      setError(`Error al serializar mensaje: ${error.message}`)
    }
  }, [sendMessage, serializer, log])

  // Obtener instancia de WebSocket
  const getWebSocket = useCallback(() => {
    return wsRef.current
  }, [])

  // Estados calculados
  const isConnecting = readyState === WebSocket.CONNECTING
  const isConnected = readyState === WebSocket.OPEN
  const isDisconnected = readyState === WebSocket.CLOSED
  const isError = readyState === WebSocket.CLOSED && !!error

  // Efecto para conectar cuando el componente se monta
  useEffect(() => {
    if (user && token && url) {
      connect()
    }

    return () => {
      mountedRef.current = false
      clearTimeouts()
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount')
      }
    }
  }, [user, token, url, connect, clearTimeouts])

  // Efecto para manejar cambios de URL
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('URL changed, reconnecting')
      reconnect()
    }
  }, [url, reconnect, log])

  // Efecto para limpiar al desmontar
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  return {
    // Estados
    readyState,
    lastMessage,
    lastJsonMessage,
    
    // Métodos
    sendMessage,
    sendJsonMessage,
    getWebSocket,
    
    // Control de conexión
    connect,
    disconnect,
    reconnect,
    
    // Estados calculados
    isConnecting,
    isConnected,
    isDisconnected,
    isError,
    
    // Información adicional
    connectionAttempts: connectionAttemptsRef.current,
    error
  }
}

// Hook especializado para escuchar mensajes específicos
export const useWebSocketMessage = <T = any>(
  url: string,
  messageType: string,
  onMessage: (data: T) => void,
  options: UseWebSocketOptions = {}
) => {
  const { lastJsonMessage, ...ws } = useWebSocket(url, {
    ...options,
    filter: (message) => {
      const typeMatches = message?.type === messageType
      return options.filter ? typeMatches && options.filter(message) : typeMatches
    }
  })

  useEffect(() => {
    if (lastJsonMessage?.type === messageType) {
      onMessage(lastJsonMessage.data)
    }
  }, [lastJsonMessage, messageType, onMessage])

  return ws
}

// Hook para múltiples tipos de mensajes
export const useWebSocketMessages = <T = Record<string, any>>(
  url: string,
  messageHandlers: T,
  options: UseWebSocketOptions = {}
) => {
  const { lastJsonMessage, ...ws } = useWebSocket(url, options)

  useEffect(() => {
    if (lastJsonMessage?.type && messageHandlers[lastJsonMessage.type as keyof T]) {
      const handler = messageHandlers[lastJsonMessage.type as keyof T] as Function
      handler(lastJsonMessage.data)
    }
  }, [lastJsonMessage, messageHandlers])

  return ws
}

export default useWebSocket
