/**
 * Utilidades de validación para formularios y datos
 */

// Expresiones regulares comunes
export const REGEX_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  phone: /^(\+34|0034|34)?[6789]\d{8}$/,
  postalCode: /^\d{5}$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alphabetic: /^[a-zA-ZÀ-ÿ\s]+$/,
  numeric: /^\d+$/,
  filename: /^[a-zA-Z0-9\s\-_\.]+$/,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
}

// Formatos de archivo permitidos por categoría
export const ALLOWED_FILE_FORMATS = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],
  documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
  spreadsheets: ['.xls', '.xlsx', '.csv'],
  presentations: ['.ppt', '.pptx'],
  cad: ['.dwg', '.dxf', '.rvt', '.ifc', '.3dm', '.skp', '.step', '.iges'],
  threed: ['.obj', '.fbx', '.3ds', '.dae', '.stl', '.3mf', '.gltf', '.glb'],
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  videos: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'],
  audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg'],
}

/**
 * Validar email
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email) {
    return { isValid: false, error: 'El email es requerido' }
  }
  
  if (!REGEX_PATTERNS.email.test(email)) {
    return { isValid: false, error: 'El formato del email no es válido' }
  }
  
  return { isValid: true }
}

/**
 * Validar contraseña
 */
export function validatePassword(
  password: string,
  options: {
    minLength?: number
    requireUppercase?: boolean
    requireLowercase?: boolean
    requireNumbers?: boolean
    requireSpecialChars?: boolean
  } = {}
): { isValid: boolean; error?: string; strength?: number } {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = true,
  } = options

  if (!password) {
    return { isValid: false, error: 'La contraseña es requerida', strength: 0 }
  }

  const errors: string[] = []
  let strength = 0

  // Longitud mínima
  if (password.length < minLength) {
    errors.push(`Debe tener al menos ${minLength} caracteres`)
  } else {
    strength += 1
  }

  // Mayúsculas
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Debe contener al menos una letra mayúscula')
  } else if (/[A-Z]/.test(password)) {
    strength += 1
  }

  // Minúsculas
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Debe contener al menos una letra minúscula')
  } else if (/[a-z]/.test(password)) {
    strength += 1
  }

  // Números
  if (requireNumbers && !/\d/.test(password)) {
    errors.push('Debe contener al menos un número')
  } else if (/\d/.test(password)) {
    strength += 1
  }

  // Caracteres especiales
  if (requireSpecialChars && !/[@$!%*?&]/.test(password)) {
    errors.push('Debe contener al menos un carácter especial (@$!%*?&)')
  } else if (/[@$!%*?&]/.test(password)) {
    strength += 1
  }

  // Puntos extra por longitud
  if (password.length >= 12) strength += 1
  if (password.length >= 16) strength += 1

  return {
    isValid: errors.length === 0,
    error: errors.length > 0 ? errors.join(', ') : undefined,
    strength: Math.min(strength, 5), // Máximo 5 puntos
  }
}

/**
 * Validar confirmación de contraseña
 */
export function validatePasswordConfirmation(
  password: string,
  confirmation: string
): { isValid: boolean; error?: string } {
  if (!confirmation) {
    return { isValid: false, error: 'La confirmación de contraseña es requerida' }
  }

  if (password !== confirmation) {
    return { isValid: false, error: 'Las contraseñas no coinciden' }
  }

  return { isValid: true }
}

/**
 * Validar nombre (nombre y apellido)
 */
export function validateName(name: string, fieldName: string = 'nombre'): { isValid: boolean; error?: string } {
  if (!name) {
    return { isValid: false, error: `El ${fieldName} es requerido` }
  }

  if (name.length < 2) {
    return { isValid: false, error: `El ${fieldName} debe tener al menos 2 caracteres` }
  }

  if (name.length > 50) {
    return { isValid: false, error: `El ${fieldName} no puede exceder 50 caracteres` }
  }

  if (!REGEX_PATTERNS.alphabetic.test(name)) {
    return { isValid: false, error: `El ${fieldName} solo puede contener letras y espacios` }
  }

  return { isValid: true }
}

