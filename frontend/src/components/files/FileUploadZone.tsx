import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { 
  CloudArrowUpIcon, 
  DocumentIcon, 
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { useFiles } from '@/hooks/useFiles'
import { useUI } from '@/hooks/useUI'
import Button from '@/components/ui/Button'
import { formatBytes } from '@/utils/format'
import { validateCADFile } from '@/utils/validation'

// Tipos de archivos permitidos para CAD/BIM
const ACCEPTED_FILE_TYPES = {
  // AutoCAD
  '.dwg': 'application/acad',
  '.dxf': 'application/dxf',
  
  // Revit
  '.rvt': 'application/revit',
  '.rfa': 'application/revit-family',
  
  // Otros formatos BIM/CAD
  '.ifc': 'application/ifc',
  '.3dm': 'application/3dm',
  '.skp': 'application/sketchup',
  '.step': 'application/step',
  '.stp': 'application/step',
  '.iges': 'application/iges',
  '.igs': 'application/iges',
  
  // Formatos 3D
  '.obj': 'model/obj',
  '.fbx': 'application/fbx',
  '.3ds': 'application/3ds',
  '.dae': 'model/vnd.collada+xml',
  '.stl': 'model/stl',
  '.3mf': 'model/3mf',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  
  // Archivos comprimidos
  '.zip': 'application/zip',
  '.rar': 'application/rar'
}

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB
const MAX_FILES = 10

interface FileUploadZoneProps {
  onFilesUploaded?: (files: File[]) => void
  maxFiles?: number
  maxSize?: number
  className?: string
  showPreview?: boolean
}

interface UploadFile extends File {
  id: string
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
}

const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFilesUploaded,
  maxFiles = MAX_FILES,
  maxSize = MAX_FILE_SIZE,
  className = '',
  showPreview = true
}) => {
  const { uploadFiles, isUploading } = useFiles()
  const { showErrorToast, showSuccessToast } = useUI()
  
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([])
  const [rejectedFiles, setRejectedFiles] = useState<Array<{ file: File; errors: string[] }>>([])

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: any[]) => {
    // Manejar archivos rechazados
    if (fileRejections.length > 0) {
      const rejected = fileRejections.map(({ file, errors }) => ({
        file,
        errors: errors.map((e: any) => {
          switch (e.code) {
            case 'file-too-large':
              return `El archivo es demasiado grande (máximo ${formatBytes(maxSize)})`
            case 'file-invalid-type':
              return 'Tipo de archivo no permitido'
            case 'too-many-files':
              return `Máximo ${maxFiles} archivos permitidos`
            default:
              return e.message
          }
        })
      }))
      setRejectedFiles(rejected)
      
      rejected.forEach(({ file, errors }) => {
        showErrorToast(`Error: ${file.name}`, errors[0])
      })
    }

    // Procesar archivos aceptados
    if (acceptedFiles.length > 0) {
      // Validación adicional para archivos CAD/BIM
      const validFiles: File[] = []
      const invalidFiles: Array<{ file: File; error: string }> = []

      acceptedFiles.forEach(file => {
        const validation = validateCADFile(file)
        if (validation.isValid) {
          validFiles.push(file)
        } else {
          invalidFiles.push({ file, error: validation.error || 'Archivo inválido' })
        }
      })

      // Mostrar errores de validación
      invalidFiles.forEach(({ file, error }) => {
        showErrorToast(`Error: ${file.name}`, error)
      })

      // Procesar archivos válidos
      if (validFiles.length > 0) {
        const newUploadFiles: UploadFile[] = validFiles.map(file => ({
          ...file,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          progress: 0,
          status: 'pending' as const
        }))

        setUploadingFiles(prev => [...prev, ...newUploadFiles])
        setRejectedFiles([]) // Limpiar archivos rechazados previos

        // Iniciar upload
        try {
          await uploadFilesWithProgress(validFiles, newUploadFiles)
          
          if (onFilesUploaded) {
            onFilesUploaded(validFiles)
          }
          
          showSuccessToast(
            `${validFiles.length} archivo${validFiles.length > 1 ? 's' : ''} subido${validFiles.length > 1 ? 's' : ''} correctamente`
          )
        } catch (error) {
          console.error('Upload error:', error)
          showErrorToast('Error al subir archivos', 'Inténtalo de nuevo')
        }
      }
    }
  }, [maxFiles, maxSize, onFilesUploaded, showErrorToast, showSuccessToast, uploadFiles])

  const uploadFilesWithProgress = async (files: File[], uploadFiles: UploadFile[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const uploadFile = uploadFiles[i]

      try {
        // Actualizar estado a uploading
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'uploading' }
              : f
          )
        )

        // Simular progreso de upload (en implementación real, esto vendría del servicio)
        const uploadPromise = uploadFiles([file])
        
        // Simular progreso
        let progress = 0
        const progressInterval = setInterval(() => {
          progress += Math.random() * 15
          if (progress > 95) {
            progress = 95
          }
          
          setUploadingFiles(prev => 
            prev.map(f => 
              f.id === uploadFile.id 
                ? { ...f, progress }
                : f
            )
          )
        }, 200)

        // Esperar a que termine el upload
        await uploadPromise

        // Limpiar interval y marcar como completado
        clearInterval(progressInterval)
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, progress: 100, status: 'completed' }
              : f
          )
        )

      } catch (error: any) {
        console.error(`Error uploading ${file.name}:`, error)
        
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === uploadFile.id 
              ? { 
                  ...f, 
                  status: 'error',
                  error: error.response?.data?.detail || 'Error al subir archivo'
                }
              : f
          )
        )
      }
    }
  }

  const removeFile = (fileId: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const clearRejectedFiles = () => {
    setRejectedFiles([])
  }

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles,
    maxSize,
    multiple: true
  })

  const getDropzoneMessage = () => {
    if (isDragReject) {
      return {
        title: 'Archivos no válidos',
        subtitle: 'Algunos archivos no son compatibles',
        icon: ExclamationTriangleIcon,
        className: 'border-red-300 bg-red-50 dark:bg-red-900/20'
      }
    }
    
    if (isDragActive) {
      return {
        title: 'Suelta los archivos aquí',
        subtitle: 'Los archivos se procesarán automáticamente',
        icon: CloudArrowUpIcon,
        className: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
      }
    }
    
    return {
      title: 'Arrastra archivos CAD/BIM aquí',
      subtitle: `O haz clic para seleccionar (máximo ${formatBytes(maxSize)})`,
      icon: CloudArrowUpIcon,
      className: 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
    }
  }

  const message = getDropzoneMessage()
  const Icon = message.icon

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Zona de drop */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${message.className}`}
      >
        <input {...getInputProps()} />
        
        <Icon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {message.title}
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {message.subtitle}
        </p>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p>Formatos soportados: DWG, DXF, RVT, IFC, SKP, OBJ, FBX, STL, GLTF</p>
          <p>Tamaño máximo por archivo: {formatBytes(maxSize)}</p>
          <p>Máximo {maxFiles} archivos</p>
        </div>
      </div>

      {/* Lista de archivos en proceso de upload */}
      {showPreview && uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Archivos en proceso
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {uploadingFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <DocumentIcon className="h-6 w-6 text-gray-400 flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatBytes(file.size)}
                    </p>
                    
                    {file.status === 'uploading' && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          {Math.round(file.progress)}% completado
                        </p>
                      </>
                    )}
                    
                    {file.status === 'completed' && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Completado
                        </p>
                      </>
                    )}
                    
                    {file.status === 'error' && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {file.error}
                        </p>
                      </>
                    )}
                  </div>
                  
                  {/* Barra de progreso */}
                  {file.status === 'uploading' && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Estado y acciones */}
                <div className="flex items-center space-x-2">
                  {file.status === 'completed' && (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  )}
                  
                  {file.status === 'error' && (
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                  )}
                  
                  {(file.status === 'pending' || file.status === 'error') && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archivos rechazados */}
      {rejectedFiles.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
              Archivos rechazados
            </h4>
            <button
              onClick={clearRejectedFiles}
              className="text-red-600 hover:text-red-700 dark:text-red-400"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1">
            {rejectedFiles.map(({ file, errors }, index) => (
              <div key={index} className="text-sm text-red-700 dark:text-red-300">
                <span className="font-medium">{file.name}:</span> {errors[0]}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón alternativo para seleccionar archivos */}
      <div className="text-center">
        <Button
          onClick={() => document.querySelector('input[type="file"]')?.click()}
          variant="outline"
          disabled={isUploading}
          leftIcon={<DocumentIcon className="h-5 w-5" />}
        >
          Seleccionar Archivos
        </Button>
      </div>
    </div>
  )
}

export default FileUploadZone
