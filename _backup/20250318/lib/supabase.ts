import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 개발 환경 여부 확인
const isDevelopment = process.env.NODE_ENV === 'development'

// 세션 관리 옵션 추가
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    // 쿠키만 사용하도록 변경 (localStorage 사용 중지)
    storage: {
      getItem: (key) => {
        if (typeof document === 'undefined') return null
        const value = document.cookie
          .split('; ')
          .find((row) => row.startsWith(`${key}=`))
          ?.split('=')[1]
        return value ? value : null
      },
      setItem: (key, value) => {
        if (typeof document === 'undefined') return
        // HttpOnly 제거하여 JavaScript에서 접근 가능하게 함
        const securePart = isDevelopment ? '' : '; Secure'
        document.cookie = `${key}=${value}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${securePart}`
      },
      removeItem: (key) => {
        if (typeof document === 'undefined') return
        // HttpOnly 제거
        const securePart = isDevelopment ? '' : '; Secure'
        document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${securePart}`
      }
    },
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
    debug: true // 디버깅 활성화
  },
  global: {
    headers: {
      'x-application-name': 'kcc-account'
    }
  }
})

// 세션 상태 확인 함수
export const checkSession = async () => {
  try {
    console.log('[클라이언트] checkSession 함수 호출');
    
    // 세션 타입 정의
    interface SessionType {
      access_token: string;
      refresh_token: string;
    }
    
    // 현재 세션 확인
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('[클라이언트] 세션 확인 오류:', error.message);
      return null;
    }
    
    // 세션이 있으면 반환
    if (data?.session) {
      console.log('[클라이언트] 유효한 세션 발견');
      return data.session;
    }
    
    console.log('[클라이언트] 세션 없음, 토큰으로 복구 시도');
    
    // 세션이 없고 토큰이 있는 경우 세션 새로고침 시도
    try {
      const accessToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('sb-access-token='))
        ?.split('=')[1];

      if (accessToken) {
        console.log('[클라이언트] 액세스 토큰 발견, 사용자 확인 시도');
        
        // 토큰 유효성 먼저 검증
        let isTokenValid = false;
        try {
          // 액세스 토큰 디코딩 및 만료 시간 확인
          const tokenParts = accessToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            const expiryTime = payload.exp * 1000; // 밀리초로 변환
            const currentTime = Date.now();
            
            isTokenValid = expiryTime > currentTime;
            console.log('[클라이언트] 토큰 만료 여부:', isTokenValid ? '유효함' : '만료됨', 
              '(남은 시간:', Math.floor((expiryTime - currentTime) / 1000 / 60), '분)');
          }
        } catch (e) {
          console.error('[클라이언트] 토큰 디코딩 오류:', e);
          isTokenValid = false;
        }
        
        // 토큰이 유효하면 사용자 정보 확인
        if (isTokenValid) {
          // 토큰으로 사용자 확인
          const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
          
          if (!userError && userData?.user) {
            console.log('[클라이언트] 토큰으로 사용자 확인 성공, 세션 새로고침 시도');
            // 세션 새로고침 시도
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (!refreshError && refreshData?.session) {
              console.log('[클라이언트] 세션 새로고침 성공');
              return refreshData.session;
            } else {
              console.log('[클라이언트] 세션 새로고침 실패:', refreshError?.message);
            }
          } else {
            console.log('[클라이언트] 토큰으로 사용자 확인 실패:', userError?.message);
          }
        } else {
          console.log('[클라이언트] 토큰이 만료되었음, 갱신 시도');
          
          // 리프레시 토큰 확인
          const refreshToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('sb-refresh-token='))
            ?.split('=')[1];
            
          if (refreshToken) {
            console.log('[클라이언트] 리프레시 토큰 발견, 세션 갱신 시도');
            try {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
                refresh_token: refreshToken
              });
              
              if (!refreshError && refreshData?.session) {
                console.log('[클라이언트] 세션 갱신 성공');
                return refreshData.session;
              } else {
                console.log('[클라이언트] 세션 갱신 실패:', refreshError?.message);
              }
            } catch (e) {
              console.error('[클라이언트] 세션 갱신 오류:', e);
            }
          }
        }
      } else {
        console.log('[클라이언트] 액세스 토큰 없음');
      }
    } catch (e) {
      console.error('[클라이언트] 토큰 검증 실패:', e);
    }
    
    return null;
  } catch (err) {
    console.error('[클라이언트] 세션 확인 중 오류 발생:', err);
    return null;
  }
};

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