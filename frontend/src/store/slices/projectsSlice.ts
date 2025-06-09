import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Project, PaginatedResponse, ApiError } from '@/types'
import * as projectService from '@/services/projectService'

export interface ProjectsState {
  projects: Project[]
  currentProject: Project | null
  selectedProjects: number[]
  
  // Filtros y búsqueda
  searchQuery: string
  filters: {
    dateRange: {
      start: string | null
      end: string | null
    }
    status: string[]
    userId: number | null
  }
  
  // Ordenamiento y paginación
  sorting: {
    field: 'name' | 'created_at' | 'updated_at'
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
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
  error: string | null
  
  // Estadísticas
  stats: {
    totalProjects: number
    totalFiles: number
    totalStorage: number
    recentProjects: Project[]
  }
  
  lastUpdated: number | null
}

const initialState: ProjectsState = {
  projects: [],
  currentProject: null,
  selectedProjects: [],
  
  searchQuery: '',
  filters: {
    dateRange: {
      start: null,
      end: null,
    },
    status: [],
    userId: null,
  },
  
  sorting: {
    field: 'updated_at',
    direction: 'desc',
  },
  pagination: {
    page: 1,
    perPage: 12,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },
  
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  error: null,
  
  stats: {
    totalProjects: 0,
    totalFiles: 0,
    totalStorage: 0,
    recentProjects: [],
  },
  
  lastUpdated: null,
}

// Async thunks
export const fetchProjects = createAsyncThunk<
  PaginatedResponse<Project>,
  {
    page?: number
    perPage?: number
    search?: string
    filters?: Partial<ProjectsState['filters']>
    sorting?: Partial<ProjectsState['sorting']>
  },
  { rejectValue: ApiError }
>('projects/fetchProjects', async (params, { rejectWithValue }) => {
  try {
    const response = await projectService.getProjects(params)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al cargar proyectos',
      status: error.response?.status,
    })
  }
})

export const fetchProjectById = createAsyncThunk<
  Project,
  number,
  { rejectValue: ApiError }
>('projects/fetchProjectById', async (projectId, { rejectWithValue }) => {
  try {
    const response = await projectService.getProjectById(projectId)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al cargar proyecto',
      status: error.response?.status,
    })
  }
})

export const createProject = createAsyncThunk<
  Project,
  {
    name: string
    description?: string
  },
  { rejectValue: ApiError }
>('projects/createProject', async (projectData, { rejectWithValue }) => {
  try {
    const response = await projectService.createProject(projectData)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al crear proyecto',
      status: error.response?.status,
    })
  }
})

export const updateProject = createAsyncThunk<
  Project,
  {
    projectId: number
    updates: Partial<Pick<Project, 'name' | 'description'>>
  },
  { rejectValue: ApiError }
>('projects/updateProject', async ({ projectId, updates }, { rejectWithValue }) => {
  try {
    const response = await projectService.updateProject(projectId, updates)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al actualizar proyecto',
      status: error.response?.status,
    })
  }
})

export const deleteProject = createAsyncThunk<
  number,
  number,
  { rejectValue: ApiError }
>('projects/deleteProject', async (projectId, { rejectWithValue }) => {
  try {
    await projectService.deleteProject(projectId)
    return projectId
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al eliminar proyecto',
      status: error.response?.status,
    })
  }
})

export const deleteMultipleProjects = createAsyncThunk<
  number[],
  number[],
  { rejectValue: ApiError }
>('projects/deleteMultipleProjects', async (projectIds, { rejectWithValue }) => {
  try {
    await projectService.deleteMultipleProjects(projectIds)
    return projectIds
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al eliminar proyectos',
      status: error.response?.status,
    })
  }
})

export const fetchProjectStats = createAsyncThunk<
  ProjectsState['stats'],
  void,
  { rejectValue: ApiError }
>('projects/fetchStats', async (_, { rejectWithValue }) => {
  try {
    const response = await projectService.getProjectStats()
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al obtener estadísticas',
      status: error.response?.status,
    })
  }
})

export const fetchRecentProjects = createAsyncThunk<
  Project[],
  { limit?: number },
  { rejectValue: ApiError }
>('projects/fetchRecentProjects', async ({ limit = 5 }, { rejectWithValue }) => {
  try {
    const response = await projectService.getRecentProjects(limit)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al cargar proyectos recientes',
      status: error.response?.status,
    })
  }
})

