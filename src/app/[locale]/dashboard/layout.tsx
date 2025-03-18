'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, invalidateExpiredSession } from '@/lib/supabase'
import { defaultLocale } from '@/i18n/settings'

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || defaultLocale
  const [isLoading, setIsLoading] = useState(true)
  
  // 세션 확인 및 토큰 만료 처리
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('[클라이언트] 대시보드 레이아웃 - 세션 확인 시작')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // 세션 오류 처리
        if (sessionError) {
          console.log('[클라이언트] 세션 확인 오류:', sessionError.message)
          
          // 토큰 관련 오류인 경우 세션 무효화 후 로그인 페이지로 리다이렉트
          if (sessionError.message.includes('token') || sessionError.message.includes('expired')) {
            console.log('[클라이언트] 토큰 만료 감지, 세션 무효화 수행')
            await invalidateExpiredSession()
            router.replace(`/${locale}/auth/login`)
            return
          }
        }
        
        // 세션이 없는 경우 로그인 페이지로 리다이렉트
        if (!session) {
          console.log('[클라이언트] 세션 없음, 로그인 페이지로 리다이렉트')
          router.replace(`/${locale}/auth/login`)
          return
        }
        
        console.log('[클라이언트] 대시보드 레이아웃 - 세션 확인됨:', session.user.email)
        
        // 세션이 있지만 토큰으로 사용자 정보 확인 - access_token을 인자로 전달
        const { data: { user }, error: userError } = await supabase.auth.getUser(session.access_token)
        
        if (userError) {
          console.log('[클라이언트] 사용자 정보 확인 실패:', userError.message)
          
          // 토큰 관련 오류인 경우 세션 무효화 후 로그인 페이지로 리다이렉트
          if (userError.message.includes('token') || userError.message.includes('expired')) {
            console.log('[클라이언트] 토큰 만료 감지, 세션 무효화 수행')
            await invalidateExpiredSession()
            router.replace(`/${locale}/auth/login`)
            return
          }
          
          // 기타 오류도 로그인 페이지로 리다이렉트
          router.replace(`/${locale}/auth/login`)
          return
        }
        
        // 사용자 정보 확인 성공
        if (user) {
          console.log('[클라이언트] 사용자 정보 확인 성공:', user.email)
          setIsLoading(false)
        } else {
          // 사용자 정보가 없는 경우 로그인 페이지로 리다이렉트
          console.log('[클라이언트] 사용자 정보 없음, 로그인 페이지로 리다이렉트')
          router.replace(`/${locale}/auth/login`)
        }
      } catch (error: any) {
        console.error('[클라이언트] 인증 확인 오류:', error)
        
        // 토큰 관련 오류인 경우 세션 무효화
        if (error?.message?.includes('token') || error?.message?.includes('expired')) {
          console.log('[클라이언트] 토큰 만료 감지, 세션 무효화 수행')
          await invalidateExpiredSession()
        }
        
        // 오류 발생 시 로그인 페이지로 리다이렉트
        router.replace(`/${locale}/auth/login`)
      }
    }
    
    checkAuth()
  }, [locale, router])
  
  // 로딩 중이면 로딩 표시
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>인증 확인 중...</p>
      </div>
    )
  }
  
  // 로그아웃 처리
  const handleLogout = async () => {
    await invalidateExpiredSession()
    router.replace(`/${locale}/auth/login`)
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* 간단한 네비게이션 바 */}
      <header className="bg-blue-600 text-white">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <div className="font-bold text-xl">Account System</div>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded"
          >
            로그아웃
          </button>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto py-6 px-4">
        {children}
      </main>
      
      {/* 간단한 푸터 */}
      <footer className="bg-gray-100 py-4">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Account System
        </div>
      </footer>
    </div>
  )
} 