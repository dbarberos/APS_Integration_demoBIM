import { apiRequest, buildUrl } from './api'
import { Project, PaginatedResponse } from '@/types'

// Endpoints de proyectos
const PROJECT_ENDPOINTS = {
  PROJECTS: '/projects',
  PROJECT_BY_ID: (id: number) => `/projects/${id}`,
  PROJECT_FILES: (id: number) => `/projects/${id}/files`,
  PROJECT_STATS: (id: number) => `/projects/${id}/stats`,
  BULK_DELETE: '/projects/bulk-delete',
  RECENT: '/projects/recent',
  STATS: '/projects/stats',
  DUPLICATE: (id: number) => `/projects/${id}/duplicate`,
  EXPORT: (id: number) => `/projects/${id}/export`,
  IMPORT: '/projects/import',
} as const

// Interfaz para parámetros de búsqueda de proyectos
interface ProjectSearchParams {
  page?: number
  perPage?: number
  search?: string
  filters?: {
    dateRange?: {
      start?: string | null
      end?: string | null
    }
    status?: string[]
    userId?: number | null
  }
  sorting?: {
    field?: 'name' | 'created_at' | 'updated_at'
    direction?: 'asc' | 'desc'
  }
}

// Interfaz para crear proyecto
interface CreateProjectData {
  name: string
  description?: string
}

// Interfaz para actualizar proyecto
interface UpdateProjectData {
  name?: string
  description?: string
}

