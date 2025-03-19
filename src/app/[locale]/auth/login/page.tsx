'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { supabase, checkSession, forceSetSession, invalidateExpiredSession, setupCSRFProtection } from '@/lib/supabase'
import { defaultLocale } from '@/i18n/settings'

export default function LoginPage() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  // useParams 사용 및 기본값 설정
  const params = useParams()
  const locale = params?.locale as string || defaultLocale
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  // CSRF 토큰 설정
  useEffect(() => {
    setupCSRFProtection();
  }, []);

  // 이미 로그인되어 있는지 확인
  useEffect(() => {
    console.log('[클라이언트] [1단계] 로그인 페이지 접근');
    
    const checkAuth = async () => {
      try {
        console.log('[클라이언트] [2단계] 기존 세션 확인');
        // 로컬 스토리지에서 인증 상태 확인
        const isAuth = localStorage.getItem('isAuthenticated');
        if (isAuth === 'true') {
          console.log('[클라이언트] 로컬 스토리지에 인증 정보 발견, 대시보드로 리디렉션');
          router.replace(`/${locale}/dashboard`);
          return;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // 세션 오류 처리
        if (sessionError) {
          console.log('[클라이언트] 세션 확인 오류:', sessionError.message);
          
          // 토큰 관련 오류인 경우 세션 무효화
          if (sessionError.message.includes('token') || sessionError.message.includes('expired')) {
            console.log('[클라이언트] 토큰 만료 감지, 세션 무효화 수행');
            await invalidateExpiredSession();
          }
          
          setIsCheckingSession(false);
          return;
        }
        
        console.log('[클라이언트] 세션 상태:', session ? '세션 있음' : '세션 없음');
        
        if (session?.user?.aud === 'authenticated' && session?.access_token) {
          console.log('[클라이언트] 유효한 세션 발견, 사용자 정보 확인');
          
          // 세션이 존재하면 로컬 스토리지에 인증 상태 저장
          localStorage.setItem('sb-access-token', session.access_token);
          localStorage.setItem('sb-refresh-token', session.refresh_token);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('lastLoginTime', Date.now().toString());
          
          // 사용자 정보 확인
          try {
            const { data: { user }, error } = await supabase.auth.getUser(session.access_token)
            
            if (!error && user) {
              console.log('[클라이언트] [4단계] 인증 성공 - 이미 로그인됨, 대시보드로 리디렉션');
              router.replace(`/${locale}/dashboard`)
              return
            } else {
              console.log('[클라이언트] 사용자 정보 확인 실패:', error?.message);
              localStorage.removeItem('isAuthenticated');
              
              // 토큰 관련 오류인 경우 세션 무효화
              if (error?.message.includes('token') || error?.message.includes('expired')) {
                console.log('[클라이언트] 토큰 만료 감지, 세션 무효화 수행');
                await invalidateExpiredSession();
              }
            }
          } catch (userError) {
            console.error('[클라이언트] 사용자 정보 확인 중 예외 발생:', userError);
            localStorage.removeItem('isAuthenticated');
          }
        }
        
        setIsCheckingSession(false)
      } catch (error: any) {
        console.error('[클라이언트] 세션 확인 오류:', error);
        
        // 토큰 관련 오류인 경우 세션 무효화
        if (error?.message?.includes('token') || error?.message?.includes('expired')) {
          console.log('[클라이언트] 토큰 만료 감지, 세션 무효화 수행');
          await invalidateExpiredSession();
        }
        
        localStorage.removeItem('isAuthenticated');
        setIsCheckingSession(false)
      }
    }
    
    checkAuth()
  }, [locale, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      console.log('[클라이언트] 로그인 시도:', email);
      
      // CSRF 토큰 가져오기
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf-token='))
        ?.split('=')[1];
      
      // Supabase 클라이언트에 추가 헤더 설정
      if (csrfToken) {
        supabase.realtime.setAuth(csrfToken);
      }
      
      // 로그인 시도
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.error('[클라이언트] 로그인 실패:', error.message);
        setError(t('error'))
        setIsLoading(false)
        return
      }
      
      console.log('[클라이언트] 로그인 성공, 세션 정보:', data.session);
      
      // 세션 데이터가 있는지 확인
      if (!data.session) {
        console.error('[클라이언트] 로그인은 성공했으나 세션 데이터가 없음');
        setError('세션 초기화 실패');
        setIsLoading(false);
        return;
      }
      
      // 세션 정보 저장
      try {
        // 세션 토큰을 localStorage에 저장
        localStorage.setItem('sb-access-token', data.session.access_token);
        localStorage.setItem('sb-refresh-token', data.session.refresh_token);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('lastLoginTime', Date.now().toString());
        localStorage.removeItem('auth_redirect_in_progress');
        
        // 세션 스토리지에도 저장
        sessionStorage.setItem('sb-access-token', data.session.access_token);
        sessionStorage.setItem('sb-refresh-token', data.session.refresh_token);
        sessionStorage.setItem('isAuthenticated', 'true');
        
        // 쿠키 설정 확인 및 필요 시 추가 설정
        const cookies = document.cookie;
        const hasAccessToken = cookies.includes('sb-access-token');
        
        if (!hasAccessToken) {
          console.log('[클라이언트] 세션 쿠키가 없어 직접 설정');
          document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
          document.cookie = `sb-refresh-token=${data.session.refresh_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
        
        // 비동기 처리 완료 후 페이지 이동
        console.log('[클라이언트] 인증 상태 저장 완료, 대시보드로 이동 준비');
        
        // Supabase 세션 설정 확인 및 기다림
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
        
        console.log('[클라이언트] 세션 설정 완료, 대시보드로 이동');
        
        // 직접 URL 이동 (router.replace 대신)
        window.location.href = `/${locale}/dashboard`;
      } catch (e) {
        console.error('[클라이언트] 세션 설정 오류:', e);
        // 오류가 있어도 대시보드로 이동 시도
        window.location.href = `/${locale}/dashboard`;
      }
    } catch (error) {
      console.error('[클라이언트] 로그인 처리 오류:', error);
      setError(t('error'))
      setIsLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader size={40} />
          <p>세션 확인 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
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