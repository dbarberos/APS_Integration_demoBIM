import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { useUI } from '@/hooks/useUI'
import Button from '@/components/ui/Button'
import { validateEmail } from '@/utils/validation'

// Schema de validación con Zod
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  rememberMe: z.boolean().optional()
})

const registerSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, 'Debes aceptar los términos')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword']
})

type LoginFormData = z.infer<typeof loginSchema>
type RegisterFormData = z.infer<typeof registerSchema>

interface LoginFormProps {
  initialMode?: 'login' | 'register'
  onSuccess?: () => void
}

const LoginForm: React.FC<LoginFormProps> = ({ 
  initialMode = 'login',
  onSuccess 
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register: registerUser, isLoading } = useAuth()
  const { showErrorToast, showSuccessToast } = useUI()
  
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Formulario de login
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  })

  // Formulario de registro
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false
    }
  })

  const handleLogin = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password, data.rememberMe)
      showSuccessToast('Sesión iniciada correctamente')
      
      const from = (location.state as any)?.from || '/'
      navigate(from, { replace: true })
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Login error:', error)
      showErrorToast(
        'Error de autenticación', 
        error.response?.data?.detail || 'Credenciales incorrectas'
      )
    }
  }

  const handleRegister = async (data: RegisterFormData) => {
    try {
      await registerUser({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        password: data.password
      })
      
      showSuccessToast(
        'Cuenta creada correctamente',
        'Por favor verifica tu email antes de iniciar sesión'
      )
      
      // Cambiar a modo login después del registro exitoso
      setMode('login')
      loginForm.setValue('email', data.email)
      registerForm.reset()
    } catch (error: any) {
      console.error('Register error:', error)
      showErrorToast(
        'Error al crear cuenta',
        error.response?.data?.detail || 'Error en el registro'
      )
    }
  }

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    loginForm.clearErrors()
    registerForm.clearErrors()
  }

  if (mode === 'login') {
    return (
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Iniciar Sesión
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Accede a tu cuenta de APS Platform
          </p>
        </div>

        {/* Formulario de Login */}
        <form 
          onSubmit={loginForm.handleSubmit(handleLogin)}
          className="space-y-4"
        >
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              {...loginForm.register('email')}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                loginForm.formState.errors.email 
                  ? 'border-red-300 dark:border-red-500' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="tu@email.com"
            />
            {loginForm.formState.errors.email && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {loginForm.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                {...loginForm.register('password')}
                className={`w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                  loginForm.formState.errors.password 
                    ? 'border-red-300 dark:border-red-500' 
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Tu contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            {loginForm.formState.errors.password && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {loginForm.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                type="checkbox"
                {...loginForm.register('rememberMe')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Recordarme
              </label>
            </div>
            <button
              type="button"
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
              onClick={() => {
                // TODO: Implementar recuperación de contraseña
                showErrorToast('Función no implementada', 'La recuperación de contraseña estará disponible próximamente')
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            loading={isLoading}
            loadingText="Iniciando sesión..."
            fullWidth
            size="lg"
          >
            Iniciar Sesión
          </Button>
        </form>

        {/* Toggle to Register */}
        <div className="text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            ¿No tienes cuenta? Regístrate aquí
          </button>
        </div>
      </div>
    )
  }

  // Formulario de Registro
  return (
    <div className="w-full max-w-md space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Crear Cuenta
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Únete a APS Platform
        </p>
      </div>

      {/* Formulario de Registro */}
      <form 
        onSubmit={registerForm.handleSubmit(handleRegister)}
        className="space-y-4"
      >
        {/* Nombre y Apellido */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre
            </label>
            <input
              type="text"
              {...registerForm.register('firstName')}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                registerForm.formState.errors.firstName 
                  ? 'border-red-300 dark:border-red-500' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Juan"
            />
            {registerForm.formState.errors.firstName && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {registerForm.formState.errors.firstName.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Apellido
            </label>
            <input
              type="text"
              {...registerForm.register('lastName')}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                registerForm.formState.errors.lastName 
                  ? 'border-red-300 dark:border-red-500' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Pérez"
            />
            {registerForm.formState.errors.lastName && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {registerForm.formState.errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            {...registerForm.register('email')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
              registerForm.formState.errors.email 
                ? 'border-red-300 dark:border-red-500' 
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="tu@email.com"
          />
          {registerForm.formState.errors.email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {registerForm.formState.errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Contraseña
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              {...registerForm.register('password')}
              className={`w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                registerForm.formState.errors.password 
                  ? 'border-red-300 dark:border-red-500' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Mínimo 8 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <EyeIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          {registerForm.formState.errors.password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {registerForm.formState.errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Confirmar Contraseña
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              {...registerForm.register('confirmPassword')}
              className={`w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                registerForm.formState.errors.confirmPassword 
                  ? 'border-red-300 dark:border-red-500' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Confirma tu contraseña"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="h-5 w-5 text-gray-400" />
              ) : (
                <EyeIcon className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          {registerForm.formState.errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {registerForm.formState.errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Accept Terms */}
        <div>
          <div className="flex items-center">
            <input
              type="checkbox"
              {...registerForm.register('acceptTerms')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Acepto los{' '}
              <button 
                type="button"
                className="text-blue-600 hover:text-blue-500 dark:text-blue-400"
                onClick={() => {
                  // TODO: Implementar modal de términos
                  showErrorToast('Función no implementada', 'Los términos y condiciones estarán disponibles próximamente')
                }}
              >
                términos y condiciones
              </button>
            </label>
          </div>
          {registerForm.formState.errors.acceptTerms && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {registerForm.formState.errors.acceptTerms.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          loading={isLoading}
          loadingText="Creando cuenta..."
          fullWidth
          size="lg"
        >
          Crear Cuenta
        </Button>
      </form>

      {/* Toggle to Login */}
      <div className="text-center">
        <button
          type="button"
          onClick={toggleMode}
          className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          ¿Ya tienes cuenta? Inicia sesión aquí
        </button>
      </div>
    </div>
  )
}

export default LoginForm
