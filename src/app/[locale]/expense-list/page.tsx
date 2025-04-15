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
  meal_option?: boolean;
  calculated_totals?: any;
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
    newThisMonth: 0,
    newLastWeek: 0,
    monthlyTotal: 0
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
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const newThisMonth = data.filter(item => new Date(item.created_at) >= firstDayOfMonth).length
    const newLastWeek = data.filter(item => new Date(item.created_at) >= oneWeekAgo).length
    const monthlyTotal = data
      .filter(item => new Date(item.created_at) >= firstDayOfMonth)
      .reduce((sum, item) => sum + item.grand_total, 0)

    setStats({
      total,
      newThisMonth,
      newLastWeek,
      monthlyTotal
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
  const handleRowClick = async (id: string) => {
    try {
      // 1. 데이터 로딩 중 표시
      toast.loading('데이터를 불러오는 중...');
      
      // 2. DB에서 필요한 모든 데이터 가져오기
      const { data: expenseData, error: expenseError } = await supabase
        .from('business_expenses')
        .select('*')
        .eq('id', id)
        .single();
        
      if (expenseError) throw expenseError;
      
      // 3. 방문 정보 가져오기
      const { data: visitsData, error: visitsError } = await supabase
        .from('expense_visits')
        .select('*')
        .eq('expense_id', id);
        
      if (visitsError) throw visitsError;
      
      // 4. 교통비 정보 가져오기
      const { data: transportationData, error: transportationError } = await supabase
        .from('expense_transportation')
        .select('*')
        .eq('expense_id', id);
        
      if (transportationError) throw transportationError;
      
      // 5. 숙박비 정보 가져오기
      const { data: accommodationData, error: accommodationError } = await supabase
        .from('expense_accommodations')
        .select('*')
        .eq('expense_id', id);
        
      if (accommodationError) throw accommodationError;
      
      // 6. 접대비 정보 가져오기
      const { data: entertainmentData, error: entertainmentError } = await supabase
        .from('expense_entertainment')
        .select('*')
        .eq('expense_id', id);
        
      if (entertainmentError) throw entertainmentError;
      
      // 7. 기타 비용 정보 가져오기
      const { data: miscellaneousData, error: miscellaneousError } = await supabase
        .from('expense_miscellaneous')
        .select('*')
        .eq('expense_id', id);
        
      if (miscellaneousError) throw miscellaneousError;
      
      // 8. 데이터 통합하여 세션 스토리지에 저장할 객체 구성
      const formData = {
        name: expenseData.name || '',
        startDate: expenseData.start_date ? new Date(expenseData.start_date) : new Date(),
        endDate: expenseData.end_date ? new Date(expenseData.end_date) : new Date(),
        startTime: expenseData.start_time || '',
        endTime: expenseData.end_time || '',
        purpose: expenseData.purpose || '',
        projectName: expenseData.project_name || '',
        projectNumber: expenseData.project_number || '',
        visits: visitsData.map(visit => ({
          date: visit.date ? new Date(visit.date) : undefined,
          companyName: visit.company_name || '',
          city: visit.city || '',
          description: visit.description || '',
          isExpanded: false,
          datePickerOpen: false
        })) || [],
        transportation: transportationData.map(item => ({
          date: item.date ? new Date(item.date) : undefined,
          type: item.type === 'km_pauschale' ? 'km_pauschale' : item.type,
          country: item.country || '',
          companyName: item.company_name || '',
          paidBy: item.paid_by,
          vat: item.vat ? String(item.vat) : '',
          totalAmount: item.amount ? String(item.amount) : '',
          mileage: item.mileage ? String(item.mileage) : '',
          licensePlate: item.license_plate || '',
          isExpanded: false,
          datePickerOpen: false
        })) || [],
        accommodation: accommodationData.map(item => ({
          startDate: item.start_date ? new Date(item.start_date) : undefined,
          endDate: item.end_date ? new Date(item.end_date) : undefined,
          type: item.type,
          country: item.country || '',
          hotelName: item.hotel_name || '',
          paidBy: item.paid_by,
          vat: item.vat ? String(item.vat) : '',
          totalAmount: item.total_amount ? String(item.total_amount) : '',
          isExpanded: false
        })) || [],
        entertainment: entertainmentData.map(item => ({
          date: item.date ? new Date(item.date) : undefined,
          type: item.type,
          country: item.country || '',
          companyName: item.company_name || '',
          paidBy: item.paid_by,
          vat: item.vat ? String(item.vat) : '',
          totalAmount: item.amount ? String(item.amount) : '',
          isExpanded: false,
          datePickerOpen: false
        })) || [],
        miscellaneous: miscellaneousData.map(item => ({
          date: item.date ? new Date(item.date) : undefined,
          type: item.type,
          country: item.country || '',
          companyName: item.company_name || '',
          paidBy: item.paid_by,
          vat: item.vat ? String(item.vat) : '',
          totalAmount: item.amount ? String(item.amount) : '',
          description: item.description || '',
          isExpanded: false,
          datePickerOpen: false
        })) || [],
        mealOption: expenseData.meal_option || false,
        calculatedTotals: expenseData.calculated_totals || {}
      };
      
      // 9. 세션 스토리지에 데이터 저장
      sessionStorage.setItem('expenseFormData', JSON.stringify(formData));
      sessionStorage.setItem('expenseEditId', id);
      
      toast.dismiss();
      toast.success('데이터가 로드되었습니다.');
      
      // 10. 요약 페이지로 이동
      router.push(`/${locale}/business-expense/summary?id=${id}`);
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
      toast.dismiss();
      toast.error('데이터 로딩 중 오류가 발생했습니다.');
      
      // 오류 발생 시 세션 데이터 없이 이동
      router.push(`/${locale}/business-expense/summary?id=${id}`);
    }
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

  // 총 금액 계산 헬퍼 함수
  const calculateTotalFromJson = (calculatedTotals: any): string => {
    if (!calculatedTotals) return formatEuro(0, false);
    
    try {
      // calculatedTotals이 문자열인 경우 파싱
      const totals = typeof calculatedTotals === 'string' 
        ? JSON.parse(calculatedTotals) 
        : calculatedTotals;
      
      const transportation = totals.transportation?.total || 0;
      const accommodation = totals.accommodation?.total || 0;
      const entertainment = totals.entertainment?.total || 0;
      const miscellaneous = totals.miscellaneous?.total || 0;
      const mealAllowance = totals.mealAllowance?.amount || 0;
      
      const total = transportation + accommodation + entertainment + miscellaneous + mealAllowance;
      
      return formatEuro(total, false);
    } catch (error) {
      console.error('Error calculating total:', error);
      return formatEuro(0, false);
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
              <Button variant="outline" className="gap-2 hover:bg-gray-800 hover:text-white cursor-pointer">
                <ArrowUpToLine className="h-4 w-4" />
                내보내기
              </Button>
              <Link href={`/${locale}/business-expense`}>
                <Button className="gap-2 hover:bg-gray-800 hover:text-white cursor-pointer">
                  <Plus className="h-4 w-4" />
                  {t('businessExpense')}
                </Button>
              </Link>
            </div>
          </div>

          {/* 통계 카드 섹션 */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-white shadow-sm">
                <CardContent className="py-1.5 px-3.5">
                  <div className="space-y-0">
                    <p className="text-xs font-medium text-muted-foreground">전체 기록</p>
                    <p className="text-lg font-bold leading-none mt-0.5">{stats.total}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white shadow-sm">
                <CardContent className="py-1.5 px-3.5">
                  <div className="space-y-0">
                    <p className="text-xs font-medium text-muted-foreground">이번달 신규</p>
                    <p className="text-lg font-bold leading-none mt-0.5">{stats.newThisMonth}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white shadow-sm">
                <CardContent className="py-1.5 px-3.5">
                  <div className="space-y-0">
                    <p className="text-xs font-medium text-muted-foreground">이번달 총 금액</p>
                    <p className="text-lg font-bold leading-none mt-0.5">{formatEuro(stats.monthlyTotal)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white shadow-sm">
                <CardContent className="py-1.5 px-3.5">
                  <div className="space-y-0">
                    <p className="text-xs font-medium text-muted-foreground">최근 7일 신규</p>
                    <p className="text-lg font-bold leading-none mt-0.5">{stats.newLastWeek}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
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
                        {calculateTotalFromJson(expense.calculated_totals)}
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
                            size="sm"
                            onClick={(e) => handleDelete(e, expense.id)}
                            className="text-red-500 hover:bg-gray-800 hover:text-white cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
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