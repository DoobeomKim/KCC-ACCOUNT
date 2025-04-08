'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { format as dateFormat } from 'date-fns'
import { toast } from 'sonner'
import { 
  Check, 
  Star, 
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Plus,
  AlertCircle,
  Loader2,
  Search,
  X,
  Trash2
} from "lucide-react"
import { useFormDataPolicy } from '@/hooks/useFormDataPolicy'
import { useRouter, usePathname, useParams } from 'next/navigation'
import { defaultLocale } from '@/i18n/settings'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import Sidebar from '@/components/layout/Sidebar'
import DatePicker from '@/components/DatePicker'
import { supabase } from '@/lib/supabase'
import { cn, formatNumber, parseGermanNumber } from '@/lib/utils'
import { 
  Alert, 
  AlertTitle, 
  AlertDescription 
} from "@/components/ui/alert"
import { AccommodationCalendar } from '@/components/AccommodationCalendar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import MealAllowanceInfo from '@/components/MealAllowanceInfo'
import CountrySelector from "@/components/CountrySelector"
import { MILEAGE_RATE } from '@/lib/constants'
import { 
  ExpenseForm,
  ExpenseFormVisit,
  ExpenseFormTransportation,
  ExpenseFormAccommodation,
  ExpenseFormEntertainment,
  ExpenseFormMiscellaneous,
  MealEntry,
  MealAllowanceInfo as MealAllowanceInfoType
} from '@/types/expense'
import { GermanNumberInput } from "@/components/ui/german-number-input"
import { TransportationInput } from "@/components/TransportationInput"
import MiscellaneousExpenseForm from '@/components/MiscellaneousExpenseForm'
import { TimeSelect } from "@/components/ui/time-select"

interface CountryOption {
  value: string;
  label: string;
  type: 'business' | 'simple';
}

interface CompanySettings {
  email: string
  company_name: string
  city: string
}

interface ExpenseFormTransportation {
  date: Date | undefined
  type: 'flight' | 'train' | 'taxi' | 'fuel' | 'rental' | 'mileage' | 'km_pauschale' | undefined
  otherType?: string
  licensePlate?: string
  country: string
  companyName: string
  paidBy: 'company' | 'personal' | undefined
  vat: string
  totalAmount: string
  mileage?: string
  isExpanded: boolean
  datePickerOpen: boolean
}

interface ExpenseFormAccommodation {
    startDate: Date | undefined
    endDate: Date | undefined
    type: 'hotel' | 'private' | undefined
    country: string
    hotelName: string
    paidBy: 'company' | 'personal' | undefined
    breakfastDates: Date[]
    cityTax: string
    vat: string
    totalAmount: string
    isExpanded?: boolean
    datePickerOpen?: boolean
    allowanceRate?: number
}

interface ExpenseFormEntertainment {
    date: Date | undefined
  type: 'breakfast' | 'lunch' | 'dinner' | 'coffee' | undefined
    otherType?: string
    country: string
    companyName: string
    totalAmount: string
    paidBy: 'company' | 'personal' | undefined
    vat: string
    isExpanded?: boolean
    datePickerOpen?: boolean
}

interface ExpenseFormVisit {
    date: Date | undefined
    companyName: string
  city: string
  description: string
  isExpanded: boolean
  datePickerOpen: boolean
}

interface MealEntry {
    date: Date | undefined
    country: string
    companyName: string
    totalAmount: string
    paidBy: 'company' | 'personal' | undefined
    vat: string
    isExpanded?: boolean
    datePickerOpen?: boolean
}

interface MealAllowanceInfo {
  date: string
  tripType?: 'international' | 'domestic'
  departureCountry?: string
  departureCity?: string
  arrivalCountry?: string
  arrivalCity?: string
  isExpanded?: boolean
  dayType?: '도착일' | '출발일' | '숙박일'
  breakfast?: boolean
  lunch?: boolean
  dinner?: boolean
}

interface ExpenseForm {
  startDate?: Date
  endDate?: Date
  startTime?: string  // 옵셔널로 변경
  endTime?: string    // 옵셔널로 변경
  city: string
  description: string
  startDatePickerOpen?: boolean
  endDatePickerOpen?: boolean
  visits: ExpenseFormVisit[]
  transportation: ExpenseFormTransportation[]
  accommodation: ExpenseFormAccommodation[]
  entertainment: ExpenseFormEntertainment[]
  meals: MealEntry[]
  miscellaneous: MiscellaneousExpense[]
  mealAllowanceInfo: { [date: string]: MealAllowanceInfo[] }
  totalMealAllowance: number
}

// 필수 라벨 컴포넌트
const RequiredLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-1">
    {children}
    <span className="text-red-500">*</span>
  </div>
)

