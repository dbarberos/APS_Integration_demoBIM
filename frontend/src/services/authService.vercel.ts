/**
 * Servicio de autenticación adaptado para Vercel Functions
 * Versión simplificada que funciona con las APIs serverless
 */
import { LoginResponse, User } from '@/types'
const API_BASE = '/api'
// Interfaz para respuestas de las APIs
interface VercelApiResponse<T = any> {
  statusCode: number
  body: string
}
// Servicio de autenticación para Vercel
export const authService = {
  /**
   * Iniciar sesión
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'login',
          email,
          password
        })
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }
      // Guardar tokens
      if (data.token) {
        localStorage.setItem('access_token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
      }
      return {
        access_token: data.token,
        token_type: 'bearer',
        user: data.user
      }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },
  /**
   * Registrarse
   */
  async register(userData: {
    email: string
    password: string
    full_name?: string
  }): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          ...userData
        })
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }
      // Guardar tokens
      if (data.token) {
        localStorage.setItem('access_token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
      }
      return {
        access_token: data.token,
        token_type: 'bearer',
        user: data.user
      }
    } catch (error) {
      console.error('Registration error:', error)
      throw error
    }
  },
  /**
   * Cerrar sesión
   */
  async logout(): Promise<void> {
    try {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
    } catch (error) {
      console.error('Logout error:', error)
    }
  },
  /**
   * Verificar token
   */
  async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verify',
          token
        })
      })
      const data = await response.json()
      return response.ok && data.valid
    } catch (error) {
      console.error('Token verification error:', error)
      return false
    }
  },
  /**
   * Obtener token APS
   */
  async getAPSToken(): Promise<{ access_token: string; expires_in: number }> {
    try {
      const response = await fetch(`${API_BASE}/aps-token`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get APS token')
      }
      return data
    } catch (error) {
      console.error('APS token error:', error)
      throw error
    }
  },
  /**
   * Obtener usuario actual del localStorage
   */
  getCurrentUser(): User | null {
    try {
      const userData = localStorage.getItem('user')
      return userData ? JSON.parse(userData) : null
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  },
  /**
   * Obtener token actual del localStorage
   */
  getCurrentToken(): string | null {
    try {
      return localStorage.getItem('access_token')
    } catch (error) {
      console.error('Error getting current token:', error)
      return null
    }
  },
  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return !!this.getCurrentToken() && !!this.getCurrentUser()
  }
}
export default authService