// Slice
const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    // Gestión de selección
    selectProject: (state, action: PayloadAction<number>) => {
      const projectId = action.payload
      if (!state.selectedProjects.includes(projectId)) {
        state.selectedProjects.push(projectId)
      }
    },
    
    deselectProject: (state, action: PayloadAction<number>) => {
      state.selectedProjects = state.selectedProjects.filter(id => id !== action.payload)
    },
    
    toggleProjectSelection: (state, action: PayloadAction<number>) => {
      const projectId = action.payload
      const index = state.selectedProjects.indexOf(projectId)
      if (index > -1) {
        state.selectedProjects.splice(index, 1)
      } else {
        state.selectedProjects.push(projectId)
      }
    },
    
    selectAllProjects: (state) => {
      state.selectedProjects = state.projects.map(project => project.id)
    },
    
    clearSelection: (state) => {
      state.selectedProjects = []
    },
    
    // Gestión de filtros
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
      state.pagination.page = 1
    },
    
    updateFilters: (state, action: PayloadAction<Partial<ProjectsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
      state.pagination.page = 1
    },
    
    clearFilters: (state) => {
      state.filters = initialState.filters
      state.searchQuery = ''
      state.pagination.page = 1
    },
    
    // Gestión de ordenamiento
    setSorting: (state, action: PayloadAction<ProjectsState['sorting']>) => {
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
    
    // Gestión de proyecto actual
    setCurrentProject: (state, action: PayloadAction<Project | null>) => {
      state.currentProject = action.payload
    },
    
    // Limpiar errores
    clearError: (state) => {
      state.error = null
    },
    
    // Actualizar proyecto en lista
    updateProjectInList: (state, action: PayloadAction<Project>) => {
      const updatedProject = action.payload
      const index = state.projects.findIndex(project => project.id === updatedProject.id)
      if (index !== -1) {
        state.projects[index] = updatedProject
      }
      if (state.currentProject?.id === updatedProject.id) {
        state.currentProject = updatedProject
      }
    },
    
    // Agregar proyecto a lista (para optimistic updates)
    addProjectToList: (state, action: PayloadAction<Project>) => {
      state.projects.unshift(action.payload)
      state.pagination.total += 1
      state.stats.totalProjects += 1
    },
    
    // Remover proyecto de lista
    removeProjectFromList: (state, action: PayloadAction<number>) => {
      const projectId = action.payload
      state.projects = state.projects.filter(project => project.id !== projectId)
      state.selectedProjects = state.selectedProjects.filter(id => id !== projectId)
      if (state.currentProject?.id === projectId) {
        state.currentProject = null
      }
      state.pagination.total -= 1
      state.stats.totalProjects -= 1
    },
    
    // Actualizar estadísticas
    updateStats: (state, action: PayloadAction<Partial<ProjectsState['stats']>>) => {
      state.stats = { ...state.stats, ...action.payload }
    },
    
    // Reset state
    resetProjectsState: (state) => {
      Object.assign(state, initialState)
    },
  },
  
  extraReducers: (builder) => {
    // Fetch projects
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.isLoading = false
        state.projects = action.payload.items
        state.pagination = {
          page: action.payload.page,
          perPage: action.payload.per_page,
          total: action.payload.total,
          totalPages: action.payload.pages,
          hasNext: action.payload.has_next,
          hasPrev: action.payload.has_prev,
        }
        state.stats.totalProjects = action.payload.total
        state.lastUpdated = Date.now()
        state.error = null
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload?.message || 'Error al cargar proyectos'
      })
    
    // Fetch project by ID
    builder
      .addCase(fetchProjectById.fulfilled, (state, action) => {
        state.currentProject = action.payload
        // Actualizar en la lista si existe
        const index = state.projects.findIndex(project => project.id === action.payload.id)
        if (index !== -1) {
          state.projects[index] = action.payload
        }
      })
      .addCase(fetchProjectById.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al cargar proyecto'
      })
    
    // Create project
    builder
      .addCase(createProject.pending, (state) => {
        state.isCreating = true
        state.error = null
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.isCreating = false
        // Agregar al principio de la lista
        state.projects.unshift(action.payload)
        state.pagination.total += 1
        state.stats.totalProjects += 1
        state.currentProject = action.payload
        state.error = null
      })
      .addCase(createProject.rejected, (state, action) => {
        state.isCreating = false
        state.error = action.payload?.message || 'Error al crear proyecto'
      })
    
    // Update project
    builder
      .addCase(updateProject.pending, (state) => {
        state.isUpdating = true
        state.error = null
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.isUpdating = false
        const updatedProject = action.payload
        
        // Actualizar en la lista
        const index = state.projects.findIndex(project => project.id === updatedProject.id)
        if (index !== -1) {
          state.projects[index] = updatedProject
        }
        
        // Actualizar proyecto actual si es el mismo
        if (state.currentProject?.id === updatedProject.id) {
          state.currentProject = updatedProject
        }
        
        state.error = null
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.isUpdating = false
        state.error = action.payload?.message || 'Error al actualizar proyecto'
      })
    
    // Delete project
    builder
      .addCase(deleteProject.pending, (state) => {
        state.isDeleting = true
        state.error = null
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.isDeleting = false
        const projectId = action.payload
        
        // Remover de la lista
        state.projects = state.projects.filter(project => project.id !== projectId)
        state.selectedProjects = state.selectedProjects.filter(id => id !== projectId)
        
        // Limpiar proyecto actual si es el eliminado
        if (state.currentProject?.id === projectId) {
          state.currentProject = null
        }
        
        state.pagination.total -= 1
        state.stats.totalProjects -= 1
        state.error = null
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.isDeleting = false
        state.error = action.payload?.message || 'Error al eliminar proyecto'
      })
    
    // Delete multiple projects
    builder
      .addCase(deleteMultipleProjects.pending, (state) => {
        state.isDeleting = true
        state.error = null
      })
      .addCase(deleteMultipleProjects.fulfilled, (state, action) => {
        state.isDeleting = false
        const deletedIds = action.payload
        
        // Remover de la lista
        state.projects = state.projects.filter(project => !deletedIds.includes(project.id))
        state.selectedProjects = state.selectedProjects.filter(id => !deletedIds.includes(id))
        
        // Limpiar proyecto actual si fue eliminado
        if (state.currentProject && deletedIds.includes(state.currentProject.id)) {
          state.currentProject = null
        }
        
        state.pagination.total -= deletedIds.length
        state.stats.totalProjects -= deletedIds.length
        state.error = null
      })
      .addCase(deleteMultipleProjects.rejected, (state, action) => {
        state.isDeleting = false
        state.error = action.payload?.message || 'Error al eliminar proyectos'
      })
    
    // Fetch project stats
    builder
      .addCase(fetchProjectStats.fulfilled, (state, action) => {
        state.stats = action.payload
      })
      .addCase(fetchProjectStats.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al obtener estadísticas'
      })
    
    // Fetch recent projects
    builder
      .addCase(fetchRecentProjects.fulfilled, (state, action) => {
        state.stats.recentProjects = action.payload
      })
      .addCase(fetchRecentProjects.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al cargar proyectos recientes'
      })
  },
})

