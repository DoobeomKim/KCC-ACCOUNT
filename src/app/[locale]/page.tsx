import { redirect } from 'next/navigation'

export default function LocalePage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  redirect(`/${locale}/auth/login`)
} 