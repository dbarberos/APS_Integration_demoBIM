import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from './redux'
import {
  toggleSidebar,
  setSidebarCollapsed,
  setSidebarMobile,
  setTheme,
  updateThemeConfig,
  setGlobalLoading,
  setLoadingState,
  clearAllLoading,
  openModal,
  closeModal,
  removeModal,
  clearAllModals,
  addToast,
  removeToast,
  clearAllToasts,
  addNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  removeNotification,
  clearAllNotifications,
  setLanguage,
  updateLayoutPreferences,
  setBreadcrumbs,
  addBreadcrumb,
  setCurrentPage,
  setGlobalSearchQuery,
  toggleGlobalSearch,
  addRecentSearch,
  setSearchSuggestions,
  setUploadZoneVisible,
  setUploadZoneDragOver,
  setUploadZoneFiles,
  clearUploadZone,
  updateViewerState,
  toggleViewerFullscreen,
  toggleViewerPanel,
  updateShortcuts,
  setCustomBinding,
  addError,
  dismissError,
  clearErrors,
  updatePerformance,
} from '@/store/slices/uiSlice'
import type { Theme, Toast, Notification, Modal } from '@/types'

export const useUI = () => {
  const dispatch = useAppDispatch()
  
  const {
    sidebarCollapsed,
    sidebarMobile,
    theme,
    themeConfig,
    globalLoading,
    loadingStates,
    modals,
    toasts,
    notifications,
    language,
    layout,
    breadcrumbs,
    currentPage,
    globalSearch,
    uploadZone,
    viewerState,
    shortcuts,
    errors,
    performance,
  } = useAppSelector((state) => state.ui)

  // Theme management
  const handleSetTheme = useCallback((newTheme: Theme) => {
    dispatch(setTheme(newTheme))
    
    // Aplicar tema al DOM
    const root = document.documentElement
    if (newTheme === 'dark') {
      root.classList.add('dark')
    } else if (newTheme === 'light') {
      root.classList.remove('dark')
    } else { // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [dispatch])

  const handleUpdateThemeConfig = useCallback((updates: any) => {
    dispatch(updateThemeConfig(updates))
  }, [dispatch])

  // Sidebar management
  const handleToggleSidebar = useCallback(() => {
    dispatch(toggleSidebar())
  }, [dispatch])

  const handleSetSidebarCollapsed = useCallback((collapsed: boolean) => {
    dispatch(setSidebarCollapsed(collapsed))
  }, [dispatch])

  const handleSetSidebarMobile = useCallback((mobile: boolean) => {
    dispatch(setSidebarMobile(mobile))
  }, [dispatch])

  // Loading states
  const handleSetGlobalLoading = useCallback((loading: boolean) => {
    dispatch(setGlobalLoading(loading))
  }, [dispatch])

  const handleSetLoadingState = useCallback((key: string, loading: boolean) => {
    dispatch(setLoadingState({ key, loading }))
  }, [dispatch])

  const handleClearAllLoading = useCallback(() => {
    dispatch(clearAllLoading())
  }, [dispatch])

  // Modal management
  const handleOpenModal = useCallback((modalData: {
    id: string
    type: string
    data?: any
    options?: Modal['options']
  }) => {
    dispatch(openModal(modalData))
  }, [dispatch])

  const handleCloseModal = useCallback((modalId: string) => {
    dispatch(closeModal(modalId))
  }, [dispatch])

  const handleRemoveModal = useCallback((modalId: string) => {
    dispatch(removeModal(modalId))
  }, [dispatch])

  const handleClearAllModals = useCallback(() => {
    dispatch(clearAllModals())
  }, [dispatch])

  // Toast management
  const handleAddToast = useCallback((toast: Omit<Toast, 'id'>) => {
    dispatch(addToast(toast))
  }, [dispatch])

  const handleRemoveToast = useCallback((toastId: string) => {
    dispatch(removeToast(toastId))
  }, [dispatch])

  const handleClearAllToasts = useCallback(() => {
    dispatch(clearAllToasts())
  }, [dispatch])

  // Convenience toast methods
  const showSuccessToast = useCallback((title: string, message?: string) => {
    handleAddToast({ type: 'success', title, message })
  }, [handleAddToast])

  const showErrorToast = useCallback((title: string, message?: string) => {
    handleAddToast({ type: 'error', title, message })
  }, [handleAddToast])

  const showInfoToast = useCallback((title: string, message?: string) => {
    handleAddToast({ type: 'info', title, message })
  }, [handleAddToast])

  const showWarningToast = useCallback((title: string, message?: string) => {
    handleAddToast({ type: 'warning', title, message })
  }, [handleAddToast])

  // Notification management
  const handleAddNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    dispatch(addNotification(notification))
  }, [dispatch])

  const handleMarkNotificationAsRead = useCallback((notificationId: string) => {
    dispatch(markNotificationAsRead(notificationId))
  }, [dispatch])

  const handleMarkAllNotificationsAsRead = useCallback(() => {
    dispatch(markAllNotificationsAsRead())
  }, [dispatch])

  const handleRemoveNotification = useCallback((notificationId: string) => {
    dispatch(removeNotification(notificationId))
  }, [dispatch])

  const handleClearAllNotifications = useCallback(() => {
    dispatch(clearAllNotifications())
  }, [dispatch])

  // Language management
  const handleSetLanguage = useCallback((newLanguage: 'es' | 'en') => {
    dispatch(setLanguage(newLanguage))
  }, [dispatch])

  // Layout preferences
  const handleUpdateLayoutPreferences = useCallback((updates: any) => {
    dispatch(updateLayoutPreferences(updates))
  }, [dispatch])

  // Navigation
  const handleSetBreadcrumbs = useCallback((breadcrumbData: any) => {
    dispatch(setBreadcrumbs(breadcrumbData))
  }, [dispatch])

  const handleAddBreadcrumb = useCallback((breadcrumb: { label: string; path?: string }) => {
    dispatch(addBreadcrumb(breadcrumb))
  }, [dispatch])

  const handleSetCurrentPage = useCallback((page: string) => {
    dispatch(setCurrentPage(page))
  }, [dispatch])

  // Global search
  const handleSetGlobalSearchQuery = useCallback((query: string) => {
    dispatch(setGlobalSearchQuery(query))
  }, [dispatch])

  const handleToggleGlobalSearch = useCallback(() => {
    dispatch(toggleGlobalSearch())
  }, [dispatch])

  const handleAddRecentSearch = useCallback((query: string) => {
    dispatch(addRecentSearch(query))
  }, [dispatch])

  const handleSetSearchSuggestions = useCallback((suggestions: string[]) => {
    dispatch(setSearchSuggestions(suggestions))
  }, [dispatch])

  // Upload zone
  const handleSetUploadZoneVisible = useCallback((visible: boolean) => {
    dispatch(setUploadZoneVisible(visible))
  }, [dispatch])

  const handleSetUploadZoneDragOver = useCallback((dragOver: boolean) => {
    dispatch(setUploadZoneDragOver(dragOver))
  }, [dispatch])

  const handleSetUploadZoneFiles = useCallback((files: File[]) => {
    dispatch(setUploadZoneFiles(files))
  }, [dispatch])

  const handleClearUploadZone = useCallback(() => {
    dispatch(clearUploadZone())
  }, [dispatch])

  // Viewer state
  const handleUpdateViewerState = useCallback((updates: any) => {
    dispatch(updateViewerState(updates))
  }, [dispatch])

  const handleToggleViewerFullscreen = useCallback(() => {
    dispatch(toggleViewerFullscreen())
  }, [dispatch])

  const handleToggleViewerPanel = useCallback((panel: 'modelTree' | 'properties' | 'navigationBar') => {
    dispatch(toggleViewerPanel(panel))
  }, [dispatch])

  // Shortcuts
  const handleUpdateShortcuts = useCallback((updates: any) => {
    dispatch(updateShortcuts(updates))
  }, [dispatch])

  const handleSetCustomBinding = useCallback((action: string, binding: string) => {
    dispatch(setCustomBinding({ action, binding }))
  }, [dispatch])

  // Error management
  const handleAddError = useCallback((error: { message: string; type?: 'error' | 'warning' | 'info' }) => {
    dispatch(addError(error))
  }, [dispatch])

  const handleDismissError = useCallback((errorId: string) => {
    dispatch(dismissError(errorId))
  }, [dispatch])

  const handleClearErrors = useCallback(() => {
    dispatch(clearErrors())
  }, [dispatch])

  // Performance
  const handleUpdatePerformance = useCallback((updates: any) => {
    dispatch(updatePerformance(updates))
  }, [dispatch])

  // Utility functions
  const isModalOpen = useCallback((modalId: string) => {
    return modals[modalId]?.isOpen || false
  }, [modals])

  const getModalData = useCallback((modalId: string) => {
    return modals[modalId]?.data
  }, [modals])

  const getUnreadNotificationCount = useCallback(() => {
    return notifications.filter(n => !n.read).length
  }, [notifications])

  const hasActiveLoading = useCallback(() => {
    return globalLoading || Object.keys(loadingStates).length > 0
  }, [globalLoading, loadingStates])

  const isLoading = useCallback((key: string) => {
    return Boolean(loadingStates[key])
  }, [loadingStates])

  const getActiveErrors = useCallback(() => {
    return errors.filter(e => !e.dismissed)
  }, [errors])

  const getDarkMode = useCallback(() => {
    if (theme === 'dark') return true
    if (theme === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }, [theme])

  // Auto-dismiss toasts
  useEffect(() => {
    toasts.forEach(toast => {
      if (toast.duration && toast.duration > 0) {
        const timer = setTimeout(() => {
          handleRemoveToast(toast.id)
        }, toast.duration)
        
        return () => clearTimeout(timer)
      }
    })
  }, [toasts, handleRemoveToast])

  // System theme listener
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      
      const handleChange = (e: MediaQueryListEvent) => {
        const root = document.documentElement
        if (e.matches) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      }
      
      mediaQuery.addEventListener('change', handleChange)
      
      // Set initial theme
      const root = document.documentElement
      if (mediaQuery.matches) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
      
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  return {
    // State
    sidebarCollapsed,
    sidebarMobile,
    theme,
    themeConfig,
    globalLoading,
    loadingStates,
    modals,
    toasts,
    notifications,
    language,
    layout,
    breadcrumbs,
    currentPage,
    globalSearch,
    uploadZone,
    viewerState,
    shortcuts,
    errors,
    performance,
    
    // Theme
    setTheme: handleSetTheme,
    updateThemeConfig: handleUpdateThemeConfig,
    
    // Sidebar
    toggleSidebar: handleToggleSidebar,
    setSidebarCollapsed: handleSetSidebarCollapsed,
    setSidebarMobile: handleSetSidebarMobile,
    
    // Loading
    setGlobalLoading: handleSetGlobalLoading,
    setLoadingState: handleSetLoadingState,
    clearAllLoading: handleClearAllLoading,
    
    // Modals
    openModal: handleOpenModal,
    closeModal: handleCloseModal,
    removeModal: handleRemoveModal,
    clearAllModals: handleClearAllModals,
    
    // Toasts
    addToast: handleAddToast,
    removeToast: handleRemoveToast,
    clearAllToasts: handleClearAllToasts,
    showSuccessToast,
    showErrorToast,
    showInfoToast,
    showWarningToast,
    
    // Notifications
    addNotification: handleAddNotification,
    markNotificationAsRead: handleMarkNotificationAsRead,
    markAllNotificationsAsRead: handleMarkAllNotificationsAsRead,
    removeNotification: handleRemoveNotification,
    clearAllNotifications: handleClearAllNotifications,
    
    // Language
    setLanguage: handleSetLanguage,
    
    // Layout
    updateLayoutPreferences: handleUpdateLayoutPreferences,
    
    // Navigation
    setBreadcrumbs: handleSetBreadcrumbs,
    addBreadcrumb: handleAddBreadcrumb,
    setCurrentPage: handleSetCurrentPage,
    
    // Search
    setGlobalSearchQuery: handleSetGlobalSearchQuery,
    toggleGlobalSearch: handleToggleGlobalSearch,
    addRecentSearch: handleAddRecentSearch,
    setSearchSuggestions: handleSetSearchSuggestions,
    
    // Upload zone
    setUploadZoneVisible: handleSetUploadZoneVisible,
    setUploadZoneDragOver: handleSetUploadZoneDragOver,
    setUploadZoneFiles: handleSetUploadZoneFiles,
    clearUploadZone: handleClearUploadZone,
    
    // Viewer
    updateViewerState: handleUpdateViewerState,
    toggleViewerFullscreen: handleToggleViewerFullscreen,
    toggleViewerPanel: handleToggleViewerPanel,
    
    // Shortcuts
    updateShortcuts: handleUpdateShortcuts,
    setCustomBinding: handleSetCustomBinding,
    
    // Errors
    addError: handleAddError,
    dismissError: handleDismissError,
    clearErrors: handleClearErrors,
    
    // Performance
    updatePerformance: handleUpdatePerformance,
    
    // Utilities
    isModalOpen,
    getModalData,
    getUnreadNotificationCount,
    hasActiveLoading,
    isLoading,
    getActiveErrors,
    getDarkMode,
  }
}

export default useUI
