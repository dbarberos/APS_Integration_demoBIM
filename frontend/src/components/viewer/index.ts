// Componentes principales del viewer
export { default as ModelViewer } from './ModelViewer'
export { default as MultiModelViewer } from './MultiModelViewer'
export { default as ViewerContainer } from './ViewerContainer'
export { default as ViewerToolbar } from './ViewerToolbar'

// Componentes de navegación y exploración
export { default as ModelTree } from './ModelTree'
export { default as PropertiesPanel } from './PropertiesPanel'
export { default as LayersPanel } from './LayersPanel'

// Componentes de UI específicos del viewer
export { default as LoadingOverlay } from './LoadingOverlay'

// Re-export de tipos relacionados con el viewer
export type {
  ModelViewerProps,
} from './ModelViewer'

export type {
  MultiModelViewerProps,
  ModelInfo,
} from './MultiModelViewer'

export type {
  ViewerToolbarProps,
} from './ViewerToolbar'

export type {
  PropertiesPanelProps,
} from './PropertiesPanel'

export type {
  ModelTreeProps,
} from './ModelTree'

export type {
  LayersPanelProps,
  LayerInfo,
} from './LayersPanel'

export type {
  LoadingOverlayProps,
} from './LoadingOverlay'

// Hooks del viewer
export { useViewer } from '@/hooks/useViewer'
export { useViewerExtensions } from '@/hooks/useViewerExtensions'
export { useModelState } from '@/hooks/useModelState'
export { useViewerEvents } from '@/hooks/useViewerEvents'

// Servicios del viewer
export { default as viewerService } from '@/services/viewerService'

// Extensiones personalizadas
export {
  InterferenceDetectionExtension,
  AdvancedMeasureExtension,
  CollaborationExtension,
  ExtensionLoader,
  useExtensionLoader,
  CUSTOM_EXTENSIONS,
  STANDARD_EXTENSIONS,
  EXTENSION_PRESETS
} from '@/extensions'

// Tipos del viewer
export type {
  ViewerState,
  ViewerConfiguration,
  ViewerToken,
  ViewerManifest,
  ViewerDerivative,
  ViewerMetadata,
  ModelTreeNode,
  ObjectProperties,
  PropertyGroup,
  Property,
  MeasurementResult,
  SectionPlane,
  ViewerExtension,
  ViewerSession
} from '@/types'
