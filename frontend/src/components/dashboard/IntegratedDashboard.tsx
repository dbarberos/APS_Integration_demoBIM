import React, { useState } from 'react'
import { 
  ChartBarIcon,
  DocumentIcon,
  CogIcon,
  FolderIcon,
  EyeIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'

// Componentes integrados
import IntegratedWorkflow from '@/components/integration/IntegratedWorkflow'
import { SkeletonCard } from '@/components/ui/SkeletonLoader'
import Button from '@/components/ui/Button'
import ErrorFallback from '@/components/ui/ErrorFallback'

// Hooks API optimizados
import { useDashboardStats } from '@/hooks/api/useProjects'
import { useFileStats } from '@/hooks/api/useFiles'
import { useTranslationStats, useActiveTranslationJobs } from '@/hooks/api/useTranslations'

// Hooks de estado
import { useWebSocket } from '@/hooks/useWebSocket'

import { clsx } from 'clsx'
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Bar, BarChart } from 'recharts'

interface IntegratedDashboardProps {
  onNavigate?: (path: string) => void
  className?: string
}

const IntegratedDashboard: React.FC<IntegratedDashboardProps> = ({
  onNavigate,
  className = ''
}) => {
  const [selectedProject, setSelectedProject] = useState<number>(1)
  const [showWorkflow, setShowWorkflow] = useState(false)

  // Hooks de datos
  const { recentProjects, stats: projectStats, isLoading: projectsLoading } = useDashboardStats()
  const { data: fileStats, isLoading: filesLoading } = useFileStats()
  const { data: translationStats, isLoading: translationsLoading } = useTranslationStats()
  const { data: activeJobs, isLoading: activeJobsLoading } = useActiveTranslationJobs()
  const { isConnected, connectionState } = useWebSocket()

  // Datos para gráficos
  const uploadTrendData = [
    { date: '2024-01-01', uploads: 12 },
    { date: '2024-01-02', uploads: 15 },
    { date: '2024-01-03', uploads: 8 },
    { date: '2024-01-04', uploads: 22 },
    { date: '2024-01-05', uploads: 18 },
    { date: '2024-01-06', uploads: 25 },
    { date: '2024-01-07', uploads: 30 }
  ]

  const translationStatusData = [
    { status: 'Completados', count: translationStats?.completed_jobs || 0 },
    { status: 'En progreso', count: translationStats?.active_jobs || 0 },
    { status: 'Fallidos', count: translationStats?.failed_jobs || 0 },
    { status: 'Pendientes', count: translationStats?.pending_jobs || 0 }
  ]

  const isLoading = projectsLoading || filesLoading || translationsLoading || activeJobsLoading

  if (isLoading) {
    return (
      <div className={clsx('grid grid-cols-1 lg:grid-cols-3 gap-6', className)}>
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} showImage={false} lines={3} />
        ))}
      </div>
    )
  }

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header con estado de conexión */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Panel de Control Integrado
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Gestión completa de archivos CAD y traducciones APS
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Estado de conexión WebSocket */}
            <div className="flex items-center space-x-2">
              <div className={clsx(
                'w-3 h-3 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-500'
              )} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {connectionState === 'connected' ? 'Tiempo Real Activo' :
                 connectionState === 'connecting' ? 'Conectando...' :
                 connectionState === 'error' ? 'Error de Conexión' :
                 'Desconectado'}
              </span>
            </div>

            <Button
              onClick={() => setShowWorkflow(!showWorkflow)}
              variant={showWorkflow ? 'primary' : 'outline'}
            >
              {showWorkflow ? 'Ocultar Flujo' : 'Mostrar Flujo de Trabajo'}
            </Button>
          </div>
        </div>
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Proyectos"
          value={projectStats?.total_projects || 0}
          change="+12%"
          changeType="positive"
          icon={<FolderIcon className="w-8 h-8" />}
          onClick={() => onNavigate?.('/projects')}
        />
        
        <StatCard
          title="Archivos"
          value={fileStats?.total_files || 0}
          change="+8%"
          changeType="positive"
          icon={<DocumentIcon className="w-8 h-8" />}
          subtitle={`${((fileStats?.total_size || 0) / 1024 / 1024 / 1024).toFixed(1)} GB`}
          onClick={() => onNavigate?.('/files')}
        />
        
        <StatCard
          title="Traducciones Activas"
          value={activeJobs?.length || 0}
          change="-5%"
          changeType="negative"
          icon={<CogIcon className="w-8 h-8" />}
          subtitle="En tiempo real"
          onClick={() => onNavigate?.('/translations')}
        />
        
        <StatCard
          title="Modelos Visualizados"
          value={translationStats?.successful_translations || 0}
          change="+15%"
          changeType="positive"
          icon={<EyeIcon className="w-8 h-8" />}
          onClick={() => onNavigate?.('/viewer')}
        />
      </div>

      {/* Flujo de trabajo integrado */}
      {showWorkflow && (
        <IntegratedWorkflow
          projectId={selectedProject}
          onViewerOpen={(urn) => onNavigate?.(`/viewer/${urn}`)}
          className="col-span-full"
        />
      )}

      {/* Gráficos y análisis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendencia de uploads */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tendencia de Uploads
            </h3>
            <ArrowTrendingUpIcon className="w-5 h-5 text-blue-500" />
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={uploadTrendData}>
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value) => [value, 'Uploads']}
                />
                <Line 
                  type="monotone" 
                  dataKey="uploads" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Estado de traducciones */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Estado de Traducciones
            </h3>
            <ChartBarIcon className="w-5 h-5 text-green-500" />
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={translationStatusData}>
                <XAxis dataKey="status" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar 
                  dataKey="count" 
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Actividad reciente y trabajos activos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Proyectos recientes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Proyectos Recientes
            </h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onNavigate?.('/projects')}
            >
              Ver todos
            </Button>
          </div>
          
          <div className="space-y-3">
            {recentProjects?.slice(0, 5).map((project: any) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors"
                onClick={() => onNavigate?.(`/projects/${project.id}`)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <FolderIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {project.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {project.files_count} archivos
                    </p>
                  </div>
                </div>
                
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(project.updated_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trabajos de traducción activos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Traducciones Activas
            </h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onNavigate?.('/translations')}
            >
              Ver todas
            </Button>
          </div>
          
          <div className="space-y-3">
            {activeJobs?.slice(0, 5).map((job: any) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors"
                onClick={() => onNavigate?.(`/translations/${job.id}`)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                    {job.status === 'success' ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : job.status === 'failed' ? (
                      <ExclamationCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                    ) : (
                      <ClockIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {job.input_file_name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {job.status === 'inprogress' ? `${job.progress || 0}%` : job.status}
                    </p>
                  </div>
                </div>
                
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(job.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Accesos Rápidos
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionCard
            title="Subir Archivos"
            description="Cargar nuevos modelos CAD"
            icon={<DocumentIcon className="w-6 h-6" />}
            onClick={() => onNavigate?.('/files')}
          />
          
          <QuickActionCard
            title="Nuevo Proyecto"
            description="Crear proyecto CAD"
            icon={<FolderIcon className="w-6 h-6" />}
            onClick={() => onNavigate?.('/projects')}
          />
          
          <QuickActionCard
            title="Ver Modelos"
            description="Visualizador 3D"
            icon={<EyeIcon className="w-6 h-6" />}
            onClick={() => onNavigate?.('/viewer')}
          />
          
          <QuickActionCard
            title="Traducciones"
            description="Gestionar trabajos"
            icon={<CogIcon className="w-6 h-6" />}
            onClick={() => onNavigate?.('/translations')}
          />
        </div>
      </div>
    </div>
  )
}

// Componente de tarjeta de estadística
const StatCard: React.FC<{
  title: string
  value: number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ReactNode
  subtitle?: string
  onClick?: () => void
}> = ({ title, value, change, changeType = 'neutral', icon, subtitle, onClick }) => (
  <div 
    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow cursor-pointer"
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value.toLocaleString()}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {subtitle}
          </p>
        )}
      </div>
      <div className="text-blue-500 dark:text-blue-400">
        {icon}
      </div>
    </div>
    
    {change && (
      <div className="mt-2">
        <span className={clsx(
          'text-sm font-medium',
          changeType === 'positive' && 'text-green-600 dark:text-green-400',
          changeType === 'negative' && 'text-red-600 dark:text-red-400',
          changeType === 'neutral' && 'text-gray-600 dark:text-gray-400'
        )}>
          {change}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
          vs mes anterior
        </span>
      </div>
    )}
  </div>
)

// Componente de acción rápida
const QuickActionCard: React.FC<{
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
}> = ({ title, description, icon, onClick }) => (
  <div
    className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group"
    onClick={onClick}
  >
    <div className="text-center">
      <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 transition-colors">
        <div className="text-blue-600 dark:text-blue-400">
          {icon}
        </div>
      </div>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
        {title}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  </div>
)

export default IntegratedDashboard