/**
 * Validar teléfono
 */
export function validatePhone(phone: string): { isValid: boolean; error?: string } {
  if (!phone) {
    return { isValid: false, error: 'El teléfono es requerido' }
  }

  if (!REGEX_PATTERNS.phone.test(phone)) {
    return { isValid: false, error: 'El formato del teléfono no es válido' }
  }

  return { isValid: true }
}

/**
 * Validar URL
 */
export function validateUrl(url: string): { isValid: boolean; error?: string } {
  if (!url) {
    return { isValid: false, error: 'La URL es requerida' }
  }

  if (!REGEX_PATTERNS.url.test(url)) {
    return { isValid: false, error: 'El formato de la URL no es válido' }
  }

  return { isValid: true }
}

/**
 * Validar archivo
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number // en bytes
    allowedFormats?: string[]
    minSize?: number
  } = {}
): { isValid: boolean; error?: string } {
  const {
    maxSize = 100 * 1024 * 1024, // 100MB por defecto
    allowedFormats = [],
    minSize = 0,
  } = options

  if (!file) {
    return { isValid: false, error: 'No se ha seleccionado ningún archivo' }
  }

  // Validar tamaño mínimo
  if (file.size < minSize) {
    return { isValid: false, error: `El archivo debe ser mayor a ${formatBytes(minSize)}` }
  }

  // Validar tamaño máximo
  if (file.size > maxSize) {
    return { isValid: false, error: `El archivo no puede ser mayor a ${formatBytes(maxSize)}` }
  }

  // Validar formato
  if (allowedFormats.length > 0) {
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedFormats.includes(fileExtension)) {
      return {
        isValid: false,
        error: `Formato no permitido. Formatos válidos: ${allowedFormats.join(', ')}`,
      }
    }
  }

  return { isValid: true }
}

/**
 * Validar nombre de proyecto
 */
export function validateProjectName(name: string): { isValid: boolean; error?: string } {
  if (!name) {
    return { isValid: false, error: 'El nombre del proyecto es requerido' }
  }

  if (name.length < 3) {
    return { isValid: false, error: 'El nombre debe tener al menos 3 caracteres' }
  }

  if (name.length > 100) {
    return { isValid: false, error: 'El nombre no puede exceder 100 caracteres' }
  }

  if (!REGEX_PATTERNS.filename.test(name)) {
    return { isValid: false, error: 'El nombre contiene caracteres no válidos' }
  }

  return { isValid: true }
}

/**
 * Validar rango de fechas
 */
export function validateDateRange(
  startDate: string | Date,
  endDate: string | Date
): { isValid: boolean; error?: string } {
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime())) {
    return { isValid: false, error: 'La fecha de inicio no es válida' }
  }

  if (isNaN(end.getTime())) {
    return { isValid: false, error: 'La fecha de fin no es válida' }
  }

  if (start > end) {
    return { isValid: false, error: 'La fecha de inicio debe ser anterior a la fecha de fin' }
  }

  return { isValid: true }
}

/**
 * Validar rango numérico
 */
export function validateNumberRange(
  value: number,
  min?: number,
  max?: number,
  fieldName: string = 'valor'
): { isValid: boolean; error?: string } {
  if (isNaN(value)) {
    return { isValid: false, error: `El ${fieldName} debe ser un número válido` }
  }

  if (min !== undefined && value < min) {
    return { isValid: false, error: `El ${fieldName} debe ser mayor o igual a ${min}` }
  }

  if (max !== undefined && value > max) {
    return { isValid: false, error: `El ${fieldName} debe ser menor o igual a ${max}` }
  }

  return { isValid: true }
}

/**
 * Validar formulario completo
 */
