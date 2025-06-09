/**
 * Tests para componente Button
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Button from '../Button'

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
  })

  it('handles click events', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies variant classes correctly', () => {
    render(<Button variant="primary">Primary Button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-blue-600', 'hover:bg-blue-700')
  })

  it('applies size classes correctly', () => {
    render(<Button size="large">Large Button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('px-6', 'py-3', 'text-base')
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveClass('opacity-50', 'cursor-not-allowed')
  })

  it('shows loading state', () => {
    render(<Button loading>Loading Button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders with icon', () => {
    const Icon = () => <svg data-testid="icon" />
    render(<Button icon={<Icon />}>Button with Icon</Button>)
    
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('Button with Icon')).toBeInTheDocument()
  })

  it('renders icon only button', () => {
    const Icon = () => <svg data-testid="icon" />
    render(<Button icon={<Icon />} iconOnly aria-label="Icon button" />)
    
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByLabelText('Icon button')).toBeInTheDocument()
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<Button ref={ref}>Button</Button>)
    
    expect(ref).toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom Button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('supports different button types', () => {
    render(<Button type="submit">Submit Button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('prevents click when loading', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick} loading>Loading Button</Button>)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('prevents click when disabled', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick} disabled>Disabled Button</Button>)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(handleClick).not.toHaveBeenCalled()
  })

  describe('Accessibility', () => {
    it('has correct ARIA attributes when loading', () => {
      render(<Button loading>Loading Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-disabled', 'true')
    })

    it('has correct ARIA attributes when disabled', () => {
      render(<Button disabled>Disabled Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-disabled', 'true')
    })

    it('supports custom ARIA attributes', () => {
      render(
        <Button aria-describedby="help-text" aria-expanded="false">
          Accessible Button
        </Button>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-describedby', 'help-text')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('Keyboard Navigation', () => {
    it('can be focused with Tab', () => {
      render(<Button>Focusable Button</Button>)
      
      const button = screen.getByRole('button')
      button.focus()
      
      expect(button).toHaveFocus()
    })

    it('can be activated with Enter', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Enter Button</Button>)
      
      const button = screen.getByRole('button')
      button.focus()
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('can be activated with Space', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Space Button</Button>)
      
      const button = screen.getByRole('button')
      button.focus()
      fireEvent.keyDown(button, { key: ' ', code: 'Space' })
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Visual Variants', () => {
    it('renders primary variant correctly', () => {
      render(<Button variant="primary">Primary</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-blue-600', 'text-white')
    })

    it('renders secondary variant correctly', () => {
      render(<Button variant="secondary">Secondary</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-gray-200', 'text-gray-900')
    })

    it('renders danger variant correctly', () => {
      render(<Button variant="danger">Danger</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-red-600', 'text-white')
    })

    it('renders outline variant correctly', () => {
      render(<Button variant="outline">Outline</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('border', 'border-gray-300', 'bg-transparent')
    })

    it('renders ghost variant correctly', () => {
      render(<Button variant="ghost">Ghost</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-transparent', 'hover:bg-gray-100')
    })
  })

  describe('Size Variants', () => {
    it('renders small size correctly', () => {
      render(<Button size="small">Small</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm')
    })

    it('renders medium size correctly', () => {
      render(<Button size="medium">Medium</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-4', 'py-2', 'text-sm')
    })

    it('renders large size correctly', () => {
      render(<Button size="large">Large</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-6', 'py-3', 'text-base')
    })
  })

  describe('Edge Cases', () => {
    it('handles null children gracefully', () => {
      render(<Button>{null}</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('handles undefined onClick gracefully', () => {
      render(<Button>No Click Handler</Button>)
      
      const button = screen.getByRole('button')
      
      // Should not throw error
      expect(() => fireEvent.click(button)).not.toThrow()
    })

    it('handles rapid clicks gracefully', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Rapid Click</Button>)
      
      const button = screen.getByRole('button')
      
      // Simulate rapid clicking
      for (let i = 0; i < 10; i++) {
        fireEvent.click(button)
      }
      
      expect(handleClick).toHaveBeenCalledTimes(10)
    })
  })
})
