'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    // 토큰 만료 시간 계산 함수
    const getTokenExpiryTime = (token: string): number => {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return payload.exp * 1000 // milliseconds로 변환
      } catch (e) {
        console.error('[클라이언트] 토큰 만료 시간 계산 오류:', e)
        return 0
      }
    }

    // 다음 체크 시간 계산 함수
    const calculateNextCheckInterval = (accessToken: string | null): number => {
      if (!accessToken) return 600000 // 기본 10분

      const expiryTime = getTokenExpiryTime(accessToken)
      const timeToExpiry = expiryTime - Date.now()
      
      // 만료 10분 전부터는 2분마다 체크
      if (timeToExpiry <= 600000) {
        return 120000 // 2분
      }
      
      return 600000 // 기본 10분
    }

    // 세션 체크 함수
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          console.log('[클라이언트] 세션 없음')
          if (mounted) {
            router.replace(`/${locale}/auth/login`)
          }
          return
        }

        // 다음 체크 시간 계산 및 설정
        if (mounted) {
          const nextInterval = calculateNextCheckInterval(session.access_token)
          console.log('[클라이언트] 다음 세션 체크까지:', Math.floor(nextInterval / 1000 / 60), '분')
          
          timeoutId = setTimeout(() => {
            checkSession()
          }, nextInterval)
          
          setIsLoading(false)
        }
      } catch (error) {
        console.error('[클라이언트] 세션 체크 오류:', error)
        if (mounted) {
          router.replace(`/${locale}/auth/login`)
        }
      }
    }

    // 초기 세션 체크 실행
    checkSession()

    // 컴포넌트 언마운트 시 정리
    return () => {
      mounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [locale, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 w-full">
        <div className="py-4 px-[5px]">
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
  )
} 