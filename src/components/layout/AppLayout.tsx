'use client'

import MobileHeader from '@/components/layout/MobileHeader'
import Sidebar from '@/components/layout/Sidebar'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* 모바일 헤더 */}
      <MobileHeader />
      
      {/* 데스크톱 사이드바 */}
      <div className="hidden lg:block fixed left-0 top-0 h-screen w-72 bg-gray-900">
        <Sidebar />
      </div>
      
      <div className="lg:pl-72">
        <main className="flex-1 w-full">
          <div className="py-4 px-[5px] mt-16 lg:mt-0">
            {children}
          </div>
        </main>
        
        {/* 간단한 푸터 */}
        <footer className="bg-gray-100 py-4">
          <div className="w-full px-[5px] text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Account System
          </div>
        </footer>
      </div>
    </div>
  )
} 