import { apiRequest } from './api'
import { LoginResponse, RefreshTokenResponse, User } from '@/types'
// Endpoints de autenticación
const AUTH_ENDPOINTS = {
LOGIN: '/auth/login',
REGISTER: '/auth/register',
LOGOUT: '/auth/logout',
REFRESH: '/auth/refresh',
PROFILE: '/auth/me',
UPDATE_PROFILE: '/auth/me',
CHANGE_PASSWORD: '/auth/change-password',
REQUEST_PASSWORD_RESET: '/auth/request-password-reset',
RESET_PASSWORD: '/auth/reset-password',
VERIFY_EMAIL: '/auth/verify-email',
RESEND_VERIFICATION: '/auth/resend-verification',
} as const
// Interfaz para datos de login
interface LoginCredentials {
email: string
password: string
}
// Interfaz para datos de registro
interface RegisterData {
email: string
password: string
firstName: string
lastName: string
}
// Servicio de autenticación
export const authService = {
/**
* Iniciar sesión con email y contraseña
*/
async login(email: string, password: string): Promise<LoginResponse> {
const response = await apiRequest.post<LoginResponse>(AUTH_ENDPOINTS.LOGIN, {
username: email, // FastAPI OAuth2 usa 'username' por convención
password,
})
// Guardar tokens en localStorage
if (response.access_token) {
localStorage.setItem('access_token', response.access_token)
localStorage.setItem('user', JSON.stringify(response.user))
}
return response
  },

  /**
   * Registrar nuevo usuario
   */
  async register(userData: RegisterData): Promise<LoginResponse> {
    const response = await apiRequest.post<LoginResponse>(AUTH_ENDPOINTS.REGISTER, {
      email: userData.email,
      password: userData.password,
      first_name: userData.firstName,
      last_name: userData.lastName,
    })
    
    // Guardar tokens en localStorage
    if (response.access_token) {
      localStorage.setItem('access_token', response.access_token)
      localStorage.setItem('user', JSON.stringify(response.user))
    }
    
    return response
  },

  /**
   * Cerrar sesión
   */
  async logout(): Promise<void> {
    try {
      await apiRequest.post(AUTH_ENDPOINTS.LOGOUT)
    } catch (error) {
      // Continuar con el logout local incluso si falla en el servidor
      console.warn('Error al cerrar sesión en el servidor:', error)
    } finally {
      // Limpiar almacenamiento local
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
    }
  },

  /**
   * Renovar token de acceso
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await apiRequest.post<RefreshTokenResponse>(AUTH_ENDPOINTS.REFRESH, {
      refresh_token: refreshToken,
    })
    
    // Actualizar token en localStorage
    if (response.access_token) {
      localStorage.setItem('access_token', response.access_token)
    }
    
    return response
  },

  /**
   * Obtener perfil del usuario actual
   */
  async getCurrentUser(): Promise<User> {
    return await apiRequest.get<User>(AUTH_ENDPOINTS.PROFILE)
  },

  /**
   * Actualizar perfil del usuario
   */
  async updateProfile(updates: Partial<User>): Promise<User> {
    const response = await apiRequest.patch<User>(AUTH_ENDPOINTS.UPDATE_PROFILE, updates)
    
    // Actualizar usuario en localStorage
    localStorage.setItem('user', JSON.stringify(response))
    
    return response
  },

  /**
   * Cambiar contraseña
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiRequest.post(AUTH_ENDPOINTS.CHANGE_PASSWORD, {
      current_password: currentPassword,
      new_password: newPassword,
    })
  },

  /**
   * Solicitar restablecimiento de contraseña
   */
  async requestPasswordReset(email: string): Promise<void> {
    await apiRequest.post(AUTH_ENDPOINTS.REQUEST_PASSWORD_RESET, {
      email,
    })
  },

  /**
   * Restablecer contraseña con token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiRequest.post(AUTH_ENDPOINTS.RESET_PASSWORD, {
      token,
      new_password: newPassword,
    })
  },

  /**
   * Verificar email con token
   */
  async verifyEmail(token: string): Promise<void> {
    await apiRequest.post(AUTH_ENDPOINTS.VERIFY_EMAIL, {
      token,
    })
  },

  /**
   * Reenviar email de verificación
   */
  async resendVerificationEmail(): Promise<void> {
    await apiRequest.post(AUTH_ENDPOINTS.RESEND_VERIFICATION)
  },

  /**
   * Verificar si el token actual es válido
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getCurrentUser()
      return true
    } catch (error) {
      return false
    }
  },

  /**
   * Obtener token del almacenamiento local
   */
  getStoredToken(): string | null {
    return localStorage.getItem('access_token')
  },

  /**
   * Obtener usuario del almacenamiento local
   */
  getStoredUser(): User | null {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch (error) {
        console.error('Error parsing stored user:', error)
        localStorage.removeItem('user')
      }
    }
    return null
  },

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    const token = this.getStoredToken()
    const user = this.getStoredUser()
    return Boolean(token && user)
  },

  /**
   * Obtener información del token (decodificar JWT)
   */
  getTokenInfo(token?: string): any {
    const tokenToUse = token || this.getStoredToken()
    if (!tokenToUse) return null

    try {
      const payload = tokenToUse.split('.')[1]
      const decoded = atob(payload)
      return JSON.parse(decoded)
    } catch (error) {
      console.error('Error decoding token:', error)
      return null
    }
  },

  /**
   * Verificar si el token está expirado
   */
  isTokenExpired(token?: string): boolean {
    const tokenInfo = this.getTokenInfo(token)
    if (!tokenInfo || !tokenInfo.exp) return true

    const currentTime = Math.floor(Date.now() / 1000)
    return tokenInfo.exp < currentTime
  },

  /**
   * Calcular tiempo restante del token en segundos
   */
  getTokenTimeRemaining(token?: string): number {
    const tokenInfo = this.getTokenInfo(token)
    if (!tokenInfo || !tokenInfo.exp) return 0

    const currentTime = Math.floor(Date.now() / 1000)
    return Math.max(0, tokenInfo.exp - currentTime)
  },
}

// Funciones de conveniencia (named exports)
export const login = authService.login
export const register = authService.register
export const logout = authService.logout
export const refreshToken = authService.refreshToken
export const getCurrentUser = authService.getCurrentUser
export const updateProfile = authService.updateProfile
export const changePassword = authService.changePassword
export const requestPasswordReset = authService.requestPasswordReset
export const resetPassword = authService.resetPassword
export const verifyEmail = authService.verifyEmail
export const resendVerificationEmail = authService.resendVerificationEmail
export const validateToken = authService.validateToken
export const getStoredToken = authService.getStoredToken
export const getStoredUser = authService.getStoredUser
export const isAuthenticated = authService.isAuthenticated
export const getTokenInfo = authService.getTokenInfo
export const isTokenExpired = authService.isTokenExpired
export const getTokenTimeRemaining = authService.getTokenTimeRemaining

export default authService
