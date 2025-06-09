import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUI } from '@/hooks/useUI'
import { useFiles } from '@/hooks/useFiles'
import { DocumentIcon, PlusIcon, FunnelIcon } from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import FileList from '@/components/files/FileList'
import FileUploadZone from '@/components/files/FileUploadZone'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { File } from '@/types'

const FilesPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setCurrentPage, addBreadcrumb, showSuccessToast } = useUI()
  const { files, isLoading, fetchFiles } = useFiles()
  
  const [showUploadZone, setShowUploadZone] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Check if we should show upload zone from URL params
  const shouldShowUpload = searchParams.get('upload') === 'true'

  useEffect(() => {
    setCurrentPage('files')
    addBreadcrumb({ label: 'Archivos', path: '/files' })
    
    // Show upload zone if URL param is set
    if (shouldShowUpload) {
      setShowUploadZone(true)
    }
    
    // Fetch files on mount
    fetchFiles()
  }, [setCurrentPage, addBreadcrumb, shouldShowUpload, fetchFiles])

  const handleFilesUploaded = (uploadedFiles: File[]) => {
    showSuccessToast(
      `${uploadedFiles.length} archivo${uploadedFiles.length > 1 ? 's' : ''} subido${uploadedFiles.length > 1 ? 's' : ''}`,
      'Los archivos están siendo procesados'
    )
    setShowUploadZone(false)
    // Refresh the file list
    fetchFiles()
  }

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    // TODO: Could open a file detail modal or navigate to file detail page
    console.log('Selected file:', file)
  }

  const handleFileView = (file: File) => {
    if (file.urn && file.status === 'ready') {
      navigate(`/viewer/${file.urn}`)
    } else {
      showSuccessToast('Archivo no disponible para visualización', 'El archivo aún se está procesando')
    }
  }

  const handleFileDelete = (file: File) => {
    // This is handled inside FileList component
    // Refresh the list after deletion
    setTimeout(() => {
      fetchFiles()
    }, 1000)
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Gestión de Archivos
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Sube, organiza y gestiona tus archivos CAD y BIM
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowUploadZone(!showUploadZone)}
                leftIcon={showUploadZone ? <FunnelIcon className="h-5 w-5" /> : <PlusIcon className="h-5 w-5" />}
              >
                {showUploadZone ? 'Ocultar Upload' : 'Subir Archivo'}
              </Button>
            </div>
          </div>
        </div>

        {/* Zona de upload (condicional) */}
        {showUploadZone && (
          <div className="mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Subir Nuevos Archivos
              </h2>
              <FileUploadZone 
                onFilesUploaded={handleFilesUploaded}
                maxFiles={5}
                showPreview={true}
              />
            </div>
          </div>
        )}

        {/* Lista de archivos */}
        {isLoading && files.length === 0 ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text="Cargando archivos..." />
          </div>
        ) : (
          <FileList
            onFileSelect={handleFileSelect}
            onFileView={handleFileView}
            onFileDelete={handleFileDelete}
            showActions={true}
            viewMode="list"
          />
        )}

        {/* Empty state cuando no hay archivos */}
        {!isLoading && files.length === 0 && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-6 py-12 text-center">
              <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No hay archivos
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Comienza subiendo tu primer archivo CAD o BIM
              </p>
              <div className="mt-6">
                <Button
                  onClick={() => setShowUploadZone(true)}
                  leftIcon={<PlusIcon className="h-5 w-5" />}
                >
                  Subir Primer Archivo
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* File detail sidebar (opcional) */}
        {selectedFile && (
          <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 z-30">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Detalles del Archivo
                </h3>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <span className="sr-only">Cerrar</span>
                  ×
                </button>
              </div>
              
              {/* File details content */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Nombre</h4>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedFile.name}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Tamaño</h4>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {/* TODO: Add formatBytes utility */}
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Estado</h4>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                    {selectedFile.status}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Fecha de creación</h4>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {new Date(selectedFile.created_at).toLocaleDateString()}
                  </p>
                </div>
                
                {selectedFile.urn && (
                  <div className="pt-4">
                    <Button
                      onClick={() => handleFileView(selectedFile)}
                      fullWidth
                      disabled={selectedFile.status !== 'ready'}
                    >
                      Ver en 3D
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FilesPage
