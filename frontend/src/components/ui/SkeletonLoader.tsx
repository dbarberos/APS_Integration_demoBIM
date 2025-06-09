import React from 'react'
import { clsx } from 'clsx'

export interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'text' | 'rectangular' | 'circular' | 'rounded'
  animation?: 'pulse' | 'wave' | 'none'
  className?: string
}

const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  variant = 'text',
  animation = 'pulse',
  className = ''
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'h-4 rounded'
      case 'circular':
        return 'rounded-full'
      case 'rounded':
        return 'rounded-lg'
      case 'rectangular':
      default:
        return 'rounded-sm'
    }
  }

  const getAnimationClasses = () => {
    switch (animation) {
      case 'wave':
        return 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700'
      case 'pulse':
        return 'animate-pulse bg-gray-200 dark:bg-gray-700'
      case 'none':
      default:
        return 'bg-gray-200 dark:bg-gray-700'
    }
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={clsx(
        getVariantClasses(),
        getAnimationClasses(),
        className
      )}
      style={style}
    />
  )
}

// Componentes de skeleton predefinidos
export const SkeletonText: React.FC<{
  lines?: number
  width?: string | number
  className?: string
}> = ({ lines = 1, width, className = '' }) => (
  <div className={clsx('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        variant="text"
        width={index === lines - 1 ? '75%' : width}
        animation="pulse"
      />
    ))}
  </div>
)

export const SkeletonAvatar: React.FC<{
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  return (
    <Skeleton
      variant="circular"
      className={clsx(sizeClasses[size], className)}
      animation="pulse"
    />
  )
}

export const SkeletonButton: React.FC<{
  width?: string | number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}> = ({ width = 80, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12'
  }

  return (
    <Skeleton
      variant="rounded"
      width={width}
      className={clsx(sizeClasses[size], className)}
      animation="pulse"
    />
  )
}

export const SkeletonCard: React.FC<{
  className?: string
  showImage?: boolean
  imageHeight?: string | number
  lines?: number
}> = ({ 
  className = '', 
  showImage = true, 
  imageHeight = 200,
  lines = 3 
}) => (
  <div className={clsx('p-4 border border-gray-200 dark:border-gray-700 rounded-lg', className)}>
    {showImage && (
      <Skeleton
        variant="rectangular"
        height={imageHeight}
        className="mb-4"
        animation="pulse"
      />
    )}
    <SkeletonText lines={lines} />
  </div>
)

export const SkeletonTable: React.FC<{
  rows?: number
  columns?: number
  className?: string
}> = ({ rows = 5, columns = 4, className = '' }) => (
  <div className={clsx('space-y-3', className)}>
    {/* Header */}
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={`header-${index}`} variant="text" height={20} animation="pulse" />
      ))}
    </div>
    
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div 
        key={`row-${rowIndex}`}
        className="grid gap-4" 
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton 
            key={`cell-${rowIndex}-${colIndex}`} 
            variant="text" 
            height={16} 
            animation="pulse" 
          />
        ))}
      </div>
    ))}
  </div>
)

export const SkeletonList: React.FC<{
  items?: number
  showAvatar?: boolean
  showIcon?: boolean
  className?: string
}> = ({ items = 5, showAvatar = false, showIcon = false, className = '' }) => (
  <div className={clsx('space-y-4', className)}>
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center space-x-3">
        {(showAvatar || showIcon) && (
          <SkeletonAvatar size="sm" />
        )}
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
    ))}
  </div>
)

export const SkeletonNavbar: React.FC<{
  className?: string
}> = ({ className = '' }) => (
  <div className={clsx('flex items-center justify-between p-4', className)}>
    {/* Logo */}
    <Skeleton variant="rectangular" width={120} height={32} />
    
    {/* Navigation items */}
    <div className="flex space-x-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} variant="text" width={60} height={20} />
      ))}
    </div>
    
    {/* User avatar */}
    <SkeletonAvatar size="sm" />
  </div>
)

export const SkeletonSidebar: React.FC<{
  className?: string
  items?: number
}> = ({ className = '', items = 8 }) => (
  <div className={clsx('space-y-2 p-4', className)}>
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center space-x-3 p-2">
        <Skeleton variant="rectangular" width={20} height={20} />
        <Skeleton variant="text" width="70%" />
      </div>
    ))}
  </div>
)

export const SkeletonFileList: React.FC<{
  className?: string
  items?: number
}> = ({ className = '', items = 6 }) => (
  <div className={clsx('space-y-3', className)}>
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex items-center space-x-3">
          <Skeleton variant="rectangular" width={40} height={40} />
          <div className="space-y-1">
            <Skeleton variant="text" width={180} />
            <Skeleton variant="text" width={120} />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton variant="rectangular" width={60} height={24} />
          <SkeletonButton width={80} size="sm" />
        </div>
      </div>
    ))}
  </div>
)

export const SkeletonViewer: React.FC<{
  className?: string
}> = ({ className = '' }) => (
  <div className={clsx('flex h-full', className)}>
    {/* Sidebar */}
    <div className="w-80 border-r border-gray-200 dark:border-gray-700 p-4">
      <Skeleton variant="text" width="60%" className="mb-4" />
      <SkeletonList items={8} showIcon />
    </div>
    
    {/* Main viewer area */}
    <div className="flex-1 relative">
      <Skeleton variant="rectangular" className="w-full h-full" />
      
      {/* Toolbar overlay */}
      <div className="absolute top-4 left-4 right-4 flex justify-between">
        <div className="flex space-x-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonButton key={index} width={40} size="sm" />
          ))}
        </div>
        <SkeletonButton width={100} size="sm" />
      </div>
    </div>
  </div>
)

// CSS para animación de wave
const SkeletonStyle: React.FC = () => (
  <style jsx global>{`
    @keyframes shimmer {
      0% {
        background-position: -468px 0;
      }
      100% {
        background-position: 468px 0;
      }
    }
    
    .animate-shimmer {
      background-size: 1000px 100%;
      animation: shimmer 2s infinite linear;
    }
  `}</style>
)

// Componente principal que incluye los estilos
const SkeletonLoader: React.FC<{
  children: React.ReactNode
}> = ({ children }) => (
  <>
    <SkeletonStyle />
    {children}
  </>
)

export {
  Skeleton,
  SkeletonLoader as default
}
