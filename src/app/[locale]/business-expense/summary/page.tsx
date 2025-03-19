'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { format as dateFormat } from 'date-fns'
import { toast } from 'sonner'
import { ArrowLeft, Save, Loader2, Pencil, FileDown, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Sidebar from '@/components/layout/Sidebar'
import { ExpenseForm } from '../page'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatEuro } from '@/lib/utils'

// 날짜를 시간대 문제 없이 저장하기 위한 함수
// YYYY-MM-DD 형식으로 날짜만 추출하여 저장
const formatDateForStorage = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 날짜 문자열을 시간대 문제 없이 Date 객체로 변환하는 함수
const parseDateFromStorage = (dateStr: string | undefined): Date | undefined => {
  if (!dateStr) return undefined;
  
  // YYYY-MM-DD 형식의 문자열인 경우
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    // 로컬 시간대로 날짜 생성 (시간은 정오로 설정하여 시간대 변환 시 날짜가 바뀌지 않도록 함)
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  
  // ISO 문자열인 경우 (이전 버전과의 호환성을 위해 유지)
  try {
    const date = new Date(dateStr);
    // 날짜만 추출하여 정오로 설정된 새 날짜 객체 생성
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  } catch (e) {
    console.error('날짜 파싱 오류:', e);
    return undefined;
  }
};

// Supabase에서 가져온 출장 경비 데이터 타입
interface ExpenseData {
  id: string;
  registration_number: string;
  user_email: string;
  name: string;
  start_date: string;
  end_date: string;
  purpose: string;
  project_name: string;
  project_number: string;
  status: string;
  transportation_total: number;
  accommodation_total: number;
  entertainment_total: number;
  meal_allowance: number;
  grand_total: number;
  created_at: string;
}

