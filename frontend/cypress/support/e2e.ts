/**
 * Configuración de soporte para tests E2E de Cypress
 */

import './commands'

// Cypress global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing on uncaught exceptions
  // that might occur in the application under test
  
  // Return false to prevent the error from failing the test
  // for known issues or non-critical errors
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
  
  if (err.message.includes('ChunkLoadError')) {
    return false
  }
  
  // Let other errors fail the test
  return true
})

// Global before hook for all tests
beforeEach(() => {
  // Set up test environment
  cy.task('log', `Starting test: ${Cypress.currentTest.title}`)
  
  // Clear application state
  cy.clearLocalStorage()
  cy.clearCookies()
  
  // Reset test database if needed
  if (Cypress.env('resetDbBeforeEach')) {
    cy.task('resetDatabase')
  }
  
  // Set up viewport
  cy.viewport(1280, 720)
  
  // Mock external APIs if in mock mode
  if (Cypress.env('enableMockMode')) {
    cy.setupMockMode()
  }
  
  // Performance monitoring setup
  cy.window().then((win) => {
    win.performance.mark('test-start')
  })
})

// Global after hook for all tests
afterEach(() => {
  // Performance monitoring
  cy.window().then((win) => {
    win.performance.mark('test-end')
    win.performance.measure('test-duration', 'test-start', 'test-end')
    
    const measures = win.performance.getEntriesByType('measure')
    const testDuration = measures.find(m => m.name === 'test-duration')
    
    if (testDuration) {
      cy.task('measurePerformance', {
        testName: Cypress.currentTest.title,
        duration: testDuration.duration,
        timestamp: new Date().toISOString()
      })
    }
  })
  
  // Cleanup tasks
  cy.task('log', `Completed test: ${Cypress.currentTest.title}`)
  
  // Take screenshot on failure
  if (Cypress.currentTest.state === 'failed') {
    cy.screenshot(`failed-${Cypress.currentTest.title}`, { 
      capture: 'fullPage',
      overwrite: true 
    })
  }
})

// Custom error handling
Cypress.on('fail', (err, runnable) => {
  // Log detailed error information
  cy.task('log', `Test failed: ${err.message}`)
  
  // Add custom error context
  err.message += `\n\nTest Context:\n`
  err.message += `- Spec: ${Cypress.spec.name}\n`
  err.message += `- Test: ${runnable.title}\n`
  err.message += `- URL: ${window.location.href}\n`
  err.message += `- Viewport: ${Cypress.config('viewportWidth')}x${Cypress.config('viewportHeight')}\n`
  err.message += `- Browser: ${Cypress.browser.name} ${Cypress.browser.version}\n`
  
  throw err
})

// Network failure detection
Cypress.on('window:before:load', (win) => {
  // Monitor for network failures
  win.addEventListener('offline', () => {
    cy.task('log', 'Network went offline during test')
  })
  
  win.addEventListener('online', () => {
    cy.task('log', 'Network came back online during test')
  })
})

// Console log monitoring
Cypress.on('window:before:load', (win) => {
  if (Cypress.env('enableDebugLogs')) {
    // Capture console errors
    win.console.error = (...args) => {
      cy.task('log', `Console Error: ${args.join(' ')}`)
    }
    
    // Capture console warnings
    win.console.warn = (...args) => {
      cy.task('log', `Console Warning: ${args.join(' ')}`)
    }
  }
})

// Accessibility testing setup
import 'cypress-axe'

// Visual regression testing setup
import '@percy/cypress'

// Real events simulation
import 'cypress-real-events/support'

// File upload support
import 'cypress-file-upload'

// Network stubbing
import 'cypress-network-idle'

// Performance testing
import 'cypress-performance'

// Multi-language support
import 'cypress-localstorage-commands'

// Custom plugin initializations
if (Cypress.env('enableA11yTesting')) {
  beforeEach(() => {
    cy.injectAxe()
  })
  
  afterEach(() => {
    if (Cypress.env('checkA11yOnEveryPage')) {
      cy.checkA11y()
    }
  })
}

// Global error boundary monitoring
Cypress.on('window:before:load', (win) => {
  // Monitor React error boundaries
  win.addEventListener('error', (event) => {
    if (event.error && event.error.boundary) {
      cy.task('log', `React Error Boundary triggered: ${event.error.message}`)
    }
  })
  
  // Monitor unhandled promise rejections
  win.addEventListener('unhandledrejection', (event) => {
    cy.task('log', `Unhandled Promise Rejection: ${event.reason}`)
  })
})

// Test data management
declare global {
  namespace Cypress {
    interface Chainable {
      setupMockMode(): Chainable<void>
      seedTestData(data: any): Chainable<void>
      cleanupTestData(): Chainable<void>
    }
  }
}
