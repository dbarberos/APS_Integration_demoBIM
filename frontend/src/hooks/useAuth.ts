import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from './redux'
import {
  loginUser,
  registerUser,
  logout,
  updateUserProfile,
  changePassword,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  clearError,
  setCredentials,
  updatePreferences,
} from '@/store/slices/authSlice'
import { addToast } from '@/store/slices/uiSlice'
import { getStoredToken, getStoredUser, isTokenExpired } from '@/services/authService'
import type { User } from '@/types'

export const useAuth = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    loginAttempts,
    lastLoginAttempt,
    preferences,
  } = useAppSelector((state) => state.auth)

  // Verificar autenticación al montar el componente
  useEffect(() => {
    const initializeAuth = () => {
      const storedToken = getStoredToken()
      const storedUser = getStoredUser()
      
      if (storedToken && storedUser && !isTokenExpired(storedToken)) {
        dispatch(setCredentials({
          user: storedUser,
          token: storedToken,
        }))
      } else if (storedToken && isTokenExpired(storedToken)) {
        // Token expirado, hacer logout
        handleLogout()
      }
    }
    
    if (!isAuthenticated) {
      initializeAuth()
    }
  }, [dispatch, isAuthenticated])

  // Login
  const handleLogin = useCallback(async (
    email: string,
    password: string,
    rememberMe: boolean = false
  ) => {
    try {
      const result = await dispatch(loginUser({ email, password, rememberMe }))
      
      if (loginUser.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Bienvenido',
          message: `Hola ${result.payload.user.first_name}!`,
        }))
        
        navigate('/')
        return { success: true }
      } else {
        const errorMessage = result.payload?.message || 'Error al iniciar sesión'
        dispatch(addToast({
          type: 'error',
          title: 'Error de autenticación',
          message: errorMessage,
        }))
        return { success: false, error: errorMessage }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Error inesperado'
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: errorMessage,
      }))
      return { success: false, error: errorMessage }
    }
  }, [dispatch, navigate])

  // Register
  const handleRegister = useCallback(async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => {
    try {
      const result = await dispatch(registerUser({ email, password, firstName, lastName }))
      
      if (registerUser.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Registro exitoso',
          message: 'Tu cuenta ha sido creada correctamente',
        }))
        
        navigate('/')
        return { success: true }
      } else {
        const errorMessage = result.payload?.message || 'Error al registrarse'
        dispatch(addToast({
          type: 'error',
          title: 'Error de registro',
          message: errorMessage,
        }))
        return { success: false, error: errorMessage }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Error inesperado'
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: errorMessage,
      }))
      return { success: false, error: errorMessage }
    }
  }, [dispatch, navigate])

  // Logout
  const handleLogout = useCallback(() => {
    dispatch(logout())
    dispatch(addToast({
      type: 'info',
      title: 'Sesión cerrada',
      message: 'Has cerrado sesión correctamente',
    }))
    navigate('/auth')
  }, [dispatch, navigate])

  // Update profile
  const handleUpdateProfile = useCallback(async (updates: Partial<User>) => {
    try {
      const result = await dispatch(updateUserProfile(updates))
      
      if (updateUserProfile.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Perfil actualizado',
          message: 'Tu perfil ha sido actualizado correctamente',
        }))
        return { success: true }
      } else {
        const errorMessage = result.payload?.message || 'Error al actualizar perfil'
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: errorMessage,
        }))
        return { success: false, error: errorMessage }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Error inesperado'
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: errorMessage,
      }))
      return { success: false, error: errorMessage }
    }
  }, [dispatch])

  // Change password
  const handleChangePassword = useCallback(async (
    currentPassword: string,
    newPassword: string
  ) => {
    try {
      const result = await dispatch(changePassword({ currentPassword, newPassword }))
      
      if (changePassword.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Contraseña cambiada',
          message: 'Tu contraseña ha sido actualizada correctamente',
        }))
        return { success: true }
      } else {
        const errorMessage = result.payload?.message || 'Error al cambiar contraseña'
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: errorMessage,
        }))
        return { success: false, error: errorMessage }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Error inesperado'
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: errorMessage,
      }))
      return { success: false, error: errorMessage }
    }
  }, [dispatch])

  // Request password reset
  const handleRequestPasswordReset = useCallback(async (email: string) => {
    try {
      const result = await dispatch(requestPasswordReset({ email }))
      
      if (requestPasswordReset.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Email enviado',
          message: 'Se ha enviado un enlace de restablecimiento a tu email',
        }))
        return { success: true }
      } else {
        const errorMessage = result.payload?.message || 'Error al solicitar restablecimiento'
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: errorMessage,
        }))
        return { success: false, error: errorMessage }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Error inesperado'
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: errorMessage,
      }))
      return { success: false, error: errorMessage }
    }
  }, [dispatch])

  // Reset password
  const handleResetPassword = useCallback(async (
    token: string,
    newPassword: string
  ) => {
    try {
      const result = await dispatch(resetPassword({ token, newPassword }))
      
      if (resetPassword.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Contraseña restablecida',
          message: 'Tu contraseña ha sido restablecida correctamente',
        }))
        navigate('/auth')
        return { success: true }
      } else {
        const errorMessage = result.payload?.message || 'Error al restablecer contraseña'
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: errorMessage,
        }))
        return { success: false, error: errorMessage }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Error inesperado'
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: errorMessage,
      }))
      return { success: false, error: errorMessage }
    }
  }, [dispatch, navigate])

  // Verify email
  const handleVerifyEmail = useCallback(async (token: string) => {
    try {
      const result = await dispatch(verifyEmail({ token }))
      
      if (verifyEmail.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Email verificado',
          message: 'Tu email ha sido verificado correctamente',
        }))
        return { success: true }
      } else {
        const errorMessage = result.payload?.message || 'Error al verificar email'
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: errorMessage,
        }))
        return { success: false, error: errorMessage }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Error inesperado'
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: errorMessage,
      }))
      return { success: false, error: errorMessage }
    }
  }, [dispatch])

  // Update preferences
  const handleUpdatePreferences = useCallback((
    newPreferences: Partial<typeof preferences>
  ) => {
    dispatch(updatePreferences(newPreferences))
    dispatch(addToast({
      type: 'success',
      title: 'Preferencias actualizadas',
      message: 'Tus preferencias han sido guardadas',
    }))
  }, [dispatch, preferences])

  // Clear error
  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  // Check if login is blocked due to too many attempts
  const isLoginBlocked = useCallback(() => {
    if (loginAttempts >= 5 && lastLoginAttempt) {
      const blockDuration = 15 * 60 * 1000 // 15 minutos
      const timeRemaining = (lastLoginAttempt + blockDuration) - Date.now()
      return timeRemaining > 0 ? Math.ceil(timeRemaining / 1000 / 60) : 0
    }
    return 0
  }, [loginAttempts, lastLoginAttempt])

  // Get user permissions
  const getUserPermissions = useCallback(() => {
    if (!user) return { canCreate: false, canEdit: false, canDelete: false, isAdmin: false }
    
    return {
      canCreate: user.is_active,
      canEdit: user.is_active,
      canDelete: user.is_superuser,
      isAdmin: user.is_superuser,
    }
  }, [user])

  return {
    // State
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    loginAttempts,
    preferences,
    
    // Actions
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    updateProfile: handleUpdateProfile,
    changePassword: handleChangePassword,
    requestPasswordReset: handleRequestPasswordReset,
    resetPassword: handleResetPassword,
    verifyEmail: handleVerifyEmail,
    updatePreferences: handleUpdatePreferences,
    clearError: handleClearError,
    
    // Utilities
    isLoginBlocked,
    getUserPermissions,
    loginBlockedMinutes: isLoginBlocked(),
  }
}

export default useAuth
