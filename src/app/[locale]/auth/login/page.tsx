'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { supabase, checkSession, forceSetSession } from '@/lib/supabase'
import { defaultLocale } from '@/i18n/settings'

export default function LoginPage() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  // useParams 사용 및 기본값 설정
  const params = useParams()
  const locale = params?.locale as string || defaultLocale
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  // 이미 로그인된 사용자 체크
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const session = await checkSession();
        
        // 세션이 있고, 액세스 토큰이 유효한 경우에만 리다이렉트
        if (session?.user?.aud === 'authenticated' && session?.access_token) {
          // 토큰 유효성 검증
          const { data: { user }, error } = await supabase.auth.getUser(session.access_token)
          
          if (user && !error) {
            router.push(`/${locale}/dashboard`)
          } else {
            // 유효하지 않은 세션이면 로그아웃 처리
            await supabase.auth.signOut()
          }
        }
      } catch (error) {
        // 에러 발생 시 로그아웃 처리
        await supabase.auth.signOut()
      } finally {
        setIsCheckingSession(false)
      }
    }
    checkUserSession()
  }, [locale, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      // 기존 세션 정리
      await supabase.auth.signOut();
      
      // 로그인 시도
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(t('error'))
        return
      }

      if (data?.user) {
        // 세션 데이터 저장 확인
        const session = await checkSession();
        
        if (session) {
          try {
            // 세션 강제 설정
            const sessionSet = await forceSetSession(session);
            
            // 세션 쿠키 직접 설정
            document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
            document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
            
            // 리다이렉션 처리
            const dashboardPath = `/${locale}/dashboard`
            
            // 세션이 설정될 때까지 충분히 대기
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // 세션 저장을 위한 로컬 스토리지 설정
            try {
              localStorage.setItem('supabase-auth-token', JSON.stringify([
                session.access_token,
                session.refresh_token
              ]));
            } catch (storageError) {
              // 로컬 스토리지 저장 실패
            }
            
            // 직접 URL 변경 (더 강력한 리다이렉트)
            router.push(dashboardPath);
            
            // 백업 리다이렉트 (위 방법이 실패할 경우)
            setTimeout(() => {
              if (window.location.pathname !== dashboardPath) {
                window.location.href = dashboardPath;
              }
            }, 500);
          } catch (redirectError) {
            // 에러 발생 시 직접 URL 변경 시도
            window.location.href = `/${locale}/dashboard`;
          }
        } else {
          setError(t('error'))
        }
      }
    } catch (error) {
      setError(t('error'))
    } finally {
      setLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-2">
          <Loader size={24} />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader size={16} />
                  <span>{t('submit')}</span>
                </div>
              ) : (
                t('submit')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 