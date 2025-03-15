'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LayoutDashboard, Users, Calendar, TrendingUp } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import { supabase, checkSession } from '@/lib/supabase'
import { defaultLocale } from '@/i18n/settings'
import { Loader } from '@/components/ui/loader'

export default function DashboardPage() {
  const t = useTranslations('navigation')
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || defaultLocale
  
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 세션 확인 함수
  const verifySession = async (mounted: boolean = true) => {
    try {
      // 세션 확인
      const session = await checkSession();
      
      if (!session && mounted) {
        router.replace(`/${locale}/auth/login`);
        return false;
      }
      
      // 세션 유효성 추가 검증
      try {
        const { data: { user }, error } = await supabase.auth.getUser(session?.access_token);
        
        if ((error || !user) && mounted) {
          await supabase.auth.signOut();
          router.replace(`/${locale}/auth/login`);
          return false;
        }
        
        if (mounted) {
          // 사용자 정보 설정
          setUser(user);
          setIsAuthenticated(true);
        }
        return true;
      } catch (tokenError) {
        if (mounted) {
          router.replace(`/${locale}/auth/login`);
        }
        return false;
      }
    } catch (error) {
      if (mounted) {
        router.replace(`/${locale}/auth/login`);
      }
      return false;
    } finally {
      if (mounted) {
        setIsLoading(false);
      }
    }
  };

  // 초기 세션 확인
  useEffect(() => {
    let mounted = true;
    verifySession(mounted);
    return () => {
      mounted = false;
    };
  }, []);

  // 주기적 세션 확인 (1분마다)
  useEffect(() => {
    let mounted = true;
    const intervalId = setInterval(() => {
      verifySession(mounted);
    }, 60 * 1000); // 1분

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [locale, router]);

  // 로딩 중이거나 인증되지 않은 경우 표시
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader size={40} />
          <p>인증 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 lg:ml-64">
        <div className="p-8 space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">{t('dashboard')}</h1>
            {user && (
              <div className="text-sm text-muted-foreground">
                {user.email}
              </div>
            )}
          </div>

          {/* 상단 통계 카드 섹션 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 매출</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₩15,182,000</div>
                <p className="text-xs text-muted-foreground">전월 대비 +20.1%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">판매 건수</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">28</div>
                <p className="text-xs text-muted-foreground">전월 대비 +12건</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">평균 단가</CardTitle>
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₩42,000</div>
                <p className="text-xs text-muted-foreground">전월 대비 -5.2%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">예약 건수</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">11</div>
                <p className="text-xs text-muted-foreground">전월 대비 +3건</p>
              </CardContent>
            </Card>
          </div>

          {/* 중간 차트 섹션 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>진행 상태별 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  차트가 이곳에 들어갈 예정입니다
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>요약 정보</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">잔여 수량</span>
                    <span className="font-bold">18</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">총 금액</span>
                    <span className="font-bold">₩11,273,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">평균 단가</span>
                    <span className="font-bold">₩39,000</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 하단 그래프 섹션 */}
          <Card>
            <CardHeader>
              <CardTitle>일별 리드 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                그래프가 이곳에 들어갈 예정입니다
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 