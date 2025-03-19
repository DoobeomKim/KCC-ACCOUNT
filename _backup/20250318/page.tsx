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
      const timeNow = Date.now();
      const loginTime = lastLogin ? parseInt(lastLogin) : 0;
      const loginTimeDiff = timeNow - loginTime;
      
      // 최근 30초 이내에 로그인했으면 인증 상태로 간주
      if (isAuth === 'true' && loginTimeDiff < 30000) {
        console.log('[클라이언트] 최근 로그인 내역 확인됨, 세션 인증됨으로 처리');
        if (mounted) {
          setIsAuthenticated(true);
          setIsLoading(false);
          
          // 백그라운드에서 세션 정보 가져오기
          supabase.auth.getUser().then(({ data }) => {
            if (data?.user && mounted) {
              setUser(data.user);
            }
          });
        }
        return true;
      }
      
      // 토큰 확인 (localStorage, sessionStorage, 쿠키 모두 확인)
      const localAccessToken = localStorage.getItem('sb-access-token');
      const localRefreshToken = localStorage.getItem('sb-refresh-token');
      const sessionAccessToken = sessionStorage.getItem('sb-access-token');
      
      const cookieAccessToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('sb-access-token='))
        ?.split('=')[1];
      
      console.log('[클라이언트] [2단계] 인증 토큰 확인:');
      console.log('- 로컬스토리지 토큰:', localAccessToken ? '있음' : '없음');
      console.log('- 세션스토리지 토큰:', sessionAccessToken ? '있음' : '없음');
      console.log('- 쿠키 토큰:', cookieAccessToken ? '있음' : '없음');
      
      // 사용가능한 토큰 (우선순위: cookie > localStorage > sessionStorage)
      const accessToken = cookieAccessToken || localAccessToken || sessionAccessToken;
      
      // 모든 저장소에 토큰이 없으면 로그인 페이지로 이동
      if (!accessToken) {
        console.log('[클라이언트] 사용 가능한 토큰이 없음 - 로그인 페이지로 이동');
        if (mounted) {
          redirectToLogin();
        }
        return false;
      }
      
      // 토큰 저장소 일치화: 발견된 토큰을 모든 저장소에 저장
      if (accessToken) {
        if (!cookieAccessToken) {
          console.log('[클라이언트] 쿠키에 토큰 저장');
          document.cookie = `sb-access-token=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
          
          if (localRefreshToken) {
            document.cookie = `sb-refresh-token=${localRefreshToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
          }
        }
        
        if (!localAccessToken) {
          console.log('[클라이언트] localStorage에 토큰 저장');
          localStorage.setItem('sb-access-token', accessToken);
          if (localRefreshToken) {
            localStorage.setItem('sb-refresh-token', localRefreshToken);
          }
        }
        
        if (!sessionAccessToken) {
          console.log('[클라이언트] sessionStorage에 토큰 저장');
          sessionStorage.setItem('sb-access-token', accessToken);
          if (localRefreshToken) {
            sessionStorage.setItem('sb-refresh-token', localRefreshToken);
          }
        }
      }
      
      // Supabase 세션 설정 (토큰이 있지만 세션이 없는 경우 대비)
      try {
        const { data: sessionCheck } = await supabase.auth.getSession();
        if (!sessionCheck.session && accessToken) {
          console.log('[클라이언트] Supabase 세션 없음, 토큰으로 세션 설정 시도');
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: localRefreshToken || ''
          });
        }
      } catch (e) {
        console.error('[클라이언트] 세션 설정 오류:', e);
      }
      
      // 사용자 정보 확인
      console.log('[클라이언트] [3단계] 사용자 정보 확인');
      const { data: { user: userInfo }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userInfo) {
        console.log('[클라이언트] 사용자 정보 확인 실패:', userError?.message || '사용자 없음');
        console.log('[클라이언트] 토큰으로 직접 사용자 정보 확인 시도');
        
        // 직접 토큰으로 사용자 정보 확인
        try {
          const { data: tokenUserData, error: tokenUserError } = await supabase.auth.getUser(accessToken);
          
          if (tokenUserError || !tokenUserData?.user) {
            console.log('[클라이언트] 토큰으로 사용자 확인 실패:', tokenUserError?.message || '사용자 없음');
            
            // 리프레시 토큰으로 세션 갱신 시도
            if (localRefreshToken) {
              console.log('[클라이언트] 리프레시 토큰으로 세션 갱신 시도');
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
                refresh_token: localRefreshToken
              });
              
              if (!refreshError && refreshData?.session && refreshData?.user) {
                console.log('[클라이언트] 세션 갱신 성공, 사용자:', refreshData.user.email);
                
                // 새로운 토큰 저장
                localStorage.setItem('sb-access-token', refreshData.session.access_token);
                localStorage.setItem('sb-refresh-token', refreshData.session.refresh_token);
                sessionStorage.setItem('sb-access-token', refreshData.session.access_token);
                sessionStorage.setItem('sb-refresh-token', refreshData.session.refresh_token);
                
                document.cookie = `sb-access-token=${refreshData.session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
                document.cookie = `sb-refresh-token=${refreshData.session.refresh_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
                
                if (mounted) {
                  setUser(refreshData.user);
                  setIsAuthenticated(true);
                  setIsLoading(false);
                  
                  // 인증 상태 저장
                  localStorage.setItem('isAuthenticated', 'true');
                  localStorage.setItem('lastLoginTime', Date.now().toString());
                  sessionStorage.setItem('isAuthenticated', 'true');
                }
                return true;
              } else {
                console.log('[클라이언트] 세션 갱신 실패:', refreshError?.message);
                if (mounted) {
                  redirectToLogin();
                }
                return false;
              }
            } else {
              // 리프레시 토큰도 없으면 로그인 페이지로
              if (mounted) {
                redirectToLogin();
              }
              return false;
            }
          } else {
            // 토큰으로 사용자 확인 성공
            console.log('[클라이언트] 토큰으로 사용자 확인 성공:', tokenUserData.user.email);
            if (mounted) {
              setUser(tokenUserData.user);
              setIsAuthenticated(true);
              setIsLoading(false);
              
              // 인증 상태 저장
              localStorage.setItem('isAuthenticated', 'true');
              localStorage.setItem('lastLoginTime', Date.now().toString());
              sessionStorage.setItem('isAuthenticated', 'true');
            }
            return true;
          }
        } catch (e) {
          console.error('[클라이언트] 토큰 검증 오류:', e);
          if (mounted) {
            redirectToLogin();
          }
          return false;
        }
      }
      
      // 사용자 정보 확인 성공
      console.log('[클라이언트] [4단계] 인증 성공 - 사용자:', userInfo?.email || 'unknown');
      
      // 최신 세션 정보 가져와서 저장소 업데이트
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        // 모든 저장소에 토큰 업데이트
        localStorage.setItem('sb-access-token', sessionData.session.access_token);
        localStorage.setItem('sb-refresh-token', sessionData.session.refresh_token);
        sessionStorage.setItem('sb-access-token', sessionData.session.access_token);
        sessionStorage.setItem('sb-refresh-token', sessionData.session.refresh_token);
      }
      
      if (mounted) {
        setUser(userInfo);
        setIsAuthenticated(true);
        setIsLoading(false);
        
        // 인증 상태 저장
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('lastLoginTime', Date.now().toString());
        sessionStorage.setItem('isAuthenticated', 'true');
      }
      return true;
    } catch (error) {
      console.error('[클라이언트] 세션 확인 오류:', error);
      if (mounted) {
        redirectToLogin();
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