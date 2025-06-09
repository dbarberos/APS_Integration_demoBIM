/**
 * Setup para tests del frontend
 */
import '@testing-library/jest-dom'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './mocks/server'

// Mock global objects
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock window.location
delete (window as any).location
window.location = {
  ...window.location,
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.sessionStorage = sessionStorageMock as any

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
})) as any

// Mock File and FileReader
global.File = vi.fn().mockImplementation((parts, filename, properties) => ({
  name: filename,
  size: parts.reduce((total: number, part: any) => total + (part.length || part.size || 0), 0),
  type: properties?.type || 'application/octet-stream',
  lastModified: Date.now(),
  slice: vi.fn(),
  stream: vi.fn(),
  text: vi.fn(),
  arrayBuffer: vi.fn(),
})) as any

global.FileReader = vi.fn().mockImplementation(() => ({
  readAsDataURL: vi.fn(),
  readAsText: vi.fn(),
  readAsArrayBuffer: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  result: null,
  error: null,
  readyState: 0,
  EMPTY: 0,
  LOADING: 1,
  DONE: 2,
})) as any

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-object-url')
global.URL.revokeObjectURL = vi.fn()

// Mock fetch if not already mocked by MSW
if (!global.fetch) {
  global.fetch = vi.fn()
}

// Mock console methods to reduce noise in tests
const originalConsole = console
global.console = {
  ...originalConsole,
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}

// Mock Autodesk Viewer
const mockViewer = {
  start: vi.fn(),
  finish: vi.fn(),
  load: vi.fn(),
  unload: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  getExtension: vi.fn(),
  loadExtension: vi.fn(),
  unloadExtension: vi.fn(),
  setTheme: vi.fn(),
  resize: vi.fn(),
  search: vi.fn(),
  clearSelection: vi.fn(),
  select: vi.fn(),
  isolate: vi.fn(),
  showAll: vi.fn(),
  hide: vi.fn(),
  show: vi.fn(),
  explode: vi.fn(),
  getState: vi.fn(),
  restoreState: vi.fn(),
  fitToView: vi.fn(),
  getCamera: vi.fn(),
  setCamera: vi.fn(),
  getCameraFromViewArray: vi.fn(),
  getViewArrayFromCamera: vi.fn(),
  navigation: {
    setVerticalFov: vi.fn(),
    getVerticalFov: vi.fn(),
    toPerspective: vi.fn(),
    toOrthographic: vi.fn(),
  },
  model: {
    getInstanceTree: vi.fn(),
    getProperties: vi.fn(),
    getBulkProperties: vi.fn(),
    search: vi.fn(),
    getExternalIdMapping: vi.fn(),
    getFragmentList: vi.fn(),
  },
  toolbar: {
    addControl: vi.fn(),
    removeControl: vi.fn(),
    getControl: vi.fn(),
  },
  autocam: {
    setHomeViewFrom: vi.fn(),
    goHome: vi.fn(),
  },
  prefs: {
    set: vi.fn(),
    get: vi.fn(),
  },
}

