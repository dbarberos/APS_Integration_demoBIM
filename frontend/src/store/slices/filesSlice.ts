import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { File, UploadProgress, PaginatedResponse, ApiError } from '@/types'
import * as fileService from '@/services/fileService'

export interface FilesState {
  files: File[]
  currentFile: File | null
  uploadProgress: Record<string, UploadProgress>
  selectedFiles: string[]
  searchQuery: string
  filters: {
    status: string[]
    fileType: string[]
    projectId: number | null
    dateRange: {
      start: string | null
      end: string | null
    }
    sizeRange: {
      min: number | null
      max: number | null
    }
  }
  sorting: {
    field: 'name' | 'size' | 'created_at' | 'updated_at' | 'status'
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
  isLoading: boolean
  isUploading: boolean
  error: string | null
  lastUpdated: number | null
}

const initialState: FilesState = {
  files: [],
  currentFile: null,
  uploadProgress: {},
  selectedFiles: [],
  searchQuery: '',
  filters: {
    status: [],
    fileType: [],
    projectId: null,
    dateRange: {
      start: null,
      end: null,
    },
    sizeRange: {
      min: null,
      max: null,
    },
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
  isUploading: false,
  error: null,
  lastUpdated: null,
}

// Async thunks
export const fetchFiles = createAsyncThunk<
  PaginatedResponse<File>,
  {
    page?: number
    perPage?: number
    search?: string
    filters?: Partial<FilesState['filters']>
    sorting?: Partial<FilesState['sorting']>
  },
  { rejectValue: ApiError }
>('files/fetchFiles', async (params, { rejectWithValue }) => {
  try {
    const response = await fileService.getFiles(params)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al cargar archivos',
      status: error.response?.status,
    })
  }
})

export const fetchFileById = createAsyncThunk<
  File,
  number,
  { rejectValue: ApiError }
>('files/fetchFileById', async (fileId, { rejectWithValue }) => {
  try {
    const response = await fileService.getFileById(fileId)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al cargar archivo',
      status: error.response?.status,
    })
  }
})

export const uploadFiles = createAsyncThunk<
  File[],
  {
    files: FileList | File[]
    projectId: number
    onProgress?: (fileId: string, progress: UploadProgress) => void
  },
  { rejectValue: ApiError }
>('files/uploadFiles', async ({ files, projectId, onProgress }, { rejectWithValue, dispatch }) => {
  try {
    const fileArray = Array.from(files)
    const uploadPromises = fileArray.map(async (file) => {
      const fileId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Inicializar progreso
      dispatch(updateUploadProgress({
        fileId,
        progress: {
          file_id: fileId,
          total_size: file.size,
          uploaded_bytes: 0,
          progress_percentage: 0,
          current_part: 1,
          total_parts: 1,
          status: 'uploading',
        }
      }))
      
      return fileService.uploadFile(file, projectId, (progress) => {
        dispatch(updateUploadProgress({ fileId, progress }))
        onProgress?.(fileId, progress)
      })
    })
    
    const results = await Promise.all(uploadPromises)
    
    // Limpiar progreso de uploads completados
    fileArray.forEach((_, index) => {
      const fileId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      dispatch(clearUploadProgress(fileId))
    })
    
    return results
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al subir archivos',
      status: error.response?.status,
    })
  }
})

export const updateFile = createAsyncThunk<
  File,
  { fileId: number; updates: Partial<File> },
  { rejectValue: ApiError }
>('files/updateFile', async ({ fileId, updates }, { rejectWithValue }) => {
  try {
    const response = await fileService.updateFile(fileId, updates)
    return response
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al actualizar archivo',
      status: error.response?.status,
    })
  }
})

export const deleteFile = createAsyncThunk<
  number,
  number,
  { rejectValue: ApiError }
>('files/deleteFile', async (fileId, { rejectWithValue }) => {
  try {
    await fileService.deleteFile(fileId)
    return fileId
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al eliminar archivo',
      status: error.response?.status,
    })
  }
})

export const deleteMultipleFiles = createAsyncThunk<
  number[],
  number[],
  { rejectValue: ApiError }
>('files/deleteMultipleFiles', async (fileIds, { rejectWithValue }) => {
  try {
    await fileService.deleteMultipleFiles(fileIds)
    return fileIds
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al eliminar archivos',
      status: error.response?.status,
    })
  }
})

