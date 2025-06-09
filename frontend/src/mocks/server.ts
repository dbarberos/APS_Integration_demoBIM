/**
 * Mock Service Worker server para tests
 */
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import { mockApiResponses } from '../setupTests'

// Handlers para las APIs
export const handlers = [
  // Auth endpoints
  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = await request.json() as any
    
    if (body.username === 'test@example.com' && body.password === 'password') {
      return HttpResponse.json({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: mockApiResponses.user,
      })
    }
    
    return HttpResponse.json(
      { detail: 'Invalid credentials' },
      { status: 401 }
    )
  }),

  http.post('/api/v1/auth/refresh', async ({ request }) => {
    const body = await request.json() as any
    
    if (body.refresh_token === 'mock-refresh-token') {
      return HttpResponse.json({
        access_token: 'new-mock-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      })
    }
    
    return HttpResponse.json(
      { detail: 'Invalid refresh token' },
      { status: 401 }
    )
  }),

  http.post('/api/v1/auth/logout', () => {
    return HttpResponse.json({ message: 'Successfully logged out' })
  }),

  http.get('/api/v1/auth/me', ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return HttpResponse.json(mockApiResponses.user)
  }),

  // Project endpoints
  http.get('/api/v1/projects/', ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const perPage = parseInt(url.searchParams.get('per_page') || '10')
    const search = url.searchParams.get('search')
    
    let projects = [mockApiResponses.project]
    
    if (search) {
      projects = projects.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    return HttpResponse.json({
      data: projects,
      pagination: {
        page,
        per_page: perPage,
        total: projects.length,
        total_pages: Math.ceil(projects.length / perPage),
      },
    })
  }),

  http.get('/api/v1/projects/:id', ({ params }) => {
    const id = parseInt(params.id as string)
    
    if (id === 1) {
      return HttpResponse.json(mockApiResponses.project)
    }
    
    return HttpResponse.json(
      { detail: 'Project not found' },
      { status: 404 }
    )
  }),

  http.post('/api/v1/projects/', async ({ request }) => {
    const body = await request.json() as any
    
    const newProject = {
      ...mockApiResponses.project,
      id: 2,
      name: body.name,
      description: body.description,
    }
    
    return HttpResponse.json(newProject, { status: 201 })
  }),

  http.patch('/api/v1/projects/:id', async ({ params, request }) => {
    const id = parseInt(params.id as string)
    const body = await request.json() as any
    
    if (id === 1) {
      const updatedProject = {
        ...mockApiResponses.project,
        ...body,
      }
      
      return HttpResponse.json(updatedProject)
    }
    
    return HttpResponse.json(
      { detail: 'Project not found' },
      { status: 404 }
    )
  }),

  http.delete('/api/v1/projects/:id', ({ params }) => {
    const id = parseInt(params.id as string)
    
    if (id === 1) {
      return new HttpResponse(null, { status: 204 })
    }
    
    return HttpResponse.json(
      { detail: 'Project not found' },
      { status: 404 }
    )
  }),

  // File endpoints
  http.get('/api/v1/files/', ({ request }) => {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('project_id')
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')
    
    let files = [mockApiResponses.file]
    
    if (projectId) {
      files = files.filter(f => f.project_id === parseInt(projectId))
    }
    
    if (status) {
      files = files.filter(f => f.status === status)
    }
    
    if (search) {
      files = files.filter(f => 
        f.name.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    return HttpResponse.json({
      data: files,
      pagination: {
        page: 1,
        per_page: 10,
        total: files.length,
        total_pages: 1,
      },
    })
  }),

  http.get('/api/v1/files/:id', ({ params }) => {
    const id = parseInt(params.id as string)
    
    if (id === 1) {
      return HttpResponse.json(mockApiResponses.file)
    }
    
    return HttpResponse.json(
      { detail: 'File not found' },
      { status: 404 }
    )
  }),

  http.post('/api/v1/files/upload', async ({ request }) => {
    // Simulate file upload delay
    await delay(1000)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('project_id') as string
    
    if (!file) {
      return HttpResponse.json(
        { detail: 'No file provided' },
        { status: 400 }
      )
    }
    
    // Check file size
    if (file.size > 100 * 1024 * 1024) { // 100MB
      return HttpResponse.json(
        { detail: 'File too large' },
        { status: 413 }
      )
    }
    
    // Check file type
    const supportedExtensions = ['.rvt', '.rfa', '.ifc', '.dwg', '.dxf']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!supportedExtensions.includes(fileExtension)) {
      return HttpResponse.json(
        { detail: 'File format not supported' },
        { status: 400 }
      )
    }
    
    const newFile = {
      ...mockApiResponses.file,
      id: 2,
      name: file.name,
      original_name: file.name,
      size: file.size,
      content_type: file.type,
      project_id: parseInt(projectId),
    }
    
    return HttpResponse.json(newFile, { status: 201 })
  }),

  http.patch('/api/v1/files/:id', async ({ params, request }) => {
    const id = parseInt(params.id as string)
    const body = await request.json() as any
    
    if (id === 1) {
      const updatedFile = {
        ...mockApiResponses.file,
        ...body,
      }
      
      return HttpResponse.json(updatedFile)
    }
    
    return HttpResponse.json(
      { detail: 'File not found' },
      { status: 404 }
    )
  }),

  http.delete('/api/v1/files/:id', ({ params }) => {
    const id = parseInt(params.id as string)
    
    if (id === 1) {
      return new HttpResponse(null, { status: 204 })
    }
    
    return HttpResponse.json(
      { detail: 'File not found' },
      { status: 404 }
    )
  }),

  // Translation endpoints
  http.get('/api/v1/translate/', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')
    
    let jobs = [mockApiResponses.translationJob]
    
    if (status) {
      jobs = jobs.filter(j => j.status === status)
    }
    
    if (priority) {
      jobs = jobs.filter(j => j.priority === priority)
    }
    
    return HttpResponse.json({
      data: jobs,
      pagination: {
        page: 1,
        per_page: 10,
        total: jobs.length,
        total_pages: 1,
      },
    })
  }),

  http.get('/api/v1/translate/:id', ({ params }) => {
    const id = params.id as string
    
    if (id === 'test-job-123') {
      return HttpResponse.json(mockApiResponses.translationJob)
    }
    
    return HttpResponse.json(
      { detail: 'Translation job not found' },
      { status: 404 }
    )
  }),

  http.post('/api/v1/translate/', async ({ request }) => {
    const body = await request.json() as any
    
    // Simulate translation start delay
    await delay(500)
    
    const newJob = {
      ...mockApiResponses.translationJob,
      id: 'new-job-456',
      file_id: body.file_id,
      output_formats: body.output_formats,
      priority: body.priority || 'normal',
      status: 'inprogress',
    }
    
    return HttpResponse.json(newJob, { status: 201 })
  }),

  http.get('/api/v1/translate/:id/status', ({ params }) => {
    const id = params.id as string
    
    if (id === 'test-job-123') {
      return HttpResponse.json({
        status: 'success',
        progress: '100%',
        region: 'US',
        urn: 'test-urn-base64',
      })
    }
    
    return HttpResponse.json(
      { detail: 'Translation job not found' },
      { status: 404 }
    )
  }),

  http.get('/api/v1/translate/:id/manifest', ({ params }) => {
    const id = params.id as string
    
    if (id === 'test-job-123') {
      return HttpResponse.json({
        type: 'manifest',
        hasThumbnail: 'true',
        status: 'success',
        progress: 'complete',
        region: 'US',
        urn: 'test-urn-base64',
        derivatives: [
          {
            name: 'test.svf2',
            hasThumbnail: 'true',
            status: 'success',
            progress: 'complete',
            outputType: 'svf2',
          },
        ],
      })
    }
    
    return HttpResponse.json(
      { detail: 'Translation job not found' },
      { status: 404 }
    )
  }),

  http.post('/api/v1/translate/:id/retry', ({ params }) => {
    const id = params.id as string
    
    if (id === 'test-job-123') {
      return HttpResponse.json({
        ...mockApiResponses.translationJob,
        status: 'inprogress',
        retry_count: 1,
      })
    }
    
    return HttpResponse.json(
      { detail: 'Translation job not found' },
      { status: 404 }
    )
  }),

  http.post('/api/v1/translate/:id/cancel', ({ params }) => {
    const id = params.id as string
    
    if (id === 'test-job-123') {
      return HttpResponse.json({
        ...mockApiResponses.translationJob,
        status: 'cancelled',
      })
    }
    
    return HttpResponse.json(
      { detail: 'Translation job not found' },
      { status: 404 }
    )
  }),

  http.delete('/api/v1/translate/:id', ({ params }) => {
    const id = params.id as string
    
    if (id === 'test-job-123') {
      return new HttpResponse(null, { status: 204 })
    }
    
    return HttpResponse.json(
      { detail: 'Translation job not found' },
      { status: 404 }
    )
  }),

  // Stats endpoints
  http.get('/api/v1/stats/dashboard', () => {
    return HttpResponse.json({
      total_projects: 5,
      total_files: 25,
      total_translations: 15,
      active_translations: 3,
      completed_translations: 12,
      failed_translations: 0,
      storage_used: '2.5GB',
      storage_limit: '10GB',
    })
  }),

  // Error simulation endpoints
  http.get('/api/v1/test/error/500', () => {
    return HttpResponse.json(
      { detail: 'Internal server error' },
      { status: 500 }
    )
  }),

  http.get('/api/v1/test/error/timeout', async () => {
    await delay(10000) // 10 second delay to simulate timeout
    return HttpResponse.json({ message: 'This should timeout' })
  }),

  http.get('/api/v1/test/slow', async () => {
    await delay(2000) // 2 second delay
    return HttpResponse.json({ message: 'Slow response' })
  }),
]

// Create server instance
export const server = setupServer(...handlers)

// Helper functions for test scenarios
export const enableNetworkError = () => {
  server.use(
    http.get('/api/v1/*', () => {
      return HttpResponse.error()
    }),
    http.post('/api/v1/*', () => {
      return HttpResponse.error()
    })
  )
}

export const enableSlowNetwork = () => {
  server.use(
    http.get('/api/v1/*', async ({ request }) => {
      await delay(3000)
      return HttpResponse.json({ slow: true })
    })
  )
}

export const enableAuthError = () => {
  server.use(
    http.get('/api/v1/*', ({ request }) => {
      const authHeader = request.headers.get('Authorization')
      if (!authHeader) {
        return HttpResponse.json(
          { detail: 'Authentication required' },
          { status: 401 }
        )
      }
      return HttpResponse.json({ authenticated: true })
    })
  )
}

export const resetMockHandlers = () => {
  server.resetHandlers(...handlers)
}
