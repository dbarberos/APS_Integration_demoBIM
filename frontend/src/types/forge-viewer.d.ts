// Definiciones de tipos para Autodesk Forge Viewer
declare global {
  interface Window {
    Autodesk: typeof Autodesk
  }

  namespace Autodesk {
    namespace Viewing {
      // Constantes de eventos
      const SELECTION_CHANGED_EVENT: string
      const CAMERA_CHANGE_EVENT: string
      const MODEL_ADDED_EVENT: string
      const MODEL_REMOVED_EVENT: string
      const ISOLATE_EVENT: string
      const HIDE_EVENT: string
      const SHOW_EVENT: string
      const CUTPLANES_CHANGE_EVENT: string
      const EXPLODE_CHANGE_EVENT: string
      const EXTENSION_LOADED_EVENT: string
      const EXTENSION_UNLOADED_EVENT: string
      const ERROR_EVENT: string
      const GEOMETRY_LOADED_EVENT: string
      const OBJECT_TREE_CREATED_EVENT: string
      const TOOLBAR_CREATED_EVENT: string
      const FULLSCREEN_MODE_EVENT: string
      const PROGRESS_UPDATE_EVENT: string

      // Función de inicialización
      function Initializer(options: any, callback: () => void): void
      function shutdown(): void

      // Clases principales
      class GuiViewer3D {
        constructor(container: HTMLElement, config?: any)
        
        // Métodos principales
        start(): number
        finish(): void
        tearDown(): void
        
        // Gestión de modelos
        loadDocumentNode(doc: Document, viewable: any, options?: any): Promise<Model>
        unloadModel(model: Model): void
        
        // Navegación
        fitToView(objectIds?: number[]): void
        setViewFromArray(camera: number[]): void
        getCamera(): any
        
        // Selección
        select(objectIds: number[]): void
        clearSelection(): void
        getSelection(): number[]
        
        // Visibilidad
        isolate(objectIds: number[]): void
        hide(objectIds: number[]): void
        show(objectIds: number[]): void
        showAll(): void
        getIsolatedNodes(): number[]
        getHiddenNodes(): number[]
        
        // Sección y explosión
        setCutPlanes(planes: any[]): void
        getCutPlanes(): any[]
        explode(scale: number): void
        getExplodeScale(): number
        
        // Extensiones
        loadExtension(extensionId: string, options?: any): Promise<Extension>
        unloadExtension(extensionId: string): boolean
        getExtension(extensionId: string): Extension | null
        
        // Eventos
        addEventListener(event: string, callback: (event: any) => void): void
        removeEventListener(event: string, callback: (event: any) => void): void
        fireEvent(event: any): void
        
        // Propiedades
        getProperties(dbId: number, callback: (properties: any) => void): void
        search(query: string, onSuccess: (results: number[]) => void, onError: () => void): void
        
        // Captura de pantalla
        getScreenShot(width: number, height: number, callback: (blob: Blob) => void): void
        
        // Autenticación
        setAccessToken(token: string): void
        
        // Propiedades
        model: Model | null
        navigation: Navigation
        autocam: any
        prefs: any
        config: any
        container: HTMLElement
      }

      class Model {
        id: number
        myData: any
        
        // Métodos
        getInstanceTree(): InstanceTree | null
        getExternalId(dbId: number): string | null
        getBoundingBox(): any
        getFragmentList(): any
        getPropertyDb(): any
        
        // Eventos
        addEventListener(event: string, callback: (event: any) => void): void
        removeEventListener(event: string, callback: (event: any) => void): void
      }

      class InstanceTree {
        // Métodos de navegación
        getRootId(): number
        getNodeParent(nodeId: number): number
        getNodeName(nodeId: number): string
        getNodeType(nodeId: number): string
        getChildCount(nodeId: number): number
        enumNodeChildren(nodeId: number, callback: (childId: number) => void): void
        enumNodeFragments(nodeId: number, callback: (fragId: number) => void): void
      }

      class Navigation {
        // Métodos de navegación
        setZoomTowardsViewCenter(enable: boolean): void
        zoom(scale: number): void
        pan(delta: any): void
        orbit(deltaX: number, deltaY: number): void
        dolly(delta: any): void
        setRequestTransitionWithUp(enable: boolean): void
      }

      class Extension {
        viewer: GuiViewer3D
        name: string
        
        // Métodos del ciclo de vida
        load(): boolean
        unload(): boolean
        activate(): boolean
        deactivate(): boolean
        
        // Eventos
        addEventListener(event: string, callback: (event: any) => void): void
        removeEventListener(event: string, callback: (event: any) => void): void
      }

      class Document {
        static load(
          documentId: string,
          onSuccess: (doc: Document) => void,
          onError: (error: string) => void
        ): void
        
        getRoot(): BubbleNode
        downloadAecModelData(callback: (data: any) => void): void
      }

      class BubbleNode {
        getDefaultGeometry(): BubbleNode | null
        getViewableUrn(): string
        getName(): string
        getRole(): string
        getGuid(): string
        search(searchOptions: any): BubbleNode[]
      }

      // Interfaces de utilidad
      interface ViewerConfig {
        theme?: 'light-theme' | 'dark-theme' | 'bim-theme'
        extensions?: string[]
        disabledExtensions?: string[]
        useADP?: boolean
        logLevel?: number
        language?: string
      }

      interface InitializerOptions {
        env?: 'AutodeskProduction' | 'AutodeskStaging'
        api?: 'modelDerivativeV2' | 'streamingV2'
        theme?: string
        extensions?: string[]
        disabledExtensions?: string[]
        useADP?: boolean
        logLevel?: number
        language?: string
      }

      interface SelectionEvent {
        type: string
        dbIdArray: number[]
        nodeArray: any[]
        model: Model
      }

      interface CameraChangeEvent {
        type: string
        camera: any
        viewer: GuiViewer3D
      }

      interface ModelEvent {
        type: string
        model: Model
        viewer: GuiViewer3D
      }

      interface ProgressEvent {
        type: string
        percent: number
        state: string
      }

      interface ErrorEvent {
        type: string
        message: string
        code?: string
        target: any
      }
    }
  }
}

export {}
