'use client'

import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LayoutDashboard, Users, Calendar, TrendingUp } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import { defaultLocale } from '@/i18n/settings'

export default function DashboardPage() {
  const t = useTranslations('navigation')
  const params = useParams()
  const locale = (params?.locale as string) || defaultLocale

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 lg:ml-64">
        <div className="p-8 space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">{t('dashboard')}</h1>
          </div>

          {/* 상단 통계 카드 섹션 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 매출</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€45,231.89</div>
                <p className="text-xs text-muted-foreground">+20.1% 전월 대비</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">신규 고객</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+2,350</div>
                <p className="text-xs text-muted-foreground">+180.1% 전월 대비</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">판매량</CardTitle>
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+12,234</div>
                <p className="text-xs text-muted-foreground">+19% 전월 대비</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">활성 사용자</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+573</div>
                <p className="text-xs text-muted-foreground">+201 전월 대비</p>
              </CardContent>
            </Card>
          </div>

          {/* 중간 차트 섹션 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>진행 상태별 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  차트가 이곳에 들어갈 예정입니다
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>요약 정보</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">잔여 수량</span>
                    <span className="font-bold">18</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">총 금액</span>
                    <span className="font-bold">€11,273,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">평균 단가</span>
                    <span className="font-bold">€39,000</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 하단 그래프 섹션 */}
          <Card>
            <CardHeader>
              <CardTitle>일별 리드 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                그래프가 이곳에 들어갈 예정입니다
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 