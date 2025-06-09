import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { fileService } from '@/services/fileService'
import { useGlobalLoaderContext } from '@/components/ui/GlobalLoader'
import type { File, PaginatedResponse, FileSearchParams, UploadProgress } from '@/types'

// Query keys para React Query
export const fileKeys = {
  all: ['files'] as const,
  lists: () => [...fileKeys.all, 'list'] as const,
  list: (params: FileSearchParams) => [...fileKeys.lists(), params] as const,
  details: () => [...fileKeys.all, 'detail'] as const,
  detail: (id: number) => [...fileKeys.details(), id] as const,
  stats: () => [...fileKeys.all, 'stats'] as const,
  metadata: (id: number) => [...fileKeys.all, 'metadata', id] as const,
}

// Hook para obtener lista de archivos con paginación
export const useFiles = (params: FileSearchParams = {}) => {
  return useQuery({
    queryKey: fileKeys.list(params),
    queryFn: () => fileService.getFiles(params),
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}

// Hook para scroll infinito de archivos
export const useInfiniteFiles = (params: Omit<FileSearchParams, 'page'> = {}) => {
  return useInfiniteQuery({
    queryKey: [...fileKeys.lists(), 'infinite', params],
    queryFn: ({ pageParam = 1 }) => 
      fileService.getFiles({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage
      return pagination.has_next_page ? pagination.page + 1 : undefined
    },
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000,
  })
}

// Hook para obtener archivo por ID
export const useFile = (id: number, enabled = true) => {
  return useQuery({
    queryKey: fileKeys.detail(id),
    queryFn: () => fileService.getFileById(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })
}

// Hook para obtener metadatos de archivo
export const useFileMetadata = (id: number, enabled = true) => {
  return useQuery({
    queryKey: fileKeys.metadata(id),
    queryFn: () => fileService.getFileMetadata(id),
    enabled: enabled && !!id,
    staleTime: 10 * 60 * 1000, // 10 minutos
  })
}

// Hook para estadísticas de archivos
export const useFileStats = () => {
  return useQuery({
    queryKey: fileKeys.stats(),
    queryFn: () => fileService.getFileStats(),
    staleTime: 5 * 60 * 1000,
  })
}

// Hook para upload de archivos
export const useUploadFile = () => {
  const queryClient = useQueryClient()
  const { showLoader, hideLoader, updateMessage, updateProgress } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async ({ 
      file, 
      projectId, 
      onProgress 
    }: { 
      file: File
      projectId: number
      onProgress?: (progress: UploadProgress) => void 
    }) => {
      showLoader('Subiendo archivo...', 0)
      
      const combinedProgress = (progress: UploadProgress) => {
        updateProgress(progress.progress_percentage)
        updateMessage(`Subiendo ${file.name}... ${progress.progress_percentage}%`)
        onProgress?.(progress)
      }

      try {
        const result = await fileService.uploadFile(file, projectId, combinedProgress)
        return result
      } finally {
        hideLoader()
      }
    },
    onSuccess: (newFile) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() })
      queryClient.invalidateQueries({ queryKey: fileKeys.stats() })
      
      // Agregar el nuevo archivo al caché
      queryClient.setQueryData(fileKeys.detail(newFile.id), newFile)
      
      toast.success(`Archivo "${newFile.name}" subido correctamente`)
    },
    onError: (error: any) => {
      console.error('Error uploading file:', error)
      toast.error(error.message || 'Error al subir el archivo')
    }
  })
}

// Hook para upload múltiple (multipart)
export const useUploadFileMultipart = () => {
  const queryClient = useQueryClient()
  const { showLoader, hideLoader, updateMessage, updateProgress } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async ({ 
      file, 
      projectId, 
      onProgress,
      config 
    }: { 
      file: File
      projectId: number
      onProgress?: (progress: UploadProgress) => void
      config?: any
    }) => {
      showLoader('Preparando upload...', 0)
      
      const combinedProgress = (progress: UploadProgress) => {
        updateProgress(progress.progress_percentage)
        const status = progress.status === 'uploading' 
          ? `Subiendo parte ${progress.current_part}/${progress.total_parts}`
          : progress.status === 'processing'
          ? 'Procesando archivo...'
          : 'Completando...'
        
        updateMessage(`${file.name} - ${status}`)
        onProgress?.(progress)
      }

      try {
        const result = await fileService.uploadFileMultipart(file, projectId, combinedProgress, config)
        return result
      } finally {
        hideLoader()
      }
    },
    onSuccess: (newFile) => {
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() })
      queryClient.invalidateQueries({ queryKey: fileKeys.stats() })
      queryClient.setQueryData(fileKeys.detail(newFile.id), newFile)
      toast.success(`Archivo "${newFile.name}" subido correctamente`)
    },
    onError: (error: any) => {
      console.error('Error uploading file:', error)
      toast.error(error.message || 'Error al subir el archivo')
    }
  })
}

