import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { projectService } from '@/services/projectService'
import { useGlobalLoaderContext } from '@/components/ui/GlobalLoader'
import type { Project, PaginatedResponse } from '@/types'

// Query keys para React Query
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params: any) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: number) => [...projectKeys.details(), id] as const,
  files: (id: number) => [...projectKeys.all, 'files', id] as const,
  stats: (id?: number) => [...projectKeys.all, 'stats', id] as const,
  recent: () => [...projectKeys.all, 'recent'] as const,
}

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

// Hook para obtener lista de proyectos
export const useProjects = (params: ProjectSearchParams = {}) => {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectService.getProjects(params),
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000, // 2 minutos
  })
}

// Hook para scroll infinito de proyectos
export const useInfiniteProjects = (params: Omit<ProjectSearchParams, 'page'> = {}) => {
  return useInfiniteQuery({
    queryKey: [...projectKeys.lists(), 'infinite', params],
    queryFn: ({ pageParam = 1 }) => 
      projectService.getProjects({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { pagination } = lastPage
      return pagination.has_next_page ? pagination.page + 1 : undefined
    },
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000,
  })
}

// Hook para obtener proyecto por ID
export const useProject = (id: number, enabled = true) => {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectService.getProjectById(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })
}

// Hook para obtener archivos de un proyecto
export const useProjectFiles = (projectId: number, params: any = {}, enabled = true) => {
  return useQuery({
    queryKey: [...projectKeys.files(projectId), params],
    queryFn: () => projectService.getProjectFiles(projectId, params),
    enabled: enabled && !!projectId,
    staleTime: 1 * 60 * 1000, // 1 minuto
  })
}

// Hook para estadísticas de proyecto específico
export const useProjectStats = (projectId?: number) => {
  return useQuery({
    queryKey: projectKeys.stats(projectId),
    queryFn: () => projectId 
      ? projectService.getProjectStats(projectId)
      : projectService.getOverallStats(),
    staleTime: 5 * 60 * 1000,
  })
}

// Hook para proyectos recientes
export const useRecentProjects = (limit = 5) => {
  return useQuery({
    queryKey: [...projectKeys.recent(), limit],
    queryFn: () => projectService.getRecentProjects(limit),
    staleTime: 2 * 60 * 1000,
  })
}

// Hook para crear proyecto
export const useCreateProject = () => {
  const queryClient = useQueryClient()
  const { showLoader, hideLoader } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      showLoader('Creando proyecto...')
      try {
        const result = await projectService.createProject(data)
        return result
      } finally {
        hideLoader()
      }
    },
    onSuccess: (newProject) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: projectKeys.recent() })
      queryClient.invalidateQueries({ queryKey: projectKeys.stats() })
      
      // Agregar nuevo proyecto al caché
      queryClient.setQueryData(projectKeys.detail(newProject.id), newProject)
      
      toast.success(`Proyecto "${newProject.name}" creado correctamente`)
    },
    onError: (error: any) => {
      console.error('Error creating project:', error)
      toast.error(error.message || 'Error al crear el proyecto')
    }
  })
}

// Hook para actualizar proyecto
export const useUpdateProject = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      projectService.updateProject(id, data),
    onSuccess: (updatedProject, { id }) => {
      // Actualizar caché del proyecto específico
      queryClient.setQueryData(projectKeys.detail(id), updatedProject)
      
      // Invalidar listas que podrían contener este proyecto
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: projectKeys.recent() })
      
      toast.success('Proyecto actualizado correctamente')
    },
    onError: (error: any) => {
      console.error('Error updating project:', error)
      toast.error(error.message || 'Error al actualizar el proyecto')
    }
  })
}