export const downloadFile = createAsyncThunk<
  void,
  { fileId: number; filename?: string },
  { rejectValue: ApiError }
>('files/downloadFile', async ({ fileId, filename }, { rejectWithValue }) => {
  try {
    await fileService.downloadFile(fileId, filename)
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al descargar archivo',
      status: error.response?.status,
    })
  }
})

export const generateThumbnail = createAsyncThunk<
  { fileId: number; thumbnailUrl: string },
  number,
  { rejectValue: ApiError }
>('files/generateThumbnail', async (fileId, { rejectWithValue }) => {
  try {
    const thumbnailUrl = await fileService.generateThumbnail(fileId)
    return { fileId, thumbnailUrl }
  } catch (error: any) {
    return rejectWithValue({
      message: error.response?.data?.detail || 'Error al generar thumbnail',
      status: error.response?.status,
    })
  }
})

// Slice
const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    // Gestión de selección
    selectFile: (state, action: PayloadAction<string>) => {
      const fileId = action.payload
      if (!state.selectedFiles.includes(fileId)) {
        state.selectedFiles.push(fileId)
      }
    },
    
    deselectFile: (state, action: PayloadAction<string>) => {
      state.selectedFiles = state.selectedFiles.filter(id => id !== action.payload)
    },
    
    toggleFileSelection: (state, action: PayloadAction<string>) => {
      const fileId = action.payload
      const index = state.selectedFiles.indexOf(fileId)
      if (index > -1) {
        state.selectedFiles.splice(index, 1)
      } else {
        state.selectedFiles.push(fileId)
      }
    },
    
    selectAllFiles: (state) => {
      state.selectedFiles = state.files.map(file => file.id.toString())
    },
    
    clearSelection: (state) => {
      state.selectedFiles = []
    },
    
    // Gestión de filtros
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
      state.pagination.page = 1 // Reset pagination
    },
    
    updateFilters: (state, action: PayloadAction<Partial<FilesState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload }
      state.pagination.page = 1 // Reset pagination
    },
    
    clearFilters: (state) => {
      state.filters = initialState.filters
      state.searchQuery = ''
      state.pagination.page = 1
    },
    
    // Gestión de ordenamiento
    setSorting: (state, action: PayloadAction<FilesState['sorting']>) => {
      state.sorting = action.payload
      state.pagination.page = 1 // Reset pagination
    },
    
    // Gestión de paginación
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = action.payload
    },
    
    setPerPage: (state, action: PayloadAction<number>) => {
      state.pagination.perPage = action.payload
      state.pagination.page = 1 // Reset to first page
    },
    
    // Gestión de progreso de upload
    updateUploadProgress: (state, action: PayloadAction<{ fileId: string; progress: UploadProgress }>) => {
      const { fileId, progress } = action.payload
      state.uploadProgress[fileId] = progress
    },
    
    clearUploadProgress: (state, action: PayloadAction<string>) => {
      delete state.uploadProgress[action.payload]
    },
    
    clearAllUploadProgress: (state) => {
      state.uploadProgress = {}
    },
    
    // Gestión de estado
    setCurrentFile: (state, action: PayloadAction<File | null>) => {
      state.currentFile = action.payload
    },
    
    clearError: (state) => {
      state.error = null
    },
    
    // Update file en lista
    updateFileInList: (state, action: PayloadAction<File>) => {
      const updatedFile = action.payload
      const index = state.files.findIndex(file => file.id === updatedFile.id)
      if (index !== -1) {
        state.files[index] = updatedFile
      }
      if (state.currentFile?.id === updatedFile.id) {
        state.currentFile = updatedFile
      }
    },
    
    // Actualizar estado de archivo (para cuando se complete traducción)
    updateFileStatus: (state, action: PayloadAction<{ fileId: number; status: File['status']; progress?: string }>) => {
      const { fileId, status, progress } = action.payload
      const file = state.files.find(f => f.id === fileId)
      if (file) {
        file.status = status
        if (progress !== undefined) {
          file.translation_progress = progress
        }
      }
      if (state.currentFile?.id === fileId) {
        state.currentFile.status = status
        if (progress !== undefined) {
          state.currentFile.translation_progress = progress
        }
      }
    },
  },
  
  extraReducers: (builder) => {
    // Fetch files
    builder
      .addCase(fetchFiles.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchFiles.fulfilled, (state, action) => {
        state.isLoading = false
        state.files = action.payload.items
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
      .addCase(fetchFiles.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload?.message || 'Error al cargar archivos'
      })
    
    // Fetch file by ID
    builder
      .addCase(fetchFileById.fulfilled, (state, action) => {
        state.currentFile = action.payload
        // También actualizar en la lista si existe
        const index = state.files.findIndex(file => file.id === action.payload.id)
        if (index !== -1) {
          state.files[index] = action.payload
        }
      })
      .addCase(fetchFileById.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al cargar archivo'
      })
    
    // Upload files
    builder
      .addCase(uploadFiles.pending, (state) => {
        state.isUploading = true
        state.error = null
      })
      .addCase(uploadFiles.fulfilled, (state, action) => {
        state.isUploading = false
        // Agregar nuevos archivos al principio de la lista
        state.files.unshift(...action.payload)
        state.pagination.total += action.payload.length
        state.error = null
      })
      .addCase(uploadFiles.rejected, (state, action) => {
        state.isUploading = false
        state.error = action.payload?.message || 'Error al subir archivos'
      })
    
    // Update file
    builder
      .addCase(updateFile.fulfilled, (state, action) => {
        const updatedFile = action.payload
        const index = state.files.findIndex(file => file.id === updatedFile.id)
        if (index !== -1) {
          state.files[index] = updatedFile
        }
        if (state.currentFile?.id === updatedFile.id) {
          state.currentFile = updatedFile
        }
      })
      .addCase(updateFile.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al actualizar archivo'
      })
    
    // Delete file
    builder
      .addCase(deleteFile.fulfilled, (state, action) => {
        const fileId = action.payload
        state.files = state.files.filter(file => file.id !== fileId)
        state.selectedFiles = state.selectedFiles.filter(id => id !== fileId.toString())
        if (state.currentFile?.id === fileId) {
          state.currentFile = null
        }
        state.pagination.total -= 1
      })
      .addCase(deleteFile.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al eliminar archivo'
      })
    
    // Delete multiple files
    builder
      .addCase(deleteMultipleFiles.fulfilled, (state, action) => {
        const deletedIds = action.payload
        state.files = state.files.filter(file => !deletedIds.includes(file.id))
        state.selectedFiles = state.selectedFiles.filter(id => 
          !deletedIds.includes(parseInt(id))
        )
        if (state.currentFile && deletedIds.includes(state.currentFile.id)) {
          state.currentFile = null
        }
        state.pagination.total -= deletedIds.length
      })
      .addCase(deleteMultipleFiles.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al eliminar archivos'
      })
    
    // Generate thumbnail
    builder
      .addCase(generateThumbnail.fulfilled, (state, action) => {
        const { fileId, thumbnailUrl } = action.payload
        const file = state.files.find(f => f.id === fileId)
        if (file) {
          file.thumbnail_url = thumbnailUrl
        }
        if (state.currentFile?.id === fileId) {
          state.currentFile.thumbnail_url = thumbnailUrl
        }
      })
      .addCase(generateThumbnail.rejected, (state, action) => {
        state.error = action.payload?.message || 'Error al generar thumbnail'
      })
  },
})

