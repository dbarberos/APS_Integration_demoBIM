import { useState, useEffect, useCallback } from 'react'

/**
 * Hook para gestionar datos en localStorage con tipado
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  // Estado para almacenar el valor
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Función para actualizar el valor
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Permitir que value sea una función para tener la misma API que useState
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      
      // Guardar en localStorage
      if (valueToStore === undefined) {
        window.localStorage.removeItem(key)
      } else {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  // Función para eliminar el valor
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
      setStoredValue(initialValue)
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  // Escuchar cambios en localStorage desde otras pestañas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue))
        } catch (error) {
          console.error(`Error parsing localStorage value for key "${key}":`, error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key])

  return [storedValue, setValue, removeValue]
}

/**
 * Hook simplificado para valores booleanos
 */
export function useLocalStorageBoolean(
  key: string,
  initialValue: boolean = false
): [boolean, () => void, () => void, (value: boolean) => void] {
  const [value, setValue, removeValue] = useLocalStorage(key, initialValue)

  const toggleValue = useCallback(() => {
    setValue((prev: boolean) => !prev)
  }, [setValue])

  const setTrue = useCallback(() => {
    setValue(true)
  }, [setValue])

  const setFalse = useCallback(() => {
    setValue(false)
  }, [setValue])

  const setBooleanValue = useCallback((newValue: boolean) => {
    setValue(newValue)
  }, [setValue])

  return [value, toggleValue, removeValue, setBooleanValue]
}

/**
 * Hook para arrays con métodos de utilidad
 */
export function useLocalStorageArray<T>(
  key: string,
  initialValue: T[] = []
): [
  T[],
  (item: T) => void,
  (index: number) => void,
  (item: T) => void,
  () => void,
  (newArray: T[]) => void
] {
  const [array, setArray, removeValue] = useLocalStorage<T[]>(key, initialValue)

  const addItem = useCallback((item: T) => {
    setArray((prev: T[]) => [...prev, item])
  }, [setArray])

  const removeItemByIndex = useCallback((index: number) => {
    setArray((prev: T[]) => prev.filter((_, i) => i !== index))
  }, [setArray])

  const removeItem = useCallback((item: T) => {
    setArray((prev: T[]) => prev.filter(i => i !== item))
  }, [setArray])

  const clearArray = useCallback(() => {
    setArray([])
  }, [setArray])

  const setFullArray = useCallback((newArray: T[]) => {
    setArray(newArray)
  }, [setArray])

  return [array, addItem, removeItemByIndex, removeItem, clearArray, setFullArray]
}

/**
 * Hook para objetos con merge functionality
 */
export function useLocalStorageObject<T extends Record<string, any>>(
  key: string,
  initialValue: T
): [T, (updates: Partial<T>) => void, (property: keyof T) => void, () => void] {
  const [object, setObject, removeValue] = useLocalStorage<T>(key, initialValue)

  const updateObject = useCallback((updates: Partial<T>) => {
    setObject((prev: T) => ({ ...prev, ...updates }))
  }, [setObject])

  const removeProperty = useCallback((property: keyof T) => {
    setObject((prev: T) => {
      const newObj = { ...prev }
      delete newObj[property]
      return newObj
    })
  }, [setObject])

  const resetObject = useCallback(() => {
    setObject(initialValue)
  }, [setObject, initialValue])

  return [object, updateObject, removeProperty, resetObject]
}

/**
 * Hook para gestionar preferencias de usuario
 */
export function useUserPreferences() {
  return useLocalStorageObject('user_preferences', {
    theme: 'system' as 'light' | 'dark' | 'system',
    language: 'es' as 'es' | 'en',
    sidebarCollapsed: false,
    density: 'comfortable' as 'comfortable' | 'compact' | 'spacious',
    animations: true,
    sounds: false,
    notifications: true,
    autoSave: true,
    defaultView: 'grid' as 'grid' | 'list',
    itemsPerPage: 20,
    autoRefresh: true,
    refreshInterval: 30000,
  })
}

/**
 * Hook para gestionar el historial de búsquedas
 */
export function useSearchHistory(maxItems: number = 10) {
  const [searches, addSearch, removeSearch, clearSearches] = useLocalStorageArray<string>('search_history', [])

  const addSearchTerm = useCallback((term: string) => {
    if (term.trim()) {
      // Remover duplicados y agregar al inicio
      const filteredSearches = searches.filter(s => s !== term.trim())
      const newSearches = [term.trim(), ...filteredSearches].slice(0, maxItems)
      clearSearches()
      newSearches.forEach(search => addSearch(search))
    }
  }, [searches, addSearch, clearSearches, maxItems])

  return [searches, addSearchTerm, removeSearch, clearSearches] as const
}

/**
 * Hook para gestionar configuraciones de tabla
 */
export function useTablePreferences(tableId: string) {
  return useLocalStorageObject(`table_${tableId}`, {
    sortField: '',
    sortDirection: 'asc' as 'asc' | 'desc',
    visibleColumns: [] as string[],
    pageSize: 20,
    filters: {} as Record<string, any>,
    columnWidths: {} as Record<string, number>,
    columnOrder: [] as string[],
  })
}

export default useLocalStorage