// Hook para eliminar proyecto
export const useDeleteProject = () => {
  const queryClient = useQueryClient()
  const { showLoader, hideLoader } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async (id: number) => {
      showLoader('Eliminando proyecto...')
      try {
        await projectService.deleteProject(id)
        return id
      } finally {
        hideLoader()
      }
    },
    onSuccess: (deletedId) => {
      // Remover del caché
      queryClient.removeQueries({ queryKey: projectKeys.detail(deletedId) })
      queryClient.removeQueries({ queryKey: projectKeys.files(deletedId) })
      queryClient.removeQueries({ queryKey: projectKeys.stats(deletedId) })
      
      // Invalidar listas
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: projectKeys.recent() })
      queryClient.invalidateQueries({ queryKey: projectKeys.stats() })
      
      toast.success('Proyecto eliminado correctamente')
    },
    onError: (error: any) => {
      console.error('Error deleting project:', error)
      toast.error(error.message || 'Error al eliminar el proyecto')
    }
  })
}

// Hook para eliminar múltiples proyectos
export const useDeleteMultipleProjects = () => {
  const queryClient = useQueryClient()
  const { showLoader, hideLoader, updateMessage } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async (projectIds: number[]) => {
      showLoader(`Eliminando ${projectIds.length} proyectos...`)
      updateMessage(`Eliminando ${projectIds.length} proyectos...`)
      
      try {
        const result = await projectService.deleteMultipleProjects(projectIds)
        return result
      } finally {
        hideLoader()
      }
    },
    onSuccess: (result, projectIds) => {
      // Remover proyectos eliminados del caché
      projectIds.forEach(id => {
        queryClient.removeQueries({ queryKey: projectKeys.detail(id) })
        queryClient.removeQueries({ queryKey: projectKeys.files(id) })
        queryClient.removeQueries({ queryKey: projectKeys.stats(id) })
      })
      
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: projectKeys.recent() })
      queryClient.invalidateQueries({ queryKey: projectKeys.stats() })
      
      toast.success(`${result.deleted_count} proyectos eliminados correctamente`)
      
      if (result.failed_count > 0) {
        toast.error(`${result.failed_count} proyectos no pudieron ser eliminados`)
      }
    },
    onError: (error: any) => {
      console.error('Error deleting projects:', error)
      toast.error(error.message || 'Error al eliminar los proyectos')
    }
  })
}

// Hook para duplicar proyecto
export const useDuplicateProject = () => {
  const queryClient = useQueryClient()
  const { showLoader, hideLoader } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async ({ id, newName }: { id: number; newName?: string }) => {
      showLoader('Duplicando proyecto...')
      try {
        const result = await projectService.duplicateProject(id, newName)
        return result
      } finally {
        hideLoader()
      }
    },
    onSuccess: (duplicatedProject) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: projectKeys.recent() })
      queryClient.invalidateQueries({ queryKey: projectKeys.stats() })
      queryClient.setQueryData(projectKeys.detail(duplicatedProject.id), duplicatedProject)
      
      toast.success(`Proyecto duplicado como "${duplicatedProject.name}"`)
    },
    onError: (error: any) => {
      console.error('Error duplicating project:', error)
      toast.error(error.message || 'Error al duplicar el proyecto')
    }
  })
}

