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
  const locale = (params?.locale as string) || defaultLocale
  
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // 로그인 페이지 리디렉션 함수
  const redirectToLogin = () => {
    try {
      console.log('[클라이언트] 로그아웃 처리 시작');
      
      // 플래그 설정 - 중복 리디렉션 방지
      sessionStorage.setItem('auth_redirect_in_progress', 'true');
      
      // 토큰 삭제 (쿠키)
      document.cookie = `sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.cookie = `sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      
      // localStorage 토큰 삭제
      localStorage.removeItem('sb-access-token');
      localStorage.removeItem('sb-refresh-token');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('lastLoginTime');
      
      // sessionStorage 토큰 삭제
      sessionStorage.removeItem('sb-access-token');
      sessionStorage.removeItem('sb-refresh-token');
      sessionStorage.removeItem('isAuthenticated');
      
      // 로그아웃 처리 후 리디렉션
      supabase.auth.signOut().then(() => {
        console.log('[클라이언트] 로그아웃 처리 완료, 로그인 페이지로 이동');
        window.location.href = `/${locale}/auth/login`;
        
        // 플래그는 3초 후 제거
        setTimeout(() => {
          sessionStorage.removeItem('auth_redirect_in_progress');
        }, 3000);
      }).catch(e => {
        console.error('[클라이언트] 로그아웃 오류:', e);
        window.location.href = `/${locale}/auth/login`;
      });
    } catch (e) {
      console.error('[클라이언트] 리디렉션 오류:', e);
      window.location.href = `/${locale}/auth/login`;
    }
  };

  // 세션 확인 함수
  const verifySession = async (mounted: boolean = true) => {
    try {
      console.log('[클라이언트] [1단계] 대시보드 페이지 접근');
      
      // 리디렉션 중복 방지 체크 (sessionStorage 사용)
      const redirectInProgress = sessionStorage.getItem('auth_redirect_in_progress') === 'true';
      if (redirectInProgress) {
        console.log('[클라이언트] 리디렉션 진행 중 - 세션 체크 건너뜀');
        return false;
      }
      
      // 빠른 체크: 로컬스토리지 인증 상태 확인
      const isAuth = localStorage.getItem('isAuthenticated');
      const lastLogin = localStorage.getItem('lastLoginTime');
      const accessToken = localStorage.getItem('sb-access-token');
      const refreshToken = localStorage.getItem('sb-refresh-token');
      const timeNow = Date.now();
      const loginTime = lastLogin ? parseInt(lastLogin) : 0;
      const loginTimeDiff = timeNow - loginTime;
      
      // 최근 로그인했고 토큰이 있으면 인증 상태로 간주
      if (isAuth === 'true' && accessToken) {
        console.log('[클라이언트] 로컬 스토리지에 인증 상태 확인됨');
        
        // 토큰을 쿠키에도 설정 (없을 경우)
        const cookieAccessToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('sb-access-token='))
          ?.split('=')[1];
          
        if (!cookieAccessToken && accessToken) {
          console.log('[클라이언트] 쿠키에 토큰 설정');
          document.cookie = `sb-access-token=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
          if (refreshToken) {
            document.cookie = `sb-refresh-token=${refreshToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
          }
        }
        
        if (mounted) {
          setIsAuthenticated(true);
          
          // 최근 30초 이내에 로그인했으면 Supabase 세션 체크 생략
          if (loginTimeDiff < 30000) {
            console.log('[클라이언트] 최근 로그인, 세션 체크 생략');
            setIsLoading(false);
            
            // 백그라운드에서 사용자 정보 가져오기
            supabase.auth.getUser().then(({ data }) => {
              if (data?.user && mounted) {
                setUser(data.user);
              }
            });
            return true;
          }
          
          // Supabase 세션 설정 (토큰이 있지만 세션이 없는 경우 대비)
          try {
            const { data: sessionCheck } = await supabase.auth.getSession();
            if (!sessionCheck.session && accessToken) {
              console.log('[클라이언트] Supabase 세션 없음, 토큰으로 세션 설정');
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
              });
            }
            
            // 사용자 정보 확인
            const { data: { user: userInfo }, error: userError } = await supabase.auth.getUser();
            
            if (userError || !userInfo) {
              console.log('[클라이언트] 사용자 정보 확인 실패, 로컬 저장소 토큰으로 시도');
              const { data: tokenUserData, error: tokenUserError } = await supabase.auth.getUser(accessToken);
              
              if (tokenUserError || !tokenUserData?.user) {
                // 리프레시 토큰으로 세션 갱신 시도
                if (refreshToken) {
                  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
                    refresh_token: refreshToken
                  });
                  
                  if (!refreshError && refreshData?.session) {
                    console.log('[클라이언트] 세션 갱신 성공');
                    setUser(refreshData.user);
                    setIsLoading(false);
                    // 새 토큰 저장
                    localStorage.setItem('sb-access-token', refreshData.session.access_token);
                    localStorage.setItem('sb-refresh-token', refreshData.session.refresh_token);
                    localStorage.setItem('lastLoginTime', Date.now().toString());
                    return true;
                  } else {
                    console.log('[클라이언트] 세션 갱신 실패, 로그인 페이지로 이동');
                    redirectToLogin();
                    return false;
                  }
                } else {
                  redirectToLogin();
                  return false;
                }
              } else {
                // 로컬 토큰으로 사용자 확인 성공
                setUser(tokenUserData.user);
                setIsLoading(false);
                return true;
              }
            } else {
              // 사용자 정보 확인 성공
              setUser(userInfo);
              setIsLoading(false);
              return true;
            }
          } catch (e) {
            console.error('[클라이언트] 세션 확인 오류:', e);
            redirectToLogin();
            return false;
          }
        }
        return true;
      } else {
        // 인증 정보 없음
        console.log('[클라이언트] 로컬 스토리지에 인증 정보 없음');
        
        // Supabase 세션 확인
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          console.log('[클라이언트] Supabase 세션 없음, 로그인 페이지로 이동');
          if (mounted) {
            redirectToLogin();
          }
          return false;
        } else {
          // 세션은 있지만 로컬 스토리지에 없는 경우 로컬 스토리지에 저장
          console.log('[클라이언트] Supabase 세션 있음, 로컬 스토리지에 저장');
          localStorage.setItem('sb-access-token', session.access_token);
          localStorage.setItem('sb-refresh-token', session.refresh_token);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('lastLoginTime', Date.now().toString());
          
          if (mounted) {
            setUser(session.user);
            setIsAuthenticated(true);
            setIsLoading(false);
          }
          return true;
        }
      }
    } catch (e) {
      console.error('[클라이언트] 세션 검증 오류:', e);
      if (mounted) {
        redirectToLogin();
      }
      return false;
    }
  };

  // 주기적 세션 확인
  useEffect(() => {
    let mounted = true;
    
    // 토큰 만료 시간을 계산하여 적절한 체크 주기 설정
    const calculateNextCheck = () => {
      try {
        const accessToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('sb-access-token='))
          ?.split('=')[1];
        
        if (accessToken) {
          const tokenParts = accessToken.split('.');
          const payload = JSON.parse(atob(tokenParts[1]));
          const expiryTime = payload.exp * 1000;
          const currentTime = Date.now();
          const timeToExpiry = expiryTime - currentTime;
          
          // 만료 10분 전 또는 최소 5분마다 체크
          // 단, 만료 시간이 10분 이하로 남았다면 1분마다 체크
          if (timeToExpiry <= 600000) { // 10분 이하
            return 60000; // 1분
          }
          return Math.min(timeToExpiry - 600000, 300000); // 만료 10분 전 또는 5분
        }
      } catch (e) {
        console.error('[클라이언트] 토큰 체크 주기 계산 오류:', e);
      }
      
      return 300000; // 기본값 5분
    };
    
    // 초기 세션 확인
    verifySession(mounted);
    
    // 동적 인터벌 설정
    const setupNextCheck = () => {
      const checkInterval = calculateNextCheck();
      console.log('[클라이언트] 다음 세션 체크까지:', Math.floor(checkInterval / 1000 / 60), '분');
      
      return setTimeout(() => {
        if (mounted) {
          verifySession(mounted);
          timeoutId = setupNextCheck(); // 재귀적으로 다음 체크 설정
        }
      }, checkInterval);
    };
    
    let timeoutId = setupNextCheck();
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
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