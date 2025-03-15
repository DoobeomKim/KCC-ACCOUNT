import { redirect } from 'next/navigation'
import { defaultLocale } from '@/i18n/settings'

export default async function LocalePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  // params를 await로 처리하고 기본값 설정
  const { locale = defaultLocale } = await params;
  
  redirect(`/${locale}/auth/login`)
} 