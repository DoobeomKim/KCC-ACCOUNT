'use client'

import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowUpToLine,
  Download,
  Plus,
  Search,
  Users,
  UserPlus,
  UserCheck,
  Activity,
  Settings,
  Loader2,
  FileText,
  Trash2
} from "lucide-react"
import Sidebar from "@/components/layout/Sidebar"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatEuro } from '@/lib/utils'
import { toast } from 'sonner'

// 출장 경비 타입 정의
interface ExpenseItem {
  id: string;
  registration_number: string;
  user_email: string;
  name: string;
  start_date: string;
  end_date: string;
  purpose: string;
  status: string;
  transportation_total: number;
  accommodation_total: number;
  entertainment_total: number;
  meal_allowance: number;
  grand_total: number;
  created_at: string;
}

export default function ExpenseListPage() {
  const t = useTranslations('navigation')
  const pathname = usePathname()
  const locale = pathname.split('/')[1]
  const router = useRouter()
  const [userRole, setUserRole] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    active: 0,
    activities: 0
  })
  
  // 사용자 권한 확인
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        setUserEmail(session.user.email)
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('email', session.user.email)
          .single()

        if (userProfile) {
          setUserRole(userProfile.role)
        }
      }
    }
    checkUserRole()
  }, [])

  // 출장 경비 데이터 가져오기
  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true)
      try {
        let query;
        
        // 관리자는 모든 데이터를 볼 수 있고, 일반 사용자는 자신의 데이터만 볼 수 있음
        if (userRole === 'admin') {
          query = supabase
            .from('expense_summary')
            .select('*')
        } else {
          query = supabase
            .from('expense_summary')
            .select('*')
            .eq('user_email', userEmail)
        }
        
        // 상태 필터 적용
        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter)
        }
        
        // 검색어 필터 적용
        if (searchTerm) {
          query = query.or(`name.ilike.%${searchTerm}%,purpose.ilike.%${searchTerm}%,registration_number.ilike.%${searchTerm}%`)
        }
        
        // 최신순으로 정렬
        query = query.order('created_at', { ascending: false })
        
        const { data, error } = await query
        
        if (error) {
          console.error('Error fetching expenses:', error)
          return
        }
        
        setExpenses(data || [])
        
        // 통계 정보 업데이트
        updateStats(data || [])
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }
    
    // 사용자 이메일이 설정된 후에만 데이터 가져오기
    if (userEmail) {
      fetchExpenses()
    }
  }, [userEmail, userRole, statusFilter, searchTerm])
  
  // 통계 정보 업데이트
  const updateStats = (data: ExpenseItem[]) => {
    const total = data.length
    const newItems = data.filter(item => {
      const createdDate = new Date(item.created_at)
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      return createdDate >= oneWeekAgo
    }).length
    const active = data.filter(item => item.status === 'submitted' || item.status === 'approved').length
    
    setStats({
      total,
      new: newItems,
      active,
      activities: Math.floor(total * 0.8) // 활동 수는 임의로 계산 (실제로는 다른 방식으로 계산할 수 있음)
    })
  }
  
  // 상태에 따른 스타일 및 텍스트 반환
  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'draft':
        return { class: 'bg-gray-100 text-gray-800', text: '임시저장' }
      case 'submitted':
        return { class: 'bg-blue-100 text-blue-800', text: '저장됨' }
      case 'approved':
        return { class: 'bg-green-100 text-green-800', text: '승인됨' }
      case 'rejected':
        return { class: 'bg-red-100 text-red-800', text: '반려됨' }
      default:
        return { class: 'bg-gray-100 text-gray-800', text: status }
    }
  }
  
  // 날짜 형식 변환
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  
  // 출장 기간 표시
  const formatDateRange = (startDate: string, endDate: string) => {
    return `${formatDate(startDate)} ~ ${formatDate(endDate)}`
  }
  
  // 행 클릭 핸들러
  const handleRowClick = (id: string) => {
    router.push(`/${locale}/business-expense/summary?id=${id}`)
  }
  
  // PDF 저장 핸들러
  const handleSavePDF = (e: React.MouseEvent, id: string) => {
    e.stopPropagation() // 이벤트 버블링 방지
    toast.info('PDF 저장 기능은 아직 구현되지 않았습니다.')
  }
  
  // 삭제 핸들러
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation() // 이벤트 버블링 방지
    
    if (confirm('정말로 이 출장 경비 기록을 삭제하시겠습니까?')) {
      try {
        // 관련 테이블의 데이터 삭제
        await supabase.from('expense_visits').delete().eq('expense_id', id)
        await supabase.from('expense_transportation').delete().eq('expense_id', id)
        await supabase.from('expense_entertainment').delete().eq('expense_id', id)
        
        // 숙박 정보 삭제 (조식 정보도 함께 삭제)
        const { data: accommodations } = await supabase
          .from('expense_accommodations')
          .select('id')
          .eq('expense_id', id)
        
        if (accommodations) {
          for (const accommodation of accommodations) {
            await supabase
              .from('expense_accommodation_breakfasts')
              .delete()
              .eq('accommodation_id', accommodation.id)
          }
        }
        
        await supabase.from('expense_accommodations').delete().eq('expense_id', id)
        
        // 마지막으로 기본 정보 삭제
        const { error } = await supabase.from('business_expenses').delete().eq('id', id)
        
        if (error) {
          throw error
        }
        
        // 성공 메시지 표시
        toast.success('출장 경비 기록이 삭제되었습니다.')
        
        // 목록 새로고침 (현재 목록에서 삭제된 항목 제거)
        setExpenses(expenses.filter(expense => expense.id !== id))
      } catch (error) {
        console.error('삭제 오류:', error)
        toast.error('삭제 중 오류가 발생했습니다.')
      }
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 lg:ml-64">
        <div className="p-8 space-y-8">
          {/* 헤더 섹션 */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('expenseList')}</h1>
              <p className="text-gray-500">출장 경비 기록을 관리하고 조회합니다.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <ArrowUpToLine className="h-4 w-4" />
                내보내기
              </Button>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                CSV 다운로드
              </Button>
              <Link href={`/${locale}/business-expense`}>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('businessExpense')}
                </Button>
              </Link>
            </div>
          </div>

          {/* 통계 카드 섹션 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium">전체 기록</span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold">{stats.total}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium">최근 7일 신규</span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold">{stats.new}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium">활성 기록</span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold">{stats.active}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-gray-500" />
                  <span className="text-sm font-medium">활동</span>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold">{stats.activities}</span>
                </div>
              </CardContent>
            </Card>
            {userRole === 'admin' && (
              <Link href={`/${locale}/admin/country-allowances`}>
                <Card className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-gray-500" />
                      <span className="text-sm font-medium">국가별 출장 비용 관리</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-sm text-gray-500">관리자 전용 설정</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>

          {/* 필터 및 검색 섹션 */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="모든 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 상태</SelectItem>
                  <SelectItem value="draft">임시저장</SelectItem>
                  <SelectItem value="submitted">저장됨</SelectItem>
                  <SelectItem value="approved">승인됨</SelectItem>
                  <SelectItem value="rejected">반려됨</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="이름, 목적, 등록번호 검색..."
                className="pl-10 w-[300px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* 테이블 섹션 */}
          <div className="bg-white rounded-lg border">
            {loading ? (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                <span className="ml-2 text-gray-500">데이터를 불러오는 중...</span>
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex flex-col justify-center items-center p-8">
                <p className="text-gray-500 mb-4">출장 경비 데이터가 없습니다.</p>
                <Link href={`/${locale}/business-expense`}>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    새 출장 경비 등록하기
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>등록번호</TableHead>
                    <TableHead>출장자</TableHead>
                    <TableHead>출장 기간</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>총 금액</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow 
                      key={expense.id} 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(expense.id)}
                    >
                      <TableCell>{expense.registration_number}</TableCell>
                      <TableCell className="font-medium">{expense.name}</TableCell>
                      <TableCell>{formatDateRange(expense.start_date, expense.end_date)}</TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getStatusStyle(expense.status).class
                        }`}>
                          {getStatusStyle(expense.status).text}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatEuro(expense.grand_total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleSavePDF(e, expense.id)}
                            title="PDF 저장"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDelete(e, expense.id)}
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 