// Hook para actualizar archivo
export const useUpdateFile = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      fileService.updateFile(id, data),
    onSuccess: (updatedFile, { id }) => {
      // Actualizar caché del archivo específico
      queryClient.setQueryData(fileKeys.detail(id), updatedFile)
      
      // Invalidar listas que podrían contener este archivo
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() })
      
      toast.success('Archivo actualizado correctamente')
    },
    onError: (error: any) => {
      console.error('Error updating file:', error)
      toast.error(error.message || 'Error al actualizar el archivo')
    }
  })
}

// Hook para eliminar archivo
export const useDeleteFile = () => {
  const queryClient = useQueryClient()
  const { showLoader, hideLoader } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async (id: number) => {
      showLoader('Eliminando archivo...')
      try {
        await fileService.deleteFile(id)
        return id
      } finally {
        hideLoader()
      }
    },
    onSuccess: (deletedId) => {
      // Remover del caché
      queryClient.removeQueries({ queryKey: fileKeys.detail(deletedId) })
      
      // Invalidar listas
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() })
      queryClient.invalidateQueries({ queryKey: fileKeys.stats() })
      
      toast.success('Archivo eliminado correctamente')
    },
    onError: (error: any) => {
      console.error('Error deleting file:', error)
      toast.error(error.message || 'Error al eliminar el archivo')
    }
  })
}

// Hook para eliminar múltiples archivos
export const useDeleteMultipleFiles = () => {
  const queryClient = useQueryClient()
  const { showLoader, hideLoader, updateMessage } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async (fileIds: number[]) => {
      showLoader(`Eliminando ${fileIds.length} archivos...`)
      updateMessage(`Eliminando ${fileIds.length} archivos...`)
      
      try {
        const result = await fileService.deleteMultipleFiles(fileIds)
        return result
      } finally {
        hideLoader()
      }
    },
    onSuccess: (result, fileIds) => {
      // Remover archivos eliminados del caché
      fileIds.forEach(id => {
        queryClient.removeQueries({ queryKey: fileKeys.detail(id) })
      })
      
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() })
      queryClient.invalidateQueries({ queryKey: fileKeys.stats() })
      
      toast.success(`${result.deleted_count} archivos eliminados correctamente`)
      
      if (result.failed_count > 0) {
        toast.error(`${result.failed_count} archivos no pudieron ser eliminados`)
      }
    },
    onError: (error: any) => {
      console.error('Error deleting files:', error)
      toast.error(error.message || 'Error al eliminar los archivos')
    }
  })
}

// Hook para duplicar archivo
export const useDuplicateFile = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, newName }: { id: number; newName?: string }) => 
      fileService.duplicateFile(id, newName),
    onSuccess: (duplicatedFile) => {
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() })
      queryClient.invalidateQueries({ queryKey: fileKeys.stats() })
      queryClient.setQueryData(fileKeys.detail(duplicatedFile.id), duplicatedFile)
      toast.success(`Archivo duplicado como "${duplicatedFile.name}"`)
    },
    onError: (error: any) => {
      console.error('Error duplicating file:', error)
      toast.error(error.message || 'Error al duplicar el archivo')
    }
  })
}

// Hook para mover archivo
export const useMoveFile = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, targetProjectId }: { id: number; targetProjectId: number }) => 
      fileService.moveFile(id, targetProjectId),
    onSuccess: (movedFile, { targetProjectId }) => {
      queryClient.setQueryData(fileKeys.detail(movedFile.id), movedFile)
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() })
      queryClient.invalidateQueries({ queryKey: fileKeys.stats() })
      toast.success('Archivo movido correctamente')
    },
    onError: (error: any) => {
      console.error('Error moving file:', error)
      toast.error(error.message || 'Error al mover el archivo')
    }
  })
}

