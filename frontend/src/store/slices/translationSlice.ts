import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { TranslationJob, PaginatedResponse, ApiError, QualityMetrics } from '@/types'
import * as translationService from '@/services/translationService'

export interface TranslationState {
  jobs: TranslationJob[]
  currentJob: TranslationJob | null
  activeJobs: TranslationJob[]
  recentJobs: TranslationJob[]
  selectedJobs: string[]
  
  // Filtros y búsqueda
  searchQuery: string
  filters: {
    status: string[]
    priority: string[]
    dateRange: {
      start: string | null
      end: string | null
    }
    fileTypes: string[]
    userId: number | null
  }
  
  // Ordenamiento y paginación
  sorting: {
    field: 'created_at' | 'status' | 'priority' | 'progress' | 'estimated_duration'
    direction: 'asc' | 'desc'
  }
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  
  // Estados de carga
  isLoading: boolean
  isStartingTranslation: boolean
  isRetrying: boolean
  error: string | null
  
  // Estadísticas
  stats: {
    totalJobs: number
    activeJobs: number
    completedJobs: number
    failedJobs: number
    successRate: number
    avgProcessingTime: number
    estimatedQueueTime: number
  }
  
  // Configuraciones
  pollingConfig: {
    enabled: boolean
    interval: number
    maxRetries: number
  }
  
  // Real-time updates
  lastUpdated: number | null
  subscriptions: Set<string>
}

const initialState: TranslationState = {
  jobs: [],
  currentJob: null,
  activeJobs: [],
  recentJobs: [],
  selectedJobs: [],
  
  searchQuery: '',
  filters: {
    status: [],
    priority: [],
    dateRange: {
      start: null,
      end: null,
    },
    fileTypes: [],
    userId: null,
  },
  
  sorting: {
    field: 'created_at',
    direction: 'desc',
  },
  pagination: {
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },
  
  isLoading: false,
  isStartingTranslation: false,
  isRetrying: false,
  error: null,
  
  stats: {
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    successRate: 0,
    avgProcessingTime: 0,
    estimatedQueueTime: 0,
  },
  
  pollingConfig: {
    enabled: true,
    interval: 30000, // 30 segundos
    maxRetries: 3,
  },
  
  lastUpdated: null,
  subscriptions: new Set(),
}

// Async thunks
export const fetchTranslationJobs = createAsyncThunk<
  PaginatedResponse<TranslationJob>,
  {
    page?: number
    perPage?: number
    search?: string
    filters?: Partial<TranslationState['filters']>
    sorting?: Partial<TranslationState['sorting']>
  },
  { rejectValue: ApiError }
>('translation/fetchJobs', async (params, { rejectWithValue }) => {
  try {
    const response = await translationService.getTranslationJobs(params)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al cargar trabajos de traducción',
      status: error.response?.status,
    })
  }
})

export const fetchTranslationJobById = createAsyncThunk<
  TranslationJob,
  string,
  { rejectValue: ApiError }
>('translation/fetchJobById', async (jobId, { rejectWithValue }) => {
  try {
    const response = await translationService.getTranslationJobById(jobId)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al cargar trabajo de traducción',
      status: error.response?.status,
    })
  }
})

export const startTranslation = createAsyncThunk<
  TranslationJob,
  {
    fileId: number
    outputFormats: string[]
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    qualityLevel?: 'low' | 'medium' | 'high'
    configName?: string
    customConfig?: Record<string, any>
    autoExtractMetadata?: boolean
    generateThumbnails?: boolean
  },
  { rejectValue: ApiError }
>('translation/startTranslation', async (params, { rejectWithValue }) => {
  try {
    const response = await translationService.startTranslation(params)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al iniciar traducción',
      status: error.response?.status,
    })
  }
})

export const retryTranslation = createAsyncThunk<
  TranslationJob,
  {
    jobId: string
    resetRetryCount?: boolean
    newConfig?: Record<string, any>
  },
  { rejectValue: ApiError }
>('translation/retryTranslation', async (params, { rejectWithValue }) => {
  try {
    const response = await translationService.retryTranslation(params.jobId, {
      reset_retry_count: params.resetRetryCount,
      new_config: params.newConfig,
    })
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al reintentar traducción',
      status: error.response?.status,
    })
  }
})

export const cancelTranslation = createAsyncThunk<
  string,
  {
    jobId: string
    reason?: string
    deleteManifest?: boolean
  },
  { rejectValue: ApiError }
>('translation/cancelTranslation', async (params, { rejectWithValue }) => {
  try {
    await translationService.cancelTranslation(params.jobId, {
      reason: params.reason,
      delete_manifest: params.deleteManifest,
    })
    return params.jobId
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al cancelar traducción',
      status: error.response?.status,
    })
  }
})

