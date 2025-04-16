'use client'

import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LayoutDashboard, Users, Calendar, TrendingUp } from 'lucide-react'
import { defaultLocale } from '@/i18n/settings'

export default function DashboardPage() {
  const t = useTranslations('navigation')
  const params = useParams()
  const locale = (params?.locale as string) || defaultLocale

  return (
    <div className="p-4 space-y-6">
      {/* 모바일 헤더 */}
      <header className="space-y-1">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">{t('dashboard')}</h1>
        <p className="text-sm text-muted-foreground">오늘의 주요 지표를 확인하세요</p>
      </header>

      {/* 주요 지표 섹션 */}
      <section aria-label="핵심 지표" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Card className="py-4 active:scale-98 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-4 min-h-[48px]">
              <CardTitle className="text-sm font-medium text-gray-900">총 매출</CardTitle>
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4">
              <div className="text-lg md:text-2xl font-bold">€45,231.89</div>
              <p className="text-xs text-gray-600">+20.1% 전월 대비</p>
            </CardContent>
          </Card>
          <Card className="py-4 active:scale-98 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-4 min-h-[48px]">
              <CardTitle className="text-sm font-medium text-gray-900">신규 고객</CardTitle>
              <Users className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4">
              <div className="text-lg md:text-2xl font-bold">+2,350</div>
              <p className="text-xs text-gray-600">+180.1% 전월 대비</p>
            </CardContent>
          </Card>
          <Card className="py-4 active:scale-98 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-4 min-h-[48px]">
              <CardTitle className="text-sm font-medium text-gray-900">판매량</CardTitle>
              <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4">
              <div className="text-lg md:text-2xl font-bold">+12,234</div>
              <p className="text-xs text-gray-600">+19% 전월 대비</p>
            </CardContent>
          </Card>
          <Card className="py-4 active:scale-98 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-4 min-h-[48px]">
              <CardTitle className="text-sm font-medium text-gray-900">활성 사용자</CardTitle>
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4">
              <div className="text-lg md:text-2xl font-bold">+573</div>
              <p className="text-xs text-gray-600">+201 전월 대비</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 차트 섹션 */}
      <section aria-label="상세 분석" className="space-y-3">
        <div className="grid gap-3 grid-cols-1">
          <Card>
            <CardHeader className="px-4">
              <CardTitle className="text-sm font-medium text-gray-900">진행 상태별 현황</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                차트가 이곳에 들어갈 예정입니다
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="px-4">
              <CardTitle className="text-sm font-medium text-gray-900">요약 정보</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center min-h-[48px]">
                  <span className="text-sm text-gray-600">잔여 수량</span>
                  <span className="text-lg font-bold">18</span>
                </div>
                <div className="flex justify-between items-center min-h-[48px]">
                  <span className="text-sm text-gray-600">총 금액</span>
                  <span className="text-lg font-bold">€11,273,000</span>
                </div>
                <div className="flex justify-between items-center min-h-[48px]">
                  <span className="text-sm text-gray-600">평균 단가</span>
                  <span className="text-lg font-bold">€39,000</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
} 