// 비용 합계 계산 함수
const calculateExpenseSummary = (formData: ExpenseForm) => {
  // 초기값 설정
  const summary = {
    transportation: { company: 0, personal: 0 },
    entertainment: { company: 0, personal: 0 },
    accommodation: { company: 0, personal: 0 },
    miscellaneous: { company: 0, personal: 0 },
    mileage: { distance: 0, amount: 0 },
    mealAllowance: { amount: 0 },
    total: { company: 0, personal: 0 }
  };

  // 교통비 합계 계산
  formData.transportation?.forEach(item => {
    if (item.type === 'mileage') {
      // 주행거리 수당 계산
      const mileage = Number(item.mileage) || 0;
      const mileageAllowance = mileage * 0.30;  // 주행거리 수당 계산 (km당 0.30유로)
      
      summary.mileage.distance += mileage;
      summary.mileage.amount += mileageAllowance;
      summary.transportation.personal += mileageAllowance;
    } else {
      // 일반 교통비 계산
      const amount = Number(item.totalAmount) || 0;
      if (amount > 0) {
        if (item.paidBy === 'company') {
          summary.transportation.company += amount;
        } else if (item.paidBy === 'personal') {
          summary.transportation.personal += amount;
        }
      }
    }
  });

  // 접대비 합계 계산
  formData.entertainment?.forEach(item => {
    const amount = Number(item.totalAmount) || 0;
    summary.entertainment.amount += amount;
    summary.entertainment.company += amount;
  });

  // 숙박비 합계 계산
  formData.accommodation?.forEach(item => {
    if (item.type === 'hotel' && item.totalAmount) {
      const amount = Number(item.totalAmount.replace(',', '.')) || 0;
      summary.accommodation.company += amount;
    } else if (item.type === 'private' && item.startDate && item.endDate && item.allowanceRate) {
      // 숙박 일수 계산 (체크아웃 - 체크인)
      const nights = Math.floor((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (1000 * 60 * 60 * 24));
      // 숙박비 계산 (숙박일수 * 국가별 숙박비 한도)
      const amount = nights * item.allowanceRate;
      summary.accommodation.personal += amount;
    }
  });

  // 일괄식대 합계 계산 - totalMealAllowance 직접 사용
  summary.mealAllowance.amount = Number(formData.totalMealAllowance) || 0;
  summary.mealAllowance.personal = summary.mealAllowance.amount;

  // 기타 금액 합계 계산
  formData.miscellaneous?.forEach(item => {
    const amount = Number(item.totalAmount) || 0;
    summary.miscellaneous.amount += amount;
    if (item.expenseType === 'company') {
      summary.miscellaneous.company += amount;
    } else {
      summary.miscellaneous.personal += amount;
    }
  });

  // 회사/개인 총액 계산 - 주행거리 수당 중복 제거
  summary.total.company = summary.transportation.company + 
                         summary.entertainment.company + 
                         summary.accommodation.company + 
                         summary.miscellaneous.company;

  summary.total.personal = summary.transportation.personal + 
                         summary.mealAllowance.personal + 
                         summary.miscellaneous.personal;

  return summary;
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

// 날짜를 시간대 문제 없이 저장하기 위한 함수
// YYYY-MM-DD 형식으로 날짜만 추출하여 저장
const formatDateForStorage = (date: Date | undefined): string | undefined => {
  if (!date) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/* Accommodation Date Validation 컴포넌트가 있어서 필요없음

// 체크인 날짜 유효성 검사 함수
const isCheckInDateValid = useCallback((date: Date, index: number) => {
  if (!formData.startDate || !formData.endDate) return false;
  
  const dateWithoutTime = new Date(date);
  dateWithoutTime.setHours(0, 0, 0, 0);
  
  // 출장 기간을 벗어난 경우
  if (date < formData.startDate || date > formData.endDate) return false;
  
  // 이전 숙박의 날짜를 제외
  for (let i = 0; i < index; i++) {
    const prevAcc = formData.accommodations[i];
    if (prevAcc.startDate && prevAcc.endDate) {
      const prevStartDate = new Date(prevAcc.startDate);
      prevStartDate.setHours(0, 0, 0, 0);
      
      const prevEndDate = new Date(prevAcc.endDate);
      prevEndDate.setHours(23, 59, 59, 999);
      
      if (dateWithoutTime >= prevStartDate && dateWithoutTime <= prevEndDate) {
        return false;
      }
    }
  }
  
  return true;
}, [formData]);

// 체크아웃 날짜 유효성 검사 함수
const isCheckOutDateValid = useCallback((date: Date, index: number, startDate: Date) => {
  if (!startDate || !formData.endDate) return false;
  
  const dateWithoutTime = new Date(date);
  dateWithoutTime.setHours(0, 0, 0, 0);
  
  // 체크인 다음날부터 출장 종료일까지만 선택 가능
  const minDate = new Date(startDate);
  minDate.setDate(minDate.getDate() + 1);
  minDate.setHours(0, 0, 0, 0);
  
  const maxDate = new Date(formData.endDate);
  maxDate.setHours(23, 59, 59, 999);
  
  if (dateWithoutTime < minDate || dateWithoutTime > maxDate) return false;
  
  // 이전 숙박의 날짜를 제외 (체크인/체크아웃 날짜는 겹쳐도 됨)
  for (let i = 0; i < index; i++) {
    const prevAcc = formData.accommodations[i];
    if (prevAcc.startDate && prevAcc.endDate) {
      const prevStartDate = new Date(prevAcc.startDate);
      prevStartDate.setHours(0, 0, 0, 0);
      
      const prevEndDate = new Date(prevAcc.endDate);
      prevEndDate.setHours(23, 59, 59, 999);
      
      const prevStartDatePlusOne = new Date(prevStartDate);
      prevStartDatePlusOne.setDate(prevStartDatePlusOne.getDate() + 1);
      
      const prevEndDateMinusOne = new Date(prevEndDate);
      prevEndDateMinusOne.setDate(prevEndDateMinusOne.getDate() - 1);
      
      if (dateWithoutTime > prevStartDatePlusOne && dateWithoutTime < prevEndDateMinusOne) {
        return false;
      }
    }
  }
  
  return true;
}, [formData]);
*/

// 초기 폼 데이터
const initialFormData: ExpenseForm = {
  name: '',
  startDate: undefined,
  endDate: undefined,
  startTime: undefined,  // undefined로 초기화
  endTime: undefined,    // undefined로 초기화
  city: '',
  description: '',
  purpose: '',
  projectName: '',
  projectNumber: '',
  mealOption: true,
  startDatePickerOpen: false,
  endDatePickerOpen: false,
  visits: [{  // 기본적으로 1개의 빈 방문지 정보 추가
    date: undefined,
    companyName: '',
    city: '',
    description: '',
    isExpanded: true,
    datePickerOpen: false
  }],
  transportation: [],
  accommodation: [],
  entertainment: [],
  meals: [],
  miscellaneous: [],
  mealAllowanceInfo: {},
  totalMealAllowance: 0
};

export default function BusinessExpensePage() {
  const t = useTranslations()
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || defaultLocale
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [formData, setFormData] = useState<ExpenseForm>({
    name: '',
    startDate: undefined,
    endDate: undefined,
    startTime: undefined,
    endTime: undefined,
    city: '',
    description: '',
    purpose: '',
    projectName: '',
    projectNumber: '',
    mealOption: true,
    startDatePickerOpen: false,
    endDatePickerOpen: false,
    visits: [{  // 기본적으로 1개의 빈 방문지 정보 추가
      date: undefined,
      companyName: '',
      city: '',
      description: '',
      isExpanded: true,
      datePickerOpen: false
    }],
    transportation: [],
    accommodation: [],
    entertainment: [],
    meals: [],
    miscellaneous: [],
    mealAllowanceInfo: {},
    totalMealAllowance: 0
  })


  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([])
  const [businessCountryOptions, setBusinessCountryOptions] = useState<CountryOption[]>([])
  const [simpleCountryOptions] = useState<CountryOption[]>([
    { value: 'DE', label: 'Germany', type: 'simple' },
    { value: 'OTHER', label: 'Other Countries', type: 'simple' }
  ])
  const [expandedSections, setExpandedSections] = useState({
    basicInfo: true,
    visitInfo: true,
    accommodationInfo: true,
    transportationInfo: true,
    mealInfo: true,
    entertainmentInfo: true,
    mealAllowanceInfo: true
  })
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [countrySearch, setCountrySearch] = useState('')
  const [frequentCountries] = useState<string[]>(['DE', 'FR', 'IT', 'GB', 'ES'])
  const [isEditMode, setIsEditMode] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [isAllowanceEnabled, setIsAllowanceEnabled] = useState(true)  // 식비 지급 여부 상태 추가

  const { saveFormData, loadFormData, clearOnLogout, policy } = useFormDataPolicy('business-expense')
  
  // 필터링된 국가 옵션
  const filteredCountryOptions = useMemo(() => {
    const searchTerm = countrySearch.toLowerCase();
    return countryOptions.filter(option => 
      option.value.toLowerCase().includes(searchTerm) || 
      option.label.toLowerCase().includes(searchTerm)
    );
  }, [countryOptions, countrySearch]);
  
  // 데이터 로드 함수
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 국가 옵션 로드
        const { data: countries, error } = await supabase
          .from('country_allowances')
          .select('country_code, country_name_de, country_name_ko')
          .order('country_name_de');

        if (error) throw error;
        
        if (!countries) {
          console.error('No countries data received');
          toast.error('국가 목록을 불러오는데 실패했습니다.');
          return;
        }

        const formattedOptions = countries.map((country) => ({
          value: country.country_code,
          label: country.country_name_de,
          type: 'business' as const
        }));
          
        // 자주 사용하는 국가를 맨 위로 정렬
        const sortedOptions = [...formattedOptions].sort((a, b) => {
          if (frequentCountries.includes(a.value) && !frequentCountries.includes(b.value)) return -1;
          if (!frequentCountries.includes(a.value) && frequentCountries.includes(b.value)) return 1;
          return a.label.localeCompare(b.label);
        });
          
        setCountryOptions(sortedOptions);
      } catch (error) {
        console.error('Error loading country options:', error);
        toast.error('국가 목록을 불러오는데 실패했습니다.');
      } finally {
        setIsInitialLoad(false);
      }
    };
    
    fetchData();
    
    // 편집 모드 확인
    const editMode = sessionStorage.getItem('expenseEditMode');
    const editExpenseId = sessionStorage.getItem('expenseEditId');
    
    if (editMode === 'true') {
      console.log('편집 모드 활성화');
      console.log('세션 유형:', editExpenseId ? `기존 데이터 (ID: ${editExpenseId})` : '신규 입력 데이터');
      setIsEditMode(true);
      if (editExpenseId) {
        setEditId(editExpenseId);
        console.log('편집 대상 ID 설정:', editExpenseId);
      }
      
      // 편집 모드 플래그 초기화 (한 번만 사용)
      sessionStorage.removeItem('expenseEditMode');
      
      // 편집 모드에서는 세션 스토리지에서 직접 데이터를 로드
      const editFormData = sessionStorage.getItem('expenseFormData');
      
      // 세션 스토리지에 데이터가 있는지 확인
      console.log('세션 스토리지 데이터 존재 여부:', !!editFormData);
      
      if (editFormData) {
        try {
          console.log('세션 스토리지에서 편집 데이터 로드 시작');
          console.log('데이터 크기:', Math.round(editFormData.length / 1024), 'KB');
          
          // 데이터 파싱 시도
          let parsedData;
          try {
            parsedData = JSON.parse(editFormData);
            console.log('데이터 파싱 성공');
            
            // 기본 데이터 구조 확인
            console.log('기본 데이터 구조 확인:');
            console.log('- name 존재:', !!parsedData.name);
            console.log('- startDate 존재:', !!parsedData.startDate);
            console.log('- endDate 존재:', !!parsedData.endDate);
            console.log('- visits 존재:', !!parsedData.visits);
            console.log('- transportation 존재:', !!parsedData.transportation);
            console.log('- accommodations 존재:', !!parsedData.accommodations);
            console.log('- entertainment 존재:', !!parsedData.entertainment);
          } catch (parseError) {
            console.error('데이터 파싱 오류:', parseError);
            console.error('원본 데이터 일부:', editFormData.substring(0, 100) + '...');
            toast.error('데이터 형식이 올바르지 않습니다.');
            return;
          }
          
          // 날짜 객체 변환
          console.log('날짜 객체 변환 시작');
          const processedData = {
            ...parsedData,
            startDate: parseDateFromStorage(parsedData.startDate),
            endDate: parseDateFromStorage(parsedData.endDate),
            date: parseDateFromStorage(parsedData.date),
            visits: parsedData.visits.map((visit: any) => ({
              ...visit,
              date: parseDateFromStorage(visit.date)
            })),
            transportation: parsedData.transportation.map((item: any) => ({
              ...item,
              date: parseDateFromStorage(item.date)
            })),
            accommodations: parsedData.accommodations.map((item: any) => ({
              ...item,
              startDate: parseDateFromStorage(item.startDate),
              endDate: parseDateFromStorage(item.endDate),
              breakfastDates: item.breakfastDates ? item.breakfastDates.map((date: string) => parseDateFromStorage(date)) : []
            })),
            entertainment: parsedData.entertainment.map((item: any) => ({
              ...item,
              date: parseDateFromStorage(item.date)
            })),
            meals: parsedData.meals.map((item: any) => ({
              ...item,
              date: parseDateFromStorage(item.date)
            }))
          };
          
          console.log('편집 데이터 처리 완료');
          console.log('기본 정보:', {
            이름: processedData.name,
            시작일: processedData.startDate,
            종료일: processedData.endDate,
            방문지수: processedData.visits.length,
            교통비항목수: processedData.transportation.length,
            숙박비항목수: processedData.accommodations.length,
            접대비항목수: processedData.entertainment.length
          });
          
          // 폼 데이터 설정
          setFormData(processedData);
          console.log('폼 데이터 설정 완료');
          
          // 국가 옵션 로드
          fetchData();
          return;
        } catch (error) {
          console.error('편집 데이터 처리 오류:', error);
          toast.error('데이터 로드 중 오류가 발생했습니다.');
        return;
      }
      } else {
        console.error('세션 스토리지에 편집 데이터가 없음');
        toast.error('편집할 데이터를 찾을 수 없습니다.');
        
        // 세션 스토리지의 모든 키 출력 (디버깅용)
        console.log('세션 스토리지 키 목록:');
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          console.log(`- ${key}`);
        }
      }
    }
    
    // 편집 모드가 아닌 경우 기존 방식으로 데이터 로드
    const savedData = loadFormData();
    if (savedData) {
      try {
        // 날짜 객체 변환
        const processedData = {
        ...savedData,
          startDate: parseDateFromStorage(savedData.startDate),
          endDate: parseDateFromStorage(savedData.endDate),
          visits: savedData.visits.map((visit: any) => ({
            ...visit,
            date: parseDateFromStorage(visit.date)
          })),
          transportation: savedData.transportation.map((item: any) => ({
            ...item,
            date: parseDateFromStorage(item.date)
          })),
          accommodations: savedData.accommodations.map((item: any) => ({
            ...item,
            startDate: parseDateFromStorage(item.startDate),
            endDate: parseDateFromStorage(item.endDate),
            breakfastDates: item.breakfastDates ? item.breakfastDates.map((date: string) => parseDateFromStorage(date)) : []
          })),
          entertainment: savedData.entertainment.map((item: any) => ({
            ...item,
            date: parseDateFromStorage(item.date)
          })),
          meals: savedData.meals.map((item: any) => ({
            ...item,
            date: parseDateFromStorage(item.date)
          }))
        };
        
        setFormData(processedData);
      } catch (error) {
        console.error('Error processing saved form data:', error);
      }
    }
    
    // 국가 옵션 로드
    fetchData();
  }, []);
  
  // 데이터 변경 시 저장
  const updateFormData = (key: keyof ExpenseForm, value: any) => {
    setFormData(prev => {
      const newFormData = { ...prev, [key]: value };
      
      // startTime 또는 endTime이 변경된 경우
      if (key === 'startTime' || key === 'endTime') {
        // mealAllowanceInfo 업데이트를 위해 빈 객체로 설정
        // MealAllowanceInfo 컴포넌트의 useEffect가 이를 감지하고 새로운 정보로 업데이트
        newFormData.mealAllowanceInfo = {};
      }
      
      return newFormData;
    });
  };
  
  // 섹션 토글 함수
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // 방문정보 추가
  const addVisit = () => {
    setFormData(prev => ({
      ...prev,
      visits: [
        ...prev.visits.map(visit => ({
          ...visit,
          isExpanded: false
        })),
        {
          date: undefined,
          companyName: '',
          city: '',
          description: '',
          isExpanded: true,
          datePickerOpen: false
        }
      ]
    }));
  };
  
  // 방문정보 업데이트
  const updateVisit = (index: number, field: string, value: any) => {
    console.log(`방문정보 업데이트 - 인덱스: ${index}, 필드: ${field}`, value);
    const newVisits = [...formData.visits];
    if (field === 'isExpanded') {
      // 다른 모든 항목을 닫고 현재 항목만 토글
      newVisits.forEach((visit, i) => {
        visit.isExpanded = i === index ? value : false;
      });
    } else {
    newVisits[index] = { ...newVisits[index], [field]: value };
    }
    console.log('업데이트된 방문정보:', newVisits[index]);
    updateFormData('visits', newVisits);
  };
  
  // 방문정보 삭제
  const removeVisit = (index: number) => {
    const newVisits = formData.visits.filter((_, i) => i !== index);
    updateFormData('visits', newVisits);
  };
  
  // 교통비 정보 추가 함수
  const addTransportation = () => {
    setFormData(prev => ({
      ...prev,
      transportation: [
        ...prev.transportation,
        {
          date: undefined,
          type: undefined,
          otherType: '',
          country: '',
          companyName: '',
          totalAmount: '',  // 초기값 추가
          paidBy: undefined,
          vat: '',
          isExpanded: true,
          datePickerOpen: false,
          mileage: ''
        }
      ]
    }));
  };
  
  // 교통비 정보 업데이트 함수
  const updateTransportation = (index: number, field: string, value: any) => {
    console.log(`updateTransportation: index=${index}, field=${field}, value=${value}`); // 디버깅용 로그
    const newTransportation = [...formData.transportation];
    newTransportation[index] = { ...newTransportation[index], [field]: value };
    updateFormData('transportation', newTransportation);
  };
  
  // 교통비 정보 삭제 함수
  const removeTransportation = (index: number) => {
    const newTransportation = formData.transportation.filter((_, i) => i !== index);
    updateFormData('transportation', newTransportation);
  };
  
  // 교통비 정보 토글 함수
  const toggleTransportation = (index: number) => {
    const newTransportation = [...formData.transportation];
    newTransportation[index] = { 
      ...newTransportation[index], 
      isExpanded: !newTransportation[index].isExpanded 
    };
    updateFormData('transportation', newTransportation);
  };
  
  // 숙박 정보 추가 함수
  const addAccommodation = () => {
    setFormData(prev => ({
      ...prev,
      accommodation: [
        ...prev.accommodation,
        {
          startDate: undefined,
          endDate: undefined,
          type: undefined,
          country: '',
          hotelName: '',
          paidBy: undefined,
          breakfastDates: [],
          cityTax: '',
          vat: '',
          totalAmount: '',
          isExpanded: true,
          datePickerOpen: false
        }
      ]
    }));
  };
  
  // 숙박 정보 업데이트 함수
  const updateAccommodation = async (index: number, field: string, value: any) => {
    const updatedFormData = { ...formData };
    if (!updatedFormData.accommodation) return;

    if (field === 'country' && updatedFormData.accommodation[index].type === 'private') {
      try {
        const { data: countryData, error } = await supabase
          .from('country_allowances')
          .select('accommodation_amount')
          .eq('country_code', value)
          .single();

        if (error) throw error;
        
        updatedFormData.accommodation[index] = {
          ...updatedFormData.accommodation[index],
          [field]: value,
          allowanceRate: countryData?.accommodation_amount || 0
        };
      } catch (error) {
        console.error('Error fetching country allowance:', error);
      }
    } else {
      updatedFormData.accommodation[index] = {
        ...updatedFormData.accommodation[index],
        [field]: value
      };
    }

    setFormData(updatedFormData);
  };
  
  // 숙박 정보 삭제 함수
  const removeAccommodation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      accommodation: prev.accommodation.filter((_, i) => i !== index)
    }));
  };
  
  // 숙박 정보 토글 함수
  const toggleAccommodation = (index: number) => {
    setFormData(prev => {
      const newAccommodation = [...prev.accommodation];
      newAccommodation[index] = {
        ...newAccommodation[index],
        isExpanded: !newAccommodation[index].isExpanded
      };
      return { ...prev, accommodation: newAccommodation };
    });
  };
  
  // 접대비 정보 추가 함수
  const addEntertainment = () => {
    setFormData(prev => ({
      ...prev,
      entertainment: [
        ...prev.entertainment,
        {
          date: undefined,
          type: undefined,
          otherType: '',
          country: '',
          companyName: '',
          totalAmount: '',  // amount를 totalAmount로 변경
          paidBy: undefined,
          vat: '',
          isExpanded: true,
          datePickerOpen: false
        }
      ]
    }));
  };
  
  // 접대비 정보 업데이트 함수
  const updateEntertainment = (index: number, field: string, value: any) => {
    const newEntertainment = [...formData.entertainment];
    newEntertainment[index] = { ...newEntertainment[index], [field]: value };
    updateFormData('entertainment', newEntertainment);
  };
  
  // 접대비 정보 삭제 함수
  const removeEntertainment = (index: number) => {
    const newEntertainment = formData.entertainment.filter((_, i) => i !== index);
    updateFormData('entertainment', newEntertainment);
  };
  
  // 접대비 정보 토글 함수
  const toggleEntertainment = (index: number) => {
    const newEntertainment = [...formData.entertainment];
    newEntertainment[index] = { 
      ...newEntertainment[index], 
      isExpanded: !newEntertainment[index].isExpanded 
    };
    updateFormData('entertainment', newEntertainment);
  };
  
  // 식대 정보 추가 함수
  const addMeal = () => {
    setFormData(prev => ({
      ...prev,
      meals: [
        ...prev.meals,
        {
          date: undefined,
          country: '',
          companyName: '',
          totalAmount: '',
          paidBy: undefined,
          vat: '',
          isExpanded: true,
          datePickerOpen: false
        }
      ]
    }));
  };
  
  // 식대 정보 업데이트 함수
  const updateMeal = (index: number, field: string, value: any) => {
    const newMeals = [...formData.meals];
    newMeals[index] = { ...newMeals[index], [field]: value };
    updateFormData('meals', newMeals);
  };
  
  // 식대 정보 삭제 함수
  const removeMeal = (index: number) => {
    const newMeals = formData.meals.filter((_, i) => i !== index);
    updateFormData('meals', newMeals);
  };
  
  // 식대 정보 토글 함수
  const toggleMeal = (index: number) => {
    const newMeals = [...formData.meals];
    newMeals[index] = { 
      ...newMeals[index], 
      isExpanded: !newMeals[index].isExpanded 
    };
    updateFormData('meals', newMeals);
  };



  // 기타 금액 정보 추가 함수
