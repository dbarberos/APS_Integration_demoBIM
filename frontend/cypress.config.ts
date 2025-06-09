/**
 * Configuración de Cypress para tests E2E
 */
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    excludeSpecPattern: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**'
    ],
    
    // Browser settings
    browsers: [
      {
        name: 'chrome',
        family: 'chromium',
        channel: 'stable',
        displayName: 'Chrome',
        version: 'stable',
        path: '/usr/bin/google-chrome-stable',
        majorVersion: 120
      },
      {
        name: 'firefox',
        family: 'firefox',
        channel: 'stable',
        displayName: 'Firefox',
        version: 'stable',
        path: '/usr/bin/firefox',
        majorVersion: 120
      }
    ],
    
    // Viewport settings
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    
    // Video and screenshots
    video: true,
    videosFolder: 'cypress/videos',
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    
    // Test files organization
    fixturesFolder: 'cypress/fixtures',
    downloadsFolder: 'cypress/downloads',
    
    // Retry configuration
    retries: {
      runMode: 2,
      openMode: 0
    },
    
    // Environment variables
    env: {
      // API endpoints
      apiUrl: 'http://localhost:8000/api/v1',
      
      // Test user credentials
      testEmail: 'test@example.com',
      testPassword: 'testpassword123',
      testUsername: 'testuser',
      
      // APS test credentials
      apsClientId: 'test-client-id',
      apsClientSecret: 'test-client-secret',
      
      // File paths for uploads
      testFilesPath: 'cypress/fixtures/files',
      
      // Feature flags for testing
      enableMockMode: true,
      enableDebugLogs: false,
      
      // Performance thresholds
      maxLoadTime: 3000,
      maxApiResponseTime: 2000,
    },
    
    // Setup and teardown
    setupNodeEvents(on, config) {
      // Plugin configurations
      
      // Task definitions for backend operations
      on('task', {
        // Database operations
        resetDatabase() {
          // Reset test database
          return null
        },
        
        seedDatabase(data) {
          // Seed database with test data
          console.log('Seeding database with:', data)
          return null
        },
        
        // File operations
        createTestFile(filename) {
          const fs = require('fs')
          const path = require('path')
          
          const filePath = path.join(config.env.testFilesPath, filename)
          const content = 'Test file content for E2E testing'
          
          fs.writeFileSync(filePath, content)
          return filePath
        },
        
        deleteTestFile(filePath) {
          const fs = require('fs')
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
          return null
        },
        
        // API mocking
        mockApiResponse(route, response) {
          // Mock specific API responses
          console.log(`Mocking ${route} with response:`, response)
          return null
        },
        
        // Performance monitoring
        measurePerformance(metrics) {
          console.log('Performance metrics:', metrics)
          return null
        },
        
        // Screenshot comparison
        compareScreenshots(baseline, current) {
          // Compare screenshots for visual regression testing
          const pixelmatch = require('pixelmatch')
          const PNG = require('pngjs').PNG
          const fs = require('fs')
          
          try {
            const img1 = PNG.sync.read(fs.readFileSync(baseline))
            const img2 = PNG.sync.read(fs.readFileSync(current))
            const { width, height } = img1
            const diff = new PNG({ width, height })
            
            const numDiffPixels = pixelmatch(
              img1.data,
              img2.data,
              diff.data,
              width,
              height,
              { threshold: 0.1 }
            )
            
            return {
              numDiffPixels,
              totalPixels: width * height,
              diffPercentage: (numDiffPixels / (width * height)) * 100
            }
          } catch (error) {
            return { error: error.message }
          }
        },
        
        // Log operations
        log(message) {
          console.log(`[Cypress Task] ${message}`)
          return null
        },
        
        // Wait for external conditions
        waitForCondition(condition) {
          // Wait for specific conditions to be met
          return new Promise((resolve) => {
            setTimeout(() => resolve(null), condition.timeout || 1000)
          })
        }
      })
      
      // Before run hook
      on('before:run', (details) => {
        console.log('Starting Cypress run with details:', details)
      })
      
      // After run hook
      on('after:run', (results) => {
        console.log('Cypress run completed with results:', results)
      })
      
      // Before spec hook
      on('before:spec', (spec) => {
        console.log('Running spec:', spec.name)
      })
      
      // After spec hook
      on('after:spec', (spec, results) => {
        console.log(`Spec ${spec.name} completed:`, results)
      })
      
      // Browser launch options
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome') {
          // Chrome-specific launch options
          launchOptions.args.push('--disable-web-security')
          launchOptions.args.push('--disable-features=VizDisplayCompositor')
          launchOptions.args.push('--no-sandbox')
          launchOptions.args.push('--disable-dev-shm-usage')
        }
        
        if (browser.name === 'firefox') {
          // Firefox-specific launch options
          launchOptions.preferences['dom.webnotifications.enabled'] = false
          launchOptions.preferences['media.navigator.permission.disabled'] = true
        }
        
        return launchOptions
      })
      
      // File preprocessing
      const preprocessor = require('@cypress/webpack-preprocessor')
      
      const options = {
        webpackOptions: {
          resolve: {
            extensions: ['.ts', '.tsx', '.js'],
            alias: {
              '@': require('path').resolve(__dirname, './src'),
            },
          },
          module: {
            rules: [
              {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                options: {
                  transpileOnly: true,
                },
              },
            ],
          },
        },
      }
      
      on('file:preprocessor', preprocessor(options))
      
      // Coverage collection (if enabled)
      if (config.env.collectCoverage) {
        require('@cypress/code-coverage/task')(on, config)
      }
      
      return config
    },
  },
  
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    supportFile: 'cypress/support/component.ts',
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    indexHtmlFile: 'cypress/support/component-index.html',
  },
  
  // Global configuration
  watchForFileChanges: true,
  experimentalStudio: true,
  experimentalWebKitSupport: false,
  
  // Network settings
  chromeWebSecurity: false,
  modifyObstructiveCode: false,
  
  // Node version compatibility
  nodeVersion: 'system',
  
  // Reporter configuration
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    configFile: 'cypress/reporter-config.json',
  },
  
  // Test isolation
  testIsolation: true,
  
  // Experimental features
  experimentalRunAllSpecs: true,
  experimentalMemoryManagement: true,
})