// Hook para exportar proyecto
export const useExportProject = () => {
  const { showLoader, hideLoader } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async ({ id, format }: { id: number; format?: string }) => {
      showLoader('Exportando proyecto...')
      try {
        const blob = await projectService.exportProject(id, format)
        return { id, blob, format }
      } finally {
        hideLoader()
      }
    },
    onSuccess: ({ blob, id, format }) => {
      // Crear URL temporal y descargar
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `project_${id}_export.${format || 'zip'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success('Exportación iniciada')
    },
    onError: (error: any) => {
      console.error('Error exporting project:', error)
      toast.error(error.message || 'Error al exportar el proyecto')
    }
  })
}

// Hook para importar proyecto
export const useImportProject = () => {
  const queryClient = useQueryClient()
  const { showLoader, hideLoader, updateMessage, updateProgress } = useGlobalLoaderContext()

  return useMutation({
    mutationFn: async ({ 
      file, 
      onProgress 
    }: { 
      file: File
      onProgress?: (progress: number) => void 
    }) => {
      showLoader('Importando proyecto...', 0)
      
      const combinedProgress = (progress: number) => {
        updateProgress(progress)
        updateMessage(`Importando proyecto... ${progress}%`)
        onProgress?.(progress)
      }

      try {
        const result = await projectService.importProject(file, combinedProgress)
        return result
      } finally {
        hideLoader()
      }
    },
    onSuccess: (importedProject) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
      queryClient.invalidateQueries({ queryKey: projectKeys.recent() })
      queryClient.invalidateQueries({ queryKey: projectKeys.stats() })
      queryClient.setQueryData(projectKeys.detail(importedProject.id), importedProject)
      
      toast.success(`Proyecto "${importedProject.name}" importado correctamente`)
    },
    onError: (error: any) => {
      console.error('Error importing project:', error)
      toast.error(error.message || 'Error al importar el proyecto')
    }
  })
}

// Hook personalizado para gestión completa de proyectos
export const useProjectManager = () => {
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const deleteMultipleProjects = useDeleteMultipleProjects()
  const duplicateProject = useDuplicateProject()
  const exportProject = useExportProject()
  const importProject = useImportProject()

  const isLoading = 
    createProject.isLoading ||
    updateProject.isLoading ||
    deleteProject.isLoading ||
    deleteMultipleProjects.isLoading ||
    duplicateProject.isLoading ||
    exportProject.isLoading ||
    importProject.isLoading

  const handleBulkOperation = useCallback(async (
    operation: 'delete' | 'export',
    projectIds: number[],
    options?: { format?: string }
  ) => {
    if (operation === 'delete') {
      return deleteMultipleProjects.mutateAsync(projectIds)
    } else if (operation === 'export') {
      const promises = projectIds.map(id => 
        exportProject.mutateAsync({ id, format: options?.format })
      )
      return Promise.allSettled(promises)
    }
  }, [deleteMultipleProjects, exportProject])

  return {
    // Mutations
    createProject: createProject.mutate,
    createProjectAsync: createProject.mutateAsync,
    updateProject: updateProject.mutate,
    updateProjectAsync: updateProject.mutateAsync,
    deleteProject: deleteProject.mutate,
    deleteProjectAsync: deleteProject.mutateAsync,
    duplicateProject: duplicateProject.mutate,
    duplicateProjectAsync: duplicateProject.mutateAsync,
    exportProject: exportProject.mutate,
    exportProjectAsync: exportProject.mutateAsync,
    importProject: importProject.mutate,
    importProjectAsync: importProject.mutateAsync,
    handleBulkOperation,
    
    // Estados
    isLoading,
    
    // Utilidades
    reset: () => {
      createProject.reset()
      updateProject.reset()
      deleteProject.reset()
      deleteMultipleProjects.reset()
      duplicateProject.reset()
      exportProject.reset()
      importProject.reset()
    }
  }
}

// Hook para estadísticas del dashboard
export const useDashboardStats = () => {
  const recentProjects = useRecentProjects(5)
  const overallStats = useProjectStats()
  
  return {
    recentProjects: recentProjects.data,
    stats: overallStats.data,
    isLoading: recentProjects.isLoading || overallStats.isLoading,
    error: recentProjects.error || overallStats.error,
    refetch: () => {
      recentProjects.refetch()
      overallStats.refetch()
    }
  }
}

// Hook para selector de proyectos
export const useProjectSelector = () => {
  const { data: projects, isLoading } = useProjects({
    sorting: { field: 'name', direction: 'asc' }
  })

  const projectOptions = projects?.data?.map(project => ({
    value: project.id,
    label: project.name,
    description: project.description
  })) || []

  return {
    projects: projectOptions,
    isLoading,
    projectsData: projects?.data || []
  }
}

export default useProjectManager
