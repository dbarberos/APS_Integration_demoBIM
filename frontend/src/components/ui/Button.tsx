import React, { forwardRef } from 'react'
import { clsx } from 'clsx'

// Tipos de variantes del botón
export type ButtonVariant = 
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'warning'

// Tamaños del botón
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
  children: React.ReactNode
}

// Estilos base del botón
const baseStyles = [
  'inline-flex items-center justify-center',
  'font-medium rounded-md',
  'border transition-all duration-200',
  'focus:outline-none focus:ring-2 focus:ring-offset-2',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'select-none'
].join(' ')

// Estilos por variante
const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'text-white bg-blue-600 border-blue-600',
    'hover:bg-blue-700 hover:border-blue-700',
    'focus:ring-blue-500',
    'active:bg-blue-800'
  ].join(' '),
  
  secondary: [
    'text-gray-700 bg-gray-100 border-gray-300',
    'hover:bg-gray-200 hover:border-gray-400',
    'focus:ring-gray-500',
    'active:bg-gray-300',
    'dark:text-gray-300 dark:bg-gray-700 dark:border-gray-600',
    'dark:hover:bg-gray-600 dark:hover:border-gray-500'
  ].join(' '),
  
  outline: [
    'text-blue-600 bg-transparent border-blue-600',
    'hover:bg-blue-50 hover:text-blue-700',
    'focus:ring-blue-500',
    'active:bg-blue-100',
    'dark:text-blue-400 dark:border-blue-400',
    'dark:hover:bg-blue-900/20'
  ].join(' '),
  
  ghost: [
    'text-gray-700 bg-transparent border-transparent',
    'hover:bg-gray-100 hover:text-gray-900',
    'focus:ring-gray-500',
    'active:bg-gray-200',
    'dark:text-gray-300',
    'dark:hover:bg-gray-800 dark:hover:text-white'
  ].join(' '),
  
  danger: [
    'text-white bg-red-600 border-red-600',
    'hover:bg-red-700 hover:border-red-700',
    'focus:ring-red-500',
    'active:bg-red-800'
  ].join(' '),
  
  success: [
    'text-white bg-green-600 border-green-600',
    'hover:bg-green-700 hover:border-green-700',
    'focus:ring-green-500',
    'active:bg-green-800'
  ].join(' '),
  
  warning: [
    'text-white bg-yellow-600 border-yellow-600',
    'hover:bg-yellow-700 hover:border-yellow-700',
    'focus:ring-yellow-500',
    'active:bg-yellow-800'
  ].join(' ')
}

// Estilos por tamaño
const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1.5 text-xs',
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
  xl: 'px-8 py-4 text-lg'
}

// Componente de spinner de carga
const LoadingSpinner: React.FC<{ size: ButtonSize }> = ({ size }) => {
  const spinnerSize = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6'
  }[size]

  return (
    <svg
      className={clsx('animate-spin', spinnerSize)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingText,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled,
    children,
    className,
    ...props
  }, ref) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && (
          <LoadingSpinner size={size} />
        )}
        
        {!loading && leftIcon && (
          <span className="mr-2 flex-shrink-0">
            {leftIcon}
          </span>
        )}
        
        <span className={clsx(
          loading && 'ml-2',
          (leftIcon && !loading) && 'ml-0',
          (rightIcon && !loading) && 'mr-0'
        )}>
          {loading && loadingText ? loadingText : children}
        </span>
        
        {!loading && rightIcon && (
          <span className="ml-2 flex-shrink-0">
            {rightIcon}
          </span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

// Componentes especializados para uso común
export const PrimaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="primary" {...props} />
)

export const SecondaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="secondary" {...props} />
)

export const OutlineButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="outline" {...props} />
)

export const GhostButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="ghost" {...props} />
)

export const DangerButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="danger" {...props} />
)

export const SuccessButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="success" {...props} />
)

export const WarningButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="warning" {...props} />
)

export default Button
