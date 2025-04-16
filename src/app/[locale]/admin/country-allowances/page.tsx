'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Download, Upload, Plus, Pencil, Check, X, AlertCircle, CheckCircle2, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from "@/lib/supabase"
import type { CountryAllowance, CountryAllowanceFormData } from "@/types/country-allowances"
import * as XLSX from 'xlsx'

interface CountryAllowanceData {
  id: string;
  country_code: string;
  country_name_de: string;
  country_name_ko: string;
  full_day_amount: number;
  partial_day_amount: number;
  accommodation_amount: number;
}

export default function CountryAllowancesPage() {
  const t = useTranslations()
  const [countryAllowances, setCountryAllowances] = useState<CountryAllowanceData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CountryAllowanceFormData>({
    country_code: '',
    country_name_de: '',
    country_name_ko: '',
    full_day_amount: '',
    partial_day_amount: '',
    accommodation_amount: ''
  })
  const router = useRouter()
  const pathname = usePathname()
  const locale = pathname.split('/')[1]
  const [isDownloading, setIsDownloading] = useState(false)
  const [sortConfig, setSortConfig] = useState<{
    key: 'country_code' | 'country_name_de' | 'country_name_ko' | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('country_allowances')
        .select('*')
        .order('country_code')

      if (error) throw error
      setCountryAllowances(data || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('데이터 로드 중 오류가 발생했습니다.')
    }
  }

  // 데이터 로드
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        // 1. 현재 사용자의 role 확인
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.email) {
          toast.error('세션이 없습니다.')
          router.push(`/${locale}/expense-list`)
          return
        }

        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('email', session.user.email)
          .single()

        if (userProfile) {
          setUserRole(userProfile.role)
          // 관리자가 아닌 경우 접근 제한
          if (userProfile.role !== 'admin') {
            toast.error('관리자만 접근할 수 있습니다.')
            router.push(`/${locale}/expense-list`)
            return
          }
        }

        // 2. 국가별 출장 비용 데이터 로드
        const { data, error } = await supabase
          .from('country_allowances')
          .select('*')
          .order('country_code')

        if (error) throw error
        setCountryAllowances(data || [])

      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('데이터 로드 중 오류가 발생했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    initializeData()
  }, [])

  // 입력값 변경 처리
  const handleInputChange = (field: keyof CountryAllowanceFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      country_code: '',
      country_name_de: '',
      country_name_ko: '',
      full_day_amount: '',
      partial_day_amount: '',
      accommodation_amount: ''
    })
  }

  // 폼 유효성 검사
  const validateForm = () => {
    const codePattern = /^[A-Z]{2}(-[A-Z]{3})?$/
    if (!formData.country_code || !codePattern.test(formData.country_code)) {
      toast.error('국가 코드는 2자리(예: DE) 또는 2자리-3자리(예: AU-SYD) 형식이어야 합니다.')
      return false
    }
    if (!formData.country_name_de) {
      toast.error('독일어 국가명을 입력해주세요.')
      return false
    }
    if (!formData.country_name_ko) {
      toast.error('한국어 국가명을 입력해주세요.')
      return false
    }
    if (!formData.full_day_amount || isNaN(Number(formData.full_day_amount))) {
      toast.error('올바른 24시간 일당을 입력해주세요.')
      return false
    }
    if (!formData.partial_day_amount || isNaN(Number(formData.partial_day_amount))) {
      toast.error('올바른 8시간 미만 일당을 입력해주세요.')
      return false
    }
    if (!formData.accommodation_amount || isNaN(Number(formData.accommodation_amount))) {
      toast.error('올바른 숙박비 한도를 입력해주세요.')
      return false
    }
    return true
  }

  // 국가 코드 입력 처리
  const handleCountryCodeChange = (value: string) => {
    // 대문자로 변환하고 특수문자는 '-'만 허용
    const formattedValue = value.toUpperCase().replace(/[^A-Z-]/g, '')
    
    // 최대 6자리까지만 허용 (XX-XXX 형식)
    if (formattedValue.length <= 6) {
      handleInputChange('country_code', formattedValue)
    }
  }

  // 새로운 국가 정보 추가
  const handleAdd = async () => {
    if (!validateForm()) return

    try {
      const { error } = await supabase
        .from('country_allowances')
        .insert({
          country_code: formData.country_code.toUpperCase(),
          country_name_de: formData.country_name_de,
          country_name_ko: formData.country_name_ko,
          full_day_amount: Number(formData.full_day_amount),
          partial_day_amount: Number(formData.partial_day_amount),
          accommodation_amount: Number(formData.accommodation_amount)
        })

      if (error) throw error

      toast.success('새로운 국가 정보가 추가되었습니다.')
      setIsAddModalOpen(false)
      resetForm()
      // 데이터 새로고침
      window.location.reload()
    } catch (error) {
      console.error('Error adding country:', error)
      toast.error('국가 정보 추가 중 오류가 발생했습니다.')
    }
  }

  // Excel 파일 다운로드
  const handleExport = async () => {
    setIsDownloading(true)
    try {
      // 데이터 준비
      const exportData = countryAllowances.map(item => ({
        'country_code': item.country_code,
        'country_name_de': item.country_name_de,
        'country_name_ko': item.country_name_ko,
        'full_day_amount': item.full_day_amount,
        'partial_day_amount': item.partial_day_amount,
        'accommodation_amount': item.accommodation_amount
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Country Allowances");

      // 열 너비 설정
      const wscols = [
        { wch: 10 },  // 국가 코드
        { wch: 20 },  // 국가명 (독일어)
        { wch: 20 },  // 국가명 (한국어)
        { wch: 15 },  // 24시간 일당
        { wch: 15 },  // 8시간 미만 일당
        { wch: 15 }   // 숙박비 한도
      ];
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, "country-allowances.xlsx");
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('엑셀 파일 생성 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false)
    }
  };

  // Excel 파일 업로드
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      toast.error(t('countryAllowances.uploadDialog.noData'))
      return
    }

    setUploadStatus('processing')
    setUploadMessage(t('countryAllowances.uploadDialog.processing'))

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const worksheet = workbook.Sheets[workbook.SheetNames[0]]
          const jsonData = XLSX.utils.sheet_to_json(worksheet)

          if (jsonData.length === 0) {
            setUploadStatus('error')
            setUploadMessage(t('countryAllowances.uploadDialog.noData'))
            return
          }

          // 중복 제거를 위한 Map 사용
          const uniqueData = new Map()

          jsonData.forEach((row: any) => {
            const cleanNumber = (value: any) => {
              if (typeof value === 'string') {
                return parseFloat(value.replace(/[^0-9.-]/g, ''))
              }
              return value
            }

            // 영문 필드명으로 데이터 추출
            const countryCode = row['country_code']?.toString().trim()
            const countryNameDe = row['country_name_de']?.toString().trim()
            const countryNameKo = row['country_name_ko']?.toString().trim()
            const fullDayAmount = cleanNumber(row['full_day_amount'])
            const partialDayAmount = cleanNumber(row['partial_day_amount'])
            const accommodationAmount = cleanNumber(row['accommodation_amount'])

            if (
              countryCode &&
              countryNameDe &&
              !isNaN(fullDayAmount) &&
              !isNaN(partialDayAmount) &&
              !isNaN(accommodationAmount)
            ) {
              uniqueData.set(countryCode, {
                country_code: countryCode,
                country_name_de: countryNameDe,
                country_name_ko: countryNameKo || countryNameDe,
                full_day_amount: fullDayAmount,
                partial_day_amount: partialDayAmount,
                accommodation_amount: accommodationAmount
              })
            } else {
              console.warn('유효하지 않은 데이터:', row)
              setUploadMessage(t('countryAllowances.uploadDialog.invalidData'))
            }
          })

          const validData = Array.from(uniqueData.values())

          if (validData.length === 0) {
            setUploadStatus('error')
            setUploadMessage(t('countryAllowances.uploadDialog.invalidData'))
            return
          }

          const { error } = await supabase
            .from('country_allowances')
            .upsert(validData, {
              onConflict: 'country_code'
            })

          if (error) throw error

          setUploadStatus('success')
          setUploadMessage(t('countryAllowances.uploadDialog.uploadSuccess', { count: validData.length }))
          await loadData()
          // 1.5초 후에 다이얼로그 닫기
          setTimeout(() => {
            setIsDialogOpen(false)
          }, 1500)

        } catch (error) {
          console.error('Error processing file:', error)
          setUploadStatus('error')
          setUploadMessage(t('countryAllowances.uploadDialog.uploadError'))
        }
      }

      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('Error importing file:', error)
      setUploadStatus('error')
      setUploadMessage(t('countryAllowances.uploadDialog.uploadError'))
    }
  }

  // 수정할 국가 정보 로드
  const handleEdit = (allowance: CountryAllowanceData) => {
    if (allowance.id) {
      setSelectedId(allowance.id)
      setFormData({
        country_code: allowance.country_code,
        country_name_de: allowance.country_name_de,
        country_name_ko: allowance.country_name_ko,
        full_day_amount: allowance.full_day_amount.toString(),
        partial_day_amount: allowance.partial_day_amount.toString(),
        accommodation_amount: allowance.accommodation_amount.toString()
      })
      setIsEditModalOpen(true)
    }
  }

  // 국가 정보 수정
  const handleUpdate = async () => {
    if (!validateForm() || !selectedId) return

    try {
      const { error } = await supabase
        .from('country_allowances')
        .update({
          country_code: formData.country_code.toUpperCase(),
          country_name_de: formData.country_name_de,
          country_name_ko: formData.country_name_ko,
          full_day_amount: Number(formData.full_day_amount),
          partial_day_amount: Number(formData.partial_day_amount),
          accommodation_amount: Number(formData.accommodation_amount),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedId)

      if (error) throw error

      toast.success('국가 정보가 수정되었습니다.')
      setIsEditModalOpen(false)
      resetForm()
      setSelectedId(null)
      // 데이터 새로고침
      window.location.reload()
    } catch (error) {
      console.error('Error updating country:', error)
      toast.error('국가 정보 수정 중 오류가 발생했습니다.')
    }
  }

  // 삭제 처리
  const handleDelete = async (id: string) => {
    if (confirm('정말로 이 국가 정보를 삭제하시겠습니까?')) {
      try {
        const { error } = await supabase
          .from('country_allowances')
          .delete()
          .eq('id', id)

        if (error) throw error

        // 목록 새로고침
        setCountryAllowances(countryAllowances.filter(item => item.id !== id))
        toast.success('국가 정보가 삭제되었습니다.')
      } catch (error) {
        console.error('Error deleting country allowance:', error)
        toast.error('삭제 중 오류가 발생했습니다.')
      }
    }
  }

  // 정렬 처리 함수
  const handleSort = (key: 'country_code' | 'country_name_de' | 'country_name_ko') => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }

    setSortConfig({ key, direction });

    const sortedData = [...countryAllowances].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setCountryAllowances(sortedData);
  };

  // 정렬 상태에 따른 아이콘 표시
  const getSortIcon = (key: 'country_code' | 'country_name_de' | 'country_name_ko') => {
    if (sortConfig.key !== key) {
      return <ChevronsUpDown className="h-4 w-4 ml-1 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-4 w-4 ml-1" />
      : <ChevronDown className="h-4 w-4 ml-1" />;
  };

  if (userRole !== 'admin') {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <div className="flex-1 lg:ml-64">
          <div className="p-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-gray-500">
                  관리자만 접근할 수 있는 페이지입니다.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">국가별 출장 비용</h1>
          <p className="text-[12px] md:text-sm text-gray-500">국가별 출장 비용을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className={cn("gap-2", isDownloading && "loading-button")}
            onClick={handleExport}
            disabled={isDownloading}
          >
            <Download className="h-3 w-3 md:h-4 md:w-4" />
            내보내기
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-3 w-3 md:h-4 md:w-4" />
                불러오기
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('countryAllowances.uploadDialog.title')}</DialogTitle>
                <DialogDescription>
                  {t('countryAllowances.uploadDialog.description')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="excel-upload">{t('countryAllowances.uploadDialog.selectFile')}</Label>
                  <Input
                    id="excel-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImport}
                    disabled={uploadStatus === 'processing'}
                    className="cursor-pointer"
                    placeholder={t('countryAllowances.uploadDialog.noFileSelected')}
                  />
                </div>
                {uploadStatus !== 'idle' && (
                  <div className={`flex items-center gap-2 p-4 rounded-lg ${
                    uploadStatus === 'processing' ? 'bg-blue-50 text-blue-700' :
                    uploadStatus === 'success' ? 'bg-green-50 text-green-700' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {uploadStatus === 'processing' && <AlertCircle className="h-5 w-5" />}
                    {uploadStatus === 'success' && <CheckCircle2 className="h-5 w-5" />}
                    {uploadStatus === 'error' && <AlertCircle className="h-5 w-5" />}
                    <span>{uploadMessage}</span>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button 
            className="gap-2"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-3 w-3 md:h-4 md:w-4" />
            새로 추가
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-white shadow-sm">
          <CardContent className="py-1.5 px-3.5">
            <div className="space-y-0">
              <p className="text-[10px] md:text-xs font-medium text-muted-foreground">전체 국가</p>
              <p className="text-base md:text-lg font-bold leading-none mt-0.5">{countryAllowances.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  onClick={() => handleSort('country_code')}
                  className="cursor-pointer hover:bg-gray-50 text-[10px] md:text-xs whitespace-nowrap"
                >
                  <div className="flex items-center">
                    국가코드
                    {getSortIcon('country_code')}
                  </div>
                </TableHead>
                <TableHead 
                  onClick={() => handleSort('country_name_de')}
                  className="cursor-pointer hover:bg-gray-50 text-[10px] md:text-xs whitespace-nowrap"
                >
                  <div className="flex items-center">
                    독일어명
                    {getSortIcon('country_name_de')}
                  </div>
                </TableHead>
                <TableHead 
                  onClick={() => handleSort('country_name_ko')}
                  className="cursor-pointer hover:bg-gray-50 text-[10px] md:text-xs whitespace-nowrap"
                >
                  <div className="flex items-center">
                    한국어명
                    {getSortIcon('country_name_ko')}
                  </div>
                </TableHead>
                <TableHead className="text-right text-[10px] md:text-xs whitespace-nowrap">전일</TableHead>
                <TableHead className="text-right text-[10px] md:text-xs whitespace-nowrap">반일</TableHead>
                <TableHead className="text-right text-[10px] md:text-xs whitespace-nowrap">숙박비</TableHead>
                <TableHead className="w-[100px] text-[10px] md:text-xs whitespace-nowrap">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {countryAllowances.map((allowance) => (
                <TableRow key={allowance.id}>
                  <TableCell className="text-[12px] md:text-sm font-medium">{allowance.country_code}</TableCell>
                  <TableCell className="text-[12px] md:text-sm">{allowance.country_name_de}</TableCell>
                  <TableCell className="text-[12px] md:text-sm">{allowance.country_name_ko}</TableCell>
                  <TableCell className="text-[12px] md:text-sm">{allowance.full_day_amount}</TableCell>
                  <TableCell className="text-[12px] md:text-sm">{allowance.partial_day_amount}</TableCell>
                  <TableCell className="text-[12px] md:text-sm">{allowance.accommodation_amount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(allowance)}
                        className="text-[12px] md:text-sm hover:bg-gray-800 hover:text-white"
                      >
                        <Pencil className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(allowance.id)}
                        className="text-[12px] md:text-sm text-red-500 hover:bg-gray-800 hover:text-white"
                      >
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 새로운 국가 추가 모달 */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">새 국가 추가</DialogTitle>
            <DialogDescription className="text-[12px] md:text-sm">
              새로운 국가의 출장 비용 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[12px] md:text-sm">국가 코드</Label>
              <Input
                className="text-[12px] md:text-sm"
                placeholder="예: DE 또는 AU-SYD"
                value={formData.country_code}
                onChange={(e) => handleCountryCodeChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] md:text-sm">독일어 국가명</Label>
              <Input
                className="text-[12px] md:text-sm"
                placeholder="예: Deutschland"
                value={formData.country_name_de}
                onChange={(e) => handleInputChange('country_name_de', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] md:text-sm">한국어 국가명</Label>
              <Input
                className="text-[12px] md:text-sm"
                placeholder="예: 독일"
                value={formData.country_name_ko}
                onChange={(e) => handleInputChange('country_name_ko', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] md:text-sm">24시간 일당 (€)</Label>
              <Input
                className="text-[12px] md:text-sm"
                type="number"
                placeholder="0.00"
                value={formData.full_day_amount}
                onChange={(e) => handleInputChange('full_day_amount', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] md:text-sm">8시간 미만 일당 (€)</Label>
              <Input
                className="text-[12px] md:text-sm"
                type="number"
                placeholder="0.00"
                value={formData.partial_day_amount}
                onChange={(e) => handleInputChange('partial_day_amount', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[12px] md:text-sm">숙박비 한도 (€)</Label>
              <Input
                className="text-[12px] md:text-sm"
                type="number"
                placeholder="0.00"
                value={formData.accommodation_amount}
                onChange={(e) => handleInputChange('accommodation_amount', e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="text-[12px] md:text-sm" onClick={() => setIsAddModalOpen(false)}>
              취소
            </Button>
            <Button className="text-[12px] md:text-sm" onClick={handleAdd}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 국가 정보 수정 모달 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('countryAllowances.editDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('countryAllowances.editDialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm">{t('countryAllowances.form.countryCode.label')}</Label>
              <div className="space-y-1">
                <Input
                  value={formData.country_code}
                  onChange={(e) => handleCountryCodeChange(e.target.value)}
                  maxLength={6}
                  placeholder={t('countryAllowances.form.countryCode.placeholder')}
                />
                <p className="text-sm text-muted-foreground">
                  {t('countryAllowances.form.countryCode.description')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">{t('countryAllowances.form.countryNameDe.label')}</Label>
              <Input
                value={formData.country_name_de}
                onChange={(e) => handleInputChange('country_name_de', e.target.value)}
                placeholder={t('countryAllowances.form.countryNameDe.placeholder')}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">{t('countryAllowances.form.countryNameKo.label')}</Label>
              <Input
                value={formData.country_name_ko}
                onChange={(e) => handleInputChange('country_name_ko', e.target.value)}
                placeholder={t('countryAllowances.form.countryNameKo.placeholder')}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-sm">{t('countryAllowances.form.fullDayAmount.label')}</Label>
                <Input
                  type="number"
                  value={formData.full_day_amount}
                  onChange={(e) => handleInputChange('full_day_amount', e.target.value)}
                  placeholder={t('countryAllowances.form.fullDayAmount.placeholder')}
                  step="0.01"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">{t('countryAllowances.form.partialDayAmount.label')}</Label>
                <Input
                  type="number"
                  value={formData.partial_day_amount}
                  onChange={(e) => handleInputChange('partial_day_amount', e.target.value)}
                  placeholder={t('countryAllowances.form.partialDayAmount.placeholder')}
                  step="0.01"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">{t('countryAllowances.form.accommodationAmount.label')}</Label>
                <Input
                  type="number"
                  value={formData.accommodation_amount}
                  onChange={(e) => handleInputChange('accommodation_amount', e.target.value)}
                  placeholder={t('countryAllowances.form.accommodationAmount.placeholder')}
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditModalOpen(false)
              resetForm()
              setSelectedId(null)
            }}>
              {t('common.buttons.cancel')}
            </Button>
            <Button onClick={handleUpdate}>
              {t('common.buttons.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 