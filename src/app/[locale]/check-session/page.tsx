'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function CheckSessionPage() {
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [cookies, setCookies] = useState<string>('')
  const [localStorageData, setLocalStorageData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkSessionStatus = async () => {
      try {
        // 세션 정보 가져오기
        const { data, error } = await supabase.auth.getSession()
        setSessionInfo(data)

        // 쿠키 정보 가져오기
        setCookies(document.cookie)

        // 로컬 스토리지 정보 가져오기
        try {
          const authToken = localStorage.getItem('supabase-auth-token')
          setLocalStorageData(authToken ? JSON.parse(authToken) : null)
        } catch (e) {
          console.error('로컬 스토리지 접근 에러:', e)
        }
      } catch (err) {
        console.error('세션 확인 에러:', err)
      } finally {
        setLoading(false)
      }
    }

    checkSessionStatus()
  }, [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('로그아웃 에러:', error)
    }
  }

  const handleRefreshSession = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error
      setSessionInfo({ session: data.session })
    } catch (error) {
      console.error('세션 새로고침 에러:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">세션 상태 확인</h1>
        <div className="space-x-2">
          <Button onClick={handleRefreshSession} variant="outline">
            세션 새로고침
          </Button>
          <Button onClick={handleLogout} variant="destructive">
            로그아웃
          </Button>
        </div>
      </div>
      
      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>세션 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-60">
                {JSON.stringify(sessionInfo, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>쿠키 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-60">
                {cookies || '쿠키 없음'}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>로컬 스토리지 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-60">
                {JSON.stringify(localStorageData, null, 2) || '로컬 스토리지 데이터 없음'}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
} 