// Servicio de proyectos
export const projectService = {
  /**
   * Obtener lista de proyectos con filtros y paginación
   */
  async getProjects(params: ProjectSearchParams = {}): Promise<PaginatedResponse<Project>> {
    const queryParams: Record<string, any> = {}
    
    // Paginación
    if (params.page) queryParams.page = params.page
    if (params.perPage) queryParams.per_page = params.perPage
    
    // Búsqueda
    if (params.search) queryParams.search = params.search
    
    // Filtros
    if (params.filters) {
      const { filters } = params
      if (filters.status?.length) queryParams.status = filters.status
      if (filters.userId) queryParams.user_id = filters.userId
      if (filters.dateRange?.start) queryParams.created_after = filters.dateRange.start
      if (filters.dateRange?.end) queryParams.created_before = filters.dateRange.end
    }
    
    // Ordenamiento
    if (params.sorting) {
      if (params.sorting.field) queryParams.sort_by = params.sorting.field
      if (params.sorting.direction) queryParams.sort_order = params.sorting.direction
    }
    
    const url = buildUrl(PROJECT_ENDPOINTS.PROJECTS, queryParams)
    return await apiRequest.get<PaginatedResponse<Project>>(url)
  },

  /**
   * Obtener proyecto por ID
   */
  async getProjectById(id: number): Promise<Project> {
    return await apiRequest.get<Project>(PROJECT_ENDPOINTS.PROJECT_BY_ID(id))
  },

  /**
   * Crear nuevo proyecto
   */
  async createProject(data: CreateProjectData): Promise<Project> {
    return await apiRequest.post<Project>(PROJECT_ENDPOINTS.PROJECTS, data)
  },

  /**
   * Actualizar proyecto
   */
  async updateProject(id: number, data: UpdateProjectData): Promise<Project> {
    return await apiRequest.patch<Project>(PROJECT_ENDPOINTS.PROJECT_BY_ID(id), data)
  },

  /**
   * Eliminar proyecto
   */
  async deleteProject(id: number): Promise<void> {
    await apiRequest.delete(PROJECT_ENDPOINTS.PROJECT_BY_ID(id))
  },

  /**
   * Eliminar múltiples proyectos
   */
  async deleteMultipleProjects(projectIds: number[]): Promise<void> {
    await apiRequest.post(PROJECT_ENDPOINTS.BULK_DELETE, {
      project_ids: projectIds,
    })
  },

  /**
   * Obtener archivos de un proyecto
   */
  async getProjectFiles(
    id: number,
    params: {
      page?: number
      perPage?: number
      search?: string
      status?: string[]
    } = {}
  ): Promise<PaginatedResponse<any>> {
    const queryParams: Record<string, any> = {}
    
    if (params.page) queryParams.page = params.page
    if (params.perPage) queryParams.per_page = params.perPage
    if (params.search) queryParams.search = params.search
    if (params.status?.length) queryParams.status = params.status
    
    const url = buildUrl(PROJECT_ENDPOINTS.PROJECT_FILES(id), queryParams)
    return await apiRequest.get<PaginatedResponse<any>>(url)
  },

  /**
   * Obtener estadísticas de un proyecto específico
   */
  async getProjectStatsById(id: number): Promise<{
    total_files: number
    total_size: number
    file_types: Record<string, number>
    recent_activity: Array<{
      action: string
      timestamp: string
      details: string
    }>
    storage_usage: {
      used: number
      limit: number
      percentage: number
    }
    translation_stats: {
      total: number
      completed: number
      failed: number
      in_progress: number
    }
  }> {
    return await apiRequest.get(PROJECT_ENDPOINTS.PROJECT_STATS(id))
  },

  /**
   * Obtener estadísticas generales de proyectos del usuario
   */
  async getProjectStats(): Promise<{
    totalProjects: number
    totalFiles: number
    totalStorage: number
    recentProjects: Project[]
  }> {
    return await apiRequest.get(PROJECT_ENDPOINTS.STATS)
  },

  /**
   * Obtener proyectos recientes
   */
  async getRecentProjects(limit: number = 5): Promise<Project[]> {
    const url = buildUrl(PROJECT_ENDPOINTS.RECENT, { limit })
    return await apiRequest.get<Project[]>(url)
  },

  /**
   * Duplicar proyecto
   */
  async duplicateProject(id: number, newName?: string): Promise<Project> {
    return await apiRequest.post<Project>(PROJECT_ENDPOINTS.DUPLICATE(id), {
      name: newName,
    })
  },

  /**
   * Exportar proyecto
   */
  async exportProject(id: number, format: 'zip' | 'json' = 'zip'): Promise<void> {
    const response = await apiRequest.get(
      PROJECT_ENDPOINTS.EXPORT(id),
      {
        params: { format },
        responseType: 'blob',
      }
    )
    
    // Crear blob y descargar
    const blob = new Blob([response])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `project_${id}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },

  /**
   * Importar proyecto
   */
  async importProject(file: File): Promise<Project> {
    const formData = new FormData()
    formData.append('file', file)
    
    return await apiRequest.post<Project>(PROJECT_ENDPOINTS.IMPORT, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  /**
   * Validar nombre de proyecto
   */
  validateProjectName(name: string): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []
    
    // Validar longitud
    if (!name || name.trim().length === 0) {
      errors.push('El nombre del proyecto es requerido')
    } else if (name.trim().length < 3) {
      errors.push('El nombre debe tener al menos 3 caracteres')
    } else if (name.trim().length > 100) {
      errors.push('El nombre no puede exceder 100 caracteres')
    }
    
    // Validar caracteres
    const validNameRegex = /^[a-zA-Z0-9\s\-_\.áéíóúñÁÉÍÓÚÑ]+$/
    if (name && !validNameRegex.test(name.trim())) {
      errors.push('El nombre contiene caracteres no válidos')
    }
    
    // Validar nombres reservados
    const reservedNames = ['con', 'prn', 'aux', 'null', 'admin', 'root']
    if (reservedNames.includes(name.trim().toLowerCase())) {
      errors.push('Este nombre está reservado, por favor elige otro')
    }
    
    return {
      valid: errors.length === 0,
      errors,
    }
  },

  /**
   * Generar nombre único para proyecto
   */
  generateUniqueProjectName(baseName: string, existingNames: string[]): string {
    let counter = 1
    let newName = baseName
    
    while (existingNames.includes(newName)) {
      newName = `${baseName} (${counter})`
      counter++
    }
    
    return newName
  },

  /**
   * Obtener plantillas de proyecto
   */
  getProjectTemplates(): Array<{
    id: string
    name: string
    description: string
    icon: string
    category: string
    files?: Array<{
      name: string
      type: string
      description: string
    }>
  }> {
    return [
      {
        id: 'architectural',
        name: 'Proyecto Arquitectónico',
        description: 'Plantilla para proyectos de arquitectura con estructura BIM estándar',
        icon: 'building',
        category: 'Arquitectura',
        files: [
          { name: 'Planos Arquitectónicos', type: 'rvt', description: 'Modelo principal de Revit' },
          { name: 'Detalles Constructivos', type: 'dwg', description: 'Detalles en AutoCAD' },
        ]
      },
      {
        id: 'structural',
        name: 'Proyecto Estructural',
        description: 'Plantilla para proyectos de ingeniería estructural',
        icon: 'support',
        category: 'Estructura',
        files: [
          { name: 'Modelo Estructural', type: 'rvt', description: 'Modelo estructural de Revit' },
          { name: 'Análisis Estructural', type: 'ifc', description: 'Modelo para análisis' },
        ]
      },
      {
        id: 'mep',
        name: 'Proyecto MEP',
        description: 'Plantilla para proyectos de instalaciones (MEP)',
        icon: 'lightning-bolt',
        category: 'Instalaciones',
        files: [
          { name: 'Instalaciones Eléctricas', type: 'rvt', description: 'Sistema eléctrico' },
          { name: 'Instalaciones Sanitarias', type: 'rvt', description: 'Sistema sanitario' },
          { name: 'HVAC', type: 'rvt', description: 'Sistema de climatización' },
        ]
      },
      {
        id: 'civil',
        name: 'Proyecto Civil',
        description: 'Plantilla para proyectos de ingeniería civil',
        icon: 'map',
        category: 'Civil',
        files: [
          { name: 'Topografía', type: 'dwg', description: 'Levantamiento topográfico' },
          { name: 'Vialidad', type: 'dwg', description: 'Diseño vial' },
        ]
      },
      {
        id: 'industrial',
        name: 'Proyecto Industrial',
        description: 'Plantilla para proyectos industriales y manufactura',
        icon: 'cog',
        category: 'Industrial',
        files: [
          { name: 'Layout Industrial', type: '3dm', description: 'Distribución de planta' },
          { name: 'Maquinaria', type: 'step', description: 'Modelos de equipos' },
        ]
      },
      {
        id: 'empty',
        name: 'Proyecto Vacío',
        description: 'Proyecto en blanco para empezar desde cero',
        icon: 'document-add',
        category: 'General',
      },
    ]
  },

  /**
   * Crear proyecto desde plantilla
   */
  async createProjectFromTemplate(
    templateId: string,
    name: string,
    description?: string
  ): Promise<Project> {
    return await apiRequest.post<Project>('/projects/from-template', {
      template_id: templateId,
      name,
      description,
    })
  },

  /**
   * Obtener configuración de proyecto
   */
  async getProjectConfig(id: number): Promise<{
    auto_translation: boolean
    default_output_formats: string[]
    quality_level: string
    notification_settings: {
      email: boolean
      in_app: boolean
      translation_complete: boolean
      translation_failed: boolean
    }
    access_settings: {
      public: boolean
      allow_downloads: boolean
      allow_comments: boolean
    }
  }> {
    return await apiRequest.get(`/projects/${id}/config`)
  },

  /**
   * Actualizar configuración de proyecto
   */
  async updateProjectConfig(id: number, config: any): Promise<void> {
    await apiRequest.patch(`/projects/${id}/config`, config)
  },

  /**
   * Obtener actividad reciente del proyecto
   */
  async getProjectActivity(
    id: number,
    params: {
      page?: number
      perPage?: number
      types?: string[]
    } = {}
  ): Promise<PaginatedResponse<{
    id: string
    type: string
    action: string
    user: string
    timestamp: string
    details: Record<string, any>
    metadata?: Record<string, any>
  }>> {
    const queryParams: Record<string, any> = {}
    
    if (params.page) queryParams.page = params.page
    if (params.perPage) queryParams.per_page = params.perPage
    if (params.types?.length) queryParams.types = params.types
    
    const url = buildUrl(`/projects/${id}/activity`, queryParams)
    return await apiRequest.get<PaginatedResponse<any>>(url)
  },

  /**
   * Formatear estadísticas de proyecto
   */
  formatProjectStats(stats: any): {
    filesCount: string
    totalSize: string
    storageUsage: string
    translationSuccess: string
  } {
    return {
      filesCount: stats.total_files?.toLocaleString() || '0',
      totalSize: this.formatBytes(stats.total_size || 0),
      storageUsage: `${stats.storage_usage?.percentage || 0}%`,
      translationSuccess: `${Math.round((stats.translation_stats?.completed || 0) / (stats.translation_stats?.total || 1) * 100)}%`,
    }
  },

  /**
   * Formatear bytes a tamaño legible
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  },
}

// Funciones de conveniencia (named exports)
export const getProjects = projectService.getProjects
export const getProjectById = projectService.getProjectById
export const createProject = projectService.createProject
export const updateProject = projectService.updateProject
export const deleteProject = projectService.deleteProject
export const deleteMultipleProjects = projectService.deleteMultipleProjects
export const getProjectFiles = projectService.getProjectFiles
export const getProjectStatsById = projectService.getProjectStatsById
export const getProjectStats = projectService.getProjectStats
export const getRecentProjects = projectService.getRecentProjects
export const duplicateProject = projectService.duplicateProject
export const exportProject = projectService.exportProject
export const importProject = projectService.importProject
export const validateProjectName = projectService.validateProjectName
export const generateUniqueProjectName = projectService.generateUniqueProjectName
export const getProjectTemplates = projectService.getProjectTemplates
export const createProjectFromTemplate = projectService.createProjectFromTemplate
export const getProjectConfig = projectService.getProjectConfig
export const updateProjectConfig = projectService.updateProjectConfig
export const getProjectActivity = projectService.getProjectActivity

export default projectService
