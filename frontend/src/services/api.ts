import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { LoginResponse, RefreshTokenResponse } from '@/types'

// Configuración base de la API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

// Crear instancia de axios
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor para agregar token de autenticación
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // Agregar timestamp para prevenir cache
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      }
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor para manejar tokens expirados
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config
    
    // Si el token expiró y no estamos ya reintentando
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          const response = await axios.post<RefreshTokenResponse>(
            `${API_BASE_URL}/auth/refresh`,
            { refresh_token: refreshToken }
          )
          
          const newToken = response.data.access_token
          localStorage.setItem('access_token', newToken)
          
          // Reintentar la petición original con el nuevo token
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Si el refresh falla, limpiar tokens y redirigir al login
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/auth'
        return Promise.reject(refreshError)
      }
    }
    
    return Promise.reject(error)
  }
)

// Utilidades para manejo de errores
export const handleApiError = (error: any) => {
  if (error.response) {
    // Error del servidor con respuesta
    const message = error.response.data?.detail || error.response.data?.message || 'Error del servidor'
    return {
      message,
      status: error.response.status,
      code: error.response.data?.code,
    }
  } else if (error.request) {
    // Error de red
    return {
      message: 'Error de conexión. Verifica tu conexión a internet.',
      status: 0,
      code: 'NETWORK_ERROR',
    }
  } else {
    // Error en la configuración de la petición
    return {
      message: error.message || 'Error desconocido',
      status: 0,
      code: 'REQUEST_ERROR',
    }
  }
}

// Configuraciones para diferentes tipos de peticiones
export const apiConfig = {
  // Para uploads de archivos grandes
  upload: (onUploadProgress?: (progressEvent: any) => void): AxiosRequestConfig => ({
    timeout: 300000, // 5 minutos
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  }),
  
  // Para descargas de archivos
  download: (): AxiosRequestConfig => ({
    responseType: 'blob',
    timeout: 300000, // 5 minutos
  }),
  
  // Para peticiones que pueden tardar más
  longRunning: (): AxiosRequestConfig => ({
    timeout: 120000, // 2 minutos
  }),
  
  // Para peticiones de polling frecuente
  polling: (): AxiosRequestConfig => ({
    timeout: 10000, // 10 segundos
  }),
}

// Funciones de utilidad para tipos comunes de peticiones
export const apiRequest = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) => 
    api.get<T>(url, config).then(response => response.data),
    
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    api.post<T>(url, data, config).then(response => response.data),
    
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    api.put<T>(url, data, config).then(response => response.data),
    
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) => 
    api.patch<T>(url, data, config).then(response => response.data),
    
  delete: <T = any>(url: string, config?: AxiosRequestConfig) => 
    api.delete<T>(url, config).then(response => response.data),
}

// Función para construir URLs con parámetros de query
export const buildUrl = (path: string, params?: Record<string, any>): string => {
  const url = new URL(path, API_BASE_URL)
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, String(v)))
        } else {
          url.searchParams.append(key, String(value))
        }
      }
    })
  }
  
  return url.pathname + url.search
}

// Función para formatear datos de formulario
export const formatFormData = (data: Record<string, any>): FormData => {
  const formData = new FormData()
  
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (value instanceof File) {
        formData.append(key, value)
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (item instanceof File) {
            formData.append(`${key}[${index}]`, item)
          } else {
            formData.append(`${key}[${index}]`, String(item))
          }
        })
      } else if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value))
      } else {
        formData.append(key, String(value))
      }
    }
  })
  
  return formData
}

// Configurar interceptor de logging para desarrollo
if (process.env.NODE_ENV === 'development') {
  api.interceptors.request.use(
    (config) => {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      })
      return config
    }
  )
  
  api.interceptors.response.use(
    (response) => {
      console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      })
      return response
    },
    (error) => {
      console.log(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status: error.response?.status,
        message: error.response?.data?.detail || error.message,
      })
      return Promise.reject(error)
    }
  )
}

export default api
