import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { es, enUS } from 'date-fns/locale'

// Configuración de locales
const locales = {
  es,
  en: enUS,
}

/**
 * Formatear bytes a tamaño legible
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Formatear número con separadores de miles
 */
export function formatNumber(num: number, locale: string = 'es-ES'): string {
  return new Intl.NumberFormat(locale).format(num)
}

/**
 * Formatear porcentaje
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Formatear moneda
 */
export function formatCurrency(
  amount: number,
  currency: string = 'EUR',
  locale: string = 'es-ES'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Formatear fecha
 */
export function formatDate(
  date: string | Date,
  formatString: string = 'dd/MM/yyyy',
  locale: string = 'es'
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date
    
    if (!isValid(dateObj)) {
      return 'Fecha inválida'
    }

    return format(dateObj, formatString, {
      locale: locales[locale as keyof typeof locales] || locales.es,
    })
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Fecha inválida'
  }
}

/**
 * Formatear fecha y hora
 */
export function formatDateTime(
  date: string | Date,
  locale: string = 'es'
): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm', locale)
}

/**
 * Formatear tiempo relativo (hace X tiempo)
 */
export function formatRelativeTime(
  date: string | Date,
  locale: string = 'es'
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date
    
    if (!isValid(dateObj)) {
      return 'Fecha inválida'
    }

    return formatDistanceToNow(dateObj, {
      addSuffix: true,
      locale: locales[locale as keyof typeof locales] || locales.es,
    })
  } catch (error) {
    console.error('Error formatting relative time:', error)
    return 'Fecha inválida'
  }
}

/**
 * Formatear duración en segundos a tiempo legible
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
}

/**
 * Formatear progreso como porcentaje
 */
export function formatProgress(current: number, total: number): string {
  if (total === 0) return '0%'
  const percentage = (current / total) * 100
  return `${Math.round(percentage)}%`
}

/**
 * Formatear velocidad de transferencia
 */
export function formatTransferSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) {
    return `${Math.round(bytesPerSecond)} B/s`
  } else if (bytesPerSecond < 1024 * 1024) {
    return `${Math.round(bytesPerSecond / 1024)} KB/s`
  } else {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
  }
}

/**
 * Truncar texto con puntos suspensivos
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

/**
 * Capitalizar primera letra
 */
export function capitalize(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/**
 * Capitalizar cada palabra
 */
export function capitalizeWords(text: string): string {
  if (!text) return text
  return text
    .split(' ')
    .map(word => capitalize(word))
    .join(' ')
}

/**
 * Formatear nombre de archivo para mostrar
 */
export function formatFileName(fileName: string, maxLength: number = 30): string {
  if (fileName.length <= maxLength) return fileName

  const extension = fileName.split('.').pop() || ''
  const nameWithoutExtension = fileName.slice(0, fileName.lastIndexOf('.'))
  const maxNameLength = maxLength - extension.length - 4 // -4 para "..." y el punto

  if (nameWithoutExtension.length <= maxNameLength) {
    return fileName
  }

  return `${nameWithoutExtension.slice(0, maxNameLength)}...${extension ? '.' + extension : ''}`
}

/**
 * Formatear estado de archivo/traducción
 */
export function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    // File status
    uploading: 'Subiendo',
    uploaded: 'Subido',
    processing: 'Procesando',
    ready: 'Listo',
    error: 'Error',
    
    // Translation status
    pending: 'Pendiente',
    inprogress: 'En progreso',
    success: 'Completado',
    failed: 'Fallido',
    timeout: 'Tiempo agotado',
    cancelled: 'Cancelado',
  }

  return statusMap[status] || status
}

/**
 * Formatear prioridad
 */
export function formatPriority(priority: string): string {
  const priorityMap: Record<string, string> = {
    low: 'Baja',
    normal: 'Normal',
    high: 'Alta',
    urgent: 'Urgente',
  }

  return priorityMap[priority] || priority
}

/**
 * Formatear extensión de archivo
 */
export function formatFileExtension(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return extension ? `.${extension.toUpperCase()}` : ''
}

/**
 * Formatear resolución de imagen
 */
export function formatResolution(width: number, height: number): string {
  return `${width} × ${height}`
}

/**
 * Formatear calidad de traducción
 */
export function formatQuality(score: number): { text: string; color: string } {
  if (score >= 0.9) {
    return { text: 'Excelente', color: 'green' }
  } else if (score >= 0.8) {
    return { text: 'Muy buena', color: 'blue' }
  } else if (score >= 0.7) {
    return { text: 'Buena', color: 'yellow' }
  } else if (score >= 0.6) {
    return { text: 'Regular', color: 'orange' }
  } else {
    return { text: 'Deficiente', color: 'red' }
  }
}

/**
 * Formatear lista de elementos
 */
export function formatList(
  items: string[],
  conjunction: string = 'y',
  locale: string = 'es'
): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`
  
  const lastItem = items[items.length - 1]
  const otherItems = items.slice(0, -1)
  
  return `${otherItems.join(', ')} ${conjunction} ${lastItem}`
}

/**
 * Formatear código de error
 */
export function formatErrorCode(code: string): string {
  const codeMap: Record<string, string> = {
    'FILE_TOO_LARGE': 'Archivo demasiado grande',
    'INVALID_FORMAT': 'Formato no válido',
    'NETWORK_ERROR': 'Error de conexión',
    'AUTH_ERROR': 'Error de autenticación',
    'PERMISSION_DENIED': 'Permisos insuficientes',
    'QUOTA_EXCEEDED': 'Cuota excedida',
    'TRANSLATION_FAILED': 'Error en traducción',
    'TIMEOUT': 'Tiempo de espera agotado',
  }

  return codeMap[code] || code
}

/**
 * Formatear tiempo estimado
 */
export function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) {
    return `~${Math.round(seconds)} segundos`
  } else if (seconds < 3600) {
    const minutes = Math.round(seconds / 60)
    return `~${minutes} minuto${minutes !== 1 ? 's' : ''}`
  } else {
    const hours = Math.round(seconds / 3600)
    return `~${hours} hora${hours !== 1 ? 's' : ''}`
  }
}

/**
 * Formatear coordenadas
 */
export function formatCoordinates(lat: number, lng: number, precision: number = 6): string {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`
}

/**
 * Formatear versión
 */
export function formatVersion(version: string): string {
  // Eliminar prefijo 'v' si existe
  return version.startsWith('v') ? version.slice(1) : version
}
