/**
 * Tests E2E para flujo completo de trabajo APS
 */

describe('Complete APS Workflow', () => {
  beforeEach(() => {
    // Login before each test
    cy.loginViaAPI()
    cy.seedTestData({
      projects: [
        { id: 1, name: 'Test Project', description: 'E2E Test Project' }
      ]
    })
  })

  afterEach(() => {
    // Clean up test data
    cy.cleanupTestData()
  })

  describe('File Upload Workflow', () => {
    it('should complete full file upload process', () => {
      cy.visitFiles()
      
      // Verify files page loaded
      cy.get('[data-testid="files-page"]').should('be.visible')
      cy.get('[data-testid="upload-section"]').should('be.visible')
      
      // Select project for upload
      cy.selectFromDropdown('[data-testid="project-select"]', 'Test Project')
      
      // Upload a test Revit file
      cy.uploadFileViaUI('sample.rvt')
      
      // Verify upload success
      cy.waitForToast('File uploaded successfully')
      
      // Verify file appears in list
      cy.get('[data-testid="files-list"]').within(() => {
        cy.get('[data-testid="file-item"]').should('contain.text', 'sample.rvt')
        cy.get('[data-testid="file-status"]').should('contain.text', 'Uploaded')
        cy.get('[data-testid="file-size"]').should('be.visible')
      })
      
      // Verify file metadata
      cy.get('[data-testid="file-item"]').first().click()
      cy.get('[data-testid="file-details-panel"]').should('be.visible')
      cy.get('[data-testid="file-name"]').should('contain.text', 'sample.rvt')
      cy.get('[data-testid="upload-date"]').should('be.visible')
      cy.get('[data-testid="file-type"]').should('contain.text', 'Revit')
    })

    it('should handle multiple file uploads', () => {
      cy.visitFiles()
      
      const testFiles = ['sample.rvt', 'test.dwg', 'model.ifc']
      
      testFiles.forEach((fileName, index) => {
        cy.selectFromDropdown('[data-testid="project-select"]', 'Test Project')
        cy.uploadFileViaUI(fileName)
        cy.waitForToast('File uploaded successfully')
        
        // Wait a bit between uploads
        cy.wait(1000)
      })
      
      // Verify all files uploaded
      cy.get('[data-testid="files-list"]').within(() => {
        testFiles.forEach(fileName => {
          cy.get('[data-testid="file-item"]').should('contain.text', fileName)
        })
      })
      
      // Verify file count
      cy.get('[data-testid="file-count"]').should('contain.text', `${testFiles.length} files`)
    })

    it('should validate file format restrictions', () => {
      cy.visitFiles()
      
      // Try to upload unsupported file
      cy.fixture('files/unsupported.txt', 'binary').then((fileContent) => {
        cy.get('[data-testid="file-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent),
          fileName: 'unsupported.txt',
          mimeType: 'text/plain'
        }, { force: true })
      })
      
      // Should show error message
      cy.waitForToast('File format not supported')
      cy.get('[data-testid="upload-error"]')
        .should('contain.text', 'Only CAD and BIM files are supported')
    })

    it('should handle large file uploads with progress tracking', () => {
      cy.visitFiles()
      
      // Mock a large file upload with progress
      cy.intercept('POST', '**/files/upload', (req) => {
        // Simulate progress updates
        req.reply((res) => {
          return new Promise((resolve) => {
            let progress = 0
            const interval = setInterval(() => {
              progress += 20
              
              // Emit progress event
              cy.window().then((win) => {
                win.dispatchEvent(new CustomEvent('upload-progress', {
                  detail: { progress, fileName: 'large-model.rvt' }
                }))
              })
              
              if (progress >= 100) {
                clearInterval(interval)
                resolve({
                  statusCode: 201,
                  body: {
                    id: 2,
                    name: 'large-model.rvt',
                    size: 104857600, // 100MB
                    status: 'uploaded'
                  }
                })
              }
            }, 500)
          })
        })
      }).as('largeFileUpload')
      
      cy.selectFromDropdown('[data-testid="project-select"]', 'Test Project')
      cy.uploadFileViaUI('large-model.rvt')
      
      // Verify progress bar appears and updates
      cy.get('[data-testid="upload-progress"]').should('be.visible')
      cy.get('[data-testid="progress-bar"]').should('have.attr', 'value', '0')
      
      // Wait for progress updates
      cy.get('[data-testid="progress-bar"]').should('have.attr', 'value', '20')
      cy.get('[data-testid="progress-bar"]').should('have.attr', 'value', '40')
      cy.get('[data-testid="progress-bar"]').should('have.attr', 'value', '60')
      cy.get('[data-testid="progress-bar"]').should('have.attr', 'value', '80')
      cy.get('[data-testid="progress-bar"]').should('have.attr', 'value', '100')
      
      cy.wait('@largeFileUpload')
      cy.waitForToast('File uploaded successfully')
    })
  })

  describe('Translation Workflow', () => {
    beforeEach(() => {
      // Create a test file for translation
      cy.createProject({ name: 'Translation Test Project' }).then((project) => {
        cy.uploadFile('files/sample.rvt', project.id).as('testFile')
      })
    })

    it('should start translation process successfully', () => {
      cy.get('@testFile').then((file) => {
        cy.visitTranslations()
        
        // Start new translation
        cy.get('[data-testid="new-translation-button"]').click()
        
        // Select file for translation
        cy.selectFromDropdown('[data-testid="file-select"]', file.name)
        
        // Configure translation options
        cy.get('[data-testid="output-format-svf2"]').check()
        cy.get('[data-testid="output-format-thumbnail"]').check()
        cy.selectFromDropdown('[data-testid="priority-select"]', 'High')
        cy.selectFromDropdown('[data-testid="quality-select"]', 'High')
        
        // Start translation
        cy.get('[data-testid="start-translation-button"]').click()
        
        // Verify translation started
        cy.waitForToast('Translation started successfully')
        
        // Verify translation job appears in list
        cy.get('[data-testid="translations-list"]').within(() => {
          cy.get('[data-testid="translation-item"]').first().within(() => {
            cy.get('[data-testid="file-name"]').should('contain.text', file.name)
            cy.get('[data-testid="status"]').should('contain.text', 'In Progress')
            cy.get('[data-testid="progress"]').should('be.visible')
          })
        })
      })
    })

    it('should monitor translation progress in real-time', () => {
      cy.get('@testFile').then((file) => {
        // Start translation via API
        cy.startTranslation(file.id, {
          output_formats: ['svf2'],
          priority: 'normal'
        }).then((job) => {
          cy.visitTranslations()
          
          // Mock WebSocket messages for progress updates
          cy.window().then((win) => {
            const mockWebSocket = {
              send: cy.stub(),
              close: cy.stub(),
              addEventListener: cy.stub(),
              removeEventListener: cy.stub()
            }
            
            // Override WebSocket constructor
            win.WebSocket = cy.stub().returns(mockWebSocket)
            
            // Simulate progress updates
            setTimeout(() => {
              win.dispatchEvent(new CustomEvent('translation-progress', {
                detail: {
                  jobId: job.id,
                  status: 'inprogress',
                  progress: '25%'
                }
              }))
            }, 1000)
            
            setTimeout(() => {
              win.dispatchEvent(new CustomEvent('translation-progress', {
                detail: {
                  jobId: job.id,
                  status: 'inprogress', 
                  progress: '50%'
                }
              }))
            }, 2000)
            
            setTimeout(() => {
              win.dispatchEvent(new CustomEvent('translation-progress', {
                detail: {
                  jobId: job.id,
                  status: 'success',
                  progress: '100%'
                }
              }))
            }, 3000)
          })
          
          // Verify initial state
          cy.get(`[data-testid="translation-${job.id}"]`).within(() => {
            cy.get('[data-testid="status"]').should('contain.text', 'In Progress')
            cy.get('[data-testid="progress"]').should('contain.text', '0%')
          })
          
          // Verify progress updates
          cy.get(`[data-testid="translation-${job.id}"]`).within(() => {
            cy.get('[data-testid="progress"]').should('contain.text', '25%')
          })
          
          cy.get(`[data-testid="translation-${job.id}"]`).within(() => {
            cy.get('[data-testid="progress"]').should('contain.text', '50%')
          })
          
          // Verify completion
          cy.get(`[data-testid="translation-${job.id}"]`).within(() => {
            cy.get('[data-testid="status"]').should('contain.text', 'Success')
            cy.get('[data-testid="progress"]').should('contain.text', '100%')
            cy.get('[data-testid="view-button"]').should('be.visible')
          })
        })
      })
    })

    it('should handle translation errors gracefully', () => {
      cy.get('@testFile').then((file) => {
        // Mock translation failure
        cy.intercept('POST', '**/translate/', {
          statusCode: 400,
          body: { detail: 'File format not supported for translation' }
        }).as('failedTranslation')
        
        cy.visitTranslations()
        
        cy.get('[data-testid="new-translation-button"]').click()
        cy.selectFromDropdown('[data-testid="file-select"]', file.name)
        cy.get('[data-testid="output-format-svf2"]').check()
        cy.get('[data-testid="start-translation-button"]').click()
        
        cy.wait('@failedTranslation')
        
        // Verify error handling
        cy.waitForToast('Translation failed: File format not supported')
        cy.get('[data-testid="error-details"]').should('be.visible')
        cy.get('[data-testid="retry-button"]').should('be.visible')
      })
    })

    it('should allow translation retry after failure', () => {
      cy.get('@testFile').then((file) => {
        // Start translation that will fail first, then succeed
        cy.startTranslation(file.id).then((job) => {
          cy.visitTranslations()
          
          // Mock failed status
          cy.intercept('GET', `**/translate/${job.id}/status`, {
            statusCode: 200,
            body: {
              status: 'failed',
              progress: '0%',
              error: 'Processing error occurred'
            }
          }).as('failedStatus')
          
          // Mock successful retry
          cy.intercept('POST', `**/translate/${job.id}/retry`, {
            statusCode: 200,
            body: {
              ...job,
              status: 'inprogress',
              retry_count: 1
            }
          }).as('retryTranslation')
          
          // Wait for failed status to be displayed
          cy.wait('@failedStatus')
          
          cy.get(`[data-testid="translation-${job.id}"]`).within(() => {
            cy.get('[data-testid="status"]').should('contain.text', 'Failed')
            cy.get('[data-testid="retry-button"]').click()
          })
          
          cy.wait('@retryTranslation')
          cy.waitForToast('Translation restarted successfully')
          
          cy.get(`[data-testid="translation-${job.id}"]`).within(() => {
            cy.get('[data-testid="status"]').should('contain.text', 'In Progress')
            cy.get('[data-testid="retry-count"]').should('contain.text', 'Retry 1')
          })
        })
      })
    })
  })

  describe('Viewer Integration', () => {
    beforeEach(() => {
      // Create translated file ready for viewing
      cy.createProject({ name: 'Viewer Test Project' }).then((project) => {
        cy.uploadFile('files/sample.rvt', project.id).then((file) => {
          cy.startTranslation(file.id).then((job) => {
            // Mock successful translation
            cy.intercept('GET', `**/translate/${job.id}/status`, {
              body: { status: 'success', progress: '100%' }
            })
            cy.intercept('GET', `**/translate/${job.id}/manifest`, {
              fixture: 'translations/manifest-success.json'
            })
            
            cy.wrap(job).as('translationJob')
          })
        })
      })
    })

    it('should load model in viewer successfully', () => {
      cy.get('@translationJob').then((job) => {
        cy.visitViewer(job.urn)
        
        // Verify viewer initialization
        cy.waitForViewerLoad()
        
        // Verify viewer UI elements
        cy.get('[data-testid="viewer-container"]').should('be.visible')
        cy.get('[data-testid="viewer-toolbar"]').should('be.visible')
        cy.get('[data-testid="model-tree-panel"]').should('be.visible')
        cy.get('[data-testid="properties-panel"]').should('be.visible')
        
        // Verify model loaded
        cy.window().then((win) => {
          expect(win.viewerInstance).to.exist
          expect(win.viewerInstance.model).to.exist
        })
        
        // Verify viewer controls work
        cy.get('[data-testid="fit-to-view-button"]').click()
        cy.get('[data-testid="home-view-button"]').click()
        cy.get('[data-testid="fullscreen-button"]').click()
      })
    })

    it('should navigate model tree and select objects', () => {
      cy.get('@translationJob').then((job) => {
        cy.visitViewer(job.urn)
        cy.waitForViewerLoad()
        
        // Expand model tree
        cy.get('[data-testid="model-tree"]').within(() => {
          cy.get('[data-testid="tree-node-expand"]').first().click()
          
          // Verify child nodes appear
          cy.get('[data-testid="tree-child-node"]').should('be.visible')
          
          // Select an object
          cy.get('[data-testid="tree-child-node"]').first().click()
        })
        
        // Verify object selection
        cy.get('[data-testid="properties-panel"]').within(() => {
          cy.get('[data-testid="object-properties"]').should('be.visible')
          cy.get('[data-testid="property-name"]').should('exist')
          cy.get('[data-testid="property-value"]').should('exist')
        })
        
        // Verify object highlighted in viewer
        cy.window().then((win) => {
          const selection = win.viewerInstance.getSelection()
          expect(selection).to.have.length.greaterThan(0)
        })
      })
    })

    it('should use measurement tools', () => {
      cy.get('@translationJob').then((job) => {
        cy.visitViewer(job.urn)
        cy.waitForViewerLoad()
        
        // Activate measurement tool
        cy.get('[data-testid="measure-button"]').click()
        
        // Verify measurement tool activated
        cy.get('[data-testid="measure-toolbar"]').should('be.visible')
        cy.get('[data-testid="measure-instructions"]')
          .should('contain.text', 'Click to start measuring')
        
        // Simulate measurement clicks
        cy.get('[data-testid="viewer-container"]')
          .click(300, 200)
          .click(400, 200)
        
        // Verify measurement result
        cy.get('[data-testid="measurement-result"]').should('be.visible')
        cy.get('[data-testid="measurement-value"]').should('exist')
        cy.get('[data-testid="measurement-unit"]').should('contain.text', 'mm')
        
        // Clear measurements
        cy.get('[data-testid="clear-measurements-button"]').click()
        cy.get('[data-testid="measurement-result"]').should('not.exist')
      })
    })

    it('should handle multiple model loading', () => {
      // Create second translated file
      cy.createProject({ name: 'Multi Model Project' }).then((project) => {
        cy.uploadFile('files/model2.rvt', project.id).then((file) => {
          cy.startTranslation(file.id).then((job2) => {
            cy.get('@translationJob').then((job1) => {
              cy.visitViewer()
              
              // Load first model
              cy.loadModelInViewer(job1.urn)
              cy.waitForViewerLoad()
              
              // Load second model
              cy.get('[data-testid="add-model-button"]').click()
              cy.get('[data-testid="model-urn-input"]').type(job2.urn)
              cy.get('[data-testid="load-model-button"]').click()
              
              // Verify both models loaded
              cy.get('[data-testid="loaded-models-list"]').within(() => {
                cy.get('[data-testid="model-item"]').should('have.length', 2)
              })
              
              // Verify model visibility controls
              cy.get('[data-testid="model-visibility-toggle"]').first().click()
              cy.get('[data-testid="model-visibility-toggle"]').should('have.class', 'hidden')
            })
          })
        })
      })
    })
  })

  describe('Complete End-to-End Workflow', () => {
    it('should complete entire workflow from upload to viewing', () => {
      // Create project
      cy.visitProjects()
      cy.get('[data-testid="new-project-button"]').click()
      cy.get('[data-testid="project-name-input"]').type('E2E Test Project')
      cy.get('[data-testid="project-description-input"]').type('Complete workflow test')
      cy.get('[data-testid="create-project-button"]').click()
      
      cy.waitForToast('Project created successfully')
      
      // Upload file
      cy.visitFiles()
      cy.selectFromDropdown('[data-testid="project-select"]', 'E2E Test Project')
      cy.uploadFileViaUI('sample.rvt')
      cy.waitForToast('File uploaded successfully')
      
      // Start translation
      cy.get('[data-testid="file-item"]').first().within(() => {
        cy.get('[data-testid="translate-button"]').click()
      })
      
      // Configure translation
      cy.get('[data-testid="translation-modal"]').within(() => {
        cy.get('[data-testid="output-format-svf2"]').check()
        cy.get('[data-testid="output-format-thumbnail"]').check()
        cy.selectFromDropdown('[data-testid="quality-select"]', 'High')
        cy.get('[data-testid="start-translation-button"]').click()
      })
      
      cy.waitForToast('Translation started successfully')
      
      // Monitor translation progress
      cy.visitTranslations()
      
      // Mock translation completion
      cy.window().then((win) => {
        setTimeout(() => {
          win.dispatchEvent(new CustomEvent('translation-complete', {
            detail: {
              status: 'success',
              urn: 'mock-urn-base64',
              fileName: 'sample.rvt'
            }
          }))
        }, 2000)
      })
      
      // Wait for completion notification
      cy.waitForToast('Translation completed successfully', { timeout: 10000 })
      
      // Navigate to viewer
      cy.get('[data-testid="translation-item"]').first().within(() => {
        cy.get('[data-testid="view-button"]').click()
      })
      
      // Verify viewer loads with model
      cy.waitForViewerLoad()
      cy.get('[data-testid="viewer-container"]').should('be.visible')
      cy.get('[data-testid="model-loaded-indicator"]').should('be.visible')
      
      // Interact with model
      cy.get('[data-testid="model-tree"]').should('be.visible')
      cy.get('[data-testid="properties-panel"]').should('be.visible')
      
      // Take screenshot for visual verification
      cy.screenshot('complete-workflow-success', { capture: 'fullPage' })
    })
  })

  describe('Performance and Reliability', () => {
    it('should handle concurrent operations efficiently', () => {
      cy.visitFiles()
      
      // Start multiple file uploads concurrently
      const testFiles = ['model1.rvt', 'model2.dwg', 'model3.ifc']
      
      testFiles.forEach((fileName, index) => {
        cy.selectFromDropdown('[data-testid="project-select"]', 'Test Project')
        cy.uploadFileViaUI(fileName)
        
        // Don't wait for completion, start next upload
        if (index < testFiles.length - 1) {
          cy.wait(500) // Small delay to stagger uploads
        }
      })
      
      // Wait for all uploads to complete
      testFiles.forEach(fileName => {
        cy.waitForToast('File uploaded successfully')
      })
      
      // Verify all files uploaded successfully
      cy.get('[data-testid="files-list"]').within(() => {
        testFiles.forEach(fileName => {
          cy.get(`[data-testid="file-item"][data-filename="${fileName}"]`)
            .should('exist')
            .within(() => {
              cy.get('[data-testid="file-status"]').should('contain.text', 'Uploaded')
            })
        })
      })
    })

    it('should maintain performance under load', () => {
      cy.visitDashboard()
      
      // Measure initial page load
      cy.measurePageLoad().should('be.lessThan', 3000)
      
      // Navigate between pages and measure performance
      const pages = [
        { path: '/projects', testId: 'projects-list' },
        { path: '/files', testId: 'files-list' },
        { path: '/translations', testId: 'translations-list' },
        { path: '/dashboard', testId: 'dashboard-content' }
      ]
      
      pages.forEach(page => {
        cy.visit(page.path)
        cy.measurePageLoad().should('be.lessThan', 2000)
        cy.get(`[data-testid="${page.testId}"]`).should('be.visible')
      })
    })

    it('should recover from network failures gracefully', () => {
      cy.visitFiles()
      
      // Simulate network failure during upload
      cy.intercept('POST', '**/files/upload', { forceNetworkError: true }).as('networkError')
      
      cy.selectFromDropdown('[data-testid="project-select"]', 'Test Project')
      cy.uploadFileViaUI('sample.rvt')
      
      // Should show network error
      cy.waitForToast('Network error occurred. Please try again.')
      
      // Reset network and retry
      cy.intercept('POST', '**/files/upload', { fixture: 'files/upload-success.json' }).as('uploadSuccess')
      
      cy.get('[data-testid="retry-upload-button"]').click()
      cy.wait('@uploadSuccess')
      cy.waitForToast('File uploaded successfully')
    })
  })
})
