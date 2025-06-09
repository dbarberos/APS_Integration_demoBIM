import React, { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { 
  CloudArrowUpIcon,
  DocumentIcon,
  EyeIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

// Hooks API optimizados
import { useFiles, useFileManager } from '@/hooks/api/useFiles'
import { useTranslationJobs, useTranslationManager, useTranslationProgress } from '@/hooks/api/useTranslations'
import { useProjects, useProjectManager } from '@/hooks/api/useProjects'

// Componentes UI
import Button from '@/components/ui/Button'
import ProgressBar, { UploadProgress, TranslationProgress } from '@/components/ui/ProgressBar'
import { SkeletonList } from '@/components/ui/SkeletonLoader'
import RetryButton from '@/components/ui/RetryButton'
import ErrorFallback from '@/components/ui/ErrorFallback'

// Hooks de estado
import { useWebSocket } from '@/hooks/useWebSocket'
import { usePagination } from '@/hooks/usePagination'
import { useDebounce } from '@/hooks/useDebounce'

import { clsx } from 'clsx'
import { toast } from 'react-hot-toast'

interface IntegratedWorkflowProps {
  projectId?: number
  onViewerOpen?: (urn: string) => void
  className?: string
}

const IntegratedWorkflow: React.FC<IntegratedWorkflowProps> = ({
  projectId = 1, // Default project
  onViewerOpen,
  className = ''
}) => {
  // Estados locales
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<number[]>([])
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'files' | 'translations'>('files')
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  // Hooks de paginación
  const filesPagination = usePagination({ initialPerPage: 10 })
  const translationsPagination = usePagination({ initialPerPage: 10 })

  // Debounced search
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Hooks API
  const filesQuery = useFiles({
    page: filesPagination.pagination.page,
    perPage: filesPagination.pagination.perPage,
    search: debouncedSearch,
    filters: { projectId }
  })

  const translationsQuery = useTranslationJobs({
    page: translationsPagination.pagination.page,
    perPage: translationsPagination.pagination.perPage,
    search: debouncedSearch
  })

  const fileManager = useFileManager()
  const translationManager = useTranslationManager()
  const { isConnected } = useWebSocket()

  // Configurar paginación cuando los datos cambien
  useEffect(() => {
    if (filesQuery.data?.pagination?.total) {
      filesPagination.controls.setTotalItems(filesQuery.data.pagination.total)
    }
  }, [filesQuery.data?.pagination?.total])

  useEffect(() => {
    if (translationsQuery.data?.pagination?.total) {
      translationsPagination.controls.setTotalItems(translationsQuery.data.pagination.total)
    }
  }, [translationsQuery.data?.pagination?.total])

  // Dropzone para upload de archivos
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const fileId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))

      try {
        await fileManager.uploadFileAsync({
          file,
          projectId,
          onProgress: (progress) => {
            setUploadProgress(prev => ({ 
              ...prev, 
              [fileId]: progress.progress_percentage 
            }))
          }
        })

        // Remover progreso cuando termine
        setUploadProgress(prev => {
          const { [fileId]: _, ...rest } = prev
          return rest
        })

      } catch (error) {
        console.error('Upload failed:', error)
        setUploadProgress(prev => {
          const { [fileId]: _, ...rest } = prev
          return rest
        })
      }
    }
  }, [fileManager, projectId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.rvt', '.rfa', '.rte'],
      'application/step': ['.step', '.stp'],
      'model/iges': ['.iges', '.igs'],
      'application/dwg': ['.dwg'],
      'application/dxf': ['.dxf'],
      'model/3mf': ['.3mf'],
      'application/sla': ['.stl']
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: true
  })

  // Manejar selección de archivos
  const handleFileSelect = (fileId: number) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    )
  }

  // Manejar selección de trabajos de traducción
  const handleJobSelect = (jobId: string) => {
    setSelectedJobs(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    )
  }

  // Iniciar traducción para archivos seleccionados
  const handleStartTranslation = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Selecciona al menos un archivo para traducir')
      return
    }

    try {
      for (const fileId of selectedFiles) {
        await translationManager.startTranslationAsync({
          fileId,
          outputFormats: ['svf2', 'thumbnail'],
          priority: 'normal',
          qualityLevel: 'high',
          autoExtractMetadata: true,
          generateThumbnails: true
        })
      }
      
      setSelectedFiles([])
      setActiveTab('translations')
      toast.success(`Traducción iniciada para ${selectedFiles.length} archivos`)
    } catch (error) {
      console.error('Error starting translation:', error)
    }
  }

  // Renderizar estado de archivo
  const renderFileStatus = (file: any) => {
    const statusConfig = {
      'uploaded': { icon: CheckCircleIcon, color: 'text-green-500', label: 'Subido' },
      'processing': { icon: ArrowPathIcon, color: 'text-blue-500 animate-spin', label: 'Procesando' },
      'ready': { icon: CheckCircleIcon, color: 'text-green-500', label: 'Listo' },
      'error': { icon: ExclamationCircleIcon, color: 'text-red-500', label: 'Error' }
    }

    const config = statusConfig[file.status as keyof typeof statusConfig] || statusConfig.uploaded
    const Icon = config.icon

    return (
      <div className="flex items-center space-x-2">
        <Icon className={clsx('w-4 h-4', config.color)} />
        <span className="text-sm text-gray-600 dark:text-gray-400">{config.label}</span>
      </div>
    )
  }

  // Renderizar estado de traducción
  const renderTranslationStatus = (job: any) => {
    const statusConfig = {
      'pending': { icon: ClockIcon, color: 'text-yellow-500', label: 'Pendiente' },
      'inprogress': { icon: ArrowPathIcon, color: 'text-blue-500 animate-spin', label: 'En progreso' },
      'success': { icon: CheckCircleIcon, color: 'text-green-500', label: 'Completado' },
      'failed': { icon: ExclamationCircleIcon, color: 'text-red-500', label: 'Falló' },
      'timeout': { icon: ExclamationCircleIcon, color: 'text-orange-500', label: 'Tiempo agotado' }
    }

    const config = statusConfig[job.status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon

    return (
      <div className="flex items-center space-x-2">
        <Icon className={clsx('w-4 h-4', config.color)} />
        <span className="text-sm text-gray-600 dark:text-gray-400">{config.label}</span>
        {job.progress !== undefined && job.progress > 0 && (
          <span className="text-xs text-gray-500">({job.progress}%)</span>
        )}
      </div>
    )
  }

  if (filesQuery.error || translationsQuery.error) {
    return (
      <ErrorFallback
        error={filesQuery.error || translationsQuery.error}
        resetError={() => {
          filesQuery.refetch()
          translationsQuery.refetch()
        }}
        showDetails={process.env.NODE_ENV === 'development'}
      />
    )
  }

  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700', className)}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Flujo de Trabajo Integrado
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Sube archivos, inicia traducciones y visualiza modelos
            </p>
          </div>
          
          {/* Estado de conexión */}
          <div className="flex items-center space-x-2">
            <div className={clsx(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500'
            )} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>
      </div>

      {/* Zona de upload */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          )}
        >
          <input {...getInputProps()} />
          <CloudArrowUpIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {isDragActive ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz clic para seleccionar'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Soporta archivos CAD: RVT, IFC, DWG, STEP, STL, etc. (Máx. 100MB)
          </p>
        </div>

        {/* Progreso de uploads activos */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Subiendo archivos:</h4>
            {Object.entries(uploadProgress).map(([fileId, progress]) => (
              <ProgressBar
                key={fileId}
                value={progress}
                label={`Archivo ${fileId.split('_')[2]}`}
                showPercentage
                size="sm"
                animated
              />
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {[
            { id: 'files', name: 'Archivos', count: filesQuery.data?.pagination?.total || 0 },
            { id: 'translations', name: 'Traducciones', count: translationsQuery.data?.pagination?.total || 0 }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'files' | 'translations')}
              className={clsx(
                'py-4 px-1 border-b-2 font-medium text-sm',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              {tab.name}
              {tab.count > 0 && (
                <span className="ml-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-300 py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido */}
      <div className="p-6">
        {/* Búsqueda y acciones */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder={`Buscar ${activeTab === 'files' ? 'archivos' : 'traducciones'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex space-x-2 ml-4">
            {activeTab === 'files' && (
              <>
                <Button
                  onClick={handleStartTranslation}
                  disabled={selectedFiles.length === 0}
                  leftIcon={<CogIcon className="w-4 h-4" />}
                  variant="primary"
                >
                  Traducir Seleccionados ({selectedFiles.length})
                </Button>
                
                {selectedFiles.length > 0 && (
                  <Button
                    onClick={() => setSelectedFiles([])}
                    variant="outline"
                  >
                    Limpiar Selección
                  </Button>
                )}
              </>
            )}

            {activeTab === 'translations' && selectedJobs.length > 0 && (
              <div className="flex space-x-2">
                <Button
                  onClick={() => translationManager.handleBulkOperation('retry', selectedJobs)}
                  variant="outline"
                  leftIcon={<ArrowPathIcon className="w-4 h-4" />}
                >
                  Reintentar
                </Button>
                <Button
                  onClick={() => translationManager.handleBulkOperation('cancel', selectedJobs)}
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => setSelectedJobs([])}
                  variant="ghost"
                >
                  Limpiar
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Lista de archivos */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            {filesQuery.isLoading ? (
              <SkeletonList items={5} showAvatar />
            ) : filesQuery.data?.data?.length === 0 ? (
              <div className="text-center py-8">
                <DocumentIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'No se encontraron archivos' : 'No hay archivos en este proyecto'}
                </p>
              </div>
            ) : (
              filesQuery.data?.data?.map((file: any) => (
                <div
                  key={file.id}
                  className={clsx(
                    'p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                    selectedFiles.includes(file.id) && 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.id)}
                        onChange={() => handleFileSelect(file.id)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                      
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {file.name}
                        </h4>
                        <div className="flex items-center space-x-4 mt-1">
                          {renderFileStatus(file)}
                          <span className="text-xs text-gray-500">
                            {file.size && `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(file.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      {file.urn && (
                        <Button
                          onClick={() => onViewerOpen?.(file.urn)}
                          size="sm"
                          variant="outline"
                          leftIcon={<EyeIcon className="w-4 h-4" />}
                        >
                          Ver
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => fileManager.deleteFile(file.id)}
                        size="sm"
                        variant="ghost"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Paginación de archivos */}
            {filesQuery.data && filesQuery.data.pagination.total_pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Mostrando {filesPagination.pagination.startIndex + 1} a {filesPagination.pagination.endIndex + 1} de {filesPagination.pagination.totalItems} archivos
                </p>
                
                <div className="flex space-x-2">
                  <Button
                    onClick={filesPagination.controls.previousPage}
                    disabled={!filesPagination.pagination.hasPreviousPage}
                    size="sm"
                    variant="outline"
                  >
                    Anterior
                  </Button>
                  <Button
                    onClick={filesPagination.controls.nextPage}
                    disabled={!filesPagination.pagination.hasNextPage}
                    size="sm"
                    variant="outline"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lista de traducciones */}
        {activeTab === 'translations' && (
          <div className="space-y-4">
            {translationsQuery.isLoading ? (
              <SkeletonList items={5} showAvatar />
            ) : translationsQuery.data?.data?.length === 0 ? (
              <div className="text-center py-8">
                <CogIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'No se encontraron traducciones' : 'No hay traducciones iniciadas'}
                </p>
              </div>
            ) : (
              translationsQuery.data?.data?.map((job: any) => (
                <TranslationJobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJobs.includes(job.id)}
                  onSelect={() => handleJobSelect(job.id)}
                  onRetry={() => translationManager.retryTranslation({ jobId: job.id })}
                  onCancel={() => translationManager.cancelTranslation({ jobId: job.id })}
                  onView={() => job.urn && onViewerOpen?.(job.urn)}
                />
              ))
            )}

            {/* Paginación de traducciones */}
            {translationsQuery.data && translationsQuery.data.pagination.total_pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Mostrando {translationsPagination.pagination.startIndex + 1} a {translationsPagination.pagination.endIndex + 1} de {translationsPagination.pagination.totalItems} traducciones
                </p>
                
                <div className="flex space-x-2">
                  <Button
                    onClick={translationsPagination.controls.previousPage}
                    disabled={!translationsPagination.pagination.hasPreviousPage}
                    size="sm"
                    variant="outline"
                  >
                    Anterior
                  </Button>
                  <Button
                    onClick={translationsPagination.controls.nextPage}
                    disabled={!translationsPagination.pagination.hasNextPage}
                    size="sm"
                    variant="outline"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Componente separado para tarjetas de trabajo de traducción
const TranslationJobCard: React.FC<{
  job: any
  isSelected: boolean
  onSelect: () => void
  onRetry: () => void
  onCancel: () => void
  onView: () => void
}> = ({ job, isSelected, onSelect, onRetry, onCancel, onView }) => {
  // Usar hook para progreso en tiempo real
  useTranslationProgress(job.id)

  return (
    <div
      className={clsx(
        'p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
        isSelected && 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          
          <div className="flex-1">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {job.input_file_name}
            </h4>
            <div className="flex items-center space-x-4 mt-1">
              <div className="flex items-center space-x-2">
                <div className={clsx(
                  'w-2 h-2 rounded-full',
                  job.status === 'success' ? 'bg-green-500' :
                  job.status === 'failed' ? 'bg-red-500' :
                  job.status === 'inprogress' ? 'bg-blue-500' :
                  'bg-yellow-500'
                )} />
                <span className="text-xs text-gray-500">
                  {job.status === 'success' ? 'Completado' :
                   job.status === 'failed' ? 'Falló' :
                   job.status === 'inprogress' ? 'En progreso' :
                   'Pendiente'}
                </span>
              </div>
              
              {job.progress > 0 && (
                <span className="text-xs text-gray-500">
                  {job.progress}%
                </span>
              )}
              
              <span className="text-xs text-gray-500">
                {new Date(job.created_at).toLocaleDateString()}
              </span>
            </div>

            {/* Barra de progreso para trabajos activos */}
            {job.status === 'inprogress' && (
              <div className="mt-2">
                <TranslationProgress
                  jobId={job.id}
                  fileName={job.input_file_name}
                  progress={job.progress || 0}
                  stage={job.current_stage || 'Procesando'}
                  status={job.status}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          {job.status === 'success' && job.urn && (
            <Button
              onClick={onView}
              size="sm"
              variant="outline"
              leftIcon={<EyeIcon className="w-4 h-4" />}
            >
              Ver
            </Button>
          )}
          
          {job.status === 'failed' && (
            <RetryButton
              onRetry={onRetry}
              size="sm"
              variant="outline"
            />
          )}
          
          {(job.status === 'pending' || job.status === 'inprogress') && (
            <Button
              onClick={onCancel}
              size="sm"
              variant="ghost"
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default IntegratedWorkflow
