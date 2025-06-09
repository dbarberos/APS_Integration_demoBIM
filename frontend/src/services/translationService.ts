import { apiRequest, buildUrl, apiConfig } from './api'
import { TranslationJob, PaginatedResponse } from '@/types'

// Endpoints de traducción
const TRANSLATION_ENDPOINTS = {
  TRANSLATE: '/translate',
  JOB_BY_ID: (jobId: string) => `/translate/${jobId}`,
  JOB_STATUS: (jobId: string) => `/translate/${jobId}/status`,
  JOB_MANIFEST: (jobId: string) => `/translate/${jobId}/manifest`,
  JOB_METADATA: (jobId: string) => `/translate/${jobId}/metadata`,
  JOB_HIERARCHY: (jobId: string) => `/translate/${jobId}/hierarchy`,
  JOB_RETRY: (jobId: string) => `/translate/${jobId}/retry`,
  JOB_METRICS: (jobId: string) => `/translate/${jobId}/metrics`,
  SUPPORTED_FORMATS: '/translate/formats/supported',
  STATS_OVERVIEW: '/translate/stats/overview',
  ACTIVE_JOBS: '/translate/active',
  RECENT_JOBS: '/translate/recent',
} as const

// Interfaz para parámetros de búsqueda de trabajos
interface TranslationSearchParams {
  page?: number
  perPage?: number
  search?: string
  filters?: {
    status?: string[]
    priority?: string[]
    dateRange?: {
      start?: string | null
      end?: string | null
    }
    fileTypes?: string[]
    userId?: number | null
  }
  sorting?: {
    field?: 'created_at' | 'status' | 'priority' | 'progress' | 'estimated_duration'
    direction?: 'asc' | 'desc'
  }
}

// Interfaz para iniciar traducción
interface StartTranslationParams {
  fileId: number
  outputFormats: string[]
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  qualityLevel?: 'low' | 'medium' | 'high'
  configName?: string
  customConfig?: Record<string, any>
  autoExtractMetadata?: boolean
  generateThumbnails?: boolean
}

// Interfaz para reintentar traducción
interface RetryTranslationParams {
  reset_retry_count?: boolean
  new_config?: Record<string, any>
}

// Interfaz para cancelar traducción
interface CancelTranslationParams {
  reason?: string
  delete_manifest?: boolean
}

