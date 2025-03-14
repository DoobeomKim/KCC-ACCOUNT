'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const t = useTranslations('auth.login')
  const router = useRouter()
  const pathname = usePathname()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  // 이미 로그인된 사용자 체크
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('Checking existing session...')
        const { data: { session } } = await supabase.auth.getSession()
        console.log('Existing session:', session)
        
        if (session?.user?.aud === 'authenticated') {
          const locale = pathname.split('/')[1]
          console.log('User already logged in, redirecting to dashboard...')
          router.push(`/${locale}/dashboard`)
        }
      } catch (error) {
        console.error('Session check error:', error)
      } finally {
        setIsCheckingSession(false)
      }
    }
    checkSession()
  }, [pathname, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log('Login form submitted')
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      console.log('Attempting to sign in...')
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error('Login error:', signInError)
        setError(t('error'))
        return
      }

      if (data?.user) {
        console.log('Login successful, user:', data.user)
        const locale = pathname.split('/')[1]
        console.log('Current locale:', locale)
        
        // 세션 데이터 저장 확인
        console.log('Checking session after login...')
        const { data: { session } } = await supabase.auth.getSession()
        console.log('Session after login:', session)
        
        if (session) {
          // 리다이렉션 처리
          const dashboardPath = `/${locale}/dashboard`
          console.log('Redirecting to:', dashboardPath)
          
          // 세션 쿠키 설정
          document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=3600; SameSite=Lax`
          document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=3600; SameSite=Lax`
          
          // 쿠키가 설정될 때까지 잠시 대기
          await new Promise(resolve => setTimeout(resolve, 500))
          
          window.location.href = dashboardPath
        } else {
          console.error('No session found after successful login')
          setError(t('error'))
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error)
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