export default function BusinessExpenseSummaryPage() {
  const t = useTranslations()
  const router = useRouter()
  const { locale } = useParams()
  const searchParams = useSearchParams()
  const expenseId = searchParams.get('id')
  
  const [formData, setFormData] = useState<ExpenseForm | null>(null)
  const [expenseData, setExpenseData] = useState<ExpenseData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPdfGenerating, setIsPdfGenerating] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // URL 파라미터로 전달된 ID를 사용해 데이터 로드
  useEffect(() => {
    const loadExpenseData = async () => {
      setIsLoading(true)
      
      try {
        // 편집 완료 플래그 확인
        const editComplete = sessionStorage.getItem('expenseEditComplete');
        
        // 편집 완료 상태인 경우 세션 스토리지에서 데이터 로드
        if (editComplete === 'true') {
          console.log('편집 완료 상태: 세션 스토리지에서 데이터 로드');
          
          // 편집 완료 플래그 초기화 (한 번만 사용)
          sessionStorage.removeItem('expenseEditComplete');
          
          // 세션 스토리지에서 데이터 로드
          const savedData = sessionStorage.getItem('expenseFormData');
          const editId = sessionStorage.getItem('expenseEditId');
          
          if (savedData) {
            console.log('세션 스토리지에서 데이터 로드 성공');
            const parsedData = JSON.parse(savedData);
            
            // 날짜 객체 복원
            if (parsedData.startDate) parsedData.startDate = parseDateFromStorage(parsedData.startDate);
            if (parsedData.endDate) parsedData.endDate = parseDateFromStorage(parsedData.endDate);
            
            parsedData.visits.forEach((visit: any) => {
              if (visit.date) visit.date = parseDateFromStorage(visit.date);
            });
            
            parsedData.transportation.forEach((item: any) => {
              if (item.date) item.date = parseDateFromStorage(item.date);
            });
            
            parsedData.accommodations.forEach((item: any) => {
              if (item.startDate) item.startDate = parseDateFromStorage(item.startDate);
              if (item.endDate) item.endDate = parseDateFromStorage(item.endDate);
              if (item.breakfastDates) {
                const breakfastDates = item.breakfastDates.map((date: string) => parseDateFromStorage(date)).filter((date: Date | undefined): date is Date => date !== undefined);
                item.breakfastDates = breakfastDates;
              }
            });
            
            parsedData.entertainment.forEach((item: any) => {
              if (item.date) item.date = parseDateFromStorage(item.date);
            });
            
            parsedData.meals.forEach((item: any) => {
              if (item.date) item.date = parseDateFromStorage(item.date);
            });
            
            setFormData(parsedData);
            
            // 편집 ID가 있는 경우 기본 정보만 Supabase에서 가져옴
            if (editId) {
              const { data: summaryData } = await supabase
                .from('expense_summary')
                .select('*')
                .eq('id', editId)
                .single();
                
              if (summaryData) {
                setExpenseData(summaryData);
              }
            }
          } else {
            console.log('세션 스토리지에 데이터 없음');
            toast.error(t('expense.summary.noData'));
            router.push(`/${locale}/business-expense`);
          }
        }
        // URL에 ID가 있는 경우 Supabase에서 데이터 로드 (기존 로직)
        else if (expenseId) {
          console.log('URL 파라미터에서 ID 발견:', expenseId);
          
          // expense_summary 뷰에서 기본 정보 가져오기
          const { data: summaryData, error: summaryError } = await supabase
            .from('expense_summary')
            .select('*')
            .eq('id', expenseId)
            .single();
            
          if (summaryError) {
            console.error('출장 경비 요약 데이터 로드 오류:', summaryError);
            toast.error(t('expense.summary.loadError'));
            router.push(`/${locale}/expense-list`);
            return;
          }
          
          if (!summaryData) {
            console.error('출장 경비 데이터를 찾을 수 없음');
            toast.error(t('expense.summary.notFound'));
            router.push(`/${locale}/expense-list`);
            return;
          }
          
          setExpenseData(summaryData);
          
          // 임시로 기본 폼 데이터 생성
          const formattedData: ExpenseForm = {
            name: summaryData.name,
            startDate: parseDateFromStorage(summaryData.start_date),
            endDate: parseDateFromStorage(summaryData.end_date),
            startTime: '',
            endTime: '',
            purpose: summaryData.purpose || '',
            projectName: summaryData.project_name || '',
            projectNumber: summaryData.project_number || '',
            mealOption: true,
            accommodationOption: true,
            date: undefined,
            amount: '',
            visits: [],
            transportation: [],
            accommodations: [],
            entertainment: [],
            meals: []
          };
          
          // 방문 데이터 가져오기
          const { data: visitsData } = await supabase
            .from('expense_visits')
            .select('*')
            .eq('expense_id', expenseId);
            
          if (visitsData) {
            formattedData.visits = visitsData.map(visit => ({
              date: visit.date ? parseDateFromStorage(visit.date) : undefined,
              companyName: visit.company_name || '',
              city: visit.city || '',
              description: visit.description || '',
              isExpanded: false,
              datePickerOpen: false
            }));
          }
          
          // 교통비 데이터 가져오기
          const { data: transportationData } = await supabase
            .from('expense_transportation')
            .select('*')
            .eq('expense_id', expenseId);
            
          if (transportationData) {
            formattedData.transportation = transportationData.map(item => ({
              date: item.date ? parseDateFromStorage(item.date) : undefined,
              type: item.type as 'flight' | 'train' | 'taxi' | 'fuel' | 'rental' | 'km_pauschale' | undefined,
              country: item.country || '',
              companyName: item.company_name || '',
              paidBy: item.paid_by as 'company' | 'personal' | undefined,
              vat: item.vat?.toString() || '',
              amount: item.amount?.toString() || '',
              mileage: item.mileage?.toString() || '',
              licensePlate: item.license_plate || '',
              isExpanded: false,
              datePickerOpen: false,
              otherType: ''
            }));
          }
          
          // 숙박비 데이터 가져오기
          const { data: accommodationData } = await supabase
            .from('expense_accommodations')
            .select('*')
            .eq('expense_id', expenseId);
            
          if (accommodationData) {
            const accommodations = [];
            
            for (const item of accommodationData) {
              // 조식 정보 가져오기
              const { data: breakfastData } = await supabase
                .from('expense_accommodation_breakfasts')
                .select('breakfast_date')
                .eq('accommodation_id', item.id);
                
                const breakfastDates = breakfastData 
                  ? breakfastData.map(b => parseDateFromStorage(b.breakfast_date)).filter((date: Date | undefined): date is Date => date !== undefined)
                  : [];
                
              accommodations.push({
                startDate: item.start_date ? parseDateFromStorage(item.start_date) : undefined,
                endDate: item.end_date ? parseDateFromStorage(item.end_date) : undefined,
                type: item.type as 'hotel' | 'private' | undefined,
                country: item.country || '',
                hotelName: item.hotel_name || '',
                paidBy: item.paid_by as 'company' | 'personal' | undefined,
                cityTax: item.city_tax?.toString() || '',
                vat: item.vat?.toString() || '',
                totalAmount: item.total_amount?.toString() || '',
                breakfastDates,
                isExpanded: false,
                datePickerOpen: false
              });
            }
            
            formattedData.accommodations = accommodations;
          }
          
          // 접대비 데이터 가져오기
          const { data: entertainmentData } = await supabase
            .from('expense_entertainment')
            .select('*')
            .eq('expense_id', expenseId);
            
          if (entertainmentData) {
            formattedData.entertainment = entertainmentData.map(item => ({
              date: item.date ? parseDateFromStorage(item.date) : undefined,
              type: item.type as 'breakfast' | 'lunch' | 'dinner' | 'coffee' | undefined,
              country: item.country || '',
              companyName: item.company_name || '',
              paidBy: item.paid_by as 'company' | 'personal' | undefined,
              vat: item.vat?.toString() || '',
              amount: item.amount?.toString() || '',
              isExpanded: false,
              datePickerOpen: false,
              otherType: ''
            }));
          }
          
          // 식대 데이터 (빈 배열로 초기화)
          formattedData.meals = [];
          
          setFormData(formattedData);
        } else {
          // URL에 ID가 없는 경우 세션 스토리지에서 데이터 로드 (기존 로직)
          console.log('세션 스토리지에서 데이터 로드 시도');
          const savedData = sessionStorage.getItem('expenseFormData');
          console.log('세션 스토리지 데이터 존재 여부:', !!savedData);
          
          if (savedData) {
            console.log('데이터 파싱 시도');
            const parsedData = JSON.parse(savedData);
            console.log('데이터 파싱 성공');
            
            // 날짜 객체 복원
            console.log('날짜 객체 복원 시작');
            if (parsedData.startDate) parsedData.startDate = parseDateFromStorage(parsedData.startDate);
            if (parsedData.endDate) parsedData.endDate = parseDateFromStorage(parsedData.endDate);
            
            parsedData.visits.forEach((visit: any) => {
              if (visit.date) visit.date = parseDateFromStorage(visit.date);
            });
            
            parsedData.transportation.forEach((item: any) => {
              if (item.date) item.date = parseDateFromStorage(item.date);
            });
            
            parsedData.accommodations.forEach((item: any) => {
              if (item.startDate) item.startDate = parseDateFromStorage(item.startDate);
              if (item.endDate) item.endDate = parseDateFromStorage(item.endDate);
              if (item.breakfastDates) {
                const breakfastDates = item.breakfastDates.map((date: string) => parseDateFromStorage(date)).filter((date: Date | undefined): date is Date => date !== undefined);
                item.breakfastDates = breakfastDates;
              }
            });
            
            parsedData.entertainment.forEach((item: any) => {
              if (item.date) item.date = parseDateFromStorage(item.date);
            });
            
            parsedData.meals.forEach((item: any) => {
              if (item.date) item.date = parseDateFromStorage(item.date);
            });
            console.log('날짜 객체 복원 완료');
            
            console.log('폼 데이터 설정');
            setFormData(parsedData);
          } else {
            // 데이터가 없으면 입력 페이지로 리다이렉트
            console.log('세션 스토리지에 데이터 없음, 입력 페이지로 리다이렉트');
            toast.error(t('expense.summary.noData'));
            router.push(`/${locale}/business-expense`);
          }
        }
      } catch (error) {
        console.error('데이터 로드 오류:', error);
        toast.error(t('expense.summary.loadError'));
        router.push(`/${locale}/expense-list`);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadExpenseData();
  }, [expenseId, locale, router, t]);

  // 최종 저장 함수
  const handleSave = async () => {
    if (!formData) return
    
    setIsSaving(true)
    
    try {
      // 세션 스토리지에서 편집 ID 확인
      const editId = sessionStorage.getItem('expenseEditId');
      console.log('세션 스토리지에서 편집 ID 확인:', editId);
      
      // 이미 저장된 데이터인 경우 (URL에 ID가 있는 경우 또는 세션 스토리지에 편집 ID가 있는 경우)
      if (expenseId || editId) {
        // 사용할 ID 결정 (URL의 ID가 우선)
        const targetId = expenseId || editId;
        console.log('업데이트할 ID:', targetId);
        
        // 상태 업데이트 (저장됨으로 변경)
        const { error } = await supabase
          .from('business_expenses')
          .update({ status: 'saved' })
          .eq('id', targetId);
          
        if (error) {
          console.error('출장 경비 상태 업데이트 오류:', error);
          toast.error(t('expense.summary.saveError'));
          return;
        }
        
        toast.success(t('expense.summary.submitSuccess'));
      } else {
        // 새로운 데이터인 경우 (세션 스토리지에서 로드한 경우)
        // 1. 기본 정보 저장
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast.error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
          return;
        }
        
        // 2. 기본 정보 저장
        const { data: newExpense, error: insertError } = await supabase
          .from('business_expenses')
          .insert({
            user_email: session.user.email,
            name: formData.name,
            start_date: formData.startDate ? formatDateForStorage(formData.startDate) : null,
            end_date: formData.endDate ? formatDateForStorage(formData.endDate) : null,
            purpose: formData.purpose || '',
            project_name: formData.projectName || '',
            project_number: formData.projectNumber || '',
            status: 'saved'
          })
          .select('id')
          .single();
          
        if (insertError || !newExpense) {
          console.error('출장 경비 기본 정보 저장 오류:', insertError);
          toast.error(t('expense.summary.saveError'));
          return;
        }
          
        const newExpenseId = newExpense.id;
          
        // 2. 방문 정보 저장
        if (formData.visits.length > 0) {
          const visitsToInsert = formData.visits
            .filter(visit => visit.date) // 날짜가 있는 항목만 필터링
            .map(visit => ({
              expense_id: newExpenseId,
              date: visit.date ? formatDateForStorage(visit.date) : null,
              company_name: visit.companyName,
              city: visit.city,
              description: visit.description
            }));
            
          if (visitsToInsert.length > 0) {
            const { error: insertVisitsError } = await supabase
              .from('expense_visits')
              .insert(visitsToInsert);
                
            if (insertVisitsError) {
              console.error('방문 정보 저장 오류:', insertVisitsError);
              toast.error('방문 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }
          
        // 3. 교통비 정보 저장
        if (formData.transportation.length > 0) {
          const transportationToInsert = formData.transportation
            .filter(item => item.date) // 날짜가 있는 항목만 필터링
            .map(item => ({
              expense_id: newExpenseId,
              date: item.date ? formatDateForStorage(item.date) : null,
              type: item.type,
              country: item.country,
              company_name: item.companyName,
              paid_by: item.paidBy,
              vat: item.vat ? parseFloat(item.vat) : null,
              amount: item.amount ? parseFloat(item.amount) : null,
              mileage: item.mileage ? parseFloat(item.mileage) : null,
              license_plate: item.licensePlate
            }));
            
          if (transportationToInsert.length > 0) {
            const { error: insertTransportationError } = await supabase
              .from('expense_transportation')
              .insert(transportationToInsert);
                
            if (insertTransportationError) {
              console.error('교통비 정보 저장 오류:', insertTransportationError);
              toast.error('교통비 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }
          
        // 4. 숙박비 정보 저장
        if (formData.accommodations.length > 0) {
          for (const accommodation of formData.accommodations) {
            // 시작일과 종료일이 있는 경우에만 저장
            if (!accommodation.startDate || !accommodation.endDate) continue;
              
            // 숙박 정보 추가
            const { data: newAccommodation, error: insertAccommodationError } = await supabase
              .from('expense_accommodations')
              .insert({
                expense_id: newExpenseId,
                start_date: formatDateForStorage(accommodation.startDate),
                end_date: formatDateForStorage(accommodation.endDate),
                type: accommodation.type,
                country: accommodation.country,
                hotel_name: accommodation.hotelName,
                paid_by: accommodation.paidBy,
                city_tax: accommodation.cityTax ? parseFloat(accommodation.cityTax) : null,
                vat: accommodation.vat ? parseFloat(accommodation.vat) : null,
                total_amount: accommodation.totalAmount ? parseFloat(accommodation.totalAmount) : null
              })
              .select('id')
              .single();
                
            if (insertAccommodationError || !newAccommodation) {
              console.error('숙박 정보 저장 오류:', insertAccommodationError);
              toast.error('숙박 정보 저장 중 오류가 발생했습니다.');
              return;
            }
                
            // 조식 정보 추가
            if (accommodation.breakfastDates && accommodation.breakfastDates.length > 0) {
              const breakfastsToInsert = accommodation.breakfastDates.map(date => ({
                accommodation_id: newAccommodation.id,
                breakfast_date: formatDateForStorage(date)
              }));
                  
              const { error: insertBreakfastsError } = await supabase
                .from('expense_accommodation_breakfasts')
                .insert(breakfastsToInsert);
                    
              if (insertBreakfastsError) {
                console.error('조식 정보 저장 오류:', insertBreakfastsError);
                toast.error('조식 정보 저장 중 오류가 발생했습니다.');
                return;
              }
            }
          }
        }
          
        // 5. 접대비 정보 저장
        if (formData.entertainment.length > 0) {
          const entertainmentToInsert = formData.entertainment
            .filter(item => item.date) // 날짜가 있는 항목만 필터링
            .map(item => ({
              expense_id: newExpenseId,
              date: item.date ? formatDateForStorage(item.date) : null,
              type: item.type,
              country: item.country,
              company_name: item.companyName,
              paid_by: item.paidBy,
              vat: item.vat ? parseFloat(item.vat) : null,
              amount: item.amount ? parseFloat(item.amount) : null
            }));
            
          if (entertainmentToInsert.length > 0) {
            const { error: insertEntertainmentError } = await supabase
              .from('expense_entertainment')
              .insert(entertainmentToInsert);
                
            if (insertEntertainmentError) {
              console.error('접대비 정보 저장 오류:', insertEntertainmentError);
              toast.error('접대비 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }
          
        toast.success(t('expense.summary.saveSuccess'));
      }
        
      // 세션 스토리지 데이터 정리
      sessionStorage.removeItem('expenseFormData');
      sessionStorage.removeItem('expenseEditMode');
      sessionStorage.removeItem('expenseEditId');
      sessionStorage.removeItem('expenseEditComplete');
        
      // 저장 성공 시 경비 조회 페이지로 이동
      router.push(`/${locale}/expense-list`);
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error(t('expense.summary.saveError'));
    } finally {
      setIsSaving(false);
    }
  }

  // 뒤로 가기 함수
  const handleBack = () => {
    // ID가 있는 경우 경비 조회 페이지로 이동
    if (expenseId) {
      router.push(`/${locale}/expense-list`);
    } else {
      // 세션 스토리지 데이터인 경우 입력 페이지로 이동
      router.push(`/${locale}/business-expense`);
    }
  }

  // 편집하기 버튼 클릭 핸들러 함수 수정
  const handleEdit = () => {
    // 현재 데이터를 세션 스토리지에 저장
    if (formData) {
      try {
        console.log('편집 모드로 전환: 데이터 저장 시작');
        console.log('세션 유형:', expenseId ? `기존 데이터 (ID: ${expenseId})` : '신규 입력 데이터');
        
        // 날짜 객체를 ISO 문자열로 변환하여 저장
        const formDataToSave = {
          ...formData,
          // 기본 날짜 필드 - 시간대 문제 해결을 위해 날짜만 추출하여 저장
          startDate: formData.startDate ? formatDateForStorage(formData.startDate) : undefined,
          endDate: formData.endDate ? formatDateForStorage(formData.endDate) : undefined,
          date: formData.date ? formatDateForStorage(formData.date) : undefined,
          
          // 방문 정보의 날짜
          visits: formData.visits.map(visit => ({
            ...visit,
            date: visit.date ? formatDateForStorage(visit.date) : undefined
          })),
          
          // 교통비 정보의 날짜
          transportation: formData.transportation.map(item => ({
            ...item,
            date: item.date ? formatDateForStorage(item.date) : undefined
          })),
          
          // 숙박비 정보의 날짜
          accommodations: formData.accommodations.map(item => ({
            ...item,
            startDate: item.startDate ? formatDateForStorage(item.startDate) : undefined,
            endDate: item.endDate ? formatDateForStorage(item.endDate) : undefined,
            breakfastDates: item.breakfastDates ? item.breakfastDates.map(date => formatDateForStorage(date)) : []
          })),
          
          // 접대비 정보의 날짜
          entertainment: formData.entertainment.map(item => ({
            ...item,
            date: item.date ? formatDateForStorage(item.date) : undefined
          })),
          
          // 식대 정보의 날짜
          meals: formData.meals.map(item => ({
            ...item,
            date: item.date ? formatDateForStorage(item.date) : undefined
          }))
        };
        
        // 세션 스토리지에 데이터 저장
        sessionStorage.setItem('expenseFormData', JSON.stringify(formDataToSave));
        console.log('세션 스토리지에 데이터 저장 완료');
        
        // 데이터 검증
        const savedData = sessionStorage.getItem('expenseFormData');
        if (savedData) {
          console.log('세션 스토리지 데이터 검증: 성공');
          console.log('데이터 크기:', Math.round(savedData.length / 1024), 'KB');
        } else {
          console.error('세션 스토리지 데이터 검증: 실패 - 데이터가 저장되지 않음');
        }
        
        // 편집 모드 플래그 설정 (입력 페이지에서 이 값을 확인하여 편집 모드임을 인식)
        sessionStorage.setItem('expenseEditMode', 'true');
        
        // 편집 대상 ID 저장 (ID가 있는 경우에만)
        if (expenseId) {
          sessionStorage.setItem('expenseEditId', expenseId);
          console.log('편집 대상 ID 저장:', expenseId);
        }
        
        // 출장경비 입력 페이지로 이동
        console.log('출장경비 입력 페이지로 이동 준비 완료');
        
        // router.push 대신 window.location.href 사용
        // 이렇게 하면 페이지가 완전히 새로 로드되어 세션 스토리지의 데이터를 확실하게 불러올 수 있음
        window.location.href = `/${locale}/business-expense`;
      } catch (error) {
        console.error('데이터 저장 오류:', error);
        toast.error(t('expense.summary.editError'));
      }
    }
  }

  // PDF 저장 기능 구현
  const handleSavePdf = async () => {
    try {
      setIsPdfGenerating(true)
      
      // html2pdf.js를 동적으로 import
      const html2pdf = (await import('html2pdf.js')).default
      
      if (!contentRef.current) {
        toast.error(t('expense.summary.pdfError') || 'PDF 생성 중 오류가 발생했습니다.')
        setIsPdfGenerating(false)
        return
      }
      
      // 파일명 설정
      const fileName = expenseData 
        ? `출장경비_${expenseData.registration_number}.pdf` 
        : `출장경비_${new Date().toISOString().slice(0, 10)}.pdf`
      
      // PDF 옵션 설정
      const opt = {
        margin: 10,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }
      
      // PDF 생성 및 저장
      html2pdf().from(contentRef.current).set(opt).save()
      
      toast.success(t('expense.summary.pdfSuccess') || 'PDF가 생성되었습니다.')
    } catch (error) {
      console.error('PDF 생성 오류:', error)
      toast.error(t('expense.summary.pdfError') || 'PDF 생성 중 오류가 발생했습니다.')
    } finally {
      setIsPdfGenerating(false)
    }
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

  if (isLoading || !formData) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 lg:ml-64">
          <div className="p-8">
            <div className="container mx-auto py-6 max-w-4xl">
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500 mr-2" />
                <p>{t('expense.summary.loading')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 lg:ml-64">
        <div className="p-8">
          <div className="container mx-auto py-6 max-w-4xl">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">{t('expense.summary.title')}</h1>
                {expenseData && (
                  <div className="flex items-center mt-1">
                    <span className="text-sm text-gray-500 mr-2">등록번호: {expenseData.registration_number}</span>
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      getStatusStyle(expenseData.status).class
                    }`}>
                      {getStatusStyle(expenseData.status).text}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="hover:bg-gray-800 hover:text-white cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  {t('expense.summary.backButton')}
                </Button>
                
                <Button variant="outline" onClick={handleSavePdf} disabled={isPdfGenerating}>
                  <FileDown className="mr-2 h-4 w-4" />
                  {isPdfGenerating ? t('expense.summary.generatingPdf') || '생성 중...' : t('expense.summary.savePdf') || 'PDF 저장'}
                </Button>
                
                {/* 경비 조회 페이지를 통한 기존 데이터 요약 페이지에서만 편집하기 버튼 표시 */}
                {expenseId && (
                  <Button
                    variant="outline"
                    onClick={handleEdit}
                    className="hover:bg-gray-800 hover:text-white cursor-pointer"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('expense.summary.editButton')}
                  </Button>
                )}
                
                {(!expenseId || (expenseData && expenseData.status === 'draft')) && (
                  <Button
                    onClick={handleSave}
                    className="hover:bg-gray-800 hover:text-white cursor-pointer"
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? t('expense.summary.saving') : t('expense.summary.save')}
                  </Button>
                )}
              </div>
            </div>
            
            <div ref={contentRef} id="expense-summary" className="space-y-6">
              {/* 기본 정보 요약 */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('expense.summary.basicInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('expense.basicInfo.travelerName.label')}</p>
                    <p className="font-medium">{formData.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">{t('expense.basicInfo.startDate')} / {t('expense.basicInfo.startTime')}</p>
                    <p className="font-medium">
                      {formData.startDate ? (
                        <>
                          {dateFormat(formData.startDate, 'PPP')} {formData.startTime ? `${formData.startTime}` : ''}
                        </>
                      ) : (
                        '-'
                      )}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">{t('expense.basicInfo.endDate')} / {t('expense.basicInfo.endTime')}</p>
                    <p className="font-medium">
                      {formData.endDate ? (
                        <>
                          {dateFormat(formData.endDate, 'PPP')} {formData.endTime ? `${formData.endTime}` : ''}
                        </>
                      ) : (
                        '-'
                      )}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('expense.allowance.meal.title') || '일괄 식비 지급'}</p>
                      <p className="font-medium">
                        {formData.mealOption 
                          ? (t('expense.allowance.meal.willBePaid') || '지급함') 
                          : (t('expense.allowance.meal.willNotBePaid') || '지급하지 않음')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* 방문지 정보 요약 */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('expense.summary.visits')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.visits.length > 0 ? (
                    <div className="space-y-4">
                      {formData.visits.map((visit, index) => (
                        <div key={index} className="border p-4 rounded-md">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.visitInfo.date')}</p>
                              <p className="font-medium">
                                {visit.date ? dateFormat(visit.date, 'PPP') : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.visitInfo.companyName.label')}</p>
                              <p className="font-medium">{visit.companyName || '-'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.visitInfo.city.label')}</p>
                              <p className="font-medium">{visit.city || '-'}</p>
                            </div>
                          </div>
                          {visit.description && (
                            <div className="mt-2">
                              <p className="text-sm text-muted-foreground">{t('expense.visitInfo.description.label')}</p>
                              <p className="font-medium">{visit.description}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{t('expense.summary.noVisits')}</p>
                  )}
                </CardContent>
              </Card>
              
              {/* 교통비 정보 요약 */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('expense.summary.transportation')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.transportation.length > 0 ? (
                    <div className="space-y-4">
                      {formData.transportation.map((item, index) => (
                        <div key={index} className="border p-4 rounded-md">
                          <div className="grid grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.transportation.date.label')}</p>
                              <p className="font-medium">
                                {item.date ? dateFormat(item.date, 'PPP') : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.transportation.type.label')}</p>
                              <p className="font-medium">
                                {item.type ? t(`expense.transportation.type.${item.type}`) : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.transportation.country.label') || '국가'}</p>
                              <p className="font-medium">{item.country || '-'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.paidBy.label')}</p>
                              <p className="font-medium">
                                {item.paidBy ? t(`expense.paidBy.${item.paidBy}`) : '-'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.transportation.companyName.label') || '회사명'}</p>
                              <p className="font-medium">{item.companyName || '-'}</p>
                            </div>
                            {item.type === 'km_pauschale' ? (
                              <div>
                                <p className="text-sm text-muted-foreground">{t('expense.transportation.mileage.label') || '주행거리 (KM)'}</p>
                                <p className="font-medium">{item.mileage || '-'}</p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm text-muted-foreground">{t('expense.transportation.vat.label') || '부가세'}</p>
                                <p className="font-medium">{item.vat ? formatEuro(parseFloat(item.vat), false) : '-'}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.transportation.totalAmount.label') || '금액'}</p>
                              <p className="font-medium">{item.amount ? formatEuro(parseFloat(item.amount), false) : '-'}</p>
                            </div>
                          </div>
                          {item.type === 'km_pauschale' && item.licensePlate && (
                            <div className="mt-2">
                              <p className="text-sm text-muted-foreground">{t('expense.transportation.licensePlate.label') || '번호판'}</p>
                              <p className="font-medium">{item.licensePlate}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{t('expense.summary.noTransportation')}</p>
                  )}
                </CardContent>
              </Card>
              
              {/* 접대비 정보 요약 */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('expense.summary.entertainment')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.entertainment.length > 0 ? (
                    <div className="space-y-4">
                      {formData.entertainment.map((item, index) => (
                        <div key={index} className="border p-4 rounded-md">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.entertainment.date.label') || '날짜'}</p>
                              <p className="font-medium">
                                {item.date ? dateFormat(item.date, 'PPP') : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.entertainment.type.label') || '유형'}</p>
                              <p className="font-medium">
                                {item.type ? (t(`expense.entertainment.type.${item.type}`) || item.type) : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.paidBy.label')}</p>
                              <p className="font-medium">
                                {item.paidBy ? t(`expense.paidBy.${item.paidBy}`) : '-'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.entertainment.companyName.label') || '회사명'}</p>
                              <p className="font-medium">{item.companyName || '-'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.entertainment.vat.label') || '부가세'}</p>
                              <p className="font-medium">{item.vat ? formatEuro(parseFloat(item.vat), false) : '-'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.entertainment.totalAmount.label') || '금액'}</p>
                              <p className="font-medium">{item.amount ? formatEuro(parseFloat(item.amount), false) : '-'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{t('expense.summary.noEntertainment')}</p>
                  )}
                </CardContent>
              </Card>
              
              {/* 숙박비 정보 요약 */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('expense.summary.accommodation')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.accommodations.length > 0 ? (
                    <div className="space-y-4">
                      {formData.accommodations.map((item, index) => (
                        <div key={index} className="border p-4 rounded-md">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.accommodation.checkIn')} - {t('expense.accommodation.checkOut')}</p>
                              <p className="font-medium">
                                {item.startDate && item.endDate ? (
                                  <>
                                    {dateFormat(item.startDate, 'PPP')} - {dateFormat(item.endDate, 'PPP')}
                                  </>
                                ) : (
                                  '-'
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.accommodation.type.label')}</p>
                              <p className="font-medium">
                                {item.type ? t(`expense.accommodation.type.${item.type}`) : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.paidBy.label')}</p>
                              <p className="font-medium">
                                {item.paidBy ? t(`expense.paidBy.${item.paidBy}`) : '-'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-4">
                            {item.type === 'hotel' && (
                              <div>
                                <p className="text-sm text-muted-foreground">{t('expense.accommodation.hotelName.label')}</p>
                                <p className="font-medium">{item.hotelName || '-'}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.accommodation.vat.label')}</p>
                              <p className="font-medium">{item.vat ? formatEuro(parseFloat(item.vat), false) : '-'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{t('expense.accommodation.totalAmount.label')}</p>
                              <p className="font-medium">{item.totalAmount ? formatEuro(parseFloat(item.totalAmount), false) : '-'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{t('expense.summary.noAccommodation')}</p>
                  )}
                </CardContent>
              </Card>
              
              {/* 식대 계산 요약 */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('expense.summary.mealAllowance')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {formData.startDate && formData.endDate ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">{t('expense.mealCalculation.travelPeriod')}</p>
                          <p className="font-medium">
                            {dateFormat(formData.startDate, 'PPP')} → {dateFormat(formData.endDate, 'PPP')}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t('expense.mealCalculation.totalDays')}</p>
                          <p className="font-medium">
                            {Math.ceil((formData.endDate.getTime() - formData.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} {t('expense.mealCalculation.days')}
                          </p>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="flex justify-between items-center">
                          <p className="font-medium">{t('expense.mealCalculation.dailyAllowance')}</p>
                          <p className="text-muted-foreground">{formatEuro(28, false)}</p>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <p className="font-medium">{t('expense.mealCalculation.totalAllowance')}</p>
                          <p className="text-lg font-semibold">
                            {formatEuro(((Math.ceil((formData.endDate.getTime() - formData.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1) * 28), false)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{t('expense.summary.noMealAllowance')}</p>
                  )}
                </CardContent>
              </Card>
              
              {/* 총 비용 요약 */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('expense.summary.totalCost')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{t('expense.summary.transportationTotal')}</p>
                        <p className="font-medium">
                          {formatEuro(formData.transportation.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('expense.summary.accommodationTotal')}</p>
                        <p className="font-medium">
                          {formatEuro(formData.accommodations.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">{t('expense.summary.entertainmentTotal')}</p>
                        <p className="font-medium">
                          {formatEuro(formData.entertainment.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0))}
                        </p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <p className="font-medium">{t('expense.summary.mealAllowanceTotal')}</p>
                        <p className="font-medium">
                          {formData.startDate && formData.endDate ? (
                            formatEuro((Math.ceil((formData.endDate.getTime() - formData.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1) * 28, false)
                          ) : (
                            formatEuro(0, false)
                          )}
                        </p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <p className="text-lg font-semibold">{t('expense.summary.grandTotal')}</p>
                        <p className="text-xl font-bold">
                          {formatEuro(
                            formData.transportation.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0) +
                            formData.accommodations.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0) +
                            formData.entertainment.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 