export const fetchTranslationStatus = createAsyncThunk<
  { jobId: string; status: string; progress: number; progressMessage?: string },
  string,
  { rejectValue: ApiError }
>('translation/fetchStatus', async (jobId, { rejectWithValue }) => {
  try {
    const response = await translationService.getTranslationStatus(jobId)
    return { jobId, ...response }
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al obtener estado',
      status: error.response?.status,
    })
  }
})

export const fetchTranslationManifest = createAsyncThunk<
  { jobId: string; manifest: any },
  string,
  { rejectValue: ApiError }
>('translation/fetchManifest', async (jobId, { rejectWithValue }) => {
  try {
    const manifest = await translationService.getTranslationManifest(jobId)
    return { jobId, manifest }
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al obtener manifest',
      status: error.response?.status,
    })
  }
})

export const fetchTranslationMetadata = createAsyncThunk<
  { jobId: string; metadata: any },
  { jobId: string; extractFresh?: boolean },
  { rejectValue: ApiError }
>('translation/fetchMetadata', async ({ jobId, extractFresh }, { rejectWithValue }) => {
  try {
    const metadata = await translationService.getTranslationMetadata(jobId, extractFresh)
    return { jobId, metadata }
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al obtener metadatos',
      status: error.response?.status,
    })
  }
})

export const fetchTranslationStats = createAsyncThunk<
  TranslationState['stats'],
  { days?: number },
  { rejectValue: ApiError }
>('translation/fetchStats', async ({ days = 30 }, { rejectWithValue }) => {
  try {
    const response = await translationService.getTranslationStats(days)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al obtener estadísticas',
      status: error.response?.status,
    })
  }
})

export const fetchActiveJobs = createAsyncThunk<
  TranslationJob[],
  void,
  { rejectValue: ApiError }
>('translation/fetchActiveJobs', async (_, { rejectWithValue }) => {
  try {
    const response = await translationService.getActiveTranslations()
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al cargar trabajos activos',
      status: error.response?.status,
    })
  }
})

