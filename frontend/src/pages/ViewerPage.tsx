import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useUI } from '@/hooks/useUI'
import { useFiles } from '@/hooks/useFiles'
import { useTranslations } from '@/hooks/useTranslations'
import ViewerContainer from '@/components/viewer/ViewerContainer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'
import { 
  ExclamationTriangleIcon, 
  ArrowLeftIcon,
  DocumentIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import type { File, TranslationJob } from '@/types'

const ViewerPage: React.FC = () => {
  const { urn } = useParams<{ urn: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setCurrentPage, addBreadcrumb, showErrorToast, showSuccessToast } = useUI()
  const { files, getFileByUrn } = useFiles()
  const { jobs, getJobsForFile } = useTranslations()

  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [relatedJobs, setRelatedJobs] = useState<TranslationJob[]>([])
  const [isReady, setIsReady] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Parámetros de configuración desde URL
  const showToolbar = searchParams.get('toolbar') !== 'false'
  const showPanels = searchParams.get('panels') !== 'false'
  const autoLoad = searchParams.get('autoload') !== 'false'
  const theme = searchParams.get('theme') as 'light-theme' | 'dark-theme' | 'bim-theme' || 'bim-theme'

  // Configuración del viewer
  const viewerConfig = {
    theme,
    showToolbar,
    showModelBrowser: showPanels,
    showProperties: showPanels,
    extensions: [
      'Autodesk.Section',
      'Autodesk.Measure',
      'Autodesk.ViewCubeUi',
      'Autodesk.ModelStructure',
      'Autodesk.LayerManager',
      'Autodesk.Properties'
    ],
    language: 'es'
  }

  // Inicializar página
  useEffect(() => {
    setCurrentPage('viewer')
    
    if (urn) {
      addBreadcrumb({ label: 'Visualizador 3D', path: '/viewer' })
      addBreadcrumb({ label: `Modelo: ${urn.slice(0, 8)}...`, path: `/viewer/${urn}` })
    } else {
      addBreadcrumb({ label: 'Visualizador 3D', path: '/viewer' })
    }
  }, [setCurrentPage, addBreadcrumb, urn])

  // Buscar archivo asociado al URN
  useEffect(() => {
    if (!urn) {
      setError('URN del modelo no proporcionado')
      return
    }

    // Buscar archivo por URN
    const file = getFileByUrn(urn)
    if (file) {
      setCurrentFile(file)
      
      // Verificar estado del archivo
      if (file.status === 'ready' && file.urn) {
        setIsReady(true)
        setError(null)
      } else if (file.status === 'error') {
        setError('El archivo tiene errores de procesamiento')
      } else if (file.status === 'processing') {
        setError('El archivo aún se está procesando')
      } else {
        setError('El archivo no está listo para visualización')
      }

      // Buscar trabajos de traducción relacionados
      const fileJobs = getJobsForFile(file.id.toString())
      setRelatedJobs(fileJobs)
    } else {
      setError('Archivo no encontrado en el sistema')
    }
  }, [urn, files, getFileByUrn, getJobsForFile])

  // Manejar carga exitosa del modelo
  const handleModelLoaded = (model: any) => {
    showSuccessToast(
      'Modelo cargado exitosamente',
      currentFile ? `Archivo: ${currentFile.name}` : 'Modelo 3D'
    )
  }

  // Manejar errores del viewer
  const handleViewerError = (error: string) => {
    setError(error)
    showErrorToast('Error del visualizador', error)
  }

  // Navegar hacia atrás
  const handleGoBack = () => {
    if (currentFile) {
      navigate(`/files`)
    } else {
      navigate('/')
    }
  }

  // Verificar estado de traducción
  const getTranslationStatus = () => {
    const activeJob = relatedJobs.find(job => ['pending', 'inprogress'].includes(job.status))
    const completedJob = relatedJobs.find(job => job.status === 'success')
    const failedJob = relatedJobs.find(job => ['failed', 'timeout'].includes(job.status))

    if (activeJob) {
      return {
        status: 'processing',
        message: 'Modelo en procesamiento...',
        job: activeJob
      }
    } else if (completedJob) {
      return {
        status: 'ready',
        message: 'Modelo listo para visualización',
        job: completedJob
      }
    } else if (failedJob) {
      return {
        status: 'error',
        message: 'Error en el procesamiento del modelo',
        job: failedJob
      }
    } else {
      return {
        status: 'unknown',
        message: 'Estado del modelo desconocido',
        job: null
      }
    }
  }

  // Si no hay URN, mostrar página de selección
  if (!urn) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          <DocumentIcon className="mx-auto h-16 w-16 text-gray-400" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
            Selecciona un modelo
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Para usar el visualizador 3D, necesitas seleccionar un modelo desde la gestión de archivos.
          </p>
          <div className="mt-6">
            <Button
              onClick={() => navigate('/files')}
              leftIcon={<DocumentIcon className="h-5 w-5" />}
            >
              Ir a Archivos
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Si hay error, mostrar pantalla de error
  if (error && !isReady) {
    const translationStatus = getTranslationStatus()
    
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          {translationStatus.status === 'processing' ? (
            <>
              <ClockIcon className="mx-auto h-16 w-16 text-yellow-500" />
              <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
                Procesando modelo
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                El modelo se está traduciendo para visualización 3D. Este proceso puede tomar varios minutos.
              </p>
              {translationStatus.job && (
                <div className="mt-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div>Progreso: {translationStatus.job.progress || 0}%</div>
                    {translationStatus.job.progress_message && (
                      <div className="mt-1">{translationStatus.job.progress_message}</div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500" />
              <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
                Error de visualización
              </h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {error}
              </p>
              {currentFile && (
                <div className="mt-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <div>Archivo: {currentFile.name}</div>
                    <div>Estado: {currentFile.status}</div>
                    <div>URN: {urn}</div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-6 flex space-x-3 justify-center">
            <Button
              variant="outline"
              onClick={handleGoBack}
              leftIcon={<ArrowLeftIcon className="h-5 w-5" />}
            >
              Volver
            </Button>
            
            {translationStatus.status === 'processing' && (
              <Button
                onClick={() => window.location.reload()}
              >
                Actualizar
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Mostrar el viewer si todo está listo
  return (
    <div className="h-full flex flex-col">
      {/* Header con información del archivo */}
      {currentFile && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                size="sm"
                variant="outline"
                onClick={handleGoBack}
                leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
              >
                Volver
              </Button>
              
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {currentFile.name}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>Estado: {currentFile.status}</span>
                  <span>Tamaño: {Math.round(currentFile.size / 1024 / 1024 * 100) / 100} MB</span>
                  <span>URN: {urn.slice(0, 16)}...</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {relatedJobs.length > 0 && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                  {relatedJobs.length} traducción{relatedJobs.length > 1 ? 'es' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Viewer Container */}
      <div className="flex-1">
        <ViewerContainer
          urn={urn}
          config={viewerConfig}
          autoLoad={autoLoad}
          onModelLoaded={handleModelLoaded}
          onError={handleViewerError}
          className="h-full"
        />
      </div>
    </div>
  )
}

export default ViewerPage