export const {
  selectProject,
  deselectProject,
  toggleProjectSelection,
  selectAllProjects,
  clearSelection,
  setSearchQuery,
  updateFilters,
  clearFilters,
  setSorting,
  setPage,
  setPerPage,
  setCurrentProject,
  clearError,
  updateProjectInList,
  addProjectToList,
  removeProjectFromList,
  updateStats,
  resetProjectsState,
} = projectsSlice.actions

export default projectsSlice.reducer

// Selectores
export const selectProjects = (state: { projects: ProjectsState }) => state.projects.projects
export const selectCurrentProject = (state: { projects: ProjectsState }) => state.projects.currentProject
export const selectSelectedProjects = (state: { projects: ProjectsState }) => state.projects.selectedProjects
export const selectProjectsLoading = (state: { projects: ProjectsState }) => state.projects.isLoading
export const selectProjectsError = (state: { projects: ProjectsState }) => state.projects.error
export const selectProjectsPagination = (state: { projects: ProjectsState }) => state.projects.pagination
export const selectProjectsFilters = (state: { projects: ProjectsState }) => state.projects.filters
export const selectProjectsSorting = (state: { projects: ProjectsState }) => state.projects.sorting
export const selectProjectsStats = (state: { projects: ProjectsState }) => state.projects.stats
export const selectProjectsSearchQuery = (state: { projects: ProjectsState }) => state.projects.searchQuery
export const selectIsCreatingProject = (state: { projects: ProjectsState }) => state.projects.isCreating
export const selectIsUpdatingProject = (state: { projects: ProjectsState }) => state.projects.isUpdating
export const selectIsDeletingProject = (state: { projects: ProjectsState }) => state.projects.isDeleting

// Selector para obtener proyecto por ID
export const selectProjectById = (projectId: number) => (state: { projects: ProjectsState }) =>
  state.projects.projects.find(project => project.id === projectId)

// Selector para verificar si un proyecto está seleccionado
export const selectIsProjectSelected = (projectId: number) => (state: { projects: ProjectsState }) =>
  state.projects.selectedProjects.includes(projectId)
