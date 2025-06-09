import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { User, LoginResponse, ApiError } from '@/types'
import * as authService from '@/services/authService.vercel'
import Cookies from 'js-cookie'

export interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  loginAttempts: number
  lastLoginAttempt: number | null
  preferences: {
    theme: 'light' | 'dark' | 'system'
    language: 'es' | 'en'
    notifications: boolean
    autoLogout: boolean
    sessionDuration: number
  }
}

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  loginAttempts: 0,
  lastLoginAttempt: null,
  preferences: {
    theme: 'system',
    language: 'es',
    notifications: true,
    autoLogout: true,
    sessionDuration: 8 * 60 * 60 * 1000, // 8 horas
  },
}

// Async thunks
export const loginUser = createAsyncThunk<
  LoginResponse,
  { email: string; password: string; rememberMe?: boolean },
  { rejectValue: ApiError }
>('auth/loginUser', async (credentials, { rejectWithValue }) => {
  try {
    const response = await authService.login(credentials.email, credentials.password)
    
    // Guardar token en cookies si "recordarme" está activado
    if (credentials.rememberMe) {
      Cookies.set('access_token', response.access_token, { 
        expires: 7, // 7 días
        secure: true,
        sameSite: 'strict'
      })
    }
    
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al iniciar sesión',
      status: error.response?.status,
    })
  }
})

export const registerUser = createAsyncThunk<
  LoginResponse,
  { email: string; password: string; firstName: string; lastName: string },
  { rejectValue: ApiError }
>('auth/registerUser', async (userData, { rejectWithValue }) => {
  try {
    const response = await authService.register(userData)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al registrarse',
      status: error.response?.status,
    })
  }
})

export const refreshAccessToken = createAsyncThunk<
  { access_token: string; expires_in: number },
  void,
  { rejectValue: ApiError }
>('auth/refreshToken', async (_, { getState, rejectWithValue }) => {
  try {
    const state = getState() as { auth: AuthState }
    const refreshToken = state.auth.refreshToken
    
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }
    
    const response = await authService.refreshToken(refreshToken)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al renovar token',
      status: error.response?.status,
    })
  }
})

export const updateUserProfile = createAsyncThunk<
  User,
  Partial<User>,
  { rejectValue: ApiError }
>('auth/updateProfile', async (updates, { rejectWithValue }) => {
  try {
    const response = await authService.updateProfile(updates)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al actualizar perfil',
      status: error.response?.status,
    })
  }
})

export const changePassword = createAsyncThunk<
  void,
  { currentPassword: string; newPassword: string },
  { rejectValue: ApiError }
>('auth/changePassword', async (passwords, { rejectWithValue }) => {
  try {
    await authService.changePassword(passwords.currentPassword, passwords.newPassword)
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al cambiar contraseña',
      status: error.response?.status,
    })
  }
})

export const requestPasswordReset = createAsyncThunk<
  void,
  { email: string },
  { rejectValue: ApiError }
>('auth/requestPasswordReset', async ({ email }, { rejectWithValue }) => {
  try {
    await authService.requestPasswordReset(email)
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al solicitar restablecimiento',
      status: error.response?.status,
    })
  }
})

export const resetPassword = createAsyncThunk<
  void,
  { token: string; newPassword: string },
  { rejectValue: ApiError }
>('auth/resetPassword', async ({ token, newPassword }, { rejectWithValue }) => {
  try {
    await authService.resetPassword(token, newPassword)
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al restablecer contraseña',
      status: error.response?.status,
    })
  }
})

export const verifyEmail = createAsyncThunk<
  void,
  { token: string },
  { rejectValue: ApiError }
>('auth/verifyEmail', async ({ token }, { rejectWithValue }) => {
  try {
    await authService.verifyEmail(token)
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al verificar email',
      status: error.response?.status,
    })
  }
})

// Slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null
      state.token = null
      state.refreshToken = null
      state.isAuthenticated = false
      state.error = null
      
      // Limpiar cookies
      Cookies.remove('access_token')
      Cookies.remove('refresh_token')
      
      // Limpiar localStorage
      localStorage.removeItem('persist:auth')
    },
    
    clearError: (state) => {
      state.error = null
    },
    
    setCredentials: (state, action: PayloadAction<{ user: User; token: string; refreshToken?: string }>) => {
      const { user, token, refreshToken } = action.payload
      state.user = user
      state.token = token
      state.refreshToken = refreshToken || state.refreshToken
      state.isAuthenticated = true
      state.error = null
    },
    
    updatePreferences: (state, action: PayloadAction<Partial<AuthState['preferences']>>) => {
      state.preferences = { ...state.preferences, ...action.payload }
    },
    
    incrementLoginAttempts: (state) => {
      state.loginAttempts += 1
      state.lastLoginAttempt = Date.now()
    },
    
    resetLoginAttempts: (state) => {
      state.loginAttempts = 0
      state.lastLoginAttempt = null
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    
    // Para inicializar desde token guardado en cookies
    initializeFromToken: (state, action: PayloadAction<{ token: string; user: User }>) => {
      const { token, user } = action.payload
      state.token = token
      state.user = user
      state.isAuthenticated = true
    },
  },
  
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload.user
        state.token = action.payload.access_token
        state.isAuthenticated = true
        state.loginAttempts = 0
        state.lastLoginAttempt = null
        state.error = null
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload?.message || 'Error al iniciar sesión'
        state.loginAttempts += 1
        state.lastLoginAttempt = Date.now()
      })
    
    // Register
    builder
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload.user
        state.token = action.payload.access_token
        state.isAuthenticated = true
        state.error = null
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload?.message || 'Error al registrarse'
      })
    
    // Refresh token
    builder
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.token = action.payload.access_token
      })
      .addCase(refreshAccessToken.rejected, (state, action) => {
        // Si falla el refresh, cerrar sesión
        state.user = null
        state.token = null
        state.refreshToken = null
        state.isAuthenticated = false
        state.error = action.payload?.message || 'Sesión expirada'
      })
    
    // Update profile
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload
        state.error = null
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload?.message || 'Error al actualizar perfil'
      })
    
    // Change password
    builder
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.isLoading = false
        state.error = null
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload?.message || 'Error al cambiar contraseña'
      })
    
    // Password reset request
    builder
      .addCase(requestPasswordReset.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(requestPasswordReset.fulfilled, (state) => {
        state.isLoading = false
        state.error = null
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload?.message || 'Error al solicitar restablecimiento'
      })
    
    // Password reset
    builder
      .addCase(resetPassword.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.isLoading = false
        state.error = null
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload?.message || 'Error al restablecer contraseña'
      })
    
    // Email verification
    builder
      .addCase(verifyEmail.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(verifyEmail.fulfilled, (state) => {
        state.isLoading = false
        state.error = null
        if (state.user) {
          state.user.is_active = true
        }
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload?.message || 'Error al verificar email'
      })
  },
})

export const {
  logout,
  clearError,
  setCredentials,
  updatePreferences,
  incrementLoginAttempts,
  resetLoginAttempts,
  setLoading,
  initializeFromToken,
} = authSlice.actions

export default authSlice.reducer

// Selectores
export const selectAuth = (state: { auth: AuthState }) => state.auth
export const selectUser = (state: { auth: AuthState }) => state.auth.user
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error
export const selectToken = (state: { auth: AuthState }) => state.auth.token
export const selectUserPreferences = (state: { auth: AuthState }) => state.auth.preferences
export const selectLoginAttempts = (state: { auth: AuthState }) => state.auth.loginAttempts
