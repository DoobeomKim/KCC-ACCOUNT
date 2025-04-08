'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader } from '@/components/ui/loader'
import { supabase } from '@/lib/supabase'
import { defaultLocale } from '@/i18n/settings'

export default function LoginPage() {
  const params = useParams()
  const locale = (params?.locale as string) || defaultLocale
  const t = useTranslations('auth.login')
  const router = useRouter()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      try {
        // 이미 리디렉션이 진행 중인지 확인
        const redirecting = sessionStorage.getItem('redirecting')
        if (redirecting === 'true') {
          return
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token && session?.user) {
          sessionStorage.setItem('redirecting', 'true')
          router.replace(`/${locale}/dashboard`)
        }
      } catch (error) {
        console.error('세션 확인 중 오류:', error)
      }
    }

    checkSession()

    // 컴포넌트가 언마운트될 때 리디렉션 플래그 제거
    return () => {
      sessionStorage.removeItem('redirecting')
    }
  }, [locale, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error('로그인 실패:', signInError.message)
        if (signInError.message.includes('Invalid login credentials')) {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('이메일 인증이 필요합니다.')
        } else {
          setError(signInError.message)
        }
        return
      }

      if (!data?.session) {
        setError('세션을 생성할 수 없습니다.')
        return
      }

      // 리디렉션 플래그 설정
      sessionStorage.setItem('redirecting', 'true')
      router.replace(`/${locale}/dashboard`)
      
    } catch (error) {
      console.error('로그인 중 오류 발생:', error)
      setError('로그인 처리 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                placeholder="name@example.com"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="w-full"
              />
            </div>
            {error && (
              <div className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader className="mr-2" /> : null}
              {t('submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 