// Servicio de traducción
export const translationService = {
  /**
   * Obtener lista de trabajos de traducción con filtros y paginación
   */
  async getTranslationJobs(params: TranslationSearchParams = {}): Promise<PaginatedResponse<TranslationJob>> {
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
      if (filters.priority?.length) queryParams.priority = filters.priority
      if (filters.fileTypes?.length) queryParams.file_types = filters.fileTypes
      if (filters.userId) queryParams.user_id = filters.userId
      if (filters.dateRange?.start) queryParams.created_after = filters.dateRange.start
      if (filters.dateRange?.end) queryParams.created_before = filters.dateRange.end
    }
    
    // Ordenamiento
    if (params.sorting) {
      if (params.sorting.field) queryParams.sort_by = params.sorting.field
      if (params.sorting.direction) queryParams.sort_order = params.sorting.direction
    }
    
    const url = buildUrl(TRANSLATION_ENDPOINTS.TRANSLATE, queryParams)
    return await apiRequest.get<PaginatedResponse<TranslationJob>>(url)
  },

  /**
   * Obtener trabajo de traducción por ID
   */
  async getTranslationJobById(jobId: string): Promise<TranslationJob> {
    return await apiRequest.get<TranslationJob>(TRANSLATION_ENDPOINTS.JOB_BY_ID(jobId))
  },

  /**
   * Iniciar nueva traducción
   */
  async startTranslation(params: StartTranslationParams): Promise<TranslationJob> {
    const requestData = {
      file_id: params.fileId,
      output_formats: params.outputFormats,
      priority: params.priority || 'normal',
      quality_level: params.qualityLevel || 'medium',
      config_name: params.configName,
      custom_config: params.customConfig,
      auto_extract_metadata: params.autoExtractMetadata ?? true,
      generate_thumbnails: params.generateThumbnails ?? true,
    }
    
    return await apiRequest.post<TranslationJob>(
      TRANSLATION_ENDPOINTS.TRANSLATE,
      requestData,
      apiConfig.longRunning()
    )
  },

  /**
   * Obtener estado actual de traducción
   */
  async getTranslationStatus(jobId: string): Promise<{
    status: string
    progress: number
    progress_message?: string
    current_step?: string
    estimated_time_remaining?: number
    last_updated: string
    warnings?: string[]
  }> {
    return await apiRequest.get(
      TRANSLATION_ENDPOINTS.JOB_STATUS(jobId),
      apiConfig.polling()
    )
  },

  /**
   * Obtener manifest del modelo traducido
   */
  async getTranslationManifest(jobId: string): Promise<any> {
    return await apiRequest.get(TRANSLATION_ENDPOINTS.JOB_MANIFEST(jobId))
  },

  /**
   * Obtener metadatos extraídos del modelo
   */
  async getTranslationMetadata(jobId: string, extractFresh: boolean = false): Promise<any> {
    const queryParams = extractFresh ? { extract_fresh: 'true' } : {}
    const url = buildUrl(TRANSLATION_ENDPOINTS.JOB_METADATA(jobId), queryParams)
    return await apiRequest.get(url, apiConfig.longRunning())
  },

  /**
   * Obtener jerarquía de objetos del modelo
   */
  async getTranslationHierarchy(jobId: string): Promise<any> {
    return await apiRequest.get(TRANSLATION_ENDPOINTS.JOB_HIERARCHY(jobId))
  },

  /**
   * Reintentar traducción fallida
   */
  async retryTranslation(jobId: string, params: RetryTranslationParams = {}): Promise<TranslationJob> {
    return await apiRequest.post<TranslationJob>(
      TRANSLATION_ENDPOINTS.JOB_RETRY(jobId),
      params,
      apiConfig.longRunning()
    )
  },

  /**
   * Cancelar traducción en progreso
   */
  async cancelTranslation(jobId: string, params: CancelTranslationParams = {}): Promise<void> {
    await apiRequest.delete(TRANSLATION_ENDPOINTS.JOB_BY_ID(jobId), {
      data: params,
    })
  },

  /**
   * Obtener métricas de performance del trabajo
   */
  async getTranslationMetrics(jobId: string): Promise<{
    job_id: string
    queue_time: number
    processing_time: number
    total_time: number
    geometry_quality: number
    input_file_size: number
    output_file_size: number
    compression_ratio: number
    vertex_count: number
    face_count: number
    object_count: number
    warnings_count: number
    errors_count: number
    overall_quality_score: number
    efficiency_score: number
    measured_at: string
  }> {
    return await apiRequest.get(TRANSLATION_ENDPOINTS.JOB_METRICS(jobId))
  },

  /**
   * Obtener formatos soportados
   */
  async getSupportedFormats(): Promise<{
    input_formats: string[]
    output_formats: string[]
    format_details: Record<string, {
      name: string
      description: string
      supports_2d: boolean
      supports_3d: boolean
      file_size: string
    }>
    last_updated: string
  }> {
    return await apiRequest.get(TRANSLATION_ENDPOINTS.SUPPORTED_FORMATS)
  },

  /**
   * Obtener estadísticas generales de traducción
   */
  async getTranslationStats(days: number = 30): Promise<{
    total_translations: number
    successful_translations: number
    failed_translations: number
    pending_translations: number
    success_rate: number
    avg_processing_time: number
    avg_queue_time: number
    popular_formats: Record<string, number>
    translations_by_day: Record<string, number>
    translations_by_status: Record<string, number>
  }> {
    const url = buildUrl(TRANSLATION_ENDPOINTS.STATS_OVERVIEW, { days })
    return await apiRequest.get(url)
  },

  /**
   * Obtener trabajos de traducción activos
   */
  async getActiveTranslations(): Promise<TranslationJob[]> {
    return await apiRequest.get<TranslationJob[]>(TRANSLATION_ENDPOINTS.ACTIVE_JOBS)
  },

  /**
   * Obtener trabajos de traducción recientes
   */
  async getRecentTranslations(limit: number = 10): Promise<TranslationJob[]> {
    const url = buildUrl(TRANSLATION_ENDPOINTS.RECENT_JOBS, { limit })
    return await apiRequest.get<TranslationJob[]>(url)
  },

  /**
   * Polling automático de estado de trabajo
   */
  async pollTranslationStatus(
    jobId: string,
    onProgress: (status: any) => void,
    interval: number = 30000,
    maxAttempts: number = 120
  ): Promise<void> {
    let attempts = 0
    
    const poll = async (): Promise<void> => {
      try {
        const status = await this.getTranslationStatus(jobId)
        onProgress(status)
        
        // Si completó (éxito o fallo), dejar de hacer polling
        if (status.status === 'success' || status.status === 'failed' || status.status === 'cancelled') {
          return
        }
        
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, interval)
        }
      } catch (error) {
        console.error('Error polling translation status:', error)
        attempts++
        if (attempts < maxAttempts) {
          // Incrementar intervalo en caso de error
          setTimeout(poll, interval * 1.5)
        }
      }
    }
    
    poll()
  },

  /**
   * Obtener configuraciones predefinidas de traducción
   */
  getTranslationConfigurations(): Record<string, {
    name: string
    description: string
    outputFormats: string[]
    qualityLevel: 'low' | 'medium' | 'high'
    config: Record<string, any>
  }> {
    return {
      'revit_standard': {
        name: 'Revit Estándar',
        description: 'Configuración optimizada para archivos Revit con extracción completa de datos BIM',
        outputFormats: ['svf2', 'thumbnail'],
        qualityLevel: 'medium',
        config: {
          svf2: {
            generateMasterViews: true,
            buildingStoreys: true,
            spaces: true,
            materialProperties: true,
            compressionLevel: 6
          },
          thumbnail: {
            width: 400,
            height: 400
          }
        }
      },
      'ifc_standard': {
        name: 'IFC Estándar',
        description: 'Configuración para archivos IFC con elementos de construcción',
        outputFormats: ['svf2', 'thumbnail'],
        qualityLevel: 'medium',
        config: {
          svf2: {
            generateMasterViews: true,
            materialProperties: true,
            openingElements: true,
            compressionLevel: 6
          },
          thumbnail: {
            width: 400,
            height: 400
          }
        }
      },
      'autocad_2d': {
        name: 'AutoCAD 2D',
        description: 'Configuración para planos 2D de AutoCAD',
        outputFormats: ['svf', 'thumbnail'],
        qualityLevel: 'medium',
        config: {
          svf: {
            generateMasterViews: false,
            '2dviews': true,
            extractThumbnail: true
          },
          thumbnail: {
            width: 400,
            height: 400
          }
        }
      },
      'high_quality': {
        name: 'Alta Calidad',
        description: 'Máxima calidad para modelos importantes',
        outputFormats: ['svf2', 'thumbnail', 'obj'],
        qualityLevel: 'high',
        config: {
          svf2: {
            generateMasterViews: true,
            buildingStoreys: true,
            materialProperties: true,
            compressionLevel: 3
          },
          thumbnail: {
            width: 800,
            height: 600
          },
          obj: {
            exportMaterials: true
          }
        }
      },
      'fast_preview': {
        name: 'Vista Previa Rápida',
        description: 'Solo thumbnail para revisión rápida',
        outputFormats: ['thumbnail'],
        qualityLevel: 'low',
        config: {
          thumbnail: {
            width: 200,
            height: 200
          }
        }
      }
    }
  },

  /**
   * Calcular tiempo estimado de traducción
   */
  estimateTranslationTime(fileSize: number, outputFormats: string[], qualityLevel: string): number {
    // Tiempo base por MB según el nivel de calidad
    const baseTimePerMB = {
      low: 2,    // 2 segundos por MB
      medium: 5, // 5 segundos por MB
      high: 10   // 10 segundos por MB
    }
    
    // Factor multiplicador por formato de salida
    const formatMultiplier = {
      svf: 1.0,
      svf2: 1.2,
      thumbnail: 0.3,
      obj: 1.5,
      stl: 1.3,
      gltf: 1.8,
      step: 2.0,
      iges: 2.2
    }
    
    const fileSizeMB = fileSize / (1024 * 1024)
    const baseTime = fileSizeMB * (baseTimePerMB[qualityLevel as keyof typeof baseTimePerMB] || 5)
    
    // Calcular tiempo total considerando formatos
    const totalMultiplier = outputFormats.reduce((total, format) => {
      return total + (formatMultiplier[format as keyof typeof formatMultiplier] || 1.0)
    }, 0)
    
    return Math.ceil(baseTime * totalMultiplier)
  },

  /**
   * Obtener recomendaciones de configuración
   */
  getConfigRecommendations(fileExtension: string, fileSize: number): {
    recommended: string
    alternatives: string[]
    reasons: string[]
  } {
    const sizeMB = fileSize / (1024 * 1024)
    const ext = fileExtension.toLowerCase()
    
    const recommendations = {
      '.rvt': {
        recommended: sizeMB > 50 ? 'revit_standard' : 'high_quality',
        alternatives: ['fast_preview'],
        reasons: ['Optimizado para datos BIM de Revit', 'Extrae propiedades y materiales', 'Soporta vistas maestras']
      },
      '.ifc': {
        recommended: 'ifc_standard',
        alternatives: ['high_quality', 'fast_preview'],
        reasons: ['Configurado para estándar IFC', 'Preserva elementos de construcción', 'Compatible con diferentes versiones IFC']
      },
      '.dwg': {
        recommended: 'autocad_2d',
        alternatives: ['fast_preview'],
        reasons: ['Optimizado para planos 2D', 'Preserva layers y dimensiones', 'Rápida visualización']
      },
      '.dxf': {
        recommended: 'autocad_2d',
        alternatives: ['fast_preview'],
        reasons: ['Compatible con formato de intercambio', 'Mantiene precisión dimensional']
      }
    }
    
    return recommendations[ext] || {
      recommended: sizeMB > 20 ? 'fast_preview' : 'high_quality',
      alternatives: ['revit_standard'],
      reasons: ['Configuración general', 'Balance entre calidad y velocidad']
    }
  },
}

// Funciones de conveniencia (named exports)
export const getTranslationJobs = translationService.getTranslationJobs
export const getTranslationJobById = translationService.getTranslationJobById
export const startTranslation = translationService.startTranslation
export const getTranslationStatus = translationService.getTranslationStatus
export const getTranslationManifest = translationService.getTranslationManifest
export const getTranslationMetadata = translationService.getTranslationMetadata
export const getTranslationHierarchy = translationService.getTranslationHierarchy
export const retryTranslation = translationService.retryTranslation
export const cancelTranslation = translationService.cancelTranslation
export const getTranslationMetrics = translationService.getTranslationMetrics
export const getSupportedFormats = translationService.getSupportedFormats
export const getTranslationStats = translationService.getTranslationStats
export const getActiveTranslations = translationService.getActiveTranslations
export const getRecentTranslations = translationService.getRecentTranslations
export const pollTranslationStatus = translationService.pollTranslationStatus
export const getTranslationConfigurations = translationService.getTranslationConfigurations
export const estimateTranslationTime = translationService.estimateTranslationTime
export const getConfigRecommendations = translationService.getConfigRecommendations

export default translationService
