'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Upload, X, File as FileIcon, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Sidebar from '@/components/layout/Sidebar'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { format as dateFormat } from 'date-fns'
import { formatNumber } from '@/lib/utils'
import { ExpenseForm } from '@/types/expense'

// 파일 업로드 제한 상수
const FILE_UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB in bytes
  MAX_TOTAL_FILES: 50,
}

export default function BusinessExpenseAttachmentsPage() {
  const t = useTranslations()
  const router = useRouter()
  const { locale } = useParams()
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [formData, setFormData] = useState<ExpenseForm | null>(null)

  // 이전 단계에서 입력한 데이터와 파일 목록 복원
  useEffect(() => {
    const savedData = sessionStorage.getItem('expenseFormData')
    if (!savedData) {
      toast.error(t('expense.attachments.noData'))
      router.push(`/${locale}/business-expense`)
      return
    }

    // 저장된 파일 목록 복원
    const savedFiles = sessionStorage.getItem('expenseAttachments')
    if (savedFiles) {
      const fileData = JSON.parse(savedFiles)
      // FileList 객체 생성
      const fileArray = fileData.map((file: any) => {
        return new File(
          [base64ToBlob(file.data, file.type)],
          file.name,
          { type: file.type }
        )
      })
      setFiles(fileArray)
    }
  }, [])

  useEffect(() => {
    // 세션 스토리지에서 데이터 로드
    const savedData = sessionStorage.getItem('expenseFormData')
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData)
        setFormData(parsedData)
      } catch (error) {
        console.error('Error parsing form data:', error)
      }
    }
  }, [])

  // 파일 목록이 변경될 때마다 sessionStorage에 저장
  useEffect(() => {
    const saveFiles = async () => {
      if (files.length > 0) {
        const fileData = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            type: file.type,
            data: await fileToBase64(file)
          }))
        )
        sessionStorage.setItem('expenseAttachments', JSON.stringify(fileData))
      } else {
        sessionStorage.removeItem('expenseAttachments')
      }
    }
    saveFiles()
  }, [files])

  // File 객체를 Base64 문자열로 변환
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Data URL에서 Base64 부분만 추출
          const base64 = reader.result.split(',')[1]
          resolve(base64)
        }
      }
      reader.onerror = reject
    })
  }

  // Base64 문자열을 Blob으로 변환
  const base64ToBlob = (base64: string, type: string): Blob => {
    const binaryString = window.atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return new Blob([bytes], { type: type })
  }

  // 파일 검증 함수
  const validateFiles = (newFiles: File[]): boolean => {
    // 폴더 체크 (폴더는 size가 0이고 type이 빈 문자열)
    const folders = newFiles.filter(file => file.size === 0 && file.type === '')
    if (folders.length > 0) {
      toast.error(t('expense.attachments.noFolders'))
      return false
    }

    // 파일 개수 체크
    if (files.length + newFiles.length > FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_FILES) {
      toast.error(t('expense.attachments.tooManyFiles', { max: FILE_UPLOAD_CONSTRAINTS.MAX_TOTAL_FILES }))
      return false
    }

    // 개별 파일 용량 체크
    const oversizedFiles = newFiles.filter(file => file.size > FILE_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE)
    if (oversizedFiles.length > 0) {
      toast.error(t('expense.attachments.fileTooLarge', { max: FILE_UPLOAD_CONSTRAINTS.MAX_FILE_SIZE / 1024 / 1024 }))
      return false
    }

    return true
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      if (validateFiles(newFiles)) {
        setFiles(prev => [...prev, ...newFiles])
      }
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handlePrevious = async () => {
    try {
      // 현재 파일 목록을 세션 스토리지에 저장
      if (files.length > 0) {
        const fileData = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            type: file.type,
            data: await fileToBase64(file)
          }))
        )
        sessionStorage.setItem('expenseAttachments', JSON.stringify(fileData))
      }

      // 이전 페이지로 이동
      router.push(`/${locale}/business-expense`)
    } catch (error) {
      console.error('Error saving files:', error)
      // 에러가 발생해도 이전 페이지로 이동
      router.push(`/${locale}/business-expense`)
    }
  }

  const handleNext = async () => {
    try {
      setIsUploading(true);

      if (files.length > 0) {
        // 각 파일에 대해 Supabase Storage에 업로드
        const uploadPromises = files.map(async (file) => {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
          const filePath = `${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('expense-attachments')
            .upload(filePath, file)

          if (uploadError) {
            throw new Error(`파일 업로드 실패 (${file.name}): ${uploadError.message}`)
          }

          return filePath
        })

        try {
          // 모든 파일 업로드 완료 대기
          const uploadedPaths = await Promise.all(uploadPromises)

          // 업로드된 파일 경로를 세션 스토리지에 저장
          const attachmentData = files.map((file, index) => ({
            name: file.name,
            path: uploadedPaths[index],
            type: file.type,
            size: file.size
          }))

          sessionStorage.setItem('uploadedAttachments', JSON.stringify(attachmentData))
        } catch (uploadError: any) {
          throw new Error(`파일 업로드 중 오류 발생: ${uploadError.message}`)
        }
      } else {
        // 파일이 없는 경우 빈 배열로 저장
        sessionStorage.setItem('uploadedAttachments', JSON.stringify([]))
      }

      // summary 페이지로 이동
      router.push(`/${locale}/business-expense/summary`)
    } catch (error: any) {
      console.error('파일 업로드 오류:', error.message)
      toast.error(error.message || t('expense.attachments.uploadError'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (validateFiles(droppedFiles)) {
      setFiles(prev => [...prev, ...droppedFiles])
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="flex-1">
        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight mb-8">
              {t("expense.attachments.title")}
            </h1>

            <div className="space-y-6">
              <p className="text-muted-foreground">
                {t("expense.attachments.description")}
              </p>

              {/* 필요한 첨부파일 목록 섹션 */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium">필요한 첨부파일 목록</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* 교통비 영수증 */}
                      {formData?.transportation && formData.transportation.length > 0 && (
                        <div className="space-y-1.5">
                          <h3 className="text-sm font-medium flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4 text-blue-500" />
                            교통비 영수증
                          </h3>
                          <div className="pl-5">
                            <ul className="list-disc space-y-1 text-sm text-muted-foreground">
                              {formData.transportation
                                .filter(item => item.type !== 'mileage')
                                .map((item, index) => (
                                  <li key={index}>
                                    {item.date ? dateFormat(new Date(item.date), "yy-MM-dd") : ''} - {
                                      item.type === 'flight' ? '항공' :
                                      item.type === 'train' ? '기차' :
                                      item.type === 'taxi' ? '택시' :
                                      item.type === 'fuel' ? '주유' :
                                      item.type === 'rental' ? '렌트카' : '기타'
                                    } ({formatNumber(Number(item.totalAmount || 0))}€)
                                  </li>
                                ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* 숙박비 영수증 */}
                      {formData?.accommodation && formData.accommodation.length > 0 && (
                        <div className="space-y-1.5">
                          <h3 className="text-sm font-medium flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4 text-blue-500" />
                            숙박비 영수증
                          </h3>
                          <div className="pl-5">
                            <ul className="list-disc space-y-1 text-sm text-muted-foreground">
                              {formData.accommodation
                                .filter(item => item.type === 'hotel')
                                .map((item, index) => (
                                  <li key={index}>
                                    {item.startDate ? dateFormat(new Date(item.startDate), "yy-MM-dd") : ''} ~ 
                                    {item.endDate ? dateFormat(new Date(item.endDate), "yy-MM-dd") : ''} - 
                                    {item.hotelName} ({formatNumber(Number(item.totalAmount || 0))}€)
                                  </li>
                                ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* 접대비 영수증 */}
                      {formData?.entertainment && formData.entertainment.length > 0 && (
                        <div className="space-y-1.5">
                          <h3 className="text-sm font-medium flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4 text-blue-500" />
                            접대비 영수증
                          </h3>
                          <div className="pl-5">
                            <ul className="list-disc space-y-1 text-sm text-muted-foreground">
                              {formData.entertainment.map((item, index) => (
                                <li key={index}>
                                  {item.date ? dateFormat(new Date(item.date), "yy-MM-dd") : ''} - {
                                    item.type === 'breakfast' ? '아침식사' :
                                    item.type === 'lunch' ? '점심식사' :
                                    item.type === 'dinner' ? '저녁식사' : '커피/다과'
                                  } ({formatNumber(Number(item.totalAmount || 0))}€)
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* 기타 금액 영수증 */}
                      {formData?.miscellaneous && formData.miscellaneous.length > 0 && (
                        <div className="space-y-1.5">
                          <h3 className="text-sm font-medium flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4 text-blue-500" />
                            기타 금액 영수증
                          </h3>
                          <div className="pl-5">
                            <ul className="list-disc space-y-1 text-sm text-muted-foreground">
                              {formData.miscellaneous.map((item, index) => (
                                <li key={index}>
                                  {item.date ? dateFormat(new Date(item.date), "yy-MM-dd") : ''} - 
                                  {item.description} ({formatNumber(Number(item.totalAmount || 0))}€)
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* 첨부파일이 필요한 항목이 없는 경우 */}
                      {(!formData?.transportation?.length && 
                        !formData?.accommodation?.length && 
                        !formData?.entertainment?.length && 
                        !formData?.miscellaneous?.length) && (
                        <div className="text-center text-sm text-muted-foreground py-3">
                          첨부할 영수증이 없습니다.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 기존 파일 업로드 섹션 */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 transition-colors duration-200 ${
                          isDragging 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <input
                          type="file"
                          multiple
                          onChange={handleFileChange}
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className="flex flex-col items-center cursor-pointer"
                        >
                          <Upload className="h-10 w-10 text-gray-400" />
                          <span className="mt-3 text-sm text-gray-500">
                            {t('expense.attachments.dragAndDrop')}
                          </span>
                          <span className="mt-1 text-sm text-gray-500">
                            {t('expense.attachments.or')}
                          </span>
                          <span className="mt-2 text-sm text-blue-500 font-semibold">
                            {t('expense.attachments.browse')}
                          </span>
                        </label>
                      </div>

                      {files.length > 0 && (
                        <div className="space-y-2">
                          {files.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded"
                            >
                              <div className="flex items-center space-x-2">
                                <FileIcon className="h-4 w-4" />
                                <span className="text-sm">{file.name}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFile(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 이전/다음 버튼 */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={isUploading}
                >
                  {t("expense.attachments.previous")}
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={isUploading}
                >
                  {t("expense.attachments.next")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 