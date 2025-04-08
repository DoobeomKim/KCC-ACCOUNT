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

// 쿠키 만료 시간 설정 (상수)
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24시간

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
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({
            name,
            value,
            ...options,
            path: '/',
            sameSite: 'lax',
            secure: !isDevelopment,
            httpOnly: !name.startsWith('sb-'),
            maxAge: COOKIE_MAX_AGE,
          });
        },
        remove(name: string, options: any) {
          res.cookies.set({
            name,
            value: '',
            ...options,
            path: '/',
            sameSite: 'lax',
            secure: !isDevelopment,
            httpOnly: !name.startsWith('sb-'),
            maxAge: 0,
          });
        },
      },
    }
  );

  // 루트 경로인 경우 로그인 페이지로 바로 리다이렉트
  if (pathname === '/' || (pathname.split('/').length === 2 && pathname === `/${locale}`)) {
    console.log('[서버] 루트 경로 접근 - 로그인 페이지로 리다이렉트');
    const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
    return NextResponse.redirect(redirectUrl);
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
    // 세션 체크 - 간단하게 수정
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('[서버] 세션 없음 - 로그인 페이지로 리다이렉트');
      const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
      return NextResponse.redirect(redirectUrl);
    }

    return res;
    
  } catch (error) {
    console.error('[서버] 세션 체크 오류:', error);
    const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)']
}; 