import axios from 'axios'
import type { ViewerToken, ViewerManifest, ViewerMetadata } from '@/types'

export interface ViewerInitOptions {
  extensions?: string[]
  theme?: 'light-theme' | 'dark-theme' | 'bim-theme'
  env?: 'AutodeskProduction' | 'AutodeskStaging'
  api?: 'modelDerivativeV2' | 'streamingV2'
  language?: string
  disabledExtensions?: string[]
  useADP?: boolean
  logLevel?: number
}

export interface ViewerConfiguration {
  accessToken: string
  urn: string
  options?: ViewerInitOptions
  viewerContainer: HTMLElement
}

class ViewerService {
  private baseURL: string
  
  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  }

  /**
   * Obtener token de acceso para el viewer
   */
  async getViewerToken(): Promise<ViewerToken> {
    try {
      const response = await axios.get(`${this.baseURL}/viewer/token`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Error getting viewer token:', error)
      throw new Error(error.response?.data?.detail || 'Error al obtener token del viewer')
    }
  }

  /**
   * Obtener manifest de un modelo
   */
  async getModelManifest(urn: string): Promise<ViewerManifest> {
    try {
      const response = await axios.get(`${this.baseURL}/viewer/manifest/${urn}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Error getting model manifest:', error)
      throw new Error(error.response?.data?.detail || 'Error al obtener manifest del modelo')
    }
  }

  /**
   * Obtener metadata de un modelo
   */
  async getModelMetadata(urn: string): Promise<ViewerMetadata> {
    try {
      const response = await axios.get(`${this.baseURL}/viewer/metadata/${urn}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Error getting model metadata:', error)
      throw new Error(error.response?.data?.detail || 'Error al obtener metadata del modelo')
    }
  }

  /**
   * Obtener jerarquía del modelo
   */
  async getModelHierarchy(urn: string, guid?: string): Promise<any> {
    try {
      const url = guid 
        ? `${this.baseURL}/viewer/hierarchy/${urn}/${guid}`
        : `${this.baseURL}/viewer/hierarchy/${urn}`
      
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Error getting model hierarchy:', error)
      throw new Error(error.response?.data?.detail || 'Error al obtener jerarquía del modelo')
    }
  }

  /**
   * Obtener propiedades de un objeto
   */
  async getObjectProperties(urn: string, dbId: number): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/viewer/properties/${urn}/${dbId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Error getting object properties:', error)
      throw new Error(error.response?.data?.detail || 'Error al obtener propiedades del objeto')
    }
  }

  /**
   * Buscar objetos en el modelo
   */
  async searchObjects(urn: string, query: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/viewer/search/${urn}`, {
        params: { query },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      return response.data
    } catch (error: any) {
      console.error('Error searching objects:', error)
      throw new Error(error.response?.data?.detail || 'Error al buscar objetos')
    }
  }

  /**
   * Inicializar el Forge Viewer
   */
  async initializeViewer(config: ViewerConfiguration): Promise<Autodesk.Viewing.GuiViewer3D> {
    return new Promise((resolve, reject) => {
      // Configuración por defecto
      const defaultOptions: ViewerInitOptions = {
        env: 'AutodeskProduction',
        api: 'modelDerivativeV2',
        theme: 'bim-theme',
        extensions: [
          'Autodesk.Section',
          'Autodesk.Measure',
          'Autodesk.ViewCubeUi',
          'Autodesk.ModelStructure',
          'Autodesk.LayerManager',
          'Autodesk.Properties'
        ],
        useADP: false,
        logLevel: 0,
        ...config.options
      }

      // Configurar la autenticación
      Autodesk.Viewing.Initializer(defaultOptions, () => {
        // Crear el viewer
        const viewer = new Autodesk.Viewing.GuiViewer3D(config.viewerContainer, {
          theme: defaultOptions.theme,
          extensions: defaultOptions.extensions,
          disabledExtensions: defaultOptions.disabledExtensions || [],
          useADP: defaultOptions.useADP,
          logLevel: defaultOptions.logLevel
        })

        // Inicializar el viewer
        const startedCode = viewer.start()
        if (startedCode > 0) {
          reject(new Error('Error al inicializar el viewer'))
          return
        }

        // Configurar el token
        viewer.setAccessToken(config.accessToken)

        resolve(viewer)
      })
    })
  }

  /**
   * Cargar modelo en el viewer
   */
  async loadModel(
    viewer: Autodesk.Viewing.GuiViewer3D,
    urn: string,
    options: any = {}
  ): Promise<Autodesk.Viewing.Model> {
    return new Promise((resolve, reject) => {
      const documentId = `urn:${urn}`
      
      Autodesk.Viewing.Document.load(documentId, (doc) => {
        // Encontrar el viewable por defecto
        const viewables = doc.getRoot().getDefaultGeometry()
        if (!viewables) {
          reject(new Error('No se encontraron geometrías viewables'))
          return
        }

        // Cargar el modelo
        viewer.loadDocumentNode(doc, viewables, options).then((model) => {
          resolve(model)
        }).catch((error) => {
          reject(new Error(`Error al cargar el modelo: ${error.message}`))
        })
      }, (errorMsg) => {
        reject(new Error(`Error al cargar el documento: ${errorMsg}`))
      })
    })
  }

  /**
   * Aplicar configuración de vista
   */
  applyViewConfiguration(viewer: Autodesk.Viewing.GuiViewer3D, config: any) {
    if (config.camera) {
      viewer.setViewFromArray(config.camera)
    }
    
    if (config.cutPlanes) {
      viewer.setCutPlanes(config.cutPlanes)
    }
    
    if (config.explode !== undefined) {
      viewer.explode(config.explode)
    }
    
    if (config.isolate && config.isolate.length > 0) {
      viewer.isolate(config.isolate)
    }
    
    if (config.hide && config.hide.length > 0) {
      viewer.hide(config.hide)
    }
  }

  /**
   * Obtener estado actual de la vista
   */
  getViewState(viewer: Autodesk.Viewing.GuiViewer3D) {
    return {
      camera: viewer.getCamera(),
      cutPlanes: viewer.getCutPlanes(),
      explode: viewer.getExplodeScale(),
      isolatedIds: viewer.getIsolatedNodes(),
      hiddenIds: viewer.getHiddenNodes(),
      selection: viewer.getSelection()
    }
  }

  /**
   * Tomar screenshot del viewer
   */
  async takeScreenshot(
    viewer: Autodesk.Viewing.GuiViewer3D,
    width: number = 1920,
    height: number = 1080
  ): Promise<string> {
    return new Promise((resolve) => {
      viewer.getScreenShot(width, height, (blob) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    })
  }

  /**
   * Limpiar recursos del viewer
   */
  cleanup(viewer: Autodesk.Viewing.GuiViewer3D) {
    if (viewer) {
      viewer.tearDown()
      viewer.finish()
    }
    
    // Limpiar el Initializer si es necesario
    if (Autodesk.Viewing.shutdown) {
      Autodesk.Viewing.shutdown()
    }
  }
}

export const viewerService = new ViewerService()
export default viewerService