// Slice
const translationSlice = createSlice({
  name: 'translation',
  initialState,
  reducers: {
    // Gestión de selección
    selectJob: (state, action: PayloadAction<string>) => {
      const jobId = action.payload
      if (!state.selectedJobs.includes(jobId)) {
        state.selectedJobs.push(jobId)
      }
    },
    
    deselectJob: (state, action: PayloadAction<string>) => {
      state.selectedJobs = state.selectedJobs.filter(id => id !== action.payload)
    },
    
    toggleJobSelection: (state, action: PayloadAction<string>) => {
      const jobId = action.payload
      const index = state.selectedJobs.indexOf(jobId)
      if (index > -1) {
        state.selectedJobs.splice(index, 1)
      } else {
        state.selectedJobs.push(jobId)
      }
    },
    
    selectAllJobs: (state) => {
      state.selectedJobs = state.jobs.map(job => job.job_id)
    },
    
    clearSelection: (state) => {
      state.selectedJobs = []
    },
    
    // Gestión de filtros
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
      state.pagination.page = 1
    },
    
    updateFilters: (state, action: PayloadAction<Partial<TranslationState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
      state.pagination.page = 1
    },
    
    clearFilters: (state) => {
      state.filters = initialState.filters
      state.searchQuery = ''
      state.pagination.page = 1
    },
    
    // Gestión de ordenamiento
    setSorting: (state, action: PayloadAction<TranslationState['sorting']>) => {
      state.sorting = action.payload
      state.pagination.page = 1
    },
    
    // Gestión de paginación
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = action.payload
    },
    
    setPerPage: (state, action: PayloadAction<number>) => {
      state.pagination.perPage = action.payload
      state.pagination.page = 1
    },
    
    // Actualización de progreso en tiempo real
    updateJobProgress: (state, action: PayloadAction<{
      jobId: string
      progress: number
      status?: string
      progressMessage?: string
      estimatedTimeRemaining?: number
    }>) => {
      const { jobId, progress, status, progressMessage, estimatedTimeRemaining } = action.payload
      
      // Actualizar en la lista principal
      const job = state.jobs.find(j => j.job_id === jobId)
      if (job) {
        job.progress = progress
        if (status) job.status = status as any
        if (progressMessage) job.progress_message = progressMessage
        job.last_checked_at = new Date().toISOString()
      }
      
      // Actualizar trabajo actual
      if (state.currentJob?.job_id === jobId) {
        state.currentJob.progress = progress
        if (status) state.currentJob.status = status as any
        if (progressMessage) state.currentJob.progress_message = progressMessage
        state.currentJob.last_checked_at = new Date().toISOString()
      }
      
      // Actualizar en trabajos activos
      const activeJob = state.activeJobs.find(j => j.job_id === jobId)
      if (activeJob) {
        activeJob.progress = progress
        if (status) activeJob.status = status as any
        if (progressMessage) activeJob.progress_message = progressMessage
        activeJob.last_checked_at = new Date().toISOString()
      }
      
      state.lastUpdated = Date.now()
    },
    
    // Actualización de estado de trabajo
    updateJobStatus: (state, action: PayloadAction<{
      jobId: string
      status: string
      completedAt?: string
      error?: string
    }>) => {
      const { jobId, status, completedAt, error } = action.payload
      
      const updateJob = (job: TranslationJob) => {
        job.status = status as any
        if (completedAt) job.completed_at = completedAt
        if (error) job.error_message = error
        job.last_checked_at = new Date().toISOString()
        
        // Si se completó, actualizar progreso a 100%
        if (status === 'success') {
          job.progress = 100
          job.progress_message = 'Traducción completada'
        }
      }
      
      // Actualizar en todas las listas
      const job = state.jobs.find(j => j.job_id === jobId)
      if (job) updateJob(job)
      
      if (state.currentJob?.job_id === jobId) {
        updateJob(state.currentJob)
      }
      
      const activeJobIndex = state.activeJobs.findIndex(j => j.job_id === jobId)
      if (activeJobIndex !== -1) {
        if (status === 'success' || status === 'failed' || status === 'cancelled') {
          // Mover a trabajos recientes y remover de activos
          const [completedJob] = state.activeJobs.splice(activeJobIndex, 1)
          updateJob(completedJob)
          state.recentJobs.unshift(completedJob)
          // Mantener solo los 10 trabajos más recientes
          if (state.recentJobs.length > 10) {
            state.recentJobs = state.recentJobs.slice(0, 10)
          }
        } else {
          updateJob(state.activeJobs[activeJobIndex])
        }
      }
      
      state.lastUpdated = Date.now()
    },
    
    // Gestión de configuración de polling
    updatePollingConfig: (state, action: PayloadAction<Partial<TranslationState['pollingConfig']>>) => {
      state.pollingConfig = { ...state.pollingConfig, ...action.payload }
    },
    
    // Gestión de suscripciones en tiempo real
    addSubscription: (state, action: PayloadAction<string>) => {
      state.subscriptions.add(action.payload)
    },
    
    removeSubscription: (state, action: PayloadAction<string>) => {
      state.subscriptions.delete(action.payload)
    },
    
    clearSubscriptions: (state) => {
      state.subscriptions.clear()
    },
    
    // Gestión de estado
    setCurrentJob: (state, action: PayloadAction<TranslationJob | null>) => {
      state.currentJob = action.payload
    },
    
    clearError: (state) => {
      state.error = null
    },
    
    // Actualización manual de trabajo en lista
    updateJobInList: (state, action: PayloadAction<TranslationJob>) => {
      const updatedJob = action.payload
      const index = state.jobs.findIndex(job => job.job_id === updatedJob.job_id)
      if (index !== -1) {
        state.jobs[index] = updatedJob
      }
      if (state.currentJob?.job_id === updatedJob.job_id) {
        state.currentJob = updatedJob
      }
    },
  },
  
  extraReducers: (builder) => {
    // Fetch translation jobs
    builder
      .addCase(fetchTranslationJobs.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchTranslationJobs.fulfilled, (state, action) => {
        state.isLoading = false
        state.jobs = action.payload.items
        state.pagination = {
          page: action.payload.page,
          perPage: action.payload.per_page,
          total: action.payload.total,
          totalPages: action.payload.pages,
          hasNext: action.payload.has_next,
          hasPrev: action.payload.has_prev,
        }
        state.lastUpdated = Date.now()
        state.error = null
      })
      .addCase(fetchTranslationJobs.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload?.message || 'Error al cargar trabajos'
      })
    
    // Fetch job by ID
    builder
      .addCase(fetchTranslationJobById.fulfilled, (state, action) => {
        state.currentJob = action.payload
        // Actualizar en la lista si existe
        const index = state.jobs.findIndex(job => job.job_id === action.payload.job_id)
        if (index !== -1) {
          state.jobs[index] = action.payload
        }
      })
      .addCase(fetchTranslationJobById.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al cargar trabajo'
      })
    
    // Start translation
    builder
      .addCase(startTranslation.pending, (state) => {
        state.isStartingTranslation = true
        state.error = null
      })
      .addCase(startTranslation.fulfilled, (state, action) => {
        state.isStartingTranslation = false
        // Agregar al inicio de la lista
        state.jobs.unshift(action.payload)
        // Agregar a trabajos activos
        state.activeJobs.unshift(action.payload)
        state.pagination.total += 1
        state.stats.totalJobs += 1
        state.stats.activeJobs += 1
        state.error = null
      })
      .addCase(startTranslation.rejected, (state, action) => {
        state.isStartingTranslation = false
        state.error = action.payload?.message || 'Error al iniciar traducción'
      })
    
    // Retry translation
    builder
      .addCase(retryTranslation.pending, (state) => {
        state.isRetrying = true
        state.error = null
      })
      .addCase(retryTranslation.fulfilled, (state, action) => {
        state.isRetrying = false
        const updatedJob = action.payload
        
        // Actualizar en todas las listas
        const index = state.jobs.findIndex(job => job.job_id === updatedJob.job_id)
        if (index !== -1) {
          state.jobs[index] = updatedJob
        }
        
        if (state.currentJob?.job_id === updatedJob.job_id) {
          state.currentJob = updatedJob
        }
        
        // Mover de recientes a activos si es necesario
        const recentIndex = state.recentJobs.findIndex(job => job.job_id === updatedJob.job_id)
        if (recentIndex !== -1) {
          state.recentJobs.splice(recentIndex, 1)
          state.activeJobs.unshift(updatedJob)
        }
        
        state.error = null
      })
      .addCase(retryTranslation.rejected, (state, action) => {
        state.isRetrying = false
        state.error = action.payload?.message || 'Error al reintentar traducción'
      })
    
    // Cancel translation
    builder
      .addCase(cancelTranslation.fulfilled, (state, action) => {
        const jobId = action.payload
        
        // Actualizar estado en todas las listas
        const updateStatus = (job: TranslationJob) => {
          job.status = 'cancelled'
          job.completed_at = new Date().toISOString()
        }
        
        const job = state.jobs.find(j => j.job_id === jobId)
        if (job) updateStatus(job)
        
        if (state.currentJob?.job_id === jobId) {
          updateStatus(state.currentJob)
        }
        
        // Mover de activos a recientes
        const activeIndex = state.activeJobs.findIndex(j => j.job_id === jobId)
        if (activeIndex !== -1) {
          const [cancelledJob] = state.activeJobs.splice(activeIndex, 1)
          updateStatus(cancelledJob)
          state.recentJobs.unshift(cancelledJob)
          state.stats.activeJobs -= 1
        }
      })
      .addCase(cancelTranslation.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al cancelar traducción'
      })
    
    // Fetch translation status
    builder
      .addCase(fetchTranslationStatus.fulfilled, (state, action) => {
        const { jobId, status, progress, progressMessage } = action.payload
        
        // Usar el reducer interno para actualizar progreso
        translationSlice.caseReducers.updateJobProgress(state, {
          type: 'translation/updateJobProgress',
          payload: { jobId, progress, status, progressMessage }
        })
      })
    
    // Fetch translation stats
    builder
      .addCase(fetchTranslationStats.fulfilled, (state, action) => {
        state.stats = action.payload
      })
      .addCase(fetchTranslationStats.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al obtener estadísticas'
      })
    
    // Fetch active jobs
    builder
      .addCase(fetchActiveJobs.fulfilled, (state, action) => {
        state.activeJobs = action.payload
        state.stats.activeJobs = action.payload.length
      })
      .addCase(fetchActiveJobs.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al cargar trabajos activos'
      })
  },
})

