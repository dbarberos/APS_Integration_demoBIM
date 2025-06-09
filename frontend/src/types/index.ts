// Tipos principales de la aplicación

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_superuser: boolean
  created_at: string
  updated_at: string
}

export interface Project {
  id: number
  name: string
  description?: string
  bucket_key: string
  created_at: string
  updated_at: string
  user_id: number
}

export interface File {
  id: number
  name: string
  original_filename: string
  urn?: string
  size: number
  content_type: string
  status: FileStatus
  bucket_key: string
  object_key: string
  project_id: number
  user_id: number
  created_at: string
  updated_at: string
  metadata?: Record<string, any>
  translation_progress?: string
  thumbnail_url?: string
}

export type FileStatus = 'uploading' | 'uploaded' | 'processing' | 'ready' | 'error'

export interface TranslationJob {
  id: number
  job_id: string
  internal_id: string
  file_id: number
  user_id: number
  source_urn: string
  output_formats: string[]
  priority: TranslationPriority
  status: TranslationStatus
  progress: number
  progress_message?: string
  translation_config?: Record<string, any>
  advanced_options?: Record<string, any>
  output_urns?: Record<string, any>
  quality_metrics?: QualityMetrics
  metadata_extracted?: Record<string, any>
  hierarchy_data?: Record<string, any>
  warnings?: string[]
  error_message?: string
  error_code?: string
  retry_count: number
  max_retries: number
  created_at: string
  started_at?: string
  completed_at?: string
  last_checked_at?: string
  estimated_duration?: number
  actual_duration?: number
  polling_interval: number
  polling_enabled: boolean
  can_retry: boolean
  is_completed: boolean
  is_active: boolean
}

export type TranslationStatus = 
  | 'pending' 
  | 'inprogress' 
  | 'success' 
  | 'failed' 
  | 'timeout' 
  | 'cancelled'

export type TranslationPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface QualityMetrics {
  overall_quality_score: number
  completeness_score: number
  consistency_score: number
  detail_level_score: number
  organization_score: number
  translation_success: boolean
  derivatives_count: number
  has_geometry: boolean
  has_materials: boolean
  has_textures: boolean
  file_size_mb: number
}

// Viewer Types
export interface ViewerToken {
  access_token: string
  expires_in: number
  token_type: string
  expires_at: string
}

export interface ViewerManifest {
  type: string
  hasThumbnail: string
  status: string
  progress: string
  region: string
  urn: string
  version: string
  derivatives: ViewerDerivative[]
}

export interface ViewerDerivative {
  name: string
  hasThumbnail: string
  status: string
  progress: string
  outputType: string
  children?: ViewerDerivative[]
}

export interface ViewerMetadata {
  metadata: Array<{
    name: string
    guid: string
    role: string
    type: string
  }>
}

export interface ViewerState {
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  currentUrn: string | null
  currentModel: any | null
  viewer: any | null
  selectedIds: number[]
  isolatedIds: number[]
  hiddenIds: number[]
  cutPlanes: any[]
  explodeScale: number
  camera: any | null
}

export interface ViewerConfiguration {
  theme?: 'light-theme' | 'dark-theme' | 'bim-theme'
  extensions?: string[]
  disabledExtensions?: string[]
  showToolbar?: boolean
  showModelBrowser?: boolean
  showProperties?: boolean
  showMinimap?: boolean
  language?: string
  useADP?: boolean
}

export interface ModelTreeNode {
  dbId: number
  name: string
  type: string
  children?: ModelTreeNode[]
  parent?: number
  visible: boolean
  selected: boolean
}

export interface ObjectProperties {
  dbId: number
  name: string
  externalId: string
  properties: PropertyGroup[]
}

export interface PropertyGroup {
  displayName: string
  displayCategory: string
  properties: Property[]
}

export interface Property {
  attributeName: string
  displayName: string
  displayValue: any
  units?: string
  type: number
  hidden: boolean
}

