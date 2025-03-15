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
import { Download, Upload, Plus, Pencil, Check, X, AlertCircle, CheckCircle2, Trash2 } from "lucide-react"
import Sidebar from "@/components/layout/Sidebar"
import { supabase } from "@/lib/supabase"
import type { CountryAllowance, CountryAllowanceFormData } from "@/types/country-allowances"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"
import { useRouter, usePathname } from 'next/navigation'

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
  const handleExport = () => {
    try {
      // 데이터 준비
      const exportData = countryAllowances.map(item => ({
        '국가 코드': item.country_code,
        '국가명 (독일어)': item.country_name_de,
        '국가명 (한국어)': item.country_name_ko,
        '24시간 일당': item.full_day_amount,
        '8시간 미만 일당': item.partial_day_amount,
        '숙박비 한도': item.accommodation_amount
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
    }
  };

  // Excel 파일 업로드
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      toast.error('파일을 선택해주세요.')
      return
    }

    setUploadStatus('processing')
    setUploadMessage('파일을 처리하는 중입니다...')

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
            setUploadMessage('파일에 데이터가 없습니다.')
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

            const countryCode = row.country_code?.toString().trim()
            const countryNameDe = row.country_name_de?.toString().trim()
            const countryNameKo = row.country_name_ko?.toString().trim() || countryNameDe
            const fullDayAmount = cleanNumber(row.full_day_amount)
            const partialDayAmount = cleanNumber(row.partial_day_amount)
            const accommodationAmount = cleanNumber(row.accommodation_amount)

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
                country_name_ko: countryNameKo,
                full_day_amount: fullDayAmount,
                partial_day_amount: partialDayAmount,
                accommodation_amount: accommodationAmount
              })
            } else {
              console.warn('Invalid row:', row)
            }
          })

          const validData = Array.from(uniqueData.values())

          if (validData.length === 0) {
            setUploadStatus('error')
            setUploadMessage('유효한 데이터가 없습니다. 모든 필수 필드가 올바르게 입력되었는지 확인해주세요.')
            return
          }

          const { error } = await supabase
            .from('country_allowances')
            .upsert(validData, {
              onConflict: 'country_code'
            })

          if (error) throw error

          setUploadStatus('success')
          setUploadMessage(`${validData.length}개의 데이터가 성공적으로 업로드되었습니다.`)
          await loadData()
          setIsDialogOpen(false)

        } catch (error) {
          console.error('Error processing file:', error)
          setUploadStatus('error')
          setUploadMessage(error instanceof Error ? error.message : '파일 처리 중 오류가 발생했습니다.')
        }
      }

      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('Error importing file:', error)
      setUploadStatus('error')
      setUploadMessage('파일 가져오기 중 오류가 발생했습니다.')
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

  if (userRole !== 'admin') {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar />
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
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 lg:ml-64">
        <div className="p-8 space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">국가별 출장 비용 관리</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                엑셀 다운로드
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    엑셀 업로드
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>엑셀 파일 업로드</DialogTitle>
                    <DialogDescription>
                      국가별 출장 비용 데이터가 포함된 엑셀 파일을 업로드해주세요.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                      <Label htmlFor="excel-upload">파일 선택</Label>
                      <Input
                        id="excel-upload"
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImport}
                        disabled={uploadStatus === 'processing'}
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
                <Plus className="h-4 w-4" />
                새로 추가
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>국가 코드</TableHead>
                    <TableHead>국가명 (독일어)</TableHead>
                    <TableHead>국가명 (한국어)</TableHead>
                    <TableHead className="text-right">24시간 일당</TableHead>
                    <TableHead className="text-right">8시간 미만 일당</TableHead>
                    <TableHead className="text-right">숙박비 한도</TableHead>
                    <TableHead className="w-[100px]">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countryAllowances.map((allowance) => (
                    <TableRow key={allowance.id}>
                      <TableCell className="font-medium">
                        {allowance.country_code}
                      </TableCell>
                      <TableCell>{allowance.country_name_de}</TableCell>
                      <TableCell>{allowance.country_name_ko}</TableCell>
                      <TableCell className="text-right">
                        {allowance.full_day_amount.toFixed(2)}€
                      </TableCell>
                      <TableCell className="text-right">
                        {allowance.partial_day_amount.toFixed(2)}€
                      </TableCell>
                      <TableCell className="text-right">
                        {allowance.accommodation_amount.toFixed(2)}€
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(allowance)}
                          className="hover:bg-gray-800 hover:text-white cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(allowance.id)}
                          className="text-red-500 hover:bg-gray-800 hover:text-white cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 새로운 국가 추가 모달 */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새로운 국가 정보 추가</DialogTitle>
            <DialogDescription>
              새로운 국가의 출장 비용 정보를 입력해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>국가 코드</Label>
              <div className="space-y-1">
                <Input
                  value={formData.country_code}
                  onChange={(e) => handleCountryCodeChange(e.target.value)}
                  maxLength={6}
                  placeholder="DE 또는 AU-SYD"
                />
                <p className="text-sm text-muted-foreground">
                  기본 국가: 2자리 코드 (예: DE)<br />
                  도시 구분 필요시: 2자리-3자리 코드 (예: AU-SYD)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>국가명 (독일어)</Label>
              <Input
                value={formData.country_name_de}
                onChange={(e) => handleInputChange('country_name_de', e.target.value)}
                placeholder="Deutschland"
              />
            </div>

            <div className="space-y-2">
              <Label>국가명 (한국어)</Label>
              <Input
                value={formData.country_name_ko}
                onChange={(e) => handleInputChange('country_name_ko', e.target.value)}
                placeholder="독일"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>24시간 일당 (€)</Label>
                <Input
                  type="number"
                  value={formData.full_day_amount}
                  onChange={(e) => handleInputChange('full_day_amount', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label>8시간 미만 일당 (€)</Label>
                <Input
                  type="number"
                  value={formData.partial_day_amount}
                  onChange={(e) => handleInputChange('partial_day_amount', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label>숙박비 한도 (€)</Label>
                <Input
                  type="number"
                  value={formData.accommodation_amount}
                  onChange={(e) => handleInputChange('accommodation_amount', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAdd}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 국가 정보 수정 모달 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>국가 정보 수정</DialogTitle>
            <DialogDescription>
              국가의 출장 비용 정보를 수정해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>국가 코드</Label>
              <div className="space-y-1">
                <Input
                  value={formData.country_code}
                  onChange={(e) => handleCountryCodeChange(e.target.value)}
                  maxLength={6}
                  placeholder="DE 또는 AU-SYD"
                />
                <p className="text-sm text-muted-foreground">
                  기본 국가: 2자리 코드 (예: DE)<br />
                  도시 구분 필요시: 2자리-3자리 코드 (예: AU-SYD)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>국가명 (독일어)</Label>
              <Input
                value={formData.country_name_de}
                onChange={(e) => handleInputChange('country_name_de', e.target.value)}
                placeholder="Deutschland"
              />
            </div>

            <div className="space-y-2">
              <Label>국가명 (한국어)</Label>
              <Input
                value={formData.country_name_ko}
                onChange={(e) => handleInputChange('country_name_ko', e.target.value)}
                placeholder="독일"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>24시간 일당 (€)</Label>
                <Input
                  type="number"
                  value={formData.full_day_amount}
                  onChange={(e) => handleInputChange('full_day_amount', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label>8시간 미만 일당 (€)</Label>
                <Input
                  type="number"
                  value={formData.partial_day_amount}
                  onChange={(e) => handleInputChange('partial_day_amount', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label>숙박비 한도 (€)</Label>
                <Input
                  type="number"
                  value={formData.accommodation_amount}
                  onChange={(e) => handleInputChange('accommodation_amount', e.target.value)}
                  placeholder="0.00"
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
              취소
            </Button>
            <Button onClick={handleUpdate}>
              수정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 