const addMiscellaneous = () => {
  setFormData(prev => ({
    ...prev,
    miscellaneous: [
      ...prev.miscellaneous,
      {
        date: undefined,
        type: undefined,
        otherType: '',
        country: '',
        companyName: '',
        totalAmount: '',
        paidBy: undefined,
        vat: '',
        isExpanded: true,
        datePickerOpen: false
      }
    ]
  }));
};

// 기타 금액 정보 업데이트 함수
const updateMiscellaneous = (index: number, field: string, value: any) => {
  const newMiscellaneous = [...formData.miscellaneous];
  newMiscellaneous[index] = { ...newMiscellaneous[index], [field]: value };
  updateFormData('miscellaneous', newMiscellaneous);
};

// 기타 금액 정보 삭제 함수
const removeMiscellaneous = (index: number) => {
  const newMiscellaneous = formData.miscellaneous.filter((_, i) => i !== index);
  updateFormData('miscellaneous', newMiscellaneous);
};

// 기타 금액 정보 토글 함수
const toggleMiscellaneous = (index: number) => {
  const newMiscellaneous = [...formData.miscellaneous];
  newMiscellaneous[index] = { 
    ...newMiscellaneous[index], 
    isExpanded: !newMiscellaneous[index].isExpanded 
  };
  updateFormData('miscellaneous', newMiscellaneous);
};
  
  // 필수 항목 검증 함수
  const validateForm = (): { isValid: boolean; errors: string[] } => {
    console.log('폼 검증 시작');
    const errors: string[] = [];
    
    // 기본 정보 검증
    if (!formData.name) {
      errors.push(t("validation.nameRequired"));
      // 이름 입력 필드로 스크롤
      document.getElementById('traveler-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 시각적 표시를 위해 클래스 추가
      document.getElementById('traveler-name')?.classList.add('border-red-500');
      // 첫 번째 오류만 처리하고 리턴
      return { isValid: false, errors };
    }
    
    if (!formData.startDate) {
      errors.push(t("validation.startDateRequired"));
      // 시작일 필드로 스크롤
      document.getElementById('start-date')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { isValid: false, errors };
    }
    
    if (!formData.endDate) {
      errors.push(t("validation.endDateRequired"));
      // 종료일 필드로 스크롤
      document.getElementById('end-date')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { isValid: false, errors };
    }
    
    // 출장목적과 프로젝트명은 필수 항목에서 제외
    // if (!formData.purpose) errors.push(t("validation.purposeRequired"));
    // if (!formData.projectName) errors.push(t("validation.projectNameRequired"));
    
    // 방문지 정보 검증 - 필수 항목에서 제외
    // if (formData.visits.length === 0) {
    //   errors.push(t("validation.visitRequired"));
    // } else {
    //   formData.visits.forEach((visit, index) => {
    //     if (!visit.date) errors.push(t("validation.visitDateRequired", { index: index + 1 }));
    //     if (!visit.companyName) errors.push(t("validation.visitCompanyRequired", { index: index + 1 }));
    //     if (!visit.city) errors.push(t("validation.visitCityRequired", { index: index + 1 }));
    //   });
    // }
    
    // 교통비 정보 검증 (교통 수단 선택만 필수)
    if (formData.transportation.length > 0) {
      for (let index = 0; index < formData.transportation.length; index++) {
        const item = formData.transportation[index];
        
        // 교통 수단(type)만 필수로 검증
        if (!item.type) {
          console.log('교통 수단 선택 누락:', index);
          errors.push(t("validation.transportationTypeRequired", { index: index + 1 }));
          // 해당 교통비 항목으로 스크롤
          document.getElementById(`transportation-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return { isValid: false, errors };
        }
        
        // 나머지 필드는 비필수로 처리
        console.log('교통비 항목 검증 성공:', index);
      }
    }
    
    // 숙박비 정보 검증 (비필수 항목으로 변경)
    if (formData.accommodations.length > 0) {
      for (let index = 0; index < formData.accommodations.length; index++) {
        const item = formData.accommodations[index];
        // 숙박비 정보는 모두 비필수로 처리
        console.log('숙박비 항목 검증 성공:', index);
      }
    }
    
    // 접대비 정보 검증 (비필수 항목으로 변경)
    if (formData.entertainment.length > 0) {
      for (let index = 0; index < formData.entertainment.length; index++) {
        const item = formData.entertainment[index];
        // 접대비 정보는 모두 비필수로 처리
        console.log('접대비 항목 검증 성공:', index);
      }
    }
    
    console.log('폼 검증 결과:', errors.length === 0, errors);
    return { isValid: errors.length === 0, errors };
  };
  
  // 경비 저장 함수
  const handleCreateExpense = async () => {
    // 폼 유효성 검사
    const { isValid, errors } = validateForm();
    
    if (!isValid) {
      // 폼 검증 실패 시 오류 메시지 표시
      toast.error(errors[0]); // 첫 번째 오류 메시지만 표시
      return;
    }
    
    try {
      // 로딩 상태 설정
      setIsLoading(true);
      
      // 편집 모드인 경우 (기존 데이터 업데이트)
      if (isEditMode && editId) {
        console.log('편집 모드: 기존 데이터 업데이트');
        
        // 1. 기본 정보 업데이트
        const { error: updateError } = await supabase
          .from('business_expenses')
          .update({
            name: formData.name,
            start_date: formatDateForStorage(formData.startDate),
            end_date: formatDateForStorage(formData.endDate),
            purpose: formData.purpose,
            project_name: formData.projectName,
            project_number: formData.projectNumber
          })
          .eq('id', editId);
          
        if (updateError) {
          console.error('기본 정보 업데이트 오류:', updateError);
          toast.error('데이터 업데이트 중 오류가 발생했습니다.');
        return;
      }

        // 2. 방문 정보 업데이트 (기존 데이터 삭제 후 새로 추가)
        // 기존 방문 정보 삭제
        const { error: deleteVisitsError } = await supabase
          .from('expense_visits')
          .delete()
          .eq('expense_id', editId);
          
        if (deleteVisitsError) {
          console.error('방문 정보 삭제 오류:', deleteVisitsError);
          toast.error('방문 정보 업데이트 중 오류가 발생했습니다.');
        return;
      }
      
        // 새 방문 정보 추가
        if (formData.visits.length > 0) {
          const visitsToInsert = formData.visits.map(visit => ({
            expense_id: editId,
            date: formatDateForStorage(visit.date),
            company_name: visit.companyName,
            city: visit.city,
            description: visit.description
          }));
          
          const { error: insertVisitsError } = await supabase
            .from('expense_visits')
            .insert(visitsToInsert);
            
          if (insertVisitsError) {
            console.error('방문 정보 추가 오류:', insertVisitsError);
            toast.error('방문 정보 업데이트 중 오류가 발생했습니다.');
        return;
          }
        }
        
        // 3. 교통비 정보 업데이트 (기존 데이터 삭제 후 새로 추가)
        // 기존 교통비 정보 삭제
        const { error: deleteTransportationError } = await supabase
          .from('expense_transportation')
          .delete()
          .eq('expense_id', editId);
          
        if (deleteTransportationError) {
          console.error('교통비 정보 삭제 오류:', deleteTransportationError);
          toast.error('교통비 정보 업데이트 중 오류가 발생했습니다.');
          return;
        }
        
        // 새 교통비 정보 추가
        if (formData.transportation.length > 0) {
          const transportationToInsert = formData.transportation.map(item => ({
            expense_id: editId,
            date: formatDateForStorage(item.date),
            type: item.type,
            country: item.country,
            company_name: item.companyName,
            paid_by: item.paidBy,
            vat: item.vat ? parseFloat(item.vat) : null,
            total_amount: item.totalAmount ? parseFloat(item.totalAmount) : null,
            mileage: item.mileage ? parseFloat(item.mileage) : null,
            license_plate: item.licensePlate
          }));
          
          const { error: insertTransportationError } = await supabase
            .from('expense_transportation')
            .insert(transportationToInsert);
            
          if (insertTransportationError) {
            console.error('교통비 정보 추가 오류:', insertTransportationError);
            toast.error('교통비 정보 업데이트 중 오류가 발생했습니다.');
        return;
          }
        }
        
        // 4. 숙박비 정보 업데이트 (기존 데이터 삭제 후 새로 추가)
        // 기존 숙박비 정보 및 조식 정보 삭제
        // 먼저 조식 정보 삭제 (외래 키 제약 조건 때문)
        const { data: accommodationIds } = await supabase
          .from('expense_accommodations')
          .select('id')
          .eq('expense_id', editId);
          
        if (accommodationIds && accommodationIds.length > 0) {
          const ids = accommodationIds.map(item => item.id);
          
          // 조식 정보 삭제
          const { error: deleteBreakfastsError } = await supabase
            .from('expense_accommodation_breakfasts')
            .delete()
            .in('accommodation_id', ids);
            
          if (deleteBreakfastsError) {
            console.error('조식 정보 삭제 오류:', deleteBreakfastsError);
            toast.error('숙박 정보 업데이트 중 오류가 발생했습니다.');
            return;
          }
        }
        
        // 숙박비 정보 삭제
        const { error: deleteAccommodationsError } = await supabase
          .from('expense_accommodations')
          .delete()
          .eq('expense_id', editId);
          
        if (deleteAccommodationsError) {
          console.error('숙박비 정보 삭제 오류:', deleteAccommodationsError);
          toast.error('숙박 정보 업데이트 중 오류가 발생했습니다.');
          return;
        }
        
        // 새 숙박비 정보 추가
        if (formData.accommodations.length > 0) {
          // 숙박비 정보 추가
          for (const accommodation of formData.accommodations) {
            // 숙박비 정보 추가
            const { data: newAccommodation, error: insertAccommodationError } = await supabase
              .from('expense_accommodations')
              .insert({
                expense_id: editId,
                start_date: formatDateForStorage(accommodation.startDate),
                end_date: formatDateForStorage(accommodation.endDate),
                type: accommodation.type,
                country: accommodation.country,
                hotel_name: accommodation.hotelName,
                paid_by: accommodation.paidBy,
                city_tax: accommodation.cityTax ? parseGermanNumber(accommodation.cityTax) : null,
                vat: accommodation.vat ? parseGermanNumber(accommodation.vat) : null,
                total_amount: accommodation.totalAmount ? parseGermanNumber(accommodation.totalAmount) : null
              })
              .select('id')
              .single();
              
            if (insertAccommodationError) {
              console.error('숙박 정보 추가 오류:', insertAccommodationError);
              toast.error('숙박 정보 업데이트 중 오류가 발생했습니다.');
              return;
            }
            
            // 조식 정보 추가
            if (newAccommodation && accommodation.breakfastDates.length > 0) {
              const breakfastsToInsert = accommodation.breakfastDates.map((date: Date) => ({
                accommodation_id: newAccommodation.id,
                breakfast_date: formatDateForStorage(date)
              }));
              
              const { error: insertBreakfastsError } = await supabase
                .from('expense_accommodation_breakfasts')
                .insert(breakfastsToInsert);
                
              if (insertBreakfastsError) {
                console.error('조식 정보 추가 오류:', insertBreakfastsError);
                toast.error('조식 정보 업데이트 중 오류가 발생했습니다.');
                return;
              }
            }
          }
        }
        
        // 5. 접대비 정보 업데이트 (기존 데이터 삭제 후 새로 추가)
        // 기존 접대비 정보 삭제
        const { error: deleteEntertainmentError } = await supabase
          .from('expense_entertainment')
          .delete()
          .eq('expense_id', editId);
          
        if (deleteEntertainmentError) {
          console.error('접대비 정보 삭제 오류:', deleteEntertainmentError);
          toast.error('접대비 정보 업데이트 중 오류가 발생했습니다.');
          return;
        }
        
        // 새 접대비 정보 추가
        if (formData.entertainment.length > 0) {
          const entertainmentToInsert = formData.entertainment.map(item => ({
            expense_id: editId,
            date: formatDateForStorage(item.date),
            type: item.type,
            country: item.country,
            company_name: item.companyName,
            paid_by: item.paidBy,
            vat: item.vat ? parseFloat(item.vat) : null,
            total_amount: item.totalAmount ? parseFloat(item.totalAmount) : null
          }));
          
          const { error: insertEntertainmentError } = await supabase
            .from('expense_entertainment')
            .insert(entertainmentToInsert);
            
          if (insertEntertainmentError) {
            console.error('접대비 정보 추가 오류:', insertEntertainmentError);
            toast.error('접대비 정보 업데이트 중 오류가 발생했습니다.');
            return;
          }
        }
        
        // 업데이트 성공 메시지
        toast.success('출장 경비 정보가 성공적으로 업데이트되었습니다.');
      }
      
      console.log('세션 스토리지에 데이터 저장 시작');
      console.log('세션 유형:', isEditMode ? (editId ? `기존 데이터 (ID: ${editId})` : '신규 입력 데이터') : '신규 입력 데이터');
      
      // 날짜 객체를 ISO 문자열로 변환하여 저장
      const formDataToSave = {
        ...formData,
        // 기본 날짜 필드
        startDate: formData.startDate ? formData.startDate.toISOString() : undefined,
        endDate: formData.endDate ? formData.endDate.toISOString() : undefined,
        
        // 방문 정보의 날짜
        visits: formData.visits.map(visit => ({
          ...visit,
          date: visit.date ? visit.date.toISOString() : undefined
        })),
        
        // 교통비 정보의 날짜
        transportation: formData.transportation.map(item => ({
          ...item,
          date: item.date ? item.date.toISOString() : undefined
        })),
        
        // 숙박비 정보의 날짜
        accommodation: formData.accommodation.map(item => ({
          ...item,
          startDate: item.startDate ? item.startDate.toISOString() : undefined,
          endDate: item.endDate ? item.endDate.toISOString() : undefined,
          breakfastDates: item.breakfastDates.map(d => d.toISOString())
        })),
        
        // 접대비 정보의 날짜
        entertainment: formData.entertainment.map(item => ({
          ...item,
          date: item.date ? item.date.toISOString() : undefined
        })),
        
        // 식대 정보의 날짜
        meals: formData.meals.map(item => ({
          ...item,
          date: item.date ? item.date.toISOString() : undefined
        })),

        // 기타 금액 정보의 날짜
        miscellaneous: formData.miscellaneous.map(item => ({
          ...item,
          date: item.date ? item.date.toISOString() : undefined
        })),
        
        // 식대 정보 - 객체 형태 유지
        mealAllowanceInfo: Object.fromEntries(
          Object.entries(formData.mealAllowanceInfo).map(([date, info]) => [
            date,
            info.map(item => ({
              ...item,
              date: item.date
            }))
          ])
        )
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
      
      // 편집 모드인 경우 ID도 함께 전달
      if (isEditMode && editId) {
        // 편집 완료 플래그 설정 (요약 페이지에서 이 값을 확인하여 편집 완료 상태임을 인식)
        sessionStorage.setItem('expenseEditComplete', 'true');
        // 편집 대상 ID 저장
        sessionStorage.setItem('expenseEditId', editId);
        // 요약 페이지로 이동 (ID를 URL 파라미터로 전달하지 않음)
        router.push(`/${locale}/business-expense/summary`);
      } else {
        // 새로운 데이터인 경우 요약 페이지로 이동
        router.push(`/${locale}/business-expense/summary`);
      }
    } catch (error) {
      console.error('Error saving expense data:', error);
      toast.error('데이터 저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // 로딩 중 상태 렌더링
  if (isInitialLoad) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 lg:ml-64">
          <div className="p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
              <div className="space-y-4">
                <div className="h-40 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // 메인 컴포넌트 렌더링
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 lg:ml-64">
        <div>
          <div className="container py-10 px-4">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">
                {t("expense.title")}
              </h1>
              <p className="text-muted-foreground">
                {t("expense.languageNotice")}
              </p>
            </div>
            
            <div className="max-w-3xl space-y-4">
              {/* 기본 정보 */}
              <Card className="mb-4">
                <CardContent className="pt-2 pb-2">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">{t("expense.basicInfo.title")}</h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSection('basicInfo')}
                      className="hover:bg-gray-800 hover:text-white cursor-pointer"
                    >
                      {expandedSections.basicInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {expandedSections.basicInfo && (
                    <div className="space-y-4">
                      {/* 기본 정보 내용 */}
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                        <RequiredLabel>
                          <Label>{t("expense.basicInfo.travelerName.label")}</Label>
                        </RequiredLabel>
                        <Input
                            id="traveler-name"
                          value={formData.name}
                          onChange={(e) => updateFormData('name', e.target.value)}
                          placeholder={t("expense.basicInfo.travelerName.placeholder")}
                        />
                      </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="grid gap-2">
                          <RequiredLabel>
                            <Label>{t("expense.basicInfo.startDate")}</Label>
                          </RequiredLabel>
                            <div id="start-date" className="flex flex-col space-y-2">
                              <DatePicker
                                date={formData.startDate}
                                setDate={(date) => updateFormData('startDate', date)}
                              />
                        </div>
                          </div>
                          <div className="grid gap-2">
                          <Label>{t("expense.basicInfo.startTime")}</Label>
                          <TimeSelect
                            value={formData.startTime}
                            onChange={(value) => updateFormData('startTime', value)}
                          />
                        </div>
                      </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="grid gap-2">
                          <RequiredLabel>
                            <Label>{t("expense.basicInfo.endDate")}</Label>
                          </RequiredLabel>
                            <div id="end-date" className="flex flex-col space-y-2">
                              <DatePicker
                                date={formData.endDate}
                                setDate={(date) => updateFormData('endDate', date)}
                              />
                        </div>
                          </div>
                          <div className="grid gap-2">
                          <Label>{t("expense.basicInfo.endTime")}</Label>
                          <TimeSelect
                            value={formData.endTime}
                            onChange={(value) => updateFormData('endTime', value)}
                          />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* 방문지 정보 */}
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">{t("expense.visitInfo.title")}</h2>
                    <Button
                      onClick={addVisit}
                      variant="outline"
                      size="sm"
                    >
                      {t("expense.visitInfo.addButton")}
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {formData.visits.map((visit, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="w-[120px]">
                          <Popover open={visit.datePickerOpen} onOpenChange={(open) => updateVisit(index, 'datePickerOpen', open)}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !visit.date && "text-muted-foreground"
                                )}
                                disabled={!formData.startDate || !formData.endDate}
                              >
                                <CalendarIcon className="mr-1 h-3 w-3" />
                                {visit.date ? dateFormat(visit.date, "yy-MM-dd") : t("expense.visitInfo.date")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={visit.date}
                                onDayClick={(day) => {
                                  console.log('방문지 날짜 선택됨 (onDayClick):', day);
                                  // 직접 formData를 업데이트
                                  const newVisits = [...formData.visits];
                                  newVisits[index] = { 
                                    ...newVisits[index], 
                                    date: day,
                                    datePickerOpen: false 
                                  };
                                  console.log('새 방문 정보:', newVisits[index]);
                                  setFormData({
                                    ...formData,
                                    visits: newVisits
                                  });
                                  // 저장
                                  saveFormData({
                                    ...formData,
                                    visits: newVisits
                                  });
                                }}
                                disabled={(date) => {
                                  if (!formData.startDate || !formData.endDate) return true;
                                  const startDate = new Date(formData.startDate);
                                  const endDate = new Date(formData.endDate);
                                  return date < startDate || date > endDate;
                                }}
                                fromDate={formData.startDate}
                                toDate={formData.endDate}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="flex-1">
                          <Input
                            value={visit.companyName}
                            onChange={(e) => updateVisit(index, 'companyName', e.target.value)}
                            placeholder={t("expense.visitInfo.companyName.placeholder")}
                          />
                        </div>

                        <div className="flex-1">
                          <Input
                            value={visit.city}
                            onChange={(e) => updateVisit(index, 'city', e.target.value)}
                            placeholder={t("expense.visitInfo.city.placeholder")}
                          />
                        </div>

                        <div className="flex-[2]">
                          <Input
                            value={visit.description}
                            onChange={(e) => updateVisit(index, 'description', e.target.value)}
                            placeholder={t("expense.visitInfo.description.placeholder")}
                          />
                        </div>

                        {/* 방문 정보 삭제 버튼 */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeVisit(index)}
                          className="text-red-500 hover:bg-accent cursor-pointer"
                          title={t("expense.visitInfo.deleteButton")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 식대 및 숙박비 지급 질문 */}
              <Card className="mb-4">
                <CardContent className="pt-2">
                  <div className="space-y-6">
                    {/* 일괄 식비 지급 질문 */}
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-semibold">{t("expense.allowance.meal.title")}</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t("expense.allowance.meal.description")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {formData.mealOption ? t("expense.allowance.meal.willBePaid") : t("expense.allowance.meal.willNotBePaid")}
                        </span>
                        <Switch
                          checked={formData.mealOption}
                          onCheckedChange={(checked) => updateFormData('mealOption', checked)}
                        />
                      </div>
                    </div>

                    {/* 숙박비 지급 질문 항목 제거 */}
                  </div>
                </CardContent>
              </Card>

              {/* 교통비 정보 */}
              <Card className="mb-4">
                <CardContent className="pt-2">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">{t("expense.transportation.title")}</h2>
                    <Button
                      onClick={addTransportation}
                      variant="outline"
                      size="sm"
                    >
                      {t("expense.transportation.addButton")}
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {formData.transportation.map((item, index) => (
                      <Card key={index} id={`transportation-${index}`} className="border border-gray-200">
                        <CardContent className="pt-2">
                          <div className="flex items-center justify-between mb-4">
                            <div className="space-y-1">
                              <h3 className="font-medium">
                                {t("expense.transportation.item", { number: index + 1 })}
                              </h3>
                              {!item.isExpanded && (
                                <div className="space-y-0.5">
                                  <p className="text-sm text-muted-foreground">
                                    {item.date ? dateFormat(item.date, "yy-MM-dd") : t("expense.transportation.date.label")}
                                  </p>
                                  <div className="flex gap-2 text-sm text-muted-foreground">
                                    {item.type && (
                                      <span>
                                        {item.type === 'flight' ? t("expense.transportation.type.flight") : 
                                         item.type === 'train' ? t("expense.transportation.type.train") : 
                                         item.type === 'taxi' ? t("expense.transportation.type.taxi") : 
                                         item.type === 'fuel' ? t("expense.transportation.type.fuel") : 
                                         item.type === 'rental' ? t("expense.transportation.type.rental") : 
                                         item.type === 'mileage' || item.type === 'km_pauschale' ? 
                                           `${t("expense.transportation.type.km_pauschale")}${item.mileage ? ` (${item.mileage.replace('.', ',')}km)` : ''}` :
                                         t("expense.transportation.type.mileage")}
                                      </span>
                                    )}
                                    {item.companyName && (
                                      <>
                                        <span>|</span>
                                        <span>{item.companyName}</span>
                                      </>
                                    )}
                                    {item.paidBy && (
                                      <>
                                        <span>|</span>
                                        <span>{item.paidBy === 'company' ? t("expense.paidBy.company") : t("expense.paidBy.personal")}</span>
                                      </>
                                    )}
                                    {item.totalAmount && (
                                      <>
                                        <span>|</span>
                                        <span>{formatNumber(Number(item.totalAmount))}€</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleTransportation(index)}
                                className="cursor-pointer"
                              >
                                {item.isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              {/* 교통비 정보 삭제 버튼 */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeTransportation(index)}
                                className="text-red-500 hover:bg-accent cursor-pointer"
                                title={t("expense.transportation.deleteButton")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* 교통비 상세 폼 내용 */}
                          {item.isExpanded && (
                            <>
                              <div className="space-y-4">
                                {/* 기존 교통비 폼 내용 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>{t("expense.transportation.date.label")}</Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !item.date && "text-muted-foreground"
                                          )}
                                        >
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {item.date ? dateFormat(item.date, "yy-MM-dd") : <span>{t("expense.transportation.date.placeholder")}</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar
                                          mode="single"
                                          selected={item.date}
                                          onDayClick={(day) => updateTransportation(index, 'date', day)}
                                          disabled={(date) => {
                                            if (!formData.startDate || !formData.endDate) return true;
                                            // 시작일부터 종료일까지 선택 가능하도록 수정
                                            const startDate = new Date(formData.startDate);
                                            startDate.setHours(0, 0, 0, 0);
                                            const endDate = new Date(formData.endDate);
                                            endDate.setHours(23, 59, 59, 999);
                                            return date < startDate || date > endDate;
                                          }}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                    <div className="space-y-2">
                                      <Label>{t("expense.transportation.type.label")}</Label>
                                    <Select
                                      value={item.type}
                                      onValueChange={(value) => updateTransportation(index, 'type', value)}
                                    >
                                        <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t("expense.transportation.type.placeholder")} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="flight">{t("expense.transportation.type.flight")}</SelectItem>
                                          <SelectItem value="train">{t("expense.transportation.type.train")}</SelectItem>
                                        <SelectItem value="taxi">{t("expense.transportation.type.taxi")}</SelectItem>
                                        <SelectItem value="fuel">{t("expense.transportation.type.fuel")}</SelectItem>
                                        <SelectItem value="rental">{t("expense.transportation.type.rental")}</SelectItem>
                                          <SelectItem value="mileage">{t("expense.transportation.type.km_pauschale")}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                {item.type !== 'mileage' && (
                                  <>
                                    <div className="space-y-2">
                                      <Label>{t("expense.transportation.country.label")}</Label>
                                  <Select
                                    value={item.country}
                                    onValueChange={(value) => updateTransportation(index, 'country', value)}
                                  >
                                      <SelectTrigger className="w-full">
                                      <SelectValue placeholder={t("expense.transportation.country.placeholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                          {simpleCountryOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                    <div className="space-y-2">
                                      <Label>{t("expense.transportation.companyName.label")}</Label>
                                  <Input
                                        placeholder={t("expense.transportation.companyName.placeholder")}
                                    value={item.companyName}
                                    onChange={(e) => updateTransportation(index, 'companyName', e.target.value)}
                                  />
                                    </div>
                                  </>
                                )}

                                {(item.type === 'mileage' || item.type === 'km_pauschale') ? (
                                  <div className="form-group">
                                    <Label className="form-label">{t("expense.transportation.mileage.label")}</Label>
                                    <div className="form-input-with-unit">
                                      <GermanNumberInput
                                        value={item.mileage || ''}
                                        onChange={(value) => updateTransportation(index, 'mileage', String(value))}
                                        placeholder={t("expense.transportation.mileage.placeholder")}
                                      />
                                      <span className="form-input-unit">km</span>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {/* 결제자와 부가세를 한 줄에 배치 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                      {/* 결제자 */}
                                      <div className="space-y-2">
                                        <Label>{t("expense.paidBy.label")}</Label>
                                        <Select
                                          value={item.paidBy}
                                          onValueChange={(value) => updateTransportation(index, 'paidBy', value)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder={t("expense.paidBy.placeholder")} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="company">{t("expense.paidBy.company")}</SelectItem>
                                            <SelectItem value="personal">{t("expense.paidBy.personal")}</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      {/* 부가세 */}
                                      <div className="form-group">
                                        <Label className="form-label">{t("expense.transportation.vat.label")}</Label>
                                        <div className="form-input-with-unit">
                                          <GermanNumberInput
                                            value={item.vat}
                                            onChange={(value) => updateTransportation(index, 'vat', String(value))}
                                            placeholder={t("expense.transportation.vat.placeholder")}
                                          />
                                          <span className="form-input-unit">€</span>
                                        </div>
                                      </div>
                                    </div>
                                    {/* 총액 */}
                                    <div className="form-group">
                                      <Label className="form-label">{t("expense.transportation.totalAmount.label")}</Label>
                                      <div className="form-input-with-unit">
                                        <GermanNumberInput
                                          value={item.totalAmount}
                                          onChange={(value) => updateTransportation(index, 'totalAmount', String(value))}
                                          placeholder={t("expense.transportation.totalAmount.placeholder")}
                                        />
                                        <span className="form-input-unit">€</span>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="flex justify-center mt-4">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => toggleTransportation(index)}
                                  className="w-full"
                                >
                                  <ChevronUp className="h-4 w-4 mr-2" />
                                  창 닫기
                                </Button>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 숙박비 정보 */}
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">{t("expense.accommodation.title")}</h2>
                    <Button
                      onClick={addAccommodation}
                      variant="outline"
                      size="sm"
                    >
                      {t("expense.accommodation.addButton")}
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {formData.accommodation.map((item, index) => (
                      <Card key={index} id={`accommodation-${index}`} className="border border-gray-200">
                        <CardContent className="pt-2">
                          <div className="flex items-center justify-between mb-4">
                            <div className="space-y-1">
                              <h3 className="font-medium">
                                {t("expense.accommodation.item", { number: index + 1 })}
                              </h3>
                              {!item.isExpanded && (
                                <div className="space-y-0.5">
                                  <p className="text-sm text-muted-foreground">
                                    {item.startDate && item.endDate ? 
                                      `${dateFormat(item.startDate, "yy-MM-dd")} ~ ${dateFormat(item.endDate, "yy-MM-dd")}` : 
                                      t("expense.accommodation.date.label")}
                                  </p>
                                  <div className="flex gap-2 text-sm text-muted-foreground">
                                    {item.type === 'hotel' ? (
                                      <>
                                        <span>{t("expense.accommodation.type.hotel")}</span>
                                        {item.hotelName && (
                                          <>
                                            <span>|</span>
                                            <span>{item.hotelName}</span>
                                          </>
                                        )}
                                        {item.country && (
                                          <>
                                            <span>|</span>
                                            <span>{item.country === 'DE' ? 'Germany' : 'Other Countries'}</span>
                                          </>
                                        )}
                                        {item.paidBy && item.totalAmount && (
                                          <>
                                            <span>|</span>
                                            <span>{item.paidBy === 'company' ? t("expense.paidBy.company") : t("expense.paidBy.personal")}</span>
                                            <span>|</span>
                                            <span>{item.totalAmount.replace('.', ',')}€</span>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <span>{t("expense.accommodation.type.private")}</span>
                                        {item.country && (
                                          <>
                                            <span>|</span>
                                            <span>{countryOptions.find(option => option.value === item.country)?.label || item.country}</span>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleAccommodation(index)}
                                className="cursor-pointer"
                              >
                                {item.isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              {/* 숙박비 정보 삭제 버튼 */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAccommodation(index)}
                                className="text-red-500 hover:bg-accent cursor-pointer"
                                title={t("expense.accommodation.deleteButton")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* 숙박비 상세 폼 내용 */}
                          {item.isExpanded && (
                            <>
                              <div className="space-y-4">
                                {/* 기존 숙박비 폼 내용 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>{t("expense.accommodation.checkIn.label")}</Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !item.startDate && "text-muted-foreground"
                                          )}
                                        >
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {item.startDate ? dateFormat(item.startDate, "yy-MM-dd") : <span>{t("expense.accommodation.checkIn.placeholder")}</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar
                                          mode="single"
                                          selected={item.startDate}
                                          onDayClick={(day) => updateAccommodation(index, 'startDate', day)}
                                          disabled={(date) => {
                                            if (!formData.startDate || !formData.endDate) return true;
                                            const startDate = new Date(formData.startDate);
                                            startDate.setHours(0, 0, 0, 0);
                                            const endDate = new Date(formData.endDate);
                                            endDate.setHours(23, 59, 59, 999);
                                            return date < startDate || date > endDate;
                                          }}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{t("expense.accommodation.checkOut.label")}</Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !item.endDate && "text-muted-foreground"
                                          )}
                                          disabled={!item.startDate}
                                        >
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {item.endDate ? dateFormat(item.endDate, "yy-MM-dd") : <span>{t("expense.accommodation.checkOut.placeholder")}</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar
                                          mode="single"
                                          selected={item.endDate}
                                          onDayClick={(day) => updateAccommodation(index, 'endDate', day)}
                                          disabled={(date) => {
                                            if (!item.startDate || !formData.endDate) return true;
                                            const startDate = new Date(item.startDate);
                                            startDate.setHours(0, 0, 0, 0);
                                            const endDate = new Date(formData.endDate);
                                            endDate.setHours(23, 59, 59, 999);
                                            return date <= startDate || date > endDate;
                                          }}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                </div>

                                {/* 숙박 유형 */}
                                <div className="space-y-2">
                                  <Label>{t("expense.accommodation.type.label")}</Label>
                                  <Select
                                    value={item.type}
                                    onValueChange={(value) => updateAccommodation(index, 'type', value)}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder={t("expense.accommodation.type.placeholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="hotel">{t("expense.accommodation.type.hotel")}</SelectItem>
                                      <SelectItem value="private">{t("expense.accommodation.type.private")}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* 국가 선택 */}
                                <div className="space-y-2">
                                  <Label>{t("expense.accommodation.country.label")}</Label>
                                  {item.type === 'hotel' ? (
                                    <Select
                                      value={item.country}
                                      onValueChange={(value) => updateAccommodation(index, 'country', value)}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t("expense.accommodation.country.placeholder")} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {simpleCountryOptions.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <CountrySelector
                                      value={item.country}
                                      onChange={(value) => updateAccommodation(index, 'country', value)}
                                      placeholder={t("expense.accommodation.country.placeholder")}
                                    />
                                  )}
                                </div>

                                {/* 호텔 타입일 때만 보이는 필드들 */}
                                {item.type === 'hotel' && (
                                  <>
                                    {/* 호텔명 */}
                                    <div className="space-y-2">
                                      <Label>{t("expense.accommodation.hotelName.label")}</Label>
                                      <Input
                                        value={item.hotelName}
                                        onChange={(e) => updateAccommodation(index, 'hotelName', e.target.value)}
                                        placeholder={t("expense.accommodation.hotelName.placeholder")}
                                      />
                                    </div>

                                    {/* 결제자와 부가세를 한 줄에 배치 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                      {/* 결제자 */}
                                      <div className="space-y-2">
                                        <Label>{t("expense.paidBy.label")}</Label>
                                        <Select
                                          value={item.paidBy}
                                          onValueChange={(value) => updateAccommodation(index, 'paidBy', value)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder={t("expense.paidBy.placeholder")} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="company">{t("expense.paidBy.company")}</SelectItem>
                                            <SelectItem value="personal">{t("expense.paidBy.personal")}</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      
                                      {/* 부가세 */}
                                      <div className="form-group">
                                        <Label className="form-label">{t("expense.accommodation.vat.label")}</Label>
                                        <div className="relative">
                                          <GermanNumberInput
                                            value={item.vat}
                                            onChange={(value) => updateAccommodation(index, 'vat', String(value))}
                                            placeholder="0,00"
                                            className="pr-8"
                                          />
                                          <span className="absolute right-3 top-1/2 -translate-y-1/2">€</span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* 총액 */}
                                    <div className="form-group">
                                      <Label className="form-label">{t("expense.accommodation.totalAmount.label")}</Label>
                                      <div className="relative">
                                        <GermanNumberInput
                                          value={item.totalAmount}
                                          onChange={(value) => updateAccommodation(index, 'totalAmount', String(value))}
                                          placeholder="0,00"
                                          className="pr-8"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2">€</span>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="flex justify-center mt-4">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => toggleAccommodation(index)}
                                  className="w-full"
                                >
                                  <ChevronUp className="h-4 w-4 mr-2" />
                                  창 닫기
                                </Button>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 접대비 정보 */}
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">{t("expense.entertainment.title")}</h2>
                    <Button
                      onClick={addEntertainment}
                      variant="outline"
                      size="sm"
                    >
                      {t("expense.entertainment.addButton")}
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {formData.entertainment.map((item, index) => (
                      <Card key={index} id={`entertainment-${index}`} className="border border-gray-200">
                        <CardContent className="pt-2">
                          <div className="flex items-center justify-between mb-4">
                            <div className="space-y-1">
                              <h3 className="font-medium">
                                {t("expense.entertainment.item", { number: index + 1 })}
                              </h3>
                              {!item.isExpanded && (
                                <div className="space-y-0.5">
                                  <p className="text-sm text-muted-foreground">
                                    {item.date ? dateFormat(item.date, "yy-MM-dd") : t("expense.entertainment.date.label")}
                                  </p>
                                  <div className="flex gap-2 text-sm text-muted-foreground">
                                    {item.type && (
                                      <span>
                                        {item.type === 'breakfast' ? t("expense.entertainment.type.breakfast") : 
                                         item.type === 'lunch' ? t("expense.entertainment.type.lunch") : 
                                         item.type === 'dinner' ? t("expense.entertainment.type.dinner") : 
                                         t("expense.entertainment.type.coffee")}
                                      </span>
                                    )}
                                    {item.companyName && (
                                      <>
                                        <span>|</span>
                                        <span>{item.companyName}</span>
                                      </>
                                    )}
                                    {item.paidBy && (
                                      <>
                                        <span>|</span>
                                        <span>{item.paidBy === 'company' ? t("expense.paidBy.company") : t("expense.paidBy.personal")}</span>
                                      </>
                                    )}
                                    {item.totalAmount && (
                                      <>
                                        <span>|</span>
                                        <span>{item.totalAmount.replace('.', ',')}€</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleEntertainment(index)}
                                className="cursor-pointer"
                              >
                                {item.isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              {/* 접대비 정보 삭제 버튼 */}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeEntertainment(index)}
                                className="text-red-500 hover:bg-accent cursor-pointer"
                                title={t("expense.entertainment.deleteButton")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* 접대비 상세 폼 내용 */}
                          {item.isExpanded && (
                            <>
                              <div className="space-y-4">
                                {/* 기존 접대비 폼 내용 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>{t("expense.entertainment.date.label")}</Label>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !item.date && "text-muted-foreground"
                                          )}
                                        >
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {item.date ? dateFormat(item.date, "yy-MM-dd") : <span>{t("expense.entertainment.date.placeholder")}</span>}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar
                                          mode="single"
                                          selected={item.date}
                                          onDayClick={(day) => updateEntertainment(index, 'date', day)}
                                          disabled={(date) => {
                                            if (!formData.startDate || !formData.endDate) return true;
                                            // 시작일부터 종료일까지 선택 가능하도록 수정
                                            const startDate = new Date(formData.startDate);
                                            startDate.setHours(0, 0, 0, 0);
                                            const endDate = new Date(formData.endDate);
                                            endDate.setHours(23, 59, 59, 999);
                                            return date < startDate || date > endDate;
                                          }}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{t("expense.entertainment.type.label")}</Label>
                                    <Select
                                      value={item.type}
                                      onValueChange={(value) => updateEntertainment(index, 'type', value)}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t("expense.entertainment.type.placeholder")} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="breakfast">{t("expense.entertainment.type.breakfast")}</SelectItem>
                                        <SelectItem value="lunch">{t("expense.entertainment.type.lunch")}</SelectItem>
                                        <SelectItem value="dinner">{t("expense.entertainment.type.dinner")}</SelectItem>
                                        <SelectItem value="coffee">{t("expense.entertainment.type.coffee")}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>{t("expense.entertainment.country.label")}</Label>
                                  <Select
                                    value={item.country}
                                    onValueChange={(value) => updateEntertainment(index, 'country', value)}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder={t("expense.entertainment.country.placeholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {simpleCountryOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label>{t("expense.entertainment.companyName.label")}</Label>
                                  <Input
                                    value={item.companyName}
                                    onChange={(e) => updateEntertainment(index, 'companyName', e.target.value)}
                                    placeholder={t("expense.entertainment.companyName.placeholder")}
                                  />
                                </div>

                                {/* 결제자와 부가세를 한 줄에 배치 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  {/* 결제자 */}
                                  <div className="space-y-2">
                                    <Label>{t("expense.paidBy.label")}</Label>
                                    <Select
                                      value={item.paidBy}
                                      onValueChange={(value) => updateEntertainment(index, 'paidBy', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder={t("expense.paidBy.placeholder")} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="company">{t("expense.paidBy.company")}</SelectItem>
                                        <SelectItem value="personal">{t("expense.paidBy.personal")}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {/* 부가세 */}
                                  <div className="form-group">
                                    <Label className="form-label">{t("expense.entertainment.vat.label")}</Label>
                                    <div className="form-input-with-unit">
                                      <GermanNumberInput
                                        value={item.vat}
                                        onChange={(value) => updateEntertainment(index, 'vat', String(value))}
                                        placeholder={t("expense.entertainment.vat.placeholder")}
                                      />
                                      <span className="form-input-unit">€</span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* 총액 */}
                                <div className="form-group">
                                  <Label className="form-label">{t("expense.entertainment.totalAmount.label")}</Label>
                                  <div className="form-input-with-unit">
                                    <GermanNumberInput
                                      value={item.totalAmount}
                                      onChange={(value) => updateEntertainment(index, 'totalAmount', String(value))}
                                      placeholder={t("expense.entertainment.totalAmount.placeholder")}
                                    />
                                    <span className="form-input-unit">€</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-center mt-4">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => toggleEntertainment(index)}
                                  className="w-full"
                                >
                                  <ChevronUp className="h-4 w-4 mr-2" />
                                  창 닫기
                                </Button>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 식대 관련 여행 정보 */}
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">{t('expense.mealAllowanceDetails.title')}</h2>
                  </div>
                  
                  {/* MealAllowanceInfo 컴포넌트 사용 */}
                  <MealAllowanceInfo 
                    mealAllowanceInfo={formData.mealAllowanceInfo}
                    onChange={(newInfo) => updateFormData('mealAllowanceInfo', newInfo)}
                    onTotalAllowanceChange={(amount) => updateFormData('totalMealAllowance', amount)}
                    tripStartDate={formData.startDate}
                    tripEndDate={formData.endDate}
                    startTime={formData.startTime}
                    endTime={formData.endTime}
                    isAllowanceEnabled={formData.mealOption}
                    entertainmentExpenses={formData.entertainment
                      .filter(ent => ent.date instanceof Date && !isNaN(ent.date.getTime()))
                      .reduce((acc, ent) => {
                        const dateStr = dateFormat(ent.date!, 'yyyy-MM-dd');
                        if (!acc.find(item => item.date === dateStr)) {
                          acc.push({
                            date: dateStr,
                            breakfast: false,
                            lunch: false,
                            dinner: false
                          });
                        }
                        const item = acc.find(item => item.date === dateStr)!;
                        if (ent.type === 'breakfast') item.breakfast = true;
                        if (ent.type === 'lunch') item.lunch = true;
                        if (ent.type === 'dinner') item.dinner = true;
                        return acc;
                      }, [] as Array<{
                        date: string;
                        breakfast: boolean;
                        lunch: boolean;
                        dinner: boolean;
                      }>)
                    }
                  />
                </CardContent>
              </Card>

              {/* 기타 금액 정보 */}
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <MiscellaneousExpenseForm
                    items={formData.miscellaneous}
                    onAdd={addMiscellaneous}
                    onUpdate={updateMiscellaneous}
                    onRemove={removeMiscellaneous}
                    onToggle={toggleMiscellaneous}
                    tripStartDate={formData.startDate ? formatDateForStorage(formData.startDate) : undefined}
                    tripEndDate={formData.endDate ? formatDateForStorage(formData.endDate) : undefined}
                  />
                </CardContent>
              </Card>

              {/* 비용 합계 정보 */}
              <Card className="border border-gray-200 mb-4">
                <CardContent className="pt-2 pb-2">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold">비용 합계</h2>
                  </div>
                  
                  {(() => {
                    const summary = calculateExpenseSummary(formData);
                    
                    return (
                      <div className="space-y-2 text-sm">
                        {/* 교통비 합계 */}
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="font-medium">교통비 합계</div>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">회사:</span>
                              <span className="font-semibold">{formatNumber(summary.transportation.company)}€</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">개인:</span>
                              <span className="font-semibold">{formatNumber(summary.transportation.personal)}€</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 주행거리 수당 정보 */}
                        <div className="flex items-center justify-between border-b pb-2 bg-gray-50 p-2 rounded">
                          <div>
                            <div className="font-medium">주행거리 수당</div>
                            <div className="text-xs text-gray-500">
                              (주행거리 × {formatNumber(MILEAGE_RATE)}/km)
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">총 거리:</span>
                              <span className="font-medium">{formatNumber(summary.mileage.distance, 1)}km</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">금액:</span>
                              <span className="font-semibold">{formatNumber(summary.mileage.amount)}€</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 접대비 합계 */}
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="font-medium">접대비 합계</div>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">회사:</span>
                              <span className="font-semibold">{formatNumber(summary.entertainment.company)}€</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">개인:</span>
                              <span className="font-semibold">{formatNumber(summary.entertainment.personal)}€</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 숙박비 합계 */}
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="font-medium">숙박비 합계</div>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">회사:</span>
                              <span className="font-semibold">{formatNumber(summary.accommodation.company)}€</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">개인:</span>
                              <span className="font-semibold">{formatNumber(summary.accommodation.personal)}€</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 일괄식대 합계 추가 */}
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="font-medium">일괄식대 합계</div>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">개인:</span>
                              <span className="font-semibold">{formatNumber(summary.mealAllowance.amount)}€</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 기타 금액 합계 */}
                        <div className="flex items-center justify-between border-b pb-2">
                          <div className="font-medium">기타 금액 합계</div>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">회사:</span>
                              <span className="font-semibold">{formatNumber(summary.miscellaneous.company)}€</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">개인:</span>
                              <span className="font-semibold">{formatNumber(summary.miscellaneous.personal)}€</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 총 합계 */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="font-medium">총 합계</div>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                              <span className="text-muted-foreground">회사:</span>
                              <span className="font-semibold text-blue-700">{formatNumber(summary.total.company)}€</span>
                            </div>
                            <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                              <span className="text-muted-foreground">개인:</span>
                              <span className="font-semibold text-green-700">{formatNumber(summary.total.personal)}€</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 전체 합계 추가 */}
                        <div className="flex items-center justify-between pt-2 mt-2 border-t-2">
                          <div className="font-bold text-lg">전체 합계</div>
                          <div className="flex items-center gap-1 bg-gray-100 px-3 py-2 rounded">
                            <span className="font-bold text-lg text-gray-900">{formatNumber(summary.total.company + summary.total.personal)}€</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* 저장 버튼 */}
              <div className="flex justify-end pt-4">
                <Button onClick={handleCreateExpense}>
                  {isEditMode ? '수정 내용 저장' : '다음 단계로'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