// Hook para mover múltiples archivos
export const useMoveMultipleFiles = () => {
  const queryClient = useQueryClient()
  const { showLoader, hideLoader } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async ({ fileIds, targetProjectId }: { fileIds: number[]; targetProjectId: number }) => {
      showLoader(`Moviendo ${fileIds.length} archivos...`)
      try {
        const result = await fileService.moveMultipleFiles(fileIds, targetProjectId)
        return result
      } finally {
        hideLoader()
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: fileKeys.lists() })
      queryClient.invalidateQueries({ queryKey: fileKeys.stats() })
      toast.success(`${result.moved_count} archivos movidos correctamente`)
      
      if (result.failed_count > 0) {
        toast.error(`${result.failed_count} archivos no pudieron ser movidos`)
      }
    },
    onError: (error: any) => {
      console.error('Error moving files:', error)
      toast.error(error.message || 'Error al mover los archivos')
    }
  })
}

// Hook para descargar archivo
export const useDownloadFile = () => {
  const { showLoader, hideLoader } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async (id: number) => {
      showLoader('Preparando descarga...')
      try {
        const blob = await fileService.downloadFile(id)
        return { id, blob }
      } finally {
        hideLoader()
      }
    },
    onSuccess: ({ blob }, id) => {
      // Crear URL temporal y descargar
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `file_${id}` // Se podría mejorar con el nombre real del archivo
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success('Descarga iniciada')
    },
    onError: (error: any) => {
      console.error('Error downloading file:', error)
      toast.error(error.message || 'Error al descargar el archivo')
    }
  })
}

// Hook para validar archivo antes de subir
export const useValidateFile = () => {
  return useMutation({
    mutationFn: (file: File) => fileService.validateFile(file),
    onError: (error: any) => {
      console.error('Error validating file:', error)
      toast.error(error.message || 'Error al validar el archivo')
    }
  })
}

// Hook personalizado para gestión completa de archivos
export const useFileManager = () => {
  const uploadFile = useUploadFile()
  const uploadFileMultipart = useUploadFileMultipart()
  const updateFile = useUpdateFile()
  const deleteFile = useDeleteFile()
  const deleteMultipleFiles = useDeleteMultipleFiles()
  const duplicateFile = useDuplicateFile()
  const moveFile = useMoveFile()
  const moveMultipleFiles = useMoveMultipleFiles()
  const downloadFile = useDownloadFile()
  const validateFile = useValidateFile()

  const isLoading = 
    uploadFile.isLoading ||
    uploadFileMultipart.isLoading ||
    updateFile.isLoading ||
    deleteFile.isLoading ||
    deleteMultipleFiles.isLoading ||
    duplicateFile.isLoading ||
    moveFile.isLoading ||
    moveMultipleFiles.isLoading ||
    downloadFile.isLoading

  const handleBulkOperation = useCallback(async (
    operation: 'delete' | 'move',
    fileIds: number[],
    targetProjectId?: number
  ) => {
    if (operation === 'delete') {
      return deleteMultipleFiles.mutateAsync(fileIds)
    } else if (operation === 'move' && targetProjectId) {
      return moveMultipleFiles.mutateAsync({ fileIds, targetProjectId })
    }
  }, [deleteMultipleFiles, moveMultipleFiles])

  return {
    // Mutations
    uploadFile: uploadFile.mutate,
    uploadFileAsync: uploadFile.mutateAsync,
    uploadFileMultipart: uploadFileMultipart.mutate,
    uploadFileMultipartAsync: uploadFileMultipart.mutateAsync,
    updateFile: updateFile.mutate,
    updateFileAsync: updateFile.mutateAsync,
    deleteFile: deleteFile.mutate,
    deleteFileAsync: deleteFile.mutateAsync,
    duplicateFile: duplicateFile.mutate,
    duplicateFileAsync: duplicateFile.mutateAsync,
    moveFile: moveFile.mutate,
    moveFileAsync: moveFile.mutateAsync,
    downloadFile: downloadFile.mutate,
    downloadFileAsync: downloadFile.mutateAsync,
    validateFile: validateFile.mutate,
    validateFileAsync: validateFile.mutateAsync,
    handleBulkOperation,
    
    // Estados
    isLoading,
    uploadProgress: uploadFile.variables || uploadFileMultipart.variables,
    
    // Utilidades
    reset: () => {
      uploadFile.reset()
      uploadFileMultipart.reset()
      updateFile.reset()
      deleteFile.reset()
      deleteMultipleFiles.reset()
      duplicateFile.reset()
      moveFile.reset()
      moveMultipleFiles.reset()
      downloadFile.reset()
      validateFile.reset()
    }
  }
}

export default useFileManager
