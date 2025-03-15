import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 세션 관리 옵션 추가
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    // 로컬 스토리지 대신 쿠키 사용
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
        document.cookie = `${key}=${value}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
        // 로컬 스토리지에도 백업
        try {
          localStorage.setItem(key, value)
        } catch (e) {
          // 로컬 스토리지 저장 실패
        }
      },
      removeItem: (key) => {
        if (typeof document === 'undefined') return
        document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        // 로컬 스토리지에서도 제거
        try {
          localStorage.removeItem(key)
        } catch (e) {
          // 로컬 스토리지 제거 실패
        }
      }
    },
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
    debug: false
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
    // 먼저 현재 세션 확인
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      return null;
    }
    
    // 세션이 없고 토큰이 있는 경우 세션 새로고침 시도
    if (!data.session) {
      try {
        const accessToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('sb-access-token='))
          ?.split('=')[1];

        if (accessToken) {
          // 토큰으로 사용자 확인
          const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
          
          if (!userError && userData.user) {
            // 세션 새로고침 시도
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (!refreshError && refreshData.session) {
              // 새로운 세션 토큰 저장
              document.cookie = `sb-access-token=${refreshData.session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
              document.cookie = `sb-refresh-token=${refreshData.session.refresh_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
              
              // 로컬 스토리지에도 백업
              localStorage.setItem('supabase-auth-token', JSON.stringify([
                refreshData.session.access_token,
                refreshData.session.refresh_token
              ]));
              
              return refreshData.session;
            }
          }
        }
      } catch (e) {
        // 토큰 검증 실패
        return null;
      }
    }
    
    // 기존 세션이 있는 경우
    if (data.session) {
      // 쿠키에 세션 저장 확인
      try {
        const cookieKey = 'sb-access-token';
        const cookieExists = document.cookie.split('; ').some(row => row.startsWith(`${cookieKey}=`));
        
        if (!cookieExists) {
          document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
          document.cookie = `sb-refresh-token=${data.session.refresh_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        }
        
        // 로컬 스토리지에도 백업
        localStorage.setItem('supabase-auth-token', JSON.stringify([
          data.session.access_token,
          data.session.refresh_token
        ]));
      } catch (e) {
        // 쿠키/로컬 스토리지 접근 에러
      }
    }
    
    return data.session;
  } catch (err) {
    return null;
  }
};

// 세션 강제 설정 함수
export const forceSetSession = async (session: any) => {
  if (!session) return false;
  
  try {
    // 쿠키에 세션 저장
    document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    
    // 로컬 스토리지에도 백업
    localStorage.setItem('supabase-auth-token', JSON.stringify([
      session.access_token,
      session.refresh_token
    ]));
    
    // 세션 설정 확인
    const { data, error } = await supabase.auth.getSession();
    return !!data.session && !error;
  } catch (err) {
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