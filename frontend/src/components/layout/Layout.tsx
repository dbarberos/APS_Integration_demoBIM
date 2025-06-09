import React from 'react'
import { Outlet } from 'react-router-dom'
import { useUI } from '@/hooks/useUI'
import { useSidebar } from '@/hooks/redux'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'

const Layout: React.FC = () => {
  const { sidebarCollapsed, sidebarMobile } = useSidebar()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Overlay para móvil cuando el sidebar está abierto */}
      {sidebarMobile && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => {
            // Cerrar sidebar móvil
          }}
        />
      )}
      
      {/* Contenido principal */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
      }`}>
        {/* Header */}
        <Header />
        
        {/* Contenido de la página */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full">
            <Outlet />
          </div>
        </main>
        
        {/* Footer */}
        <Footer />
      </div>
    </div>
  )
}

export default Layout
