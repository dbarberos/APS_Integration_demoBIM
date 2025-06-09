import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux'
import type { RootState, AppDispatch } from '@/store/store'

// Hooks tipados para Redux
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// Hook para obtener loading states
export const useLoadingState = (key: string) => {
  return useAppSelector((state) => Boolean(state.ui.loadingStates[key]))
}

// Hook para verificar si hay algún loading activo
export const useHasActiveLoading = () => {
  return useAppSelector((state) => 
    state.ui.globalLoading || Object.keys(state.ui.loadingStates).length > 0
  )
}

// Hook para obtener modal específico
export const useModal = (modalId: string) => {
  return useAppSelector((state) => state.ui.modals[modalId])
}

// Hook para obtener estado de autenticación básico
export const useAuthState = () => {
  const auth = useAppSelector((state) => state.auth)
  
  return {
    user: auth.user,
    token: auth.token,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    preferences: auth.preferences,
    loginAttempts: auth.loginAttempts,
  }
}

// Hook para obtener información del usuario actual
export const useCurrentUser = () => {
  return useAppSelector((state) => state.auth.user)
}

// Hook para verificar permisos del usuario
export const useUserPermissions = () => {
  const user = useCurrentUser()
  
  return {
    isAdmin: user?.is_superuser || false,
    isActive: user?.is_active || false,
    canCreate: user?.is_active || false,
    canEdit: user?.is_active || false,
    canDelete: user?.is_superuser || false,
  }
}

// Hook para obtener configuración de tema
export const useTheme = () => {
  const themeConfig = useAppSelector((state) => state.ui.themeConfig)
  const theme = useAppSelector((state) => state.ui.theme)
  
  return {
    theme,
    themeConfig,
    isDark: theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
  }
}

// Hook para obtener estado del sidebar
export const useSidebar = () => {
  const collapsed = useAppSelector((state) => state.ui.sidebarCollapsed)
  const mobile = useAppSelector((state) => state.ui.sidebarMobile)
  
  return {
    collapsed,
    mobile,
    isOpen: !collapsed || mobile,
  }
}

// Hook para obtener notificaciones
export const useNotifications = () => {
  const notifications = useAppSelector((state) => state.ui.notifications)
  const unreadCount = notifications.filter(n => !n.read).length
  
  return {
    notifications,
    unreadCount,
    hasUnread: unreadCount > 0,
  }
}

// Hook para obtener toasts
export const useToasts = () => {
  return useAppSelector((state) => state.ui.toasts)
}

// Hook para obtener estado de archivos
export const useFiles = () => {
  const files = useAppSelector((state) => state.files)
  
  return {
    files: files.files,
    currentFile: files.currentFile,
    selectedFiles: files.selectedFiles,
    isLoading: files.isLoading,
    isUploading: files.isUploading,
    error: files.error,
    pagination: files.pagination,
    filters: files.filters,
    sorting: files.sorting,
    searchQuery: files.searchQuery,
    uploadProgress: files.uploadProgress,
  }
}

// Hook para obtener estado de traducciones
export const useTranslation = () => {
  const translation = useAppSelector((state) => state.translation)
  
  return {
    jobs: translation.jobs,
    currentJob: translation.currentJob,
    activeJobs: translation.activeJobs,
    recentJobs: translation.recentJobs,
    selectedJobs: translation.selectedJobs,
    isLoading: translation.isLoading,
    isStartingTranslation: translation.isStartingTranslation,
    isRetrying: translation.isRetrying,
    error: translation.error,
    stats: translation.stats,
    pagination: translation.pagination,
    filters: translation.filters,
    sorting: translation.sorting,
    searchQuery: translation.searchQuery,
    pollingConfig: translation.pollingConfig,
  }
}

// Hook para obtener estado de proyectos
export const useProjects = () => {
  const projects = useAppSelector((state) => state.projects)
  
  return {
    projects: projects.projects,
    currentProject: projects.currentProject,
    selectedProjects: projects.selectedProjects,
    isLoading: projects.isLoading,
    isCreating: projects.isCreating,
    isUpdating: projects.isUpdating,
    isDeleting: projects.isDeleting,
    error: projects.error,
    stats: projects.stats,
    pagination: projects.pagination,
    filters: projects.filters,
    sorting: projects.sorting,
    searchQuery: projects.searchQuery,
  }
}

// Hook para obtener breadcrumbs
export const useBreadcrumbs = () => {
  return useAppSelector((state) => state.ui.breadcrumbs)
}

// Hook para obtener estado del viewer
export const useViewer = () => {
  return useAppSelector((state) => state.ui.viewerState)
}

// Hook para obtener configuración de idioma
export const useLanguage = () => {
  const language = useAppSelector((state) => state.ui.language)
  const locale = useAppSelector((state) => state.ui.locale)
  
  return {
    language,
    locale,
    isSpanish: language === 'es',
    isEnglish: language === 'en',
  }
}

// Hook para obtener preferencias de layout
export const useLayoutPreferences = () => {
  return useAppSelector((state) => state.ui.layout)
}

// Hook para obtener estado de búsqueda global
export const useGlobalSearch = () => {
  return useAppSelector((state) => state.ui.globalSearch)
}

// Hook para obtener zona de upload
export const useUploadZone = () => {
  return useAppSelector((state) => state.ui.uploadZone)
}

// Hook para obtener errores
export const useErrors = () => {
  const errors = useAppSelector((state) => state.ui.errors)
  const activeErrors = errors.filter(e => !e.dismissed)
  
  return {
    errors,
    activeErrors,
    hasErrors: activeErrors.length > 0,
  }
}

// Hook para obtener métricas de performance
export const usePerformance = () => {
  return useAppSelector((state) => state.ui.performance)
}

// Hook combinado para obtener toda la información del estado actual
export const useAppState = () => {
  const auth = useAuthState()
  const theme = useTheme()
  const sidebar = useSidebar()
  const notifications = useNotifications()
  const files = useFiles()
  const translation = useTranslation()
  const projects = useProjects()
  const language = useLanguage()
  
  return {
    auth,
    theme,
    sidebar,
    notifications,
    files,
    translation,
    projects,
    language,
    isLoading: useHasActiveLoading(),
  }
}
