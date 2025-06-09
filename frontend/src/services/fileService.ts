import { apiRequest, apiConfig, buildUrl, formatFormData } from './api'
import { File, PaginatedResponse, UploadProgress, FileUploadConfig } from '@/types'

// Endpoints de archivos
const FILE_ENDPOINTS = {
  FILES: '/files',
  FILE_BY_ID: (id: number) => `/files/${id}`,
  UPLOAD: '/files/upload',
  UPLOAD_MULTIPART: '/files/upload/multipart',
  DOWNLOAD: (id: number) => `/files/${id}/download`,
  THUMBNAIL: (id: number) => `/files/${id}/thumbnail`,
  METADATA: (id: number) => `/files/${id}/metadata`,
  DUPLICATE: (id: number) => `/files/${id}/duplicate`,
  MOVE: (id: number) => `/files/${id}/move`,
  BULK_DELETE: '/files/bulk-delete',
  BULK_MOVE: '/files/bulk-move',
  STATS: '/files/stats',
} as const

// Configuración por defecto para uploads
const DEFAULT_UPLOAD_CONFIG: FileUploadConfig = {
  maxSize: 100 * 1024 * 1024, // 100MB
  maxFiles: 10,
  acceptedFileTypes: [
    '.rvt', '.rfa', '.rte', // Revit
    '.ifc', // IFC
    '.dwg', '.dxf', // AutoCAD
    '.3dm', // Rhino
    '.skp', // SketchUp
    '.step', '.stp', '.iges', '.igs', // CAD
    '.obj', '.fbx', '.3ds', // 3D
    '.stl', '.3mf', // 3D Printing
  ],
  chunkSize: 5 * 1024 * 1024, // 5MB chunks
  autoStart: true,
  showProgress: true,
}

// Interfaz para parámetros de búsqueda
interface FileSearchParams {
  page?: number
  perPage?: number
  search?: string
  filters?: {
    status?: string[]
    fileType?: string[]
    projectId?: number | null
    dateRange?: {
      start?: string | null
      end?: string | null
    }
    sizeRange?: {
      min?: number | null
      max?: number | null
    }
  }
  sorting?: {
    field?: 'name' | 'size' | 'created_at' | 'updated_at' | 'status'
    direction?: 'asc' | 'desc'
  }
}

