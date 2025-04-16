'use client'

import AppLayout from '@/components/layout/AppLayout'

export default function BusinessExpenseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
} 