export const {
  selectJob,
  deselectJob,
  toggleJobSelection,
  selectAllJobs,
  clearSelection,
  setSearchQuery,
  updateFilters,
  clearFilters,
  setSorting,
  setPage,
  setPerPage,
  updateJobProgress,
  updateJobStatus,
  updatePollingConfig,
  addSubscription,
  removeSubscription,
  clearSubscriptions,
  setCurrentJob,
  clearError,
  updateJobInList,
} = translationSlice.actions

export default translationSlice.reducer

// Selectores
export const selectTranslationJobs = (state: { translation: TranslationState }) => state.translation.jobs
export const selectCurrentJob = (state: { translation: TranslationState }) => state.translation.currentJob
export const selectActiveJobs = (state: { translation: TranslationState }) => state.translation.activeJobs
export const selectRecentJobs = (state: { translation: TranslationState }) => state.translation.recentJobs
export const selectSelectedJobs = (state: { translation: TranslationState }) => state.translation.selectedJobs
export const selectTranslationLoading = (state: { translation: TranslationState }) => state.translation.isLoading
export const selectTranslationError = (state: { translation: TranslationState }) => state.translation.error
export const selectTranslationStats = (state: { translation: TranslationState }) => state.translation.stats
export const selectPollingConfig = (state: { translation: TranslationState }) => state.translation.pollingConfig
export const selectTranslationFilters = (state: { translation: TranslationState }) => state.translation.filters
export const selectTranslationSorting = (state: { translation: TranslationState }) => state.translation.sorting
export const selectTranslationPagination = (state: { translation: TranslationState }) => state.translation.pagination