// Servicio de archivos
export const fileService = {
  /**
   * Obtener lista de archivos con filtros y paginación
   */
  async getFiles(params: FileSearchParams = {}): Promise<PaginatedResponse<File>> {
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
      if (filters.fileType?.length) queryParams.file_type = filters.fileType
      if (filters.projectId) queryParams.project_id = filters.projectId
      if (filters.dateRange?.start) queryParams.created_after = filters.dateRange.start
      if (filters.dateRange?.end) queryParams.created_before = filters.dateRange.end
      if (filters.sizeRange?.min) queryParams.size_min = filters.sizeRange.min
      if (filters.sizeRange?.max) queryParams.size_max = filters.sizeRange.max
    }
    
    // Ordenamiento
    if (params.sorting) {
      if (params.sorting.field) queryParams.sort_by = params.sorting.field
      if (params.sorting.direction) queryParams.sort_order = params.sorting.direction
    }
    
    const url = buildUrl(FILE_ENDPOINTS.FILES, queryParams)
    return await apiRequest.get<PaginatedResponse<File>>(url)
  },

  /**
   * Obtener archivo por ID
   */
  async getFileById(id: number): Promise<File> {
    return await apiRequest.get<File>(FILE_ENDPOINTS.FILE_BY_ID(id))
  },

  /**
   * Subir archivo simple
   */
  async uploadFile(
    file: File,
    projectId: number,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<File> {
    const formData = formatFormData({
      file,
      project_id: projectId,
    })

    const config = apiConfig.upload((progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress: UploadProgress = {
          file_id: file.name,
          total_size: progressEvent.total,
          uploaded_bytes: progressEvent.loaded,
          progress_percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
          current_part: 1,
          total_parts: 1,
          status: progressEvent.loaded === progressEvent.total ? 'completed' : 'uploading',
          upload_speed_mbps: 0, // Se calcularía externamente
          elapsed_seconds: 0,
          estimated_remaining: 0,
        }
        onProgress(progress)
      }
    })

    return await apiRequest.post<File>(FILE_ENDPOINTS.UPLOAD, formData, config)
  },

  /**
   * Subir archivo grande con chunks (multipart)
   */
  async uploadFileMultipart(
    file: File,
    projectId: number,
    onProgress?: (progress: UploadProgress) => void,
    config: Partial<FileUploadConfig> = {}
  ): Promise<File> {
    const uploadConfig = { ...DEFAULT_UPLOAD_CONFIG, ...config }
    const chunkSize = uploadConfig.chunkSize
    const totalParts = Math.ceil(file.size / chunkSize)
    
    // Iniciar upload multipart
    const initResponse = await apiRequest.post<{ upload_id: string }>('/files/upload/multipart/init', {
      filename: file.name,
      size: file.size,
      content_type: file.type,
      project_id: projectId,
      parts: totalParts,
    })
    
    const uploadId = initResponse.upload_id
    const uploadedParts: Array<{ part_number: number; etag: string }> = []
    
    // Subir cada parte
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const chunk = file.slice(start, end)
      
      const partFormData = new FormData()
      partFormData.append('chunk', chunk)
      partFormData.append('upload_id', uploadId)
      partFormData.append('part_number', partNumber.toString())
      
      const partResponse = await apiRequest.post<{ etag: string }>(
        '/files/upload/multipart/part',
        partFormData,
        apiConfig.upload()
      )
      
      uploadedParts.push({
        part_number: partNumber,
        etag: partResponse.etag,
      })
      
      // Reportar progreso
      if (onProgress) {
        const progress: UploadProgress = {
          file_id: uploadId,
          total_size: file.size,
          uploaded_bytes: end,
          progress_percentage: Math.round((end * 100) / file.size),
          current_part: partNumber,
          total_parts: totalParts,
          status: partNumber === totalParts ? 'processing' : 'uploading',
        }
        onProgress(progress)
      }
    }
    
    // Completar upload
    const completeResponse = await apiRequest.post<File>('/files/upload/multipart/complete', {
      upload_id: uploadId,
      parts: uploadedParts,
    })
    
    return completeResponse
  },

  /**
   * Actualizar archivo
   */
  async updateFile(id: number, updates: Partial<File>): Promise<File> {
    return await apiRequest.patch<File>(FILE_ENDPOINTS.FILE_BY_ID(id), updates)
  },

  /**
   * Eliminar archivo
   */
  async deleteFile(id: number): Promise<void> {
    await apiRequest.delete(FILE_ENDPOINTS.FILE_BY_ID(id))
  },

  /**
   * Eliminar múltiples archivos
   */
  async deleteMultipleFiles(fileIds: number[]): Promise<void> {
    await apiRequest.post(FILE_ENDPOINTS.BULK_DELETE, {
      file_ids: fileIds,
    })
  },

  /**
   * Descargar archivo
   */
  async downloadFile(id: number, filename?: string): Promise<void> {
    const response = await apiRequest.get(
      FILE_ENDPOINTS.DOWNLOAD(id),
      apiConfig.download()
    )
    
    // Crear blob y descargar
    const blob = new Blob([response])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `file_${id}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },

  /**
   * Generar thumbnail
   */
  async generateThumbnail(id: number): Promise<string> {
    const response = await apiRequest.post<{ thumbnail_url: string }>(
      FILE_ENDPOINTS.THUMBNAIL(id)
    )
    return response.thumbnail_url
  },

  /**
   * Obtener metadatos del archivo
   */
  async getFileMetadata(id: number): Promise<Record<string, any>> {
    return await apiRequest.get<Record<string, any>>(FILE_ENDPOINTS.METADATA(id))
  },

  /**
   * Duplicar archivo
   */
  async duplicateFile(id: number, newName?: string): Promise<File> {
    return await apiRequest.post<File>(FILE_ENDPOINTS.DUPLICATE(id), {
      name: newName,
    })
  },

  /**
   * Mover archivo a otro proyecto
   */
  async moveFile(id: number, newProjectId: number): Promise<File> {
    return await apiRequest.post<File>(FILE_ENDPOINTS.MOVE(id), {
      project_id: newProjectId,
    })
  },

  /**
   * Mover múltiples archivos
   */
  async moveMultipleFiles(fileIds: number[], newProjectId: number): Promise<void> {
    await apiRequest.post(FILE_ENDPOINTS.BULK_MOVE, {
      file_ids: fileIds,
      project_id: newProjectId,
    })
  },

  /**
   * Obtener estadísticas de archivos
   */
  async getFileStats(): Promise<{
    total_files: number
    total_size: number
    by_status: Record<string, number>
    by_type: Record<string, number>
    recent_uploads: File[]
  }> {
    return await apiRequest.get(FILE_ENDPOINTS.STATS)
  },

  /**
   * Validar archivo antes del upload
   */
  validateFile(file: File, config: Partial<FileUploadConfig> = {}): {
    valid: boolean
    errors: string[]
  } {
    const uploadConfig = { ...DEFAULT_UPLOAD_CONFIG, ...config }
    const errors: string[] = []
    
    // Validar tamaño
    if (file.size > uploadConfig.maxSize) {
      errors.push(`El archivo es demasiado grande. Máximo permitido: ${uploadConfig.maxSize / 1024 / 1024}MB`)
    }
    
    // Validar tipo de archivo
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!uploadConfig.acceptedFileTypes.includes(fileExtension)) {
      errors.push(`Tipo de archivo no soportado. Tipos permitidos: ${uploadConfig.acceptedFileTypes.join(', ')}`)
    }
    
    return {
      valid: errors.length === 0,
      errors,
    }
  },

  /**
   * Obtener URL de previsualización
   */
  getPreviewUrl(file: File): string | null {
    if (file.thumbnail_url) {
      return file.thumbnail_url
    }
    
    // URLs de previsualización por tipo de archivo
    const extension = file.name.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'rvt':
        return '/icons/file-types/revit.svg'
      case 'ifc':
        return '/icons/file-types/ifc.svg'
      case 'dwg':
      case 'dxf':
        return '/icons/file-types/autocad.svg'
      case '3dm':
        return '/icons/file-types/rhino.svg'
      case 'skp':
        return '/icons/file-types/sketchup.svg'
      default:
        return '/icons/file-types/generic.svg'
    }
  },

  /**
   * Formatear tamaño de archivo
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  },

  /**
   * Obtener icono por tipo de archivo
   */
  getFileIcon(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase()
    
    const iconMap: Record<string, string> = {
      // CAD/BIM
      'rvt': 'revit',
      'rfa': 'revit',
      'rte': 'revit',
      'ifc': 'ifc',
      'dwg': 'autocad',
      'dxf': 'autocad',
      '3dm': 'rhino',
      'skp': 'sketchup',
      
      // 3D
      'obj': '3d',
      'fbx': '3d',
      '3ds': '3d',
      'dae': '3d',
      'blend': '3d',
      
      // CAD Interchange
      'step': 'cad',
      'stp': 'cad',
      'iges': 'cad',
      'igs': 'cad',
      
      // 3D Printing
      'stl': '3d-print',
      '3mf': '3d-print',
      
      // Images
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
      'gif': 'image',
      'bmp': 'image',
      'svg': 'image',
      
      // Documents
      'pdf': 'pdf',
      'doc': 'word',
      'docx': 'word',
      'xls': 'excel',
      'xlsx': 'excel',
      'ppt': 'powerpoint',
      'pptx': 'powerpoint',
      'txt': 'text',
    }
    
    return iconMap[extension || ''] || 'generic'
  },
}

// Funciones de conveniencia (named exports)
export const getFiles = fileService.getFiles
export const getFileById = fileService.getFileById
export const uploadFile = fileService.uploadFile
export const uploadFileMultipart = fileService.uploadFileMultipart
export const updateFile = fileService.updateFile
export const deleteFile = fileService.deleteFile
export const deleteMultipleFiles = fileService.deleteMultipleFiles
export const downloadFile = fileService.downloadFile
export const generateThumbnail = fileService.generateThumbnail
export const getFileMetadata = fileService.getFileMetadata
export const duplicateFile = fileService.duplicateFile
export const moveFile = fileService.moveFile
export const moveMultipleFiles = fileService.moveMultipleFiles
export const getFileStats = fileService.getFileStats
export const validateFile = fileService.validateFile
export const getPreviewUrl = fileService.getPreviewUrl
export const formatFileSize = fileService.formatFileSize
export const getFileIcon = fileService.getFileIcon

export default fileService
