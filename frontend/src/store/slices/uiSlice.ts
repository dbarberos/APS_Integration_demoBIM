import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Toast, Modal, Notification, Theme, ThemeConfig } from '@/types'

export interface UIState {
  // Layout
  sidebarCollapsed: boolean
  sidebarMobile: boolean
  
  // Theme
  theme: Theme
  themeConfig: ThemeConfig
  
  // Loading states
  globalLoading: boolean
  loadingStates: Record<string, boolean>
  
  // Modales
  modals: Record<string, Modal>
  
  // Notifications & Toasts
  notifications: Notification[]
  toasts: Toast[]
  
  // Language & Localization
  language: 'es' | 'en'
  locale: string
  
  // Layout preferences
  layout: {
    density: 'comfortable' | 'compact' | 'spacious'
    fontSize: 'sm' | 'md' | 'lg'
    animations: boolean
    sounds: boolean
  }
  
  // Navigation
  breadcrumbs: Array<{ label: string; path?: string; current?: boolean }>
  currentPage: string
  previousPage: string | null
  
  // Search & Filters
  globalSearch: {
    query: string
    isOpen: boolean
    recentSearches: string[]
    suggestions: string[]
  }
  
  // Upload & Progress
  uploadZone: {
    isVisible: boolean
    isDragOver: boolean
    files: File[]
  }
  
  // Viewer
  viewerState: {
    isFullscreen: boolean
    showNavigationBar: boolean
    showModelTree: boolean
    showProperties: boolean
    currentExtensions: string[]
  }
  
  // Keyboard shortcuts
  shortcuts: {
    enabled: boolean
    customBindings: Record<string, string>
  }
  
  // Error handling
  errors: Array<{
    id: string
    message: string
    type: 'error' | 'warning' | 'info'
    timestamp: number
    dismissed: boolean
  }>
  
  // Performance
  performance: {
    enableMetrics: boolean
    showFPS: boolean
    memoryUsage: number
    renderTime: number
  }
}

