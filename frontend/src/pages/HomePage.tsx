import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUI } from '@/hooks/useUI'
import { useFiles } from '@/hooks/useFiles'
import { useTranslation } from '@/hooks/redux'
import { useProjects } from '@/hooks/redux'
import TranslationStatus from '@/components/translation/TranslationStatus'
import FileUploadZone from '@/components/files/FileUploadZone'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { 
  DocumentIcon, 
  FolderIcon, 
  ArrowPathIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PlusIcon,
  EyeIcon,
  TrendingUpIcon,
  TrendingDownIcon
} from '@heroicons/react/24/outline'
import { formatRelativeTime, formatNumber, formatBytes } from '@/utils/format'

// Interface para actividad reciente
interface RecentActivity {
  id: string
  type: 'file_upload' | 'translation_complete' | 'project_created' | 'file_processed'
  title: string
  description: string
  timestamp: Date
  icon: React.ComponentType<any>
  color: 'blue' | 'green' | 'purple' | 'yellow'
}

const HomePage: React.FC = () => {
  const { user } = useAuth()
  const { setCurrentPage, addBreadcrumb, showSuccessToast } = useUI()
  const { files, isLoading: filesLoading, fetchFiles } = useFiles()
  const { jobs: translationJobs, activeJobs, stats: translationStats } = useTranslation()
  const { projects, stats: projectStats } = useProjects()
  
  const [showUploadZone, setShowUploadZone] = useState(false)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [dashboardStats, setDashboardStats] = useState({
    totalProjects: 0,
    totalFiles: 0,
    activeTranslations: 0,
    completedThisWeek: 0,
    storageUsed: 0,
    successRate: 0
  })

  useEffect(() => {
    setCurrentPage('dashboard')
    addBreadcrumb({ label: 'Dashboard', path: '/' })
    
    // Cargar datos iniciales
    fetchFiles({ limit: 10 })
  }, [setCurrentPage, addBreadcrumb, fetchFiles])

  // Actualizar estadísticas del dashboard
  useEffect(() => {
    const totalFiles = files.length
    const totalProjects = projects.length
    const activeTranslations = activeJobs.length
    const completedThisWeek = translationJobs.filter(job => {
      const completedDate = job.completed_at ? new Date(job.completed_at) : null
      if (!completedDate) return false
      
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return completedDate >= weekAgo && job.status === 'success'
    }).length

    const storageUsed = files.reduce((total, file) => total + (file.size || 0), 0)
    
    const totalCompletedJobs = translationJobs.filter(job => 
      ['success', 'failed'].includes(job.status)
    ).length
    const successfulJobs = translationJobs.filter(job => job.status === 'success').length
    const successRate = totalCompletedJobs > 0 ? (successfulJobs / totalCompletedJobs) * 100 : 0

    setDashboardStats({
      totalProjects,
      totalFiles,
      activeTranslations,
      completedThisWeek,
      storageUsed,
      successRate
    })
  }, [files, projects, translationJobs, activeJobs])

  // Generar actividad reciente basada en datos reales
  useEffect(() => {
    const activities: RecentActivity[] = []

    // Agregar archivos recientes
    files.slice(0, 3).forEach(file => {
      activities.push({
        id: `file-${file.id}`,
        type: 'file_upload',
        title: 'Archivo subido',
        description: file.name,
        timestamp: new Date(file.created_at),
        icon: DocumentIcon,
        color: 'blue'
      })
    })

    // Agregar traducciones completadas recientes
    translationJobs
      .filter(job => job.status === 'success')
      .slice(0, 2)
      .forEach(job => {
        activities.push({
          id: `translation-${job.id}`,
          type: 'translation_complete',
          title: 'Traducción completada',
          description: `${job.input_file?.name} → ${job.output_formats?.join(', ')}`,
          timestamp: new Date(job.completed_at || job.created_at),
          icon: ArrowPathIcon,
          color: 'green'
        })
      })

    // Agregar proyectos recientes
    projects.slice(0, 2).forEach(project => {
      activities.push({
        id: `project-${project.id}`,
        type: 'project_created',
        title: 'Proyecto creado',
        description: project.name,
        timestamp: new Date(project.created_at),
        icon: FolderIcon,
        color: 'purple'
      })
    })

    // Ordenar por fecha más reciente
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    
    setRecentActivity(activities.slice(0, 5))
  }, [files, translationJobs, projects])

  const handleFilesUploaded = (uploadedFiles: File[]) => {
    showSuccessToast(
      `${uploadedFiles.length} archivo${uploadedFiles.length > 1 ? 's' : ''} subido${uploadedFiles.length > 1 ? 's' : ''}`,
      'Los archivos están siendo procesados'
    )
    setShowUploadZone(false)
    // Recargar archivos para mostrar los nuevos
    fetchFiles({ limit: 10 })
  }

  const getActivityIcon = (type: string, color: string) => {
    const baseClasses = `h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-900`
    const colorClasses = {
      blue: 'bg-blue-500',
      green: 'bg-green-500', 
      purple: 'bg-purple-500',
      yellow: 'bg-yellow-500'
    }
    
    return `${baseClasses} ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Encabezado de bienvenida */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Bienvenido, {user?.first_name || 'Usuario'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Aquí tienes un resumen de tu actividad en APS Integration Platform
            </p>
          </div>
          <Button
            onClick={() => setShowUploadZone(!showUploadZone)}
            leftIcon={<PlusIcon className="h-5 w-5" />}
            size="lg"
          >
            Subir Archivo
          </Button>
        </div>
      </div>

      {/* Zona de upload (condicional) */}
      {showUploadZone && (
        <div className="mb-8">
          <FileUploadZone 
            onFilesUploaded={handleFilesUploaded}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          />
        </div>
      )}

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Proyectos */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FolderIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Proyectos
                  </dt>
                  <dd className="flex items-center">
                    <span className="text-lg font-medium text-gray-900 dark:text-white">
                      {formatNumber(dashboardStats.totalProjects)}
                    </span>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Archivos */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DocumentIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Archivos
                  </dt>
                  <dd className="flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-900 dark:text-white">
                      {formatNumber(dashboardStats.totalFiles)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatBytes(dashboardStats.storageUsed)}
                    </span>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Traducciones Activas */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowPathIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Traducciones Activas
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatNumber(dashboardStats.activeTranslations)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Tasa de éxito */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Tasa de Éxito
                  </dt>
                  <dd className="flex items-center">
                    <span className="text-lg font-medium text-gray-900 dark:text-white">
                      {dashboardStats.successRate.toFixed(1)}%
                    </span>
                    {dashboardStats.successRate >= 90 ? (
                      <TrendingUpIcon className="ml-2 h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDownIcon className="ml-2 h-4 w-4 text-red-500" />
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Actividad reciente */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Actividad Reciente
            </h3>
          </div>
          <div className="p-6">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  No hay actividad reciente
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Comienza subiendo un archivo o creando un proyecto
                </p>
              </div>
            ) : (
              <div className="flow-root">
                <ul className="-mb-8">
                  {recentActivity.map((activity, activityIdx) => (
                    <li key={activity.id}>
                      <div className="relative pb-8">
                        {activityIdx !== recentActivity.length - 1 ? (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-600"
                            aria-hidden="true"
                          />
                        ) : null}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={getActivityIcon(activity.type, activity.color)}>
                              <activity.icon className="h-4 w-4 text-white" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-900 dark:text-white font-medium">
                                {activity.title}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                {activity.description}
                              </p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                              <ClockIcon className="h-4 w-4 inline mr-1" />
                              {formatRelativeTime(activity.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Traducciones en progreso */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Traducciones en Progreso
            </h3>
            <Link 
              to="/translations"
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Ver todas
            </Link>
          </div>
          <div className="p-6">
            {activeJobs.length === 0 ? (
              <div className="text-center py-8">
                <ArrowPathIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  No hay traducciones activas
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Sube un archivo para iniciar una traducción
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeJobs.slice(0, 3).map((job) => (
                  <TranslationStatus
                    key={job.id}
                    job={job}
                    showActions={false}
                    showDetails={false}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg !p-4 !shadow-none"
                  />
                ))}
                {activeJobs.length > 3 && (
                  <div className="text-center pt-4">
                    <Link to="/translations">
                      <Button variant="outline" size="sm">
                        Ver {activeJobs.length - 3} más
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="mt-8 bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Acciones Rápidas
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setShowUploadZone(!showUploadZone)}
              className="group relative rounded-lg p-6 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-blue-600 text-white">
                  <DocumentIcon className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Subir Archivo
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Sube un nuevo archivo CAD o BIM para traducir
                </p>
              </div>
            </button>

            <Link
              to="/projects"
              className="group relative rounded-lg p-6 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-green-600 text-white">
                  <FolderIcon className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Nuevo Proyecto
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Crea un nuevo proyecto para organizar tus archivos
                </p>
              </div>
            </Link>

            <Link
              to="/translations"
              className="group relative rounded-lg p-6 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-purple-600 text-white">
                  <ArrowPathIcon className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Ver Traducciones
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Revisa el estado de todas tus traducciones
                </p>
              </div>
            </Link>

            <Link
              to="/files"
              className="group relative rounded-lg p-6 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
            >
              <div>
                <span className="rounded-lg inline-flex p-3 bg-yellow-600 text-white">
                  <EyeIcon className="h-6 w-6" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Ver Archivos
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Explora y gestiona todos tus archivos
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
