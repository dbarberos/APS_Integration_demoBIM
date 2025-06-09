/**
 * Tests E2E para flujo de autenticación
 */

describe('Authentication Flow', () => {
  beforeEach(() => {
    // Clear any existing authentication
    cy.clearLocalStorage()
    cy.clearCookies()
  })

  describe('Login Process', () => {
    it('should display login form when not authenticated', () => {
      cy.visit('/')
      
      // Should redirect to login page
      cy.url().should('include', '/login')
      
      // Verify login form elements
      cy.get('[data-testid="email-input"]').should('be.visible')
      cy.get('[data-testid="password-input"]').should('be.visible')
      cy.get('[data-testid="login-button"]').should('be.visible')
      cy.get('[data-testid="forgot-password-link"]').should('be.visible')
      
      // Check form validation
      cy.get('[data-testid="login-button"]').click()
      cy.get('[data-testid="email-error"]').should('contain.text', 'Email is required')
      cy.get('[data-testid="password-error"]').should('contain.text', 'Password is required')
    })

    it('should successfully log in with valid credentials', () => {
      cy.visit('/login')
      
      // Enter valid credentials
      cy.get('[data-testid="email-input"]').type(Cypress.env('testEmail'))
      cy.get('[data-testid="password-input"]').type(Cypress.env('testPassword'))
      
      // Submit form
      cy.get('[data-testid="login-button"]').click()
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard')
      
      // Verify user is authenticated
      cy.get('[data-testid="user-menu"]').should('be.visible')
      cy.get('[data-testid="welcome-message"]').should('contain.text', 'Welcome')
      
      // Verify localStorage contains auth tokens
      cy.window().then((win) => {
        expect(win.localStorage.getItem('authToken')).to.exist
        expect(win.localStorage.getItem('user')).to.exist
      })
    })

    it('should show error message with invalid credentials', () => {
      cy.visit('/login')
      
      // Enter invalid credentials
      cy.get('[data-testid="email-input"]').type('invalid@example.com')
      cy.get('[data-testid="password-input"]').type('wrongpassword')
      
      // Submit form
      cy.get('[data-testid="login-button"]').click()
      
      // Should show error message
      cy.waitForToast('Invalid credentials')
      
      // Should remain on login page
      cy.url().should('include', '/login')
      
      // Should not store auth tokens
      cy.window().then((win) => {
        expect(win.localStorage.getItem('authToken')).to.be.null
      })
    })

    it('should validate email format', () => {
      cy.visit('/login')
      
      // Enter invalid email format
      cy.get('[data-testid="email-input"]').type('invalid-email')
      cy.get('[data-testid="password-input"]').type('password123')
      cy.get('[data-testid="login-button"]').click()
      
      // Should show email format error
      cy.get('[data-testid="email-error"]').should('contain.text', 'Please enter a valid email')
    })

    it('should handle loading state during login', () => {
      cy.visit('/login')
      
      // Intercept login request to add delay
      cy.intercept('POST', '**/auth/login', (req) => {
        req.reply((res) => {
          return new Promise((resolve) => {
            setTimeout(() => resolve(res), 2000)
          })
        })
      }).as('loginRequest')
      
      cy.get('[data-testid="email-input"]').type(Cypress.env('testEmail'))
      cy.get('[data-testid="password-input"]').type(Cypress.env('testPassword'))
      cy.get('[data-testid="login-button"]').click()
      
      // Should show loading state
      cy.get('[data-testid="login-button"]').should('be.disabled')
      cy.get('[data-testid="loading-spinner"]').should('be.visible')
      
      // Wait for request to complete
      cy.wait('@loginRequest')
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard')
    })
  })

  describe('Logout Process', () => {
    beforeEach(() => {
      // Login before each logout test
      cy.loginViaAPI()
      cy.visit('/dashboard')
    })

    it('should successfully log out user', () => {
      // Click user menu
      cy.get('[data-testid="user-menu"]').click()
      
      // Click logout
      cy.get('[data-testid="logout-button"]').click()
      
      // Should redirect to login page
      cy.url().should('include', '/login')
      
      // Should clear authentication data
      cy.window().then((win) => {
        expect(win.localStorage.getItem('authToken')).to.be.null
        expect(win.localStorage.getItem('user')).to.be.null
      })
      
      // Should show logout success message
      cy.waitForToast('Logged out successfully')
    })

    it('should handle logout from multiple tabs', () => {
      // Simulate logout in another tab by clearing localStorage
      cy.window().then((win) => {
        win.localStorage.removeItem('authToken')
        win.localStorage.removeItem('user')
        
        // Dispatch storage event to simulate cross-tab communication
        win.dispatchEvent(new StorageEvent('storage', {
          key: 'authToken',
          oldValue: 'some-token',
          newValue: null,
          storageArea: win.localStorage
        }))
      })
      
      // Should automatically redirect to login
      cy.url().should('include', '/login')
      cy.waitForToast('Your session has expired')
    })
  })

  describe('Protected Routes', () => {
    it('should redirect unauthenticated users to login', () => {
      const protectedRoutes = [
        '/dashboard',
        '/projects',
        '/files',
        '/translations',
        '/settings',
        '/profile'
      ]
      
      protectedRoutes.forEach((route) => {
        cy.visit(route)
        cy.url().should('include', '/login')
        cy.get('[data-testid="redirect-message"]')
          .should('contain.text', 'Please log in to access this page')
      })
    })

    it('should allow authenticated users to access protected routes', () => {
      cy.loginViaAPI()
      
      const protectedRoutes = [
        { path: '/dashboard', testId: 'dashboard-content' },
        { path: '/projects', testId: 'projects-list' },
        { path: '/files', testId: 'files-list' },
        { path: '/translations', testId: 'translations-list' }
      ]
      
      protectedRoutes.forEach((route) => {
        cy.visit(route.path)
        cy.url().should('include', route.path)
        cy.get(`[data-testid="${route.testId}"]`).should('be.visible')
      })
    })
  })

  describe('Token Management', () => {
    it('should automatically refresh expired tokens', () => {
      cy.loginViaAPI()
      cy.visit('/dashboard')
      
      // Mock an expired token response
      cy.intercept('GET', '**/projects/', {
        statusCode: 401,
        body: { detail: 'Token expired' }
      }).as('expiredToken')
      
      // Mock successful token refresh
      cy.intercept('POST', '**/auth/refresh', {
        statusCode: 200,
        body: {
          access_token: 'new-token',
          expires_in: 3600
        }
      }).as('refreshToken')
      
      // Mock successful retry with new token
      cy.intercept('GET', '**/projects/', { fixture: 'projects/list.json' }).as('retryRequest')
      
      // Navigate to projects page
      cy.visitProjects()
      
      // Should automatically refresh token and retry request
      cy.wait('@expiredToken')
      cy.wait('@refreshToken')
      cy.wait('@retryRequest')
      
      // Should display projects normally
      cy.get('[data-testid="projects-list"]').should('be.visible')
    })

    it('should handle refresh token expiration', () => {
      cy.loginViaAPI()
      cy.visit('/dashboard')
      
      // Mock expired refresh token
      cy.intercept('POST', '**/auth/refresh', {
        statusCode: 401,
        body: { detail: 'Refresh token expired' }
      }).as('expiredRefreshToken')
      
      // Simulate token expiration
      cy.window().then((win) => {
        win.localStorage.setItem('authToken', 'expired-token')
      })
      
      cy.visitProjects()
      
      // Should redirect to login
      cy.url().should('include', '/login')
      cy.waitForToast('Your session has expired. Please log in again.')
    })
  })

  describe('Remember Me Functionality', () => {
    it('should remember user when checkbox is checked', () => {
      cy.visit('/login')
      
      cy.get('[data-testid="email-input"]').type(Cypress.env('testEmail'))
      cy.get('[data-testid="password-input"]').type(Cypress.env('testPassword'))
      cy.get('[data-testid="remember-me-checkbox"]').check()
      
      cy.get('[data-testid="login-button"]').click()
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard')
      
      // Clear session storage but keep localStorage
      cy.clearCookies()
      
      // Reload page
      cy.reload()
      
      // Should remain authenticated
      cy.url().should('include', '/dashboard')
      cy.get('[data-testid="user-menu"]').should('be.visible')
    })

    it('should not remember user when checkbox is unchecked', () => {
      cy.visit('/login')
      
      cy.get('[data-testid="email-input"]').type(Cypress.env('testEmail'))
      cy.get('[data-testid="password-input"]').type(Cypress.env('testPassword'))
      // Don't check remember me checkbox
      
      cy.get('[data-testid="login-button"]').click()
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard')
      
      // Close browser session (clear all storage)
      cy.clearLocalStorage()
      cy.clearCookies()
      
      // Visit site again
      cy.visit('/')
      
      // Should redirect to login
      cy.url().should('include', '/login')
    })
  })

  describe('Password Reset Flow', () => {
    it('should send password reset email', () => {
      cy.visit('/login')
      
      cy.get('[data-testid="forgot-password-link"]').click()
      
      // Should navigate to forgot password page
      cy.url().should('include', '/forgot-password')
      
      cy.get('[data-testid="email-input"]').type(Cypress.env('testEmail'))
      cy.get('[data-testid="send-reset-button"]').click()
      
      cy.waitForToast('Password reset email sent')
      cy.get('[data-testid="check-email-message"]').should('be.visible')
    })

    it('should validate email for password reset', () => {
      cy.visit('/forgot-password')
      
      cy.get('[data-testid="email-input"]').type('invalid-email')
      cy.get('[data-testid="send-reset-button"]').click()
      
      cy.get('[data-testid="email-error"]').should('contain.text', 'Please enter a valid email')
    })
  })

  describe('Performance and Accessibility', () => {
    it('should have good performance on login page', () => {
      cy.visit('/login')
      cy.measurePageLoad().should('be.lessThan', Cypress.env('maxLoadTime'))
    })

    it('should be accessible', () => {
      cy.visit('/login')
      cy.injectAxe()
      cy.checkA11y()
    })

    it('should work with keyboard navigation', () => {
      cy.visit('/login')
      
      // Tab through form elements
      cy.get('body').tab()
      cy.focused().should('have.attr', 'data-testid', 'email-input')
      
      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'password-input')
      
      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'remember-me-checkbox')
      
      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'login-button')
      
      // Submit form with Enter key
      cy.get('[data-testid="email-input"]').type(Cypress.env('testEmail'))
      cy.get('[data-testid="password-input"]').type(Cypress.env('testPassword'))
      cy.get('[data-testid="login-button"]').type('{enter}')
      
      cy.url().should('include', '/dashboard')
    })
  })

  describe('Multi-language Support', () => {
    it('should display login form in different languages', () => {
      // Test Spanish
      cy.visit('/login?lang=es')
      cy.get('[data-testid="login-title"]').should('contain.text', 'Iniciar Sesión')
      
      // Test English (default)
      cy.visit('/login?lang=en')
      cy.get('[data-testid="login-title"]').should('contain.text', 'Sign In')
    })
  })

  describe('Security Features', () => {
    it('should implement rate limiting for login attempts', () => {
      cy.visit('/login')
      
      // Attempt multiple failed logins
      for (let i = 0; i < 5; i++) {
        cy.get('[data-testid="email-input"]').clear().type('test@example.com')
        cy.get('[data-testid="password-input"]').clear().type('wrongpassword')
        cy.get('[data-testid="login-button"]').click()
        
        if (i < 4) {
          cy.waitForToast('Invalid credentials')
        }
      }
      
      // Should be rate limited after multiple attempts
      cy.waitForToast('Too many login attempts. Please try again later.')
      cy.get('[data-testid="login-button"]').should('be.disabled')
    })

    it('should not expose sensitive information in error messages', () => {
      cy.visit('/login')
      
      // Try with non-existent email
      cy.get('[data-testid="email-input"]').type('nonexistent@example.com')
      cy.get('[data-testid="password-input"]').type('password123')
      cy.get('[data-testid="login-button"]').click()
      
      // Should show generic error message
      cy.waitForToast('Invalid credentials')
      // Should not reveal whether email exists or not
      cy.get('[data-testid="error-message"]').should('not.contain.text', 'User not found')
    })
  })
})