export interface MeasurementResult {
  type: 'distance' | 'area' | 'angle'
  value: number
  units: string
  points: number[][]
  precision: number
}

export interface SectionPlane {
  id: string
  normal: number[]
  distance: number
  visible: boolean
  name: string
}

export interface ViewerExtension {
  name: string
  enabled: boolean
  loaded: boolean
  instance?: any
}

export interface ViewerSession {
  id: string
  urn: string
  startTime: Date
  duration: number
  interactions: number
  lastActivity: Date
  viewStates: any[]
}
  complexity_score: number
}

export interface UploadProgress {
  file_id: string
  total_size: number
  uploaded_bytes: number
  progress_percentage: number
  current_part: number
  total_parts: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  upload_speed_mbps?: number
  elapsed_seconds?: number
  estimated_remaining?: number
}

export interface ApiError {
  message: string
  detail?: string
  code?: string
  status?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
  has_next: boolean
  has_prev: boolean
}

// UI Types
export interface LoadingState {
  isLoading: boolean
  error?: string | null
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export interface Modal {
  id: string
  type: string
  isOpen: boolean
  data?: any
  options?: {
    closable?: boolean
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    title?: string
  }
}

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  timestamp: string
  read: boolean
  actions?: Array<{
    label: string
    action: string
    data?: any
  }>
}

// Theme types
export type Theme = 'light' | 'dark' | 'system'

export interface ThemeConfig {
  theme: Theme
  primaryColor: string
  accentColor: string
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  fontSize: 'sm' | 'md' | 'lg'
}

// Form types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'file' | 'checkbox' | 'radio'
  required?: boolean
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  validation?: Record<string, any>
  disabled?: boolean
  description?: string
}

export interface FileUploadConfig {
  maxSize: number
  maxFiles: number
  acceptedFileTypes: string[]
  chunkSize: number
  autoStart: boolean
  showProgress: boolean
}

// Viewer types
export interface ViewerConfig {
  viewerContainer: string
  urn: string
  accessToken: string
  options?: Record<string, any>
}

export interface ViewerExtension {
  id: string
  name: string
  enabled: boolean
  config?: Record<string, any>
}

// Navigation types
export interface NavigationItem {
  id: string
  label: string
  icon?: string
  path?: string
  badge?: string | number
  children?: NavigationItem[]
  onClick?: () => void
  external?: boolean
  disabled?: boolean
}

export interface Breadcrumb {
  label: string
  path?: string
  current?: boolean
}

// Table types
export interface TableColumn<T = any> {
  key: string
  title: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, record: T) => React.ReactNode
  width?: string | number
  align?: 'left' | 'center' | 'right'
}

export interface TableAction<T = any> {
  key: string
  label: string
  icon?: string
  onClick: (record: T) => void
  disabled?: (record: T) => boolean
  danger?: boolean
}

// Statistics types
export interface DashboardStats {
  totalFiles: number
  totalProjects: number
  activeTranslations: number
  storageUsed: number
  storageLimit: number
  translationsToday: number
  translationsThisMonth: number
  successRate: number
}

export interface ChartData {
  name: string
  value: number
  color?: string
}

// API Response types
export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface RefreshTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

// Utility types
export type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never }
export type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

// Enum types
export enum FileFormat {
  RVT = 'rvt',
  IFC = 'ifc',
  DWG = 'dwg',
  DXF = 'dxf',
  STEP = 'step',
  IGES = 'iges',
  OBJ = 'obj',
  FBX = 'fbx',
  THREEMF = '3mf',
  STL = 'stl',
}

export enum OutputFormat {
  SVF = 'svf',
  SVF2 = 'svf2',
  THUMBNAIL = 'thumbnail',
  STL = 'stl',
  STEP = 'step',
  IGES = 'iges',
  OBJ = 'obj',
  GLTF = 'gltf',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPERUSER = 'superuser',
}

export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
}