const initialState: UIState = {
  sidebarCollapsed: false,
  sidebarMobile: false,
  
  theme: 'system',
  themeConfig: {
    theme: 'system',
    primaryColor: '#3b82f6',
    accentColor: '#10b981',
    borderRadius: 'md',
    fontSize: 'md',
  },
  
  globalLoading: false,
  loadingStates: {},
  
  modals: {},
  
  notifications: [],
  toasts: [],
  
  language: 'es',
  locale: 'es-ES',
  
  layout: {
    density: 'comfortable',
    fontSize: 'md',
    animations: true,
    sounds: false,
  },
  
  breadcrumbs: [],
  currentPage: '/',
  previousPage: null,
  
  globalSearch: {
    query: '',
    isOpen: false,
    recentSearches: [],
    suggestions: [],
  },
  
  uploadZone: {
    isVisible: false,
    isDragOver: false,
    files: [],
  },
  
  viewerState: {
    isFullscreen: false,
    showNavigationBar: true,
    showModelTree: false,
    showProperties: false,
    currentExtensions: [],
  },
  
  shortcuts: {
    enabled: true,
    customBindings: {},
  },
  
  errors: [],
  
  performance: {
    enableMetrics: false,
    showFPS: false,
    memoryUsage: 0,
    renderTime: 0,
  },
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Layout actions
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed
    },
    
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload
    },
    
    toggleSidebarMobile: (state) => {
      state.sidebarMobile = !state.sidebarMobile
    },
    
    setSidebarMobile: (state, action: PayloadAction<boolean>) => {
      state.sidebarMobile = action.payload
    },
    
    // Theme actions
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload
      state.themeConfig.theme = action.payload
    },
    
    updateThemeConfig: (state, action: PayloadAction<Partial<ThemeConfig>>) => {
      state.themeConfig = { ...state.themeConfig, ...action.payload }
    },
    
    // Loading actions
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.globalLoading = action.payload
    },
    
    setLoadingState: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      const { key, loading } = action.payload
      if (loading) {
        state.loadingStates[key] = true
      } else {
        delete state.loadingStates[key]
      }
    },
    
    clearAllLoading: (state) => {
      state.globalLoading = false
      state.loadingStates = {}
    },
    
    // Modal actions
    openModal: (state, action: PayloadAction<{
      id: string
      type: string
      data?: any
      options?: Modal['options']
    }>) => {
      const { id, type, data, options } = action.payload
      state.modals[id] = {
        id,
        type,
        isOpen: true,
        data,
        options: {
          closable: true,
          size: 'md',
          ...options,
        },
      }
    },
    
    closeModal: (state, action: PayloadAction<string>) => {
      const modalId = action.payload
      if (state.modals[modalId]) {
        state.modals[modalId].isOpen = false
      }
    },
    
    removeModal: (state, action: PayloadAction<string>) => {
      delete state.modals[action.payload]
    },
    
    clearAllModals: (state) => {
      state.modals = {}
    },
    
    // Toast actions
    addToast: (state, action: PayloadAction<Omit<Toast, 'id'>>) => {
      const toast: Toast = {
        id: `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...action.payload,
      }
      state.toasts.push(toast)
      
      // Limitar a 5 toasts máximo
      if (state.toasts.length > 5) {
        state.toasts = state.toasts.slice(-5)
      }
    },
    
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter(toast => toast.id !== action.payload)
    },
    
    clearAllToasts: (state) => {
      state.toasts = []
    },
    
    // Notification actions
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: Notification = {
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        read: false,
        ...action.payload,
      }
      state.notifications.unshift(notification)
      
      // Limitar a 50 notificaciones
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50)
      }
    },
    
    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload)
      if (notification) {
        notification.read = true
      }
    },
    
    markAllNotificationsAsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.read = true
      })
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload)
    },
    
    clearAllNotifications: (state) => {
      state.notifications = []
    },
    
    // Language actions
    setLanguage: (state, action: PayloadAction<'es' | 'en'>) => {
      state.language = action.payload
      state.locale = action.payload === 'es' ? 'es-ES' : 'en-US'
    },
    
    // Layout preferences
    updateLayoutPreferences: (state, action: PayloadAction<Partial<UIState['layout']>>) => {
      state.layout = { ...state.layout, ...action.payload }
    },
    
    // Navigation actions
    setBreadcrumbs: (state, action: PayloadAction<UIState['breadcrumbs']>) => {
      state.breadcrumbs = action.payload
    },
    
    addBreadcrumb: (state, action: PayloadAction<{ label: string; path?: string }>) => {
      state.breadcrumbs.push({ ...action.payload, current: true })
      // Marcar el anterior como no actual
      if (state.breadcrumbs.length > 1) {
        state.breadcrumbs[state.breadcrumbs.length - 2].current = false
      }
    },
    
    setCurrentPage: (state, action: PayloadAction<string>) => {
      state.previousPage = state.currentPage
      state.currentPage = action.payload
    },
    
    // Global search actions
    setGlobalSearchQuery: (state, action: PayloadAction<string>) => {
      state.globalSearch.query = action.payload
    },
    
    toggleGlobalSearch: (state) => {
      state.globalSearch.isOpen = !state.globalSearch.isOpen
      if (!state.globalSearch.isOpen) {
        state.globalSearch.query = ''
      }
    },
    
    addRecentSearch: (state, action: PayloadAction<string>) => {
      const query = action.payload.trim()
      if (query && !state.globalSearch.recentSearches.includes(query)) {
        state.globalSearch.recentSearches.unshift(query)
        // Limitar a 10 búsquedas recientes
        if (state.globalSearch.recentSearches.length > 10) {
          state.globalSearch.recentSearches = state.globalSearch.recentSearches.slice(0, 10)
        }
      }
    },
    
    setSearchSuggestions: (state, action: PayloadAction<string[]>) => {
      state.globalSearch.suggestions = action.payload
    },
    
    // Upload zone actions
    setUploadZoneVisible: (state, action: PayloadAction<boolean>) => {
      state.uploadZone.isVisible = action.payload
    },
    
    setUploadZoneDragOver: (state, action: PayloadAction<boolean>) => {
      state.uploadZone.isDragOver = action.payload
    },
    
    setUploadZoneFiles: (state, action: PayloadAction<File[]>) => {
      state.uploadZone.files = action.payload
    },
    
    clearUploadZone: (state) => {
      state.uploadZone.isVisible = false
      state.uploadZone.isDragOver = false
      state.uploadZone.files = []
    },
    
    // Viewer state actions
    updateViewerState: (state, action: PayloadAction<Partial<UIState['viewerState']>>) => {
      state.viewerState = { ...state.viewerState, ...action.payload }
    },
    
    toggleViewerFullscreen: (state) => {
      state.viewerState.isFullscreen = !state.viewerState.isFullscreen
    },
    
    toggleViewerPanel: (state, action: PayloadAction<'modelTree' | 'properties' | 'navigationBar'>) => {
      const panel = action.payload
      switch (panel) {
        case 'modelTree':
          state.viewerState.showModelTree = !state.viewerState.showModelTree
          break
        case 'properties':
          state.viewerState.showProperties = !state.viewerState.showProperties
          break
        case 'navigationBar':
          state.viewerState.showNavigationBar = !state.viewerState.showNavigationBar
          break
      }
    },
    
    // Keyboard shortcuts
    updateShortcuts: (state, action: PayloadAction<Partial<UIState['shortcuts']>>) => {
      state.shortcuts = { ...state.shortcuts, ...action.payload }
    },
    
    setCustomBinding: (state, action: PayloadAction<{ action: string; binding: string }>) => {
      const { action: actionName, binding } = action.payload
      state.shortcuts.customBindings[actionName] = binding
    },
    
    // Error handling
    addError: (state, action: PayloadAction<{
      message: string
      type?: 'error' | 'warning' | 'info'
    }>) => {
      const error = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message: action.payload.message,
        type: action.payload.type || 'error',
        timestamp: Date.now(),
        dismissed: false,
      }
      state.errors.unshift(error)
      
      // Limitar a 20 errores
      if (state.errors.length > 20) {
        state.errors = state.errors.slice(0, 20)
      }
    },
    
    dismissError: (state, action: PayloadAction<string>) => {
      const error = state.errors.find(e => e.id === action.payload)
      if (error) {
        error.dismissed = true
      }
    },
    
    clearErrors: (state) => {
      state.errors = []
    },
    
    // Performance
    updatePerformance: (state, action: PayloadAction<Partial<UIState['performance']>>) => {
      state.performance = { ...state.performance, ...action.payload }
    },
  },
})

export const {
  // Layout
  toggleSidebar,
  setSidebarCollapsed,
  toggleSidebarMobile,
  setSidebarMobile,
  
  // Theme
  setTheme,
  updateThemeConfig,
  
  // Loading
  setGlobalLoading,
  setLoadingState,
  clearAllLoading,
  
  // Modals
  openModal,
  closeModal,
  removeModal,
  clearAllModals,
  
  // Toasts
  addToast,
  removeToast,
  clearAllToasts,
  
  // Notifications
  addNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  removeNotification,
  clearAllNotifications,
  
  // Language
  setLanguage,
  
  // Layout preferences
  updateLayoutPreferences,
  
  // Navigation
  setBreadcrumbs,
  addBreadcrumb,
  setCurrentPage,
  
  // Global search
  setGlobalSearchQuery,
  toggleGlobalSearch,
  addRecentSearch,
  setSearchSuggestions,
  
  // Upload zone
  setUploadZoneVisible,
  setUploadZoneDragOver,
  setUploadZoneFiles,
  clearUploadZone,
  
  // Viewer
  updateViewerState,
  toggleViewerFullscreen,
  toggleViewerPanel,
  
  // Shortcuts
  updateShortcuts,
  setCustomBinding,
  
  // Errors
  addError,
  dismissError,
  clearErrors,
  
  // Performance
  updatePerformance,
} = uiSlice.actions

export default uiSlice.reducer

// Selectores
export const selectSidebarCollapsed = (state: { ui: UIState }) => state.ui.sidebarCollapsed
export const selectSidebarMobile = (state: { ui: UIState }) => state.ui.sidebarMobile
export const selectTheme = (state: { ui: UIState }) => state.ui.theme
export const selectThemeConfig = (state: { ui: UIState }) => state.ui.themeConfig
export const selectGlobalLoading = (state: { ui: UIState }) => state.ui.globalLoading
export const selectLoadingStates = (state: { ui: UIState }) => state.ui.loadingStates
export const selectModals = (state: { ui: UIState }) => state.ui.modals
export const selectToasts = (state: { ui: UIState }) => state.ui.toasts
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications
export const selectUnreadNotifications = (state: { ui: UIState }) => 
  state.ui.notifications.filter(n => !n.read)
export const selectLanguage = (state: { ui: UIState }) => state.ui.language
export const selectLayoutPreferences = (state: { ui: UIState }) => state.ui.layout
export const selectBreadcrumbs = (state: { ui: UIState }) => state.ui.breadcrumbs
export const selectCurrentPage = (state: { ui: UIState }) => state.ui.currentPage
export const selectGlobalSearch = (state: { ui: UIState }) => state.ui.globalSearch
export const selectUploadZone = (state: { ui: UIState }) => state.ui.uploadZone
export const selectViewerState = (state: { ui: UIState }) => state.ui.viewerState
export const selectShortcuts = (state: { ui: UIState }) => state.ui.shortcuts
export const selectErrors = (state: { ui: UIState }) => state.ui.errors
export const selectPerformance = (state: { ui: UIState }) => state.ui.performance

// Selector para verificar si hay loading activo
export const selectHasActiveLoading = (state: { ui: UIState }) => 
  state.ui.globalLoading || Object.keys(state.ui.loadingStates).length > 0

// Selector para modal específico
export const selectModalById = (modalId: string) => (state: { ui: UIState }) => 
  state.ui.modals[modalId]

// Selector para verificar si un loading específico está activo
export const selectIsLoading = (key: string) => (state: { ui: UIState }) => 
  Boolean(state.ui.loadingStates[key])
