import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/settings';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 개발 환경 여부 확인
const isDevelopment = process.env.NODE_ENV === 'development';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always'
});

export async function middleware(request: NextRequest) {
  console.log('[서버] [1단계] 미들웨어: 웹페이지 접근 - URL:', request.nextUrl.pathname);
  
  const res = NextResponse.next();

  // 로케일 추출 (URL 경로에서)
  const pathname = request.nextUrl.pathname;
  const pathnameIsMissingLocale = locales.every(
    locale => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  // 기본 로케일 사용
  const locale = pathnameIsMissingLocale ? defaultLocale : pathname.split('/')[1];
  console.log('[서버] 로케일 확인:', locale);

  // Supabase 클라이언트 생성
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.cookies.get(name);
          console.log('[서버] [2단계] 쿠키 확인:', name, cookie ? '존재함' : '없음');
          return cookie?.value;
        },
        set(name: string, value: string, options: any) {
          // 응답 객체에 쿠키 설정 (보안 강화)
          console.log('[서버] 쿠키 설정:', name);
          
          // 개발/프로덕션 환경에 따라 Secure 속성 설정
          const secureSetting = isDevelopment ? false : true;
          
          // Supabase 인증 관련 쿠키는 JavaScript에서 접근 가능하게 설정
          const isAuthCookie = name.startsWith('sb-');
          const httpOnlySetting = isAuthCookie ? false : true;
          
          res.cookies.set({
            name,
            value,
            ...options,
            path: '/',
            sameSite: 'lax',
            secure: secureSetting,
            httpOnly: httpOnlySetting, // 인증 쿠키는 JavaScript에서 접근 가능하게
            maxAge: 60 * 60 * 24 * 7, // 7일
          });
        },
        remove(name: string, options: any) {
          console.log('[서버] 쿠키 삭제:', name);
          
          // 개발/프로덕션 환경에 따라 Secure 속성 설정
          const secureSetting = isDevelopment ? false : true;
          
          // Supabase 인증 관련 쿠키는 JavaScript에서 접근 가능하게 설정
          const isAuthCookie = name.startsWith('sb-');
          const httpOnlySetting = isAuthCookie ? false : true;
          
          res.cookies.set({
            name,
            value: '',
            ...options,
            path: '/',
            sameSite: 'lax',
            secure: secureSetting,
            httpOnly: httpOnlySetting,
            maxAge: 0,
          });
        },
      },
    }
  );

  // 주요 요청 헤더에 CSRF 토큰 검증 추가 (POST, PUT, DELETE 요청에 대해)
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
    const csrfToken = request.cookies.get('csrf-token')?.value;
    const requestCsrfToken = request.headers.get('x-csrf-token');
    
    // API 엔드포인트에 대한 요청만 확인 (정적 파일 등은 제외)
    if (pathname.includes('/api/') && (!csrfToken || csrfToken !== requestCsrfToken)) {
      console.log('[서버] CSRF 토큰 불일치, 접근 거부');
      return NextResponse.json({ error: 'CSRF 보호 실패' }, { status: 403 });
    }
  }

  // 루트 경로인 경우 로그인 페이지로 바로 리다이렉트
  if (pathname === '/' || (pathname.split('/').length === 2 && pathname === `/${locale}`)) {
    console.log('[서버] 루트 경로 접근 - 로그인 페이지로 리다이렉트');
    const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
    return NextResponse.redirect(redirectUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  }
  
  // 로그인 페이지와 공개 페이지는 세션 체크하지 않고 통과
  const isLoginPage = pathname.includes('/auth/login');
  const isPublicPage = pathname.includes('/_next') || 
                     pathname.includes('/favicon.ico') || 
                     pathname.includes('/assets');
  
  if (isLoginPage || isPublicPage) {
    console.log('[서버] 공개 페이지 접근 - 세션 체크 생략');
    return res;
  }
  
  try {
    console.log('[서버] [3단계] 보호된 페이지 접근 - 세션 확인 시작');
    
    // 모든 인증 관련 쿠키를 먼저 확인
    const accessToken = request.cookies.get('sb-access-token')?.value;
    const refreshToken = request.cookies.get('sb-refresh-token')?.value;
    
    console.log('[서버] 액세스 토큰:', accessToken ? '토큰 있음' : '토큰 없음');
    console.log('[서버] 리프레시 토큰:', refreshToken ? '토큰 있음' : '토큰 없음');
    
    // 토큰이 없으면 로그인 페이지로 리다이렉트
    if (!accessToken) {
      console.log('[서버] 토큰 없음 - 로그인 페이지로 리다이렉트');
      
      // 강제로 모든 인증 관련 쿠키 제거 (서버 측)
      clearAuthCookies(res);

      const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
      return NextResponse.redirect(redirectUrl, {
        status: 302,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      });
    }

    // 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // 세션 오류 또는 세션이 없는 경우
    if (sessionError || !session) {
      console.log('[서버] 세션 오류 또는 세션 없음:', sessionError?.message || 'No session');
      
      // 강제로 모든 인증 관련 쿠키 제거 (서버 측)
      clearAuthCookies(res);
      
      // 로그아웃 처리 후 로그인 페이지로 리다이렉트
      await supabase.auth.signOut();
      
      const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
      return NextResponse.redirect(redirectUrl, {
        status: 302,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      });
    }
    
    // 토큰 유효성 검사
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
      
      if (userError || !user) {
        console.log('[서버] 토큰으로 사용자 확인 실패:', userError?.message || 'No user');
        
        // 강제로 모든 인증 관련 쿠키 제거 (서버 측)
        clearAuthCookies(res);
        
        // 로그아웃 처리 후 로그인 페이지로 리다이렉트
        await supabase.auth.signOut();
        
        const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
        return NextResponse.redirect(redirectUrl, {
          status: 302,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          }
        });
      }
      
      // 사용자 확인됨 - 계속 진행
      console.log('[서버] 사용자 확인 성공:', user.email);
      return res;
      
    } catch (error) {
      console.error('[서버] 토큰 검증 오류:', error);
      
      // 강제로 모든 인증 관련 쿠키 제거 (서버 측)
      clearAuthCookies(res);
      
      // 로그아웃 처리 후 로그인 페이지로 리다이렉트
      await supabase.auth.signOut();
      
      const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
      return NextResponse.redirect(redirectUrl, {
        status: 302,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      });
    }
    
  } catch (error) {
    console.error('[서버] 미들웨어 오류:', error);
    
    // 모든 오류는 로그인 페이지로 리다이렉트
    // 강제로 모든 인증 관련 쿠키 제거 (서버 측)
    clearAuthCookies(res);
    
    const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
    return NextResponse.redirect(redirectUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  }
}

// 인증 관련 쿠키 삭제 헬퍼 함수
function clearAuthCookies(response: NextResponse) {
  const secureSetting = isDevelopment ? false : true;
  
  response.cookies.set({
    name: 'sb-access-token',
    value: '',
    path: '/',
    sameSite: 'lax',
    secure: secureSetting,
    httpOnly: false, // JavaScript에서 접근 가능하게 변경
    maxAge: 0,
  });
  
  response.cookies.set({
    name: 'sb-refresh-token',
    value: '',
    path: '/',
    sameSite: 'lax',
    secure: secureSetting,
    httpOnly: false, // JavaScript에서 접근 가능하게 변경
    maxAge: 0,
  });
  
  // Supabase 관련 쿠키도 제거
  response.cookies.set({
    name: 'supabase-auth-token',
    value: '',
    path: '/',
    sameSite: 'lax',
    secure: secureSetting,
    httpOnly: true,
    maxAge: 0,
  });
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)']
}; 