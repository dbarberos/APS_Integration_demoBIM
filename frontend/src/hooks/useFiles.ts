import { useCallback, useRef } from 'react'
import { useAppDispatch, useAppSelector } from './redux'
import {
  fetchFiles,
  fetchFileById,
  uploadFiles,
  updateFile,
  deleteFile,
  deleteMultipleFiles,
  downloadFile,
  generateThumbnail,
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
  updateFileStatus,
} from '@/store/slices/filesSlice'
import { addToast } from '@/store/slices/uiSlice'
import { validateFile, formatFileSize, getFileIcon } from '@/services/fileService'
import type { File, FileUploadConfig } from '@/types'

export const useFiles = () => {
  const dispatch = useAppDispatch()
  const uploadAbortControllers = useRef<Map<string, AbortController>>(new Map())
  
  const {
    files,
    currentFile,
    selectedFiles,
    isLoading,
    isUploading,
    error,
    pagination,
    filters,
    sorting,
    searchQuery,
    uploadProgress,
  } = useAppSelector((state) => state.files)

  // Fetch files
  const handleFetchFiles = useCallback(async (params = {}) => {
    try {
      const result = await dispatch(fetchFiles(params))
      if (fetchFiles.rejected.match(result)) {
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: result.payload?.message || 'Error al cargar archivos',
        }))
      }
    } catch (error: any) {
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Error inesperado',
      }))
    }
  }, [dispatch])

  // Fetch file by ID
  const handleFetchFileById = useCallback(async (fileId: number) => {
    try {
      const result = await dispatch(fetchFileById(fileId))
      if (fetchFileById.rejected.match(result)) {
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: result.payload?.message || 'Error al cargar archivo',
        }))
      }
    } catch (error: any) {
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Error inesperado',
      }))
    }
  }, [dispatch])

  // Upload files
  const handleUploadFiles = useCallback(async (
    fileList: FileList | File[],
    projectId: number,
    config?: Partial<FileUploadConfig>
  ) => {
    const validFiles: File[] = []
    const invalidFiles: { file: File; errors: string[] }[] = []
    
    // Validar archivos
    Array.from(fileList).forEach((file) => {
      const validation = validateFile(file, config)
      if (validation.valid) {
        validFiles.push(file)
      } else {
        invalidFiles.push({ file, errors: validation.errors })
      }
    })
    
    // Mostrar errores de validación
    if (invalidFiles.length > 0) {
      invalidFiles.forEach(({ file, errors }) => {
        dispatch(addToast({
          type: 'error',
          title: `Error en ${file.name}`,
          message: errors.join(', '),
        }))
      })
    }
    
    // Subir archivos válidos
    if (validFiles.length > 0) {
      try {
        const result = await dispatch(uploadFiles({
          files: validFiles,
          projectId,
          onProgress: (fileId, progress) => {
            dispatch(updateUploadProgress({ fileId, progress }))
          },
        }))
        
        if (uploadFiles.fulfilled.match(result)) {
          dispatch(addToast({
            type: 'success',
            title: 'Upload completado',
            message: `${validFiles.length} archivo(s) subido(s) correctamente`,
          }))
          
          // Limpiar progreso después de un tiempo
          setTimeout(() => {
            dispatch(clearAllUploadProgress())
          }, 3000)
          
          return { success: true, uploadedFiles: result.payload }
        } else {
          dispatch(addToast({
            type: 'error',
            title: 'Error de upload',
            message: result.payload?.message || 'Error al subir archivos',
          }))
          return { success: false, error: result.payload?.message }
        }
      } catch (error: any) {
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: error.message || 'Error inesperado',
        }))
        return { success: false, error: error.message }
      }
    }
    
    return { success: validFiles.length > 0, validatedFiles: validFiles.length, invalidFiles: invalidFiles.length }
  }, [dispatch])

  // Cancel upload
  const handleCancelUpload = useCallback((fileId: string) => {
    const controller = uploadAbortControllers.current.get(fileId)
    if (controller) {
      controller.abort()
      uploadAbortControllers.current.delete(fileId)
      dispatch(clearUploadProgress(fileId))
      dispatch(addToast({
        type: 'info',
        title: 'Upload cancelado',
        message: 'La subida del archivo ha sido cancelada',
      }))
    }
  }, [dispatch])

  // Update file
  const handleUpdateFile = useCallback(async (fileId: number, updates: Partial<File>) => {
    try {
      const result = await dispatch(updateFile({ fileId, updates }))
      
      if (updateFile.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Archivo actualizado',
          message: 'El archivo ha sido actualizado correctamente',
        }))
        return { success: true }
      } else {
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: result.payload?.message || 'Error al actualizar archivo',
        }))
        return { success: false, error: result.payload?.message }
      }
    } catch (error: any) {
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Error inesperado',
      }))
      return { success: false, error: error.message }
    }
  }, [dispatch])

  // Delete file
  const handleDeleteFile = useCallback(async (fileId: number) => {
    try {
      const result = await dispatch(deleteFile(fileId))
      
      if (deleteFile.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Archivo eliminado',
          message: 'El archivo ha sido eliminado correctamente',
        }))
        return { success: true }
      } else {
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: result.payload?.message || 'Error al eliminar archivo',
        }))
        return { success: false, error: result.payload?.message }
      }
    } catch (error: any) {
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Error inesperado',
      }))
      return { success: false, error: error.message }
    }
  }, [dispatch])

  // Delete multiple files
  const handleDeleteMultipleFiles = useCallback(async (fileIds: number[]) => {
    try {
      const result = await dispatch(deleteMultipleFiles(fileIds))
      
      if (deleteMultipleFiles.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Archivos eliminados',
          message: `${fileIds.length} archivo(s) eliminado(s) correctamente`,
        }))
        dispatch(clearSelection())
        return { success: true }
      } else {
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: result.payload?.message || 'Error al eliminar archivos',
        }))
        return { success: false, error: result.payload?.message }
      }
    } catch (error: any) {
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Error inesperado',
      }))
      return { success: false, error: error.message }
    }
  }, [dispatch])

  // Download file
  const handleDownloadFile = useCallback(async (fileId: number, filename?: string) => {
    try {
      const result = await dispatch(downloadFile({ fileId, filename }))
      
      if (downloadFile.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Descarga iniciada',
          message: 'El archivo se está descargando',
        }))
        return { success: true }
      } else {
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: result.payload?.message || 'Error al descargar archivo',
        }))
        return { success: false, error: result.payload?.message }
      }
    } catch (error: any) {
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Error inesperado',
      }))
      return { success: false, error: error.message }
    }
  }, [dispatch])

  // Generate thumbnail
  const handleGenerateThumbnail = useCallback(async (fileId: number) => {
    try {
      const result = await dispatch(generateThumbnail(fileId))
      
      if (generateThumbnail.fulfilled.match(result)) {
        dispatch(addToast({
          type: 'success',
          title: 'Thumbnail generado',
          message: 'La vista previa ha sido generada correctamente',
        }))
        return { success: true }
      } else {
        dispatch(addToast({
          type: 'error',
          title: 'Error',
          message: result.payload?.message || 'Error al generar thumbnail',
        }))
        return { success: false, error: result.payload?.message }
      }
    } catch (error: any) {
      dispatch(addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Error inesperado',
      }))
      return { success: false, error: error.message }
    }
  }, [dispatch])

  // Selection management
  const handleSelectFile = useCallback((fileId: string) => {
    dispatch(selectFile(fileId))
  }, [dispatch])

  const handleDeselectFile = useCallback((fileId: string) => {
    dispatch(deselectFile(fileId))
  }, [dispatch])

  const handleToggleFileSelection = useCallback((fileId: string) => {
    dispatch(toggleFileSelection(fileId))
  }, [dispatch])

  const handleSelectAllFiles = useCallback(() => {
    dispatch(selectAllFiles())
  }, [dispatch])

  const handleClearSelection = useCallback(() => {
    dispatch(clearSelection())
  }, [dispatch])

  // Search and filters
  const handleSetSearchQuery = useCallback((query: string) => {
    dispatch(setSearchQuery(query))
  }, [dispatch])

  const handleUpdateFilters = useCallback((newFilters: any) => {
    dispatch(updateFilters(newFilters))
  }, [dispatch])

  const handleClearFilters = useCallback(() => {
    dispatch(clearFilters())
  }, [dispatch])

  // Sorting
  const handleSetSorting = useCallback((newSorting: any) => {
    dispatch(setSorting(newSorting))
  }, [dispatch])

  // Pagination
  const handleSetPage = useCallback((page: number) => {
    dispatch(setPage(page))
  }, [dispatch])

  const handleSetPerPage = useCallback((perPage: number) => {
    dispatch(setPerPage(perPage))
  }, [dispatch])

  // File operations
  const handleSetCurrentFile = useCallback((file: File | null) => {
    dispatch(setCurrentFile(file))
  }, [dispatch])

  const handleClearError = useCallback(() => {
    dispatch(clearError())
  }, [dispatch])

  const handleUpdateFileStatus = useCallback((fileId: number, status: File['status'], progress?: string) => {
    dispatch(updateFileStatus({ fileId, status, progress }))
  }, [dispatch])

  // Utility functions
  const getSelectedFileCount = useCallback(() => {
    return selectedFiles.length
  }, [selectedFiles])

  const isFileSelected = useCallback((fileId: string) => {
    return selectedFiles.includes(fileId)
  }, [selectedFiles])

  const getFilesByStatus = useCallback((status: File['status']) => {
    return files.filter(file => file.status === status)
  }, [files])

  const getTotalFileSize = useCallback(() => {
    return files.reduce((total, file) => total + file.size, 0)
  }, [files])

  const getFileTypeDistribution = useCallback(() => {
    const distribution: Record<string, number> = {}
    files.forEach(file => {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown'
      distribution[extension] = (distribution[extension] || 0) + 1
    })
    return distribution
  }, [files])

  const searchFiles = useCallback((query: string) => {
    return files.filter(file => 
      file.name.toLowerCase().includes(query.toLowerCase()) ||
      file.original_filename.toLowerCase().includes(query.toLowerCase())
    )
  }, [files])

  const filterFilesByType = useCallback((types: string[]) => {
    return files.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      return types.includes(extension || '')
    })
  }, [files])

  const sortFiles = useCallback((field: string, direction: 'asc' | 'desc') => {
    return [...files].sort((a, b) => {
      let aValue: any = a[field as keyof File]
      let bValue: any = b[field as keyof File]
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      if (direction === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  }, [files])

  return {
    // State
    files,
    currentFile,
    selectedFiles,
    isLoading,
    isUploading,
    error,
    pagination,
    filters,
    sorting,
    searchQuery,
    uploadProgress,
    
    // Actions
    fetchFiles: handleFetchFiles,
    fetchFileById: handleFetchFileById,
    uploadFiles: handleUploadFiles,
    cancelUpload: handleCancelUpload,
    updateFile: handleUpdateFile,
    deleteFile: handleDeleteFile,
    deleteMultipleFiles: handleDeleteMultipleFiles,
    downloadFile: handleDownloadFile,
    generateThumbnail: handleGenerateThumbnail,
    
    // Selection
    selectFile: handleSelectFile,
    deselectFile: handleDeselectFile,
    toggleFileSelection: handleToggleFileSelection,
    selectAllFiles: handleSelectAllFiles,
    clearSelection: handleClearSelection,
    
    // Search and filters
    setSearchQuery: handleSetSearchQuery,
    updateFilters: handleUpdateFilters,
    clearFilters: handleClearFilters,
    
    // Sorting
    setSorting: handleSetSorting,
    
    // Pagination
    setPage: handleSetPage,
    setPerPage: handleSetPerPage,
    
    // File management
    setCurrentFile: handleSetCurrentFile,
    clearError: handleClearError,
    updateFileStatus: handleUpdateFileStatus,
    
    // Utilities
    getSelectedFileCount,
    isFileSelected,
    getFilesByStatus,
    getFileByUrn: useCallback((urn: string) => {
      return files.find(file => file.urn === urn)
    }, [files]),
    getTotalFileSize,
    getFileTypeDistribution,
    searchFiles,
    filterFilesByType,
    sortFiles,
    formatFileSize,
    getFileIcon,
    validateFile,
  }
}

export default useFiles
