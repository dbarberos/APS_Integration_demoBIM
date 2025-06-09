/**
 * Comandos personalizados de Cypress para tests E2E
 */

// Typescript support for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      // Authentication commands
      login(email?: string, password?: string): Chainable<void>
      logout(): Chainable<void>
      loginViaAPI(user?: { email: string; password: string }): Chainable<void>
      
      // Navigation commands
      visitDashboard(): Chainable<void>
      visitProjects(): Chainable<void>
      visitFiles(): Chainable<void>
      visitTranslations(): Chainable<void>
      visitViewer(urn?: string): Chainable<void>
      
      // Data management commands
      createProject(projectData?: any): Chainable<any>
      uploadFile(filePath: string, projectId?: number): Chainable<any>
      startTranslation(fileId: number, options?: any): Chainable<any>
      
      // UI interaction commands
      waitForLoader(): Chainable<void>
      waitForToast(message?: string): Chainable<void>
      dismissToast(): Chainable<void>
      selectFromDropdown(selector: string, value: string): Chainable<void>
      
      // File operations
      uploadFileViaUI(fileName: string, projectName?: string): Chainable<void>
      downloadFile(fileName: string): Chainable<void>
      
      // Viewer commands
      waitForViewerLoad(): Chainable<void>
      loadModelInViewer(urn: string): Chainable<void>
      
      // Performance commands
      measurePageLoad(): Chainable<number>
      measureAPIResponse(route: string): Chainable<number>
      
      // Utility commands
      setupMockMode(): Chainable<void>
      seedTestData(data: any): Chainable<void>
      cleanupTestData(): Chainable<void>
      waitForNetworkIdle(): Chainable<void>
    }
  }
}

// Authentication Commands
Cypress.Commands.add('login', (email?: string, password?: string) => {
  const testEmail = email || Cypress.env('testEmail')
  const testPassword = password || Cypress.env('testPassword')
  
  cy.visit('/login')
  cy.get('[data-testid="email-input"]').type(testEmail)
  cy.get('[data-testid="password-input"]').type(testPassword)
  cy.get('[data-testid="login-button"]').click()
  
  // Wait for redirect to dashboard
  cy.url().should('include', '/dashboard')
  cy.waitForLoader()
})

Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click()
  cy.get('[data-testid="logout-button"]').click()
  
  // Should redirect to login page
  cy.url().should('include', '/login')
})

Cypress.Commands.add('loginViaAPI', (user) => {
  const credentials = user || {
    email: Cypress.env('testEmail'),
    password: Cypress.env('testPassword')
  }
  
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/auth/login`,
    body: {
      username: credentials.email,
      password: credentials.password
    }
  }).then((response) => {
    expect(response.status).to.eq(200)
    
    // Store authentication tokens
    window.localStorage.setItem('authToken', response.body.access_token)
    window.localStorage.setItem('refreshToken', response.body.refresh_token)
    window.localStorage.setItem('user', JSON.stringify(response.body.user))
    
    // Set authorization header for subsequent requests
    cy.window().then((win) => {
      win.localStorage.setItem('authToken', response.body.access_token)
    })
  })
})

// Navigation Commands
Cypress.Commands.add('visitDashboard', () => {
  cy.visit('/dashboard')
  cy.waitForLoader()
})

Cypress.Commands.add('visitProjects', () => {
  cy.visit('/projects')
  cy.waitForLoader()
})

Cypress.Commands.add('visitFiles', () => {
  cy.visit('/files')
  cy.waitForLoader()
})

Cypress.Commands.add('visitTranslations', () => {
  cy.visit('/translations')
  cy.waitForLoader()
})

Cypress.Commands.add('visitViewer', (urn?: string) => {
  const url = urn ? `/viewer/${urn}` : '/viewer'
  cy.visit(url)
  cy.waitForViewerLoad()
})

// Data Management Commands
Cypress.Commands.add('createProject', (projectData) => {
  const data = projectData || {
    name: `Test Project ${Date.now()}`,
    description: 'Created by Cypress test'
  }
  
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/projects/`,
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('authToken')}`
    },
    body: data
  }).then((response) => {
    expect(response.status).to.eq(201)
    return cy.wrap(response.body)
  })
})

Cypress.Commands.add('uploadFile', (filePath: string, projectId?: number) => {
  cy.fixture(filePath, 'binary').then((fileContent) => {
    const formData = new FormData()
    const file = new Blob([fileContent], { type: 'application/octet-stream' })
    
    formData.append('file', file, filePath.split('/').pop())
    if (projectId) {
      formData.append('project_id', projectId.toString())
    }
    
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/files/upload`,
      headers: {
        'Authorization': `Bearer ${window.localStorage.getItem('authToken')}`
      },
      body: formData
    }).then((response) => {
      expect(response.status).to.eq(201)
      return cy.wrap(response.body)
    })
  })
})

Cypress.Commands.add('startTranslation', (fileId: number, options) => {
  const translationData = {
    file_id: fileId,
    output_formats: ['svf2'],
    priority: 'normal',
    ...options
  }
  
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/translate/`,
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('authToken')}`
    },
    body: translationData
  }).then((response) => {
    expect(response.status).to.eq(201)
    return cy.wrap(response.body)
  })
})

// UI Interaction Commands
Cypress.Commands.add('waitForLoader', () => {
  // Wait for any loading spinners to disappear
  cy.get('[data-testid="loading-spinner"]', { timeout: 10000 }).should('not.exist')
  cy.get('[data-testid="global-loader"]', { timeout: 10000 }).should('not.exist')
})

