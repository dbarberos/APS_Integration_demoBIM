/**
 * Tests para componente ErrorBoundary
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../ErrorBoundary'

// Mock console.error to prevent noise in tests
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
})

// Test component that throws an error
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

// Test component that throws async error
const ThrowAsyncError = () => {
  React.useEffect(() => {
    setTimeout(() => {
      throw new Error('Async test error')
    }, 100)
  }, [])
  return <div>Async component</div>
}

describe('ErrorBoundary Component', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('renders error fallback when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('renders custom fallback component', () => {
    const CustomFallback = ({ error, retry }: any) => (
      <div>
        <h2>Custom Error: {error.message}</h2>
        <button onClick={retry}>Custom Retry</button>
      </div>
    )
    
    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Custom Error: Test error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /custom retry/i })).toBeInTheDocument()
  })

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn()
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('resets error state when retry is clicked', () => {
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true)
      
      React.useEffect(() => {
        const timer = setTimeout(() => setShouldThrow(false), 1000)
        return () => clearTimeout(timer)
      }, [])
      
      return <ThrowError shouldThrow={shouldThrow} />
    }
    
    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    )
    
    // Error should be displayed
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    
    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    
    // Component should render normally after state change
    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('displays error details when showDetails is true', () => {
    render(
      <ErrorBoundary showDetails={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText(/error details/i)).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('hides error details by default', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.queryByText(/error details/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Test error')).not.toBeInTheDocument()
  })

  it('allows toggling error details', () => {
    render(
      <ErrorBoundary showDetails={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    // Details should be visible initially
    expect(screen.getByText('Test error')).toBeInTheDocument()
    
    // Click to hide details
    const toggleButton = screen.getByRole('button', { name: /hide details/i })
    fireEvent.click(toggleButton)
    
    expect(screen.queryByText('Test error')).not.toBeInTheDocument()
    
    // Click to show details again
    const showButton = screen.getByRole('button', { name: /show details/i })
    fireEvent.click(showButton)
    
    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('limits retry attempts', () => {
    const onError = vi.fn()
    
    render(
      <ErrorBoundary onError={onError} maxRetries={2}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    // First retry
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    
    // Second retry
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    
    // Third retry - button should be disabled
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByText(/maximum retry attempts reached/i)).toBeInTheDocument()
  })

  it('logs errors to console in development', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(consoleSpy).toHaveBeenCalled()
    
    consoleSpy.mockRestore()
  })

  it('reports errors to external service when onError is provided', () => {
    const mockErrorReporting = vi.fn()
    
    render(
      <ErrorBoundary onError={mockErrorReporting}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(mockErrorReporting).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test error'
      }),
      expect.any(Object)
    )
  })

  it('handles errors from different child components', () => {
    const Component1 = () => <ThrowError shouldThrow={true} />
    const Component2 = () => <div>Working component</div>
    
    render(
      <ErrorBoundary>
        <Component1 />
        <Component2 />
      </ErrorBoundary>
    )
    
    // Should show error boundary, not the working component
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.queryByText('Working component')).not.toBeInTheDocument()
  })

  it('isolates errors per boundary', () => {
    render(
      <div>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
        <ErrorBoundary>
          <div>Working section</div>
        </ErrorBoundary>
      </div>
    )
    
    // First boundary should show error
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    
    // Second boundary should work normally
    expect(screen.getByText('Working section')).toBeInTheDocument()
  })

  it('provides error context to fallback component', () => {
    const FallbackWithContext = ({ error, errorInfo, retry }: any) => (
      <div>
        <h2>Error: {error.message}</h2>
        <details>
          <summary>Component Stack</summary>
          <pre>{errorInfo.componentStack}</pre>
        </details>
        <button onClick={retry}>Retry</button>
      </div>
    )
    
    render(
      <ErrorBoundary fallback={FallbackWithContext}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Error: Test error')).toBeInTheDocument()
    expect(screen.getByText('Component Stack')).toBeInTheDocument()
  })

  it('handles nested error boundaries correctly', () => {
    const InnerError = () => <ThrowError shouldThrow={true} />
    
    render(
      <ErrorBoundary fallback={() => <div>Outer boundary</div>}>
        <ErrorBoundary fallback={() => <div>Inner boundary</div>}>
          <InnerError />
        </ErrorBoundary>
      </ErrorBoundary>
    )
    
    // Inner boundary should catch the error
    expect(screen.getByText('Inner boundary')).toBeInTheDocument()
    expect(screen.queryByText('Outer boundary')).not.toBeInTheDocument()
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const errorContainer = screen.getByRole('alert')
      expect(errorContainer).toBeInTheDocument()
      expect(errorContainer).toHaveAttribute('aria-live', 'assertive')
    })

    it('focuses retry button for keyboard users', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const retryButton = screen.getByRole('button', { name: /try again/i })
      expect(retryButton).toHaveFocus()
    })
  })

  describe('Edge Cases', () => {
    it('handles null error gracefully', () => {
      const BoundaryWithNullError = class extends React.Component {
        constructor(props: any) {
          super(props)
          this.state = { hasError: true, error: null }
        }
        
        render() {
          if (this.state.hasError) {
            return <ErrorBoundary fallback={({ error }) => <div>Error: {error?.message || 'Unknown'}</div>} />
          }
          return this.props.children
        }
      }
      
      render(
        <BoundaryWithNullError>
          <div>Test</div>
        </BoundaryWithNullError>
      )
      
      expect(screen.getByText('Error: Unknown')).toBeInTheDocument()
    })

    it('handles missing fallback component gracefully', () => {
      // @ts-ignore - Testing runtime behavior
      render(
        <ErrorBoundary fallback={null}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      // Should render default fallback
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })

    it('resets error state when children change', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      
      // Change children
      rerender(
        <ErrorBoundary>
          <div>New content</div>
        </ErrorBoundary>
      )
      
      expect(screen.getByText('New content')).toBeInTheDocument()
    })
  })
})