export const {
  selectFile,
  deselectFile,
  toggleFileSelection,
  selectAllFiles,
  clearSelection,
  setSearchQuery,
  updateFilters,
  clearFilters,
  setSorting,
  setPage,
  setPerPage,
  updateUploadProgress,
  clearUploadProgress,
  clearAllUploadProgress,
  setCurrentFile,
  clearError,
  updateFileInList,
  updateFileStatus,
} = filesSlice.actions

export default filesSlice.reducer

// Selectores
export const selectFiles = (state: { files: FilesState }) => state.files.files
export const selectCurrentFile = (state: { files: FilesState }) => state.files.currentFile
export const selectSelectedFiles = (state: { files: FilesState }) => state.files.selectedFiles
export const selectFilesLoading = (state: { files: FilesState }) => state.files.isLoading
export const selectUploadProgress = (state: { files: FilesState }) => state.files.uploadProgress
export const selectFilesError = (state: { files: FilesState }) => state.files.error
export const selectFilesPagination = (state: { files: FilesState }) => state.files.pagination
export const selectFilesFilters = (state: { files: FilesState }) => state.files.filters
export const selectFilesSorting = (state: { files: FilesState }) => state.files.sorting
export const selectSearchQuery = (state: { files: FilesState }) => state.files.searchQuery
