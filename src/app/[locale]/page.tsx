import { redirect } from 'next/navigation'
import { defaultLocale } from '@/i18n/settings'

export default function LocalePage({
  params,
}: {
  params: { locale: string }
}) {
  const locale = params?.locale || defaultLocale
  
  // 무조건 로그인 페이지로 리다이렉트
  redirect(`/${locale}/auth/login`)
} 