import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type FormDataPolicy = 'default' | 'strict'

interface FormDataPolicyConfig {
  onBrowserClose: boolean
  onLogout: boolean
  onNavigation: boolean
  onRefresh: boolean
}

const defaultConfig: FormDataPolicyConfig = {
  onBrowserClose: true,
  onLogout: true,
  onNavigation: false,
  onRefresh: false
}

const strictConfig: FormDataPolicyConfig = {
  onBrowserClose: true,
  onLogout: true,
  onNavigation: true,
  onRefresh: true
}

// 디바운스 시간 설정 (밀리초)
const DEBOUNCE_DELAY = 500;

export function useFormDataPolicy(storageKey: string) {
  const [policy, setPolicy] = useState<FormDataPolicy>('default')
  const pathname = usePathname()
  const router = useRouter()

  // 정책 설정 가져오기
  useEffect(() => {
    const fetchPolicy = async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('form_data_policy')
        .single()

      if (!error && data) {
        setPolicy(data.form_data_policy as FormDataPolicy)
      }
    }

    fetchPolicy()
  }, [])

  // 페이지 이동 감지
  useEffect(() => {
    const config = policy === 'strict' ? strictConfig : defaultConfig
    if (config.onNavigation) {
      localStorage.removeItem(storageKey)
    }
  }, [pathname, policy, storageKey])

  // 새로고침 감지
  useEffect(() => {
    const config = policy === 'strict' ? strictConfig : defaultConfig
    if (config.onRefresh) {
      const handleBeforeUnload = () => {
        localStorage.removeItem(storageKey)
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [policy, storageKey])

  // 로그아웃 시 데이터 삭제
  const clearOnLogout = () => {
    localStorage.removeItem(storageKey)
  }

  // 브라우저 종료 시 데이터 삭제 (sessionStorage 사용)
  useEffect(() => {
    const config = policy === 'strict' ? strictConfig : defaultConfig
    if (config.onBrowserClose) {
      const savedData = localStorage.getItem(storageKey)
      if (savedData) {
        sessionStorage.setItem(storageKey, savedData)
        localStorage.removeItem(storageKey)
      }
    }
  }, [policy, storageKey])

  // 디바운스 타이머 참조
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 데이터 저장 (디바운싱 적용)
  const saveFormData = (data: any) => {
    console.log('saveFormData 호출됨', storageKey);
    
    // 이전 타이머가 있으면 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // 설정된 시간 후에 저장 실행
    debounceTimerRef.current = setTimeout(() => {
      const config = policy === 'strict' ? strictConfig : defaultConfig
      if (config.onBrowserClose) {
        console.log('sessionStorage에 데이터 저장');
        sessionStorage.setItem(storageKey, JSON.stringify(data))
      } else {
        console.log('localStorage에 데이터 저장');
        localStorage.setItem(storageKey, JSON.stringify(data))
      }
      console.log('데이터 저장 완료');
      debounceTimerRef.current = null;
    }, DEBOUNCE_DELAY);
  }

  // 데이터 로드
  const loadFormData = () => {
    const config = policy === 'strict' ? strictConfig : defaultConfig
    const storage = config.onBrowserClose ? sessionStorage : localStorage
    const savedData = storage.getItem(storageKey)
    return savedData ? JSON.parse(savedData) : null
  }

  return {
    saveFormData,
    loadFormData,
    clearOnLogout,
    policy
  }
} 