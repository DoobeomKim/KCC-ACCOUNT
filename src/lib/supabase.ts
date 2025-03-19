import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 개발 환경 여부 확인
const isDevelopment = process.env.NODE_ENV === 'development'

// 토큰 만료 시간 설정 (상수)
const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1시간
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24; // 24시간

// 세션 관리 옵션 추가
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: false,
      storage: {
        getItem: (key: string) => {
          if (typeof document === 'undefined') return null
          const value = document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${key}=`))
            ?.split('=')[1]
          return value ? value : null
        },
        setItem: (key: string, value: any) => {
          if (typeof document === 'undefined') return
          const securePart = isDevelopment ? '' : '; Secure'
          const maxAge = key.includes('refresh') ? REFRESH_TOKEN_MAX_AGE : ACCESS_TOKEN_MAX_AGE
          document.cookie = `${key}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${securePart}`
        },
        removeItem: (key: string) => {
          if (typeof document === 'undefined') return
          const securePart = isDevelopment ? '' : '; Secure'
          document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${securePart}`
        }
      },
      autoRefreshToken: true,
      debug: isDevelopment // 개발 환경에서만 디버그 활성화
    },
    global: {
      headers: {
        'X-Client-Info': `supabase-js-web/2.38.4`,
      },
    },
  }
)

// 세션 새로고침 이벤트 리스너
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('[클라이언트] 토큰 갱신 성공')
  } else if (event === 'SIGNED_OUT') {
    // 모든 관련 쿠키 삭제
    const securePart = isDevelopment ? '' : '; Secure'
    document.cookie = `sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${securePart}`
    document.cookie = `sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${securePart}`
  }
})

// 세션 상태 확인 함수 수정
export const checkSession = async () => {
  try {
    console.log('[클라이언트] 세션 상태 확인 시작')
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('[클라이언트] 세션 확인 오류:', error.message)
      return null
    }

    if (!session) {
      console.log('[클라이언트] 유효한 세션 없음')
      return null
    }

    // 액세스 토큰 만료 시간 확인
    const tokenParts = session.access_token.split('.')
    if (tokenParts.length === 3) {
      const payload = JSON.parse(atob(tokenParts[1]))
      const expiryTime = payload.exp * 1000
      const currentTime = Date.now()
      const timeToExpiry = expiryTime - currentTime

      console.log('[클라이언트] 액세스 토큰 만료까지:', Math.floor(timeToExpiry / 1000 / 60), '분')

      // 만료 10분 전에 자동 갱신
      if (timeToExpiry < 600000) {
        console.log('[클라이언트] 토큰 갱신 시도')
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()

        if (refreshError) {
          console.error('[클라이언트] 토큰 갱신 실패:', refreshError.message)
          return null
        }

        if (refreshedSession) {
          console.log('[클라이언트] 토큰 갱신 성공')
          return refreshedSession
        }
      }
    }

    return session
  } catch (err) {
    console.error('[클라이언트] 세션 확인 중 오류:', err)
    return null
  }
}

// 세션 강제 설정 함수
export const forceSetSession = async (session: any) => {
  if (!session) return false;
  
  try {
    // 세션 타입 정의
    interface SessionType {
      access_token: string;
      refresh_token: string;
    }
    
    // 세션 객체를 타입 안전하게 변환
    const typedSession = session as SessionType;
    
    // 보안 향상된 쿠키 설정
    // 개발환경에서는 Secure 속성 제외, 프로덕션에서는 포함
    const securePart = isDevelopment ? '' : '; Secure';
    document.cookie = `sb-access-token=${typedSession.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${securePart}`;
    document.cookie = `sb-refresh-token=${typedSession.refresh_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${securePart}`;
    
    // 세션 설정 확인
    const { data, error } = await supabase.auth.getSession();
    return !!data.session && !error;
  } catch (err) {
    return false;
  }
};

// 토큰 만료 시 세션을 완전히 무효화하는 함수
export const invalidateExpiredSession = async () => {
  console.log('[클라이언트] 만료된 토큰 감지, 세션 무효화');
  try {
    // 보안 향상된 쿠키 삭제
    const securePart = isDevelopment ? '' : '; Secure';
    document.cookie = `sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${securePart}`;
    document.cookie = `sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${securePart}`;
    
    // Supabase 세션 로그아웃 처리
    await supabase.auth.signOut();
    
    // CSRF 토큰 쿠키 삭제 (도입 예정)
    document.cookie = `csrf-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${securePart}`;
    
    return true;
  } catch (err) {
    console.error('[클라이언트] 세션 무효화 실패:', err);
    return false;
  }
};

// CSRF 토큰 생성 함수 추가
export const generateCSRFToken = () => {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// CSRF 보호를 위한 토큰 설정 함수
export const setupCSRFProtection = () => {
  try {
    // 이미 CSRF 토큰이 있는지 확인
    const existingToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf-token='))
      ?.split('=')[1];
      
    if (!existingToken) {
      // 새 CSRF 토큰 생성 및 설정
      const csrfToken = generateCSRFToken();
      const securePart = isDevelopment ? '' : '; Secure';
      document.cookie = `csrf-token=${csrfToken}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax${securePart}`;
    }
    return true;
  } catch (err) {
    console.error('[클라이언트] CSRF 보호 설정 실패:', err);
    return false;
  }
};

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          email: string
          role: 'admin' | 'user'
          created_at: string
          updated_at: string
        }
        Insert: {
          email: string
          role?: 'admin' | 'user'
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          role?: 'admin' | 'user'
          created_at?: string
          updated_at?: string
        }
      },
      company_profiles: {
        Row: {
          email: string
          company_name: string | null
          city: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          email: string
          company_name?: string | null
          city?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          company_name?: string | null
          city?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
} 