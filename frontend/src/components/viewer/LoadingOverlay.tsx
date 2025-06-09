import React from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { CubeIcon, CloudArrowDownIcon, DocumentIcon } from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

export interface LoadingOverlayProps {
  isVisible: boolean
  stage: 'initializing' | 'downloading' | 'parsing' | 'rendering' | 'complete'
  progress?: number
  message?: string
  fileName?: string
  className?: string
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  stage,
  progress = 0,
  message,
  fileName,
  className = ''
}) => {
  const getStageInfo = () => {
    switch (stage) {
      case 'initializing':
        return {
          icon: CubeIcon,
          title: 'Inicializando viewer...',
          description: 'Configurando el entorno de visualización 3D',
          color: 'text-blue-500'
        }
      case 'downloading':
        return {
          icon: CloudArrowDownIcon,
          title: 'Descargando modelo...',
          description: 'Obteniendo geometría y metadatos del servidor',
          color: 'text-green-500'
        }
      case 'parsing':
        return {
          icon: DocumentIcon,
          title: 'Procesando modelo...',
          description: 'Analizando estructura y preparando geometría',
          color: 'text-yellow-500'
        }
      case 'rendering':
        return {
          icon: CubeIcon,
          title: 'Renderizando...',
          description: 'Generando visualización 3D del modelo',
          color: 'text-purple-500'
        }
      default:
        return {
          icon: CubeIcon,
          title: 'Cargando...',
          description: 'Preparando visualización',
          color: 'text-gray-500'
        }
    }
  }

  const stageInfo = getStageInfo()
  const Icon = stageInfo.icon

  if (!isVisible) {
    return null
  }

  return (
    <div className={clsx(
      'absolute inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-50',
      className
    )}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md mx-4 min-w-80">
        {/* Icono principal */}
        <div className="flex justify-center mb-6">
          <div className={clsx(
            'relative',
            stage === 'rendering' && 'animate-pulse'
          )}>
            <Icon className={clsx('h-16 w-16', stageInfo.color)} />
            {stage === 'downloading' && (
              <div className="absolute -top-1 -right-1">
                <div className="h-4 w-4 bg-green-500 rounded-full animate-ping"></div>
              </div>
            )}
          </div>
        </div>

        {/* Contenido principal */}
        <div className="text-center space-y-4">
          {/* Título */}
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {stageInfo.title}
          </h3>

          {/* Descripción */}
          <p className="text-gray-600 dark:text-gray-400">
            {message || stageInfo.description}
          </p>

          {/* Nombre del archivo */}
          {fileName && (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Archivo:</span> {fileName}
              </p>
            </div>
          )}

          {/* Barra de progreso */}
          {progress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Progreso</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={clsx(
                    'h-2 rounded-full transition-all duration-500',
                    stage === 'downloading' && 'bg-green-500',
                    stage === 'parsing' && 'bg-yellow-500',
                    stage === 'rendering' && 'bg-purple-500',
                    stage === 'initializing' && 'bg-blue-500'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Spinner de carga */}
          {progress === 0 && (
            <div className="flex justify-center">
              <LoadingSpinner size="md" />
            </div>
          )}

          {/* Etapas de progreso */}
          <div className="flex justify-center space-x-2 mt-6">
            {['initializing', 'downloading', 'parsing', 'rendering'].map((stageName, index) => {
              const isActive = stageName === stage
              const isCompleted = ['initializing', 'downloading', 'parsing', 'rendering'].indexOf(stage) > index
              
              return (
                <div
                  key={stageName}
                  className={clsx(
                    'w-2 h-2 rounded-full transition-colors duration-300',
                    isActive && 'bg-blue-500 animate-pulse',
                    isCompleted && 'bg-green-500',
                    !isActive && !isCompleted && 'bg-gray-300 dark:bg-gray-600'
                  )}
                />
              )
            })}
          </div>

          {/* Mensaje de estado adicional */}
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            {stage === 'initializing' && (
              <p>Cargando librerías del viewer...</p>
            )}
            {stage === 'downloading' && progress > 0 && (
              <p>Descargado {Math.round(progress)}% del modelo</p>
            )}
            {stage === 'parsing' && (
              <p>Procesando geometría y metadatos...</p>
            )}
            {stage === 'rendering' && (
              <p>Preparando visualización 3D...</p>
            )}
          </div>
        </div>

        {/* Tips o información adicional */}
        <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 <span className="font-medium">Tip:</span> {
              stage === 'downloading' ? 'Los modelos grandes pueden tardar más en descargar' :
              stage === 'parsing' ? 'Se está analizando la estructura del modelo' :
              stage === 'rendering' ? 'Generando la visualización 3D interactiva' :
              'Inicializando el entorno de visualización'
            }
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoadingOverlay
