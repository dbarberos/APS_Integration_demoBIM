import { configureStore } from '@reduxjs/toolkit'
import { combineReducers } from '@reduxjs/toolkit'

// Reducers
import authReducer from './slices/authSlice'
import filesReducer from './slices/filesSlice'
import translationReducer from './slices/translationSlice'
import uiReducer from './slices/uiSlice'
import projectsReducer from './slices/projectsSlice'

// Root reducer
const rootReducer = combineReducers({
  auth: authReducer,
  files: filesReducer,
  translation: translationReducer,
  projects: projectsReducer,
  ui: uiReducer,
})

// Crear store
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
        ignoredPaths: ['items.dates'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
})

// Tipos para TypeScript
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Selectores base para hooks tipados
export const selectAuth = (state: RootState) => state.auth
export const selectFiles = (state: RootState) => state.files
export const selectTranslation = (state: RootState) => state.translation
export const selectProjects = (state: RootState) => state.projects
export const selectUI = (state: RootState) => state.ui

// Store enhancers para desarrollo
if (process.env.NODE_ENV === 'development') {
  // Exponer store globalmente para debugging
  ;(window as any).__REDUX_STORE__ = store
}

export default store