// Mock Autodesk namespace
;(global as any).Autodesk = {
  Viewing: {
    Initializer: vi.fn().mockImplementation((options, callback) => {
      callback()
      return Promise.resolve()
    }),
    GuiViewer3D: vi.fn().mockImplementation(() => mockViewer),
    Extensions: {
      ViewerPropertyPanel: vi.fn(),
      ViewerModelStructurePanel: vi.fn(),
      ViewerSettingsPanel: vi.fn(),
    },
    theExtensionManager: {
      registerExtension: vi.fn(),
      unregisterExtension: vi.fn(),
      getExtension: vi.fn(),
    },
    Private: {
      GuiViewer3D: vi.fn().mockImplementation(() => mockViewer),
    },
    ErrorCodes: {
      VIEWER_INTERNAL_ERROR: 1,
      BAD_DATA: 2,
      NETWORK_FAILURE: 3,
      NETWORK_ACCESS_DENIED: 4,
      NETWORK_FILE_NOT_FOUND: 5,
      NETWORK_SERVER_ERROR: 6,
      NETWORK_UNHANDLED_RESPONSE_CODE: 7,
      BROWSER_WEBGL_NOT_SUPPORTED: 8,
      BAD_DATA_NO_VIEWABLE_CONTENT: 9,
      BROWSER_WEBGL_DISABLED: 10,
      BAD_DATA_MODEL_IS_EMPTY: 11,
      RTC_ERROR: 12,
      UNSUPORTED_FILE_EXTENSION: 13,
    },
    FileLoaderManager: {
      registerFileLoader: vi.fn(),
    },
    Document: {
      load: vi.fn(),
      getSubItemsWithProperties: vi.fn(),
    },
  },
}

// Setup MSW server
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  vi.clearAllMocks()
  // Reset localStorage/sessionStorage
  localStorageMock.clear()
  sessionStorageMock.clear()
})

afterAll(() => {
  server.close()
})

// Custom matchers for testing
expect.extend({
  toBeInTheDocument: (received) => {
    const pass = received !== null && document.body.contains(received)
    return {
      pass,
      message: () => `Expected element to ${pass ? 'not ' : ''}be in the document`,
    }
  },
  toHaveClass: (received, className) => {
    const pass = received?.classList?.contains(className)
    return {
      pass,
      message: () => `Expected element to ${pass ? 'not ' : ''}have class "${className}"`,
    }
  },
  toBeVisible: (received) => {
    const pass = received?.style?.display !== 'none' && received?.style?.visibility !== 'hidden'
    return {
      pass,
      message: () => `Expected element to ${pass ? 'not ' : ''}be visible`,
    }
  },
})

// Global test utilities
export const createMockFile = (name: string, size: number = 1024, type: string = 'application/octet-stream') => {
  const content = new Array(size).fill('x').join('')
  return new File([content], name, { type })
}

export const createMockUser = () => ({
  id: 1,
  email: 'test@example.com',
  username: 'testuser',
  full_name: 'Test User',
  is_active: true,
  aps_user_id: 'aps-user-123',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
})

export const createMockProject = () => ({
  id: 1,
  name: 'Test Project',
  description: 'Test project description',
  user_id: 1,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
})

export const createMockFileRecord = () => ({
  id: 1,
  name: 'test.rvt',
  original_name: 'test.rvt',
  size: 1024,
  content_type: 'application/octet-stream',
  bucket_key: 'test-bucket',
  object_key: 'test-object',
  project_id: 1,
  user_id: 1,
  status: 'uploaded',
  tags: ['revit', 'test'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
})

export const createMockTranslationJob = () => ({
  id: 'test-job-123',
  urn: 'test-urn-base64',
  input_file_name: 'test.rvt',
  output_formats: ['svf2'],
  status: 'pending',
  priority: 'normal',
  quality_level: 'medium',
  progress_percentage: 0,
  file_id: 1,
  user_id: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
})

// Test helpers for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const flushPromises = () => new Promise(resolve => setImmediate(resolve))

// Mock data for tests
export const mockApiResponses = {
  user: createMockUser(),
  project: createMockProject(),
  file: createMockFileRecord(),
  translationJob: createMockTranslationJob(),
  
  projects: {
    data: [createMockProject()],
    pagination: {
      page: 1,
      per_page: 10,
      total: 1,
      total_pages: 1,
    },
  },
  
  files: {
    data: [createMockFileRecord()],
    pagination: {
      page: 1,
      per_page: 10,
      total: 1,
      total_pages: 1,
    },
  },
  
  translationJobs: {
    data: [createMockTranslationJob()],
    pagination: {
      page: 1,
      per_page: 10,
      total: 1,
      total_pages: 1,
    },
  },
}
