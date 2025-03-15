import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/settings';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always'
});

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();

  // 로케일 추출 (URL 경로에서)
  const pathname = request.nextUrl.pathname;
  const pathnameIsMissingLocale = locales.every(
    locale => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  // 기본 로케일 사용
  const locale = pathnameIsMissingLocale ? defaultLocale : pathname.split('/')[1];

  // Supabase 클라이언트 생성
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.cookies.get(name);
          return cookie?.value;
        },
        set(name: string, value: string, options: any) {
          // 응답 객체에 쿠키 설정
          res.cookies.set({
            name,
            value,
            ...options,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 7, // 7일
          });
        },
        remove(name: string, options: any) {
          res.cookies.set({
            name,
            value: '',
            ...options,
            path: '/',
            maxAge: 0,
          });
        },
      },
    }
  );

  try {
    // 세션 체크
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // 액세스 토큰이 있는지 확인
    const accessToken = request.cookies.get('sb-access-token')?.value;
    
    // 세션이 없지만 토큰이 있는 경우 토큰으로 사용자 확인
    if (!session && accessToken) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        if (!error && user) {
          // 세션 새로고침 시도
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshData.session) {
            // 세션 쿠키 강제 설정
            res.cookies.set({
              name: 'sb-access-token',
              value: refreshData.session.access_token,
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              maxAge: 60 * 60 * 24 * 7, // 7일
            });
            
            res.cookies.set({
              name: 'sb-refresh-token',
              value: refreshData.session.refresh_token,
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              maxAge: 60 * 60 * 24 * 7, // 7일
            });
          } else {
            // 세션 새로고침 실패시 로그아웃
            await supabase.auth.signOut();
            const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
            return NextResponse.redirect(redirectUrl, {
              status: 302,
              headers: {
                'Cache-Control': 'no-store, max-age=0',
              }
            });
          }
        }
      } catch (error) {
        // 토큰 검증 실패시 로그아웃
        await supabase.auth.signOut();
        const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
        return NextResponse.redirect(redirectUrl, {
          status: 302,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          }
        });
      }
    }

    // 현재 경로가 로그인 페이지인지 확인
    const isLoginPage = request.nextUrl.pathname.includes('/auth/login');

    // 로그인이 필요한 페이지 목록
    const protectedPages = ['/dashboard', '/business-expense', '/expense-list', '/admin'];
    const pathParts = request.nextUrl.pathname.split('/');
    const currentPath = pathParts.length > 2 ? `/${pathParts[2]}` : '';
    const isProtectedPage = protectedPages.some(page => page === currentPath);

    // 세션 확인 페이지 여부 확인
    const isCheckSessionPage = request.nextUrl.pathname.includes('/check-session');

    // 루트 경로인 경우 로그인 페이지로 리다이렉트
    if (pathname === '/' || (pathParts.length === 2 && pathname === `/${locale}`)) {
      const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
      return NextResponse.redirect(redirectUrl, {
        status: 302,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      });
    }

    // 보호된 페이지에서 세션이 없는 경우
    if ((isProtectedPage || currentPath === '') && !session && !isLoginPage && !isCheckSessionPage) {
      const redirectUrl = new URL(`/${locale}/auth/login`, request.url);
      const redirectRes = NextResponse.redirect(redirectUrl, {
        status: 302,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      });
      
      // 세션 쿠키를 리다이렉트 응답에 복사
      res.cookies.getAll().forEach((cookie) => {
        redirectRes.cookies.set({
          ...cookie,
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      });
      
      return redirectRes;
    }

    // 로그인 페이지에서 유효한 세션이 있는 경우
    if (isLoginPage && session) {
      // 세션 유효성 추가 검증
      try {
        const { data: { user }, error } = await supabase.auth.getUser(session.access_token);
        
        if (error || !user) {
          await supabase.auth.signOut();
          return res;
        }

        const redirectUrl = new URL(`/${locale}/dashboard`, request.url);
        const redirectRes = NextResponse.redirect(redirectUrl, {
          status: 302,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          }
        });
        
        // 세션 쿠키를 리다이렉트 응답에 복사
        res.cookies.getAll().forEach((cookie) => {
          redirectRes.cookies.set({
            ...cookie,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          });
        });
        
        return redirectRes;
      } catch (tokenError) {
        await supabase.auth.signOut();
        return res;
      }
    }

    // i18n 미들웨어 적용
    const response = await intlMiddleware(request);

    // 세션 쿠키를 최종 응답에 복사
    res.cookies.getAll().forEach((cookie) => {
      response.cookies.set({
        ...cookie,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    });

    return response;
  } catch (error) {
    return res;
  }
}

export const config = {
  matcher: [
    '/',
    '/(de|ko)/:path*',
    '/((?!_next|api|favicon.ico).*)'
  ]
}; 