export function validateForm<T extends Record<string, any>>(
  data: T,
  rules: Record<keyof T, (value: any) => { isValid: boolean; error?: string }>
): { isValid: boolean; errors: Record<keyof T, string> } {
  const errors: Record<keyof T, string> = {} as Record<keyof T, string>
  let isValid = true

  Object.keys(rules).forEach((field) => {
    const fieldKey = field as keyof T
    const validation = rules[fieldKey](data[fieldKey])
    
    if (!validation.isValid && validation.error) {
      errors[fieldKey] = validation.error
      isValid = false
    }
  })

  return { isValid, errors }
}

/**
 * Validar array no vacío
 */
export function validateRequiredArray(
  array: any[],
  fieldName: string = 'campo'
): { isValid: boolean; error?: string } {
  if (!Array.isArray(array) || array.length === 0) {
    return { isValid: false, error: `Debe seleccionar al menos un ${fieldName}` }
  }

  return { isValid: true }
}

/**
 * Validar IP v4
 */
export function validateIPv4(ip: string): { isValid: boolean; error?: string } {
  if (!ip) {
    return { isValid: false, error: 'La dirección IP es requerida' }
  }

  if (!REGEX_PATTERNS.ipv4.test(ip)) {
    return { isValid: false, error: 'El formato de la dirección IP no es válido' }
  }

  return { isValid: true }
}

/**
 * Validar color hexadecimal
 */
export function validateHexColor(color: string): { isValid: boolean; error?: string } {
  if (!color) {
    return { isValid: false, error: 'El color es requerido' }
  }

  if (!REGEX_PATTERNS.hexColor.test(color)) {
    return { isValid: false, error: 'El formato del color no es válido (debe ser #RRGGBB)' }
  }

  return { isValid: true }
}

/**
 * Sanitizar entrada de texto
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remover caracteres potencialmente peligrosos
    .replace(/\s+/g, ' ') // Normalizar espacios en blanco
}

/**
 * Validar JSON string
 */
export function validateJSON(jsonString: string): { isValid: boolean; error?: string; parsed?: any } {
  if (!jsonString) {
    return { isValid: false, error: 'El JSON es requerido' }
  }

  try {
    const parsed = JSON.parse(jsonString)
    return { isValid: true, parsed }
  } catch (error) {
    return { isValid: false, error: 'El formato JSON no es válido' }
  }
}

/**
 * Función auxiliar para formatear bytes (usada en validación de archivos)
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Validadores específicos para la aplicación APS
 */

/**
 * Validar formatos de archivo CAD/BIM
 */
export function validateCADFile(file: File): { isValid: boolean; error?: string } {
  const cadFormats = [...ALLOWED_FILE_FORMATS.cad, ...ALLOWED_FILE_FORMATS.threed]
  
  return validateFile(file, {
    maxSize: 500 * 1024 * 1024, // 500MB para archivos CAD
    allowedFormats: cadFormats,
    minSize: 1024, // Mínimo 1KB
  })
}

/**
 * Validar configuración de traducción
 */
export function validateTranslationConfig(config: any): { isValid: boolean; error?: string } {
  if (!config || typeof config !== 'object') {
    return { isValid: false, error: 'La configuración de traducción debe ser un objeto válido' }
  }

  // Validar que tenga al menos un formato de salida
  if (!config.outputFormats || !Array.isArray(config.outputFormats) || config.outputFormats.length === 0) {
    return { isValid: false, error: 'Debe especificar al menos un formato de salida' }
  }

  // Validar prioridad
  const validPriorities = ['low', 'normal', 'high', 'urgent']
  if (config.priority && !validPriorities.includes(config.priority)) {
    return { isValid: false, error: 'La prioridad debe ser: low, normal, high o urgent' }
  }

  // Validar nivel de calidad
  const validQualityLevels = ['low', 'medium', 'high']
  if (config.qualityLevel && !validQualityLevels.includes(config.qualityLevel)) {
    return { isValid: false, error: 'El nivel de calidad debe ser: low, medium o high' }
  }

  return { isValid: true }
}