Cypress.Commands.add('waitForToast', (message?: string) => {
  if (message) {
    cy.get('[data-testid="toast"]').should('contain.text', message)
  } else {
    cy.get('[data-testid="toast"]').should('be.visible')
  }
})

Cypress.Commands.add('dismissToast', () => {
  cy.get('[data-testid="toast-close"]').click()
  cy.get('[data-testid="toast"]').should('not.exist')
})

Cypress.Commands.add('selectFromDropdown', (selector: string, value: string) => {
  cy.get(selector).click()
  cy.get(`[data-testid="dropdown-option"][data-value="${value}"]`).click()
})

// File Operation Commands
Cypress.Commands.add('uploadFileViaUI', (fileName: string, projectName?: string) => {
  if (projectName) {
    cy.selectFromDropdown('[data-testid="project-select"]', projectName)
  }
  
  cy.get('[data-testid="file-upload-zone"]').should('be.visible')
  cy.fixture(`files/${fileName}`, 'binary').then((fileContent) => {
    const file = new File([fileContent], fileName, { type: 'application/octet-stream' })
    
    cy.get('[data-testid="file-input"]').selectFile({
      contents: Cypress.Buffer.from(fileContent),
      fileName: fileName,
      mimeType: 'application/octet-stream'
    }, { force: true })
  })
  
  cy.get('[data-testid="upload-button"]').click()
  cy.waitForToast('File uploaded successfully')
})

Cypress.Commands.add('downloadFile', (fileName: string) => {
  cy.get(`[data-testid="file-item"][data-filename="${fileName}"]`).within(() => {
    cy.get('[data-testid="download-button"]').click()
  })
  
  // Verify download started
  cy.readFile(`cypress/downloads/${fileName}`, { timeout: 10000 }).should('exist')
})

// Viewer Commands
Cypress.Commands.add('waitForViewerLoad', () => {
  // Wait for Autodesk Viewer to load
  cy.window().should('have.property', 'Autodesk')
  cy.get('[data-testid="viewer-container"]').should('be.visible')
  
  // Wait for viewer initialization
  cy.window().then((win) => {
    return new Cypress.Promise((resolve) => {
      const checkViewer = () => {
        if (win.viewerInstance && win.viewerInstance.model) {
          resolve()
        } else {
          setTimeout(checkViewer, 100)
        }
      }
      checkViewer()
    })
  })
})

Cypress.Commands.add('loadModelInViewer', (urn: string) => {
  cy.get('[data-testid="load-model-button"]').click()
  cy.get('[data-testid="urn-input"]').type(urn)
  cy.get('[data-testid="load-button"]').click()
  
  cy.waitForViewerLoad()
})

// Performance Commands
Cypress.Commands.add('measurePageLoad', () => {
  cy.window().then((win) => {
    const loadTime = win.performance.timing.loadEventEnd - win.performance.timing.navigationStart
    cy.task('measurePerformance', {
      metric: 'pageLoad',
      value: loadTime,
      threshold: Cypress.env('maxLoadTime')
    })
    return cy.wrap(loadTime)
  })
})

Cypress.Commands.add('measureAPIResponse', (route: string) => {
  cy.intercept(route).as('apiCall')
  
  cy.wait('@apiCall').then((interception) => {
    const responseTime = interception.response?.duration || 0
    cy.task('measurePerformance', {
      metric: 'apiResponse',
      route: route,
      value: responseTime,
      threshold: Cypress.env('maxApiResponseTime')
    })
    return cy.wrap(responseTime)
  })
})

// Utility Commands
Cypress.Commands.add('setupMockMode', () => {
  if (Cypress.env('enableMockMode')) {
    // Intercept API calls and return mock responses
    cy.intercept('POST', '**/auth/login', { fixture: 'auth/login-success.json' }).as('login')
    cy.intercept('GET', '**/projects/', { fixture: 'projects/list.json' }).as('projects')
    cy.intercept('GET', '**/files/', { fixture: 'files/list.json' }).as('files')
    cy.intercept('GET', '**/translate/', { fixture: 'translations/list.json' }).as('translations')
    
    // Mock file upload
    cy.intercept('POST', '**/files/upload', { fixture: 'files/upload-success.json' }).as('fileUpload')
    
    // Mock translation start
    cy.intercept('POST', '**/translate/', { fixture: 'translations/start-success.json' }).as('startTranslation')
  }
})

Cypress.Commands.add('seedTestData', (data: any) => {
  cy.task('seedDatabase', data)
})

Cypress.Commands.add('cleanupTestData', () => {
  cy.task('resetDatabase')
})

Cypress.Commands.add('waitForNetworkIdle', () => {
  // Wait for all network requests to complete
  cy.waitForNetworkIdle('@**', 1000)
})

// Custom assertions
Cypress.Commands.overwrite('should', (originalFn, subject, chainer, ...args) => {
  if (chainer === 'be.accessible') {
    // Custom accessibility assertion
    cy.checkA11y()
    return subject
  }
  
  if (chainer === 'have.goodPerformance') {
    // Custom performance assertion
    const threshold = args[0] || 3000
    cy.measurePageLoad().should('be.lessThan', threshold)
    return subject
  }
  
  return originalFn(subject, chainer, ...args)
})

// Error handling for commands
Cypress.on('command:retry', ({ error, totalRetries, attemptIndex }) => {
  if (attemptIndex < totalRetries - 1) {
    cy.task('log', `Command retry ${attemptIndex + 1}/${totalRetries}: ${error.message}`)
  }
})

// Network request logging
if (Cypress.env('enableDebugLogs')) {
  beforeEach(() => {
    cy.intercept('**', (req) => {
      cy.task('log', `API Request: ${req.method} ${req.url}`)
    })
  })
}
