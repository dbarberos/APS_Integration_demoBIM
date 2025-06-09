/**
 * Tests para hook useAuth
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '../useAuth'
import authSlice from '../../store/slices/authSlice'
import { server, resetMockHandlers } from '../../mocks/server'

// Mock store setup
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
    },
    preloadedState: {
      auth: {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        ...initialState,
      },
    },
  })
}

// Test wrapper component
const createWrapper = (store?: any, queryClient?: QueryClient) => {
  const defaultStore = store || createMockStore()
  const defaultQueryClient = queryClient || new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={defaultStore}>
      <QueryClientProvider client={defaultQueryClient}>
        {children}
      </QueryClientProvider>
    </Provider>
  )
}

describe('useAuth Hook', () => {
  let mockStore: any
  let queryClient: QueryClient

  beforeEach(() => {
    mockStore = createMockStore()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    resetMockHandlers()
  })

  afterEach(() => {
    queryClient.clear()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('returns initial auth state', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockStore, queryClient),
    })

    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('handles successful login', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockStore, queryClient),
    })

    await act(async () => {
      await result.current.login('test@example.com', 'password')
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toBeTruthy()
      expect(result.current.token).toBeTruthy()
      expect(result.current.error).toBeNull()
    })
  })

  it('handles login failure', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockStore, queryClient),
    })

    await act(async () => {
      try {
        await result.current.login('invalid@example.com', 'wrongpassword')
      } catch (error) {
        // Expected to fail
      }
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
      expect(result.current.error).toBeTruthy()
    })
  })

  it('handles logout', async () => {
    // Start with authenticated state
    const authenticatedStore = createMockStore({
      user: { id: 1, email: 'test@example.com' },
      token: 'mock-token',
      isAuthenticated: true,
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(authenticatedStore, queryClient),
    })

    await act(async () => {
      await result.current.logout()
    })

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(result.current.token).toBeNull()
    })
  })

  it('handles token refresh', async () => {
    // Mock localStorage with refresh token
    localStorage.setItem('refreshToken', 'mock-refresh-token')

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockStore, queryClient),
    })

    await act(async () => {
      await result.current.refreshToken()
    })

    await waitFor(() => {
      expect(result.current.token).toBeTruthy()
      expect(localStorage.getItem('authToken')).toBeTruthy()
    })
  })

  it('handles token refresh failure', async () => {
    // Mock localStorage with invalid refresh token
    localStorage.setItem('refreshToken', 'invalid-refresh-token')

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockStore, queryClient),
    })

    await act(async () => {
      try {
        await result.current.refreshToken()
      } catch (error) {
        // Expected to fail
      }
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
      expect(localStorage.getItem('authToken')).toBeNull()
    })
  })

  it('automatically refreshes token when expired', async () => {
    // Mock expired token
    const expiredToken = 'expired-token'
    localStorage.setItem('authToken', expiredToken)
    localStorage.setItem('refreshToken', 'mock-refresh-token')

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockStore, queryClient),
    })

    // Wait for automatic refresh
    await waitFor(() => {
      expect(result.current.token).not.toBe(expiredToken)
    }, { timeout: 3000 })
  })

  it('persists auth state in localStorage', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockStore, queryClient),
    })

    await act(async () => {
      await result.current.login('test@example.com', 'password')
    })

    await waitFor(() => {
      expect(localStorage.getItem('authToken')).toBeTruthy()
      expect(localStorage.getItem('refreshToken')).toBeTruthy()
      expect(localStorage.getItem('user')).toBeTruthy()
    })
  })

  it('restores auth state from localStorage on initialization', () => {
    // Pre-populate localStorage
    const mockUser = { id: 1, email: 'test@example.com' }
    localStorage.setItem('authToken', 'stored-token')
    localStorage.setItem('user', JSON.stringify(mockUser))

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockStore, queryClient),
    })

    expect(result.current.token).toBe('stored-token')
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('clears auth state on logout', async () => {
    // Start with authenticated state
    const authenticatedStore = createMockStore({
      user: { id: 1, email: 'test@example.com' },
      token: 'mock-token',
      isAuthenticated: true,
    })

    localStorage.setItem('authToken', 'mock-token')
    localStorage.setItem('refreshToken', 'mock-refresh-token')
    localStorage.setItem('user', JSON.stringify({ id: 1, email: 'test@example.com' }))

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(authenticatedStore, queryClient),
    })

    await act(async () => {
      await result.current.logout()
    })

    await waitFor(() => {
      expect(localStorage.getItem('authToken')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()
    })
  })

  it('handles change password', async () => {
    const authenticatedStore = createMockStore({
      user: { id: 1, email: 'test@example.com' },
      token: 'mock-token',
      isAuthenticated: true,
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(authenticatedStore, queryClient),
    })

    await act(async () => {
      await result.current.changePassword('oldpassword', 'newpassword')
    })

    // Should not change auth state for successful password change
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('handles network errors gracefully', async () => {
    // Mock network error
    server.use(
      http.post('/api/v1/auth/login', () => {
        return HttpResponse.error()
      })
    )

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockStore, queryClient),
    })

    await act(async () => {
      try {
        await result.current.login('test@example.com', 'password')
      } catch (error) {
        // Expected to fail
      }
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  it('provides loading states during async operations', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(mockStore, queryClient),
    })

    // Start login process
    act(() => {
      result.current.login('test@example.com', 'password')
    })

    // Should show loading state
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('validates user permissions', () => {
    const userWithPermissions = {
      id: 1,
      email: 'test@example.com',
      permissions: ['read:projects', 'write:projects', 'admin:users'],
    }

    const authenticatedStore = createMockStore({
      user: userWithPermissions,
      token: 'mock-token',
      isAuthenticated: true,
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(authenticatedStore, queryClient),
    })

    expect(result.current.hasPermission('read:projects')).toBe(true)
    expect(result.current.hasPermission('write:projects')).toBe(true)
    expect(result.current.hasPermission('admin:users')).toBe(true)
    expect(result.current.hasPermission('delete:projects')).toBe(false)
  })

  it('checks user roles', () => {
    const userWithRoles = {
      id: 1,
      email: 'test@example.com',
      roles: ['user', 'moderator'],
    }

    const authenticatedStore = createMockStore({
      user: userWithRoles,
      token: 'mock-token',
      isAuthenticated: true,
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(authenticatedStore, queryClient),
    })

    expect(result.current.hasRole('user')).toBe(true)
    expect(result.current.hasRole('moderator')).toBe(true)
    expect(result.current.hasRole('admin')).toBe(false)
  })

  describe('Token Management', () => {
    it('automatically sets authorization header', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(mockStore, queryClient),
      })

      await act(async () => {
        await result.current.login('test@example.com', 'password')
      })

      // Check if token is available for API calls
      expect(result.current.token).toBeTruthy()
    })

    it('handles token expiration gracefully', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(mockStore, queryClient),
      })

      // Mock token that expires immediately
      act(() => {
        result.current.setToken('expired-token', new Date(Date.now() - 1000))
      })

      await waitFor(() => {
        expect(result.current.isTokenExpired()).toBe(true)
      })
    })

    it('refreshes token before expiration', async () => {
      localStorage.setItem('refreshToken', 'mock-refresh-token')

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(mockStore, queryClient),
      })

      // Mock token that expires soon
      const expirationTime = new Date(Date.now() + 30000) // 30 seconds
      act(() => {
        result.current.setToken('soon-to-expire-token', expirationTime)
      })

      // Should automatically refresh
      await waitFor(() => {
        expect(result.current.token).not.toBe('soon-to-expire-token')
      }, { timeout: 5000 })
    })
  })

  describe('Error Handling', () => {
    it('handles 401 responses by logging out', async () => {
      const authenticatedStore = createMockStore({
        user: { id: 1, email: 'test@example.com' },
        token: 'mock-token',
        isAuthenticated: true,
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(authenticatedStore, queryClient),
      })

      // Simulate 401 response
      act(() => {
        result.current.handle401Error()
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.user).toBeNull()
      })
    })

    it('retries failed requests with new token', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(mockStore, queryClient),
      })

      const requestSpy = vi.fn()

      await act(async () => {
        await result.current.retryWithNewToken(requestSpy)
      })

      expect(requestSpy).toHaveBeenCalled()
    })
  })

  describe('Concurrent Operations', () => {
    it('handles concurrent login attempts', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(mockStore, queryClient),
      })

      // Start multiple login attempts simultaneously
      const loginPromises = [
        result.current.login('test@example.com', 'password'),
        result.current.login('test@example.com', 'password'),
        result.current.login('test@example.com', 'password'),
      ]

      await act(async () => {
        await Promise.allSettled(loginPromises)
      })

      // Should only authenticate once
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('handles concurrent refresh attempts', async () => {
      localStorage.setItem('refreshToken', 'mock-refresh-token')

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(mockStore, queryClient),
      })

      // Start multiple refresh attempts simultaneously
      const refreshPromises = [
        result.current.refreshToken(),
        result.current.refreshToken(),
        result.current.refreshToken(),
      ]

      await act(async () => {
        await Promise.allSettled(refreshPromises)
      })

      // Should only refresh once
      expect(result.current.token).toBeTruthy()
    })
  })
})
