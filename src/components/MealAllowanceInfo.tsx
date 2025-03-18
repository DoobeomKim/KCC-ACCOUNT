'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { format as dateFormat, addDays, differenceInHours, isSameDay, isAfter, isBefore, parseISO, isValid } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarIcon, Plus, Trash2, ChevronUp, ChevronDown, AlertCircle, Clock } from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from '@/lib/utils'
import DatePicker from '@/components/DatePicker'
import { supabase } from '@/lib/supabase'
import CountrySelector from '@/components/CountrySelector'
import MealAllowanceDaySummary from './MealAllowanceSummary'

interface EntertainmentExpense {
  date: string
  breakfast?: boolean
  lunch?: boolean
  dinner?: boolean
}

interface MealAllowanceInfo {
  startDate?: Date
  startTime: string
  endDate?: Date
  endTime: string
  tripType?: 'international' | 'domestic'
  departureCountry?: string
  departureCity?: string
  arrivalCountry?: string
  arrivalCity?: string
  isExpanded?: boolean
}

interface MealAllowanceInfoProps {
  mealAllowanceInfo: MealAllowanceInfo[]
  onChange: (newInfo: MealAllowanceInfo[]) => void
  tripStartDate?: Date
  tripEndDate?: Date
  entertainmentExpenses?: EntertainmentExpense[]
}

// DailyAllowanceAmount 컴포넌트 - 일별 식대 금액을 표시하고 부모에게 전달
interface DailyAllowanceAmountProps {
  date: string
  schedules: {
    stayHours: number
    stayCategory: string
    moveType: string
    dayType: string
    index: number
    locationInfo: string
    departureCountry?: string
    arrivalCountry?: string
    departureCity?: string
    arrivalCity?: string
    tripType?: 'international' | 'domestic'
  }[]
  entertainmentExpense?: {
    breakfast?: boolean
    lunch?: boolean
    dinner?: boolean
  }
  onUpdate: (date: string, amount: number) => void
}

function DailyAllowanceAmount({ date, schedules, entertainmentExpense, onUpdate }: DailyAllowanceAmountProps) {
  const [amount, setAmount] = useState(0);
  
  // MealAllowanceDaySummary에서 계산된 금액을 받아 처리
  const handleAllowanceCalculated = (calculatedAmount: number) => {
    setAmount(calculatedAmount);
    onUpdate(date, calculatedAmount);
  };
  
  return (
    <div className="flex items-center">
      <span>{amount.toFixed(2)}€</span>
      <div className="hidden">
        <MealAllowanceDaySummary 
          schedules={schedules}
          entertainmentExpense={entertainmentExpense}
          onAllowanceCalculated={handleAllowanceCalculated}
        />
      </div>
    </div>
  );
}

export default function MealAllowanceInfo({ 
  mealAllowanceInfo, 
  onChange, 
  tripStartDate, 
  tripEndDate,
  entertainmentExpenses = [] 
}: MealAllowanceInfoProps) {
  const t = useTranslations()
  const [isLoadingCountries, setIsLoadingCountries] = useState(false)
  const [currentLocale, setCurrentLocale] = useState<string>('ko') // 기본값 설정
  
  // 컴포넌트 마운트 시 현재 언어 확인
  useEffect(() => {
    const locale = t('locale')
    console.log('현재 언어(초기화):', locale)
    setCurrentLocale(locale)
  }, [t])
  
  useEffect(() => {
    console.log('Translation test:', {
      title: t('expense.mealAllowanceDetails.title'),
      startDate: t('expense.mealAllowanceDetails.startDate'),
      endDate: t('expense.mealAllowanceDetails.endDate')
    });
  }, [t]);

  const handleAddInfo = () => {
    onChange([
      ...mealAllowanceInfo,
      { 
        startDate: undefined, 
        startTime: '', 
        endDate: undefined, 
        endTime: '', 
        tripType: undefined,
        departureCountry: '',
        departureCity: '',
        arrivalCountry: '',
        arrivalCity: '',
        isExpanded: true
      }
    ])
  }

  const handleRemoveInfo = (index: number) => {
    const newInfo = [...mealAllowanceInfo]
    newInfo.splice(index, 1)
    onChange(newInfo)
  }

  const handleInfoChange = (index: number, field: keyof MealAllowanceInfo, value: any) => {
    console.log(`MealAllowanceInfo 변경 - 인덱스: ${index}, 필드: ${field}`, value);
    const newInfo = [...mealAllowanceInfo]
    newInfo[index] = {
      ...newInfo[index],
      [field]: value
    }
    console.log('새 정보:', newInfo[index]);
    onChange(newInfo)
  }

  // 날짜가 출장 기간 내에 있는지 확인하는 함수
  const isDateInTripRange = (date: Date) => {
    if (!tripStartDate || !tripEndDate) return true;
    if (!date) return false;
    
    try {
      // 날짜 유효성 검사
      if (!(date instanceof Date) || isNaN(date.getTime())) return false;
      if (!(tripStartDate instanceof Date) || isNaN(tripStartDate.getTime())) return true;
      if (!(tripEndDate instanceof Date) || isNaN(tripEndDate.getTime())) return true;
      
      const dateToCheck = new Date(date);
      dateToCheck.setHours(0, 0, 0, 0);
      
      const startDate = new Date(tripStartDate);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(tripEndDate);
      endDate.setHours(23, 59, 59, 999);
      
      return dateToCheck >= startDate && dateToCheck <= endDate;
    } catch (error) {
      console.error("날짜 검증 오류:", error);
      return false;
    }
  }

  // 일정 겹침 체크 함수
  const checkOverlappingSchedules = () => {
    const validInfos = mealAllowanceInfo.filter(
      info => info.startDate instanceof Date && !isNaN(info.startDate.getTime()) &&
              info.endDate instanceof Date && !isNaN(info.endDate.getTime())
    );
    
    if (validInfos.length < 2) return { overlapping: false, details: [] };
    
    const overlaps = [];
    
    for (let i = 0; i < validInfos.length; i++) {
      for (let j = i + 1; j < validInfos.length; j++) {
        const info1 = validInfos[i];
        const info2 = validInfos[j];
        
        const start1 = new Date(info1.startDate!);
        const end1 = new Date(info1.endDate!);
        const start2 = new Date(info2.startDate!);
        const end2 = new Date(info2.endDate!);
        
        // 시간 정보 추가
        if (info1.startTime) {
          const [hours, minutes] = info1.startTime.split(':').map(Number);
          start1.setHours(hours, minutes);
        }
        
        if (info1.endTime) {
          const [hours, minutes] = info1.endTime.split(':').map(Number);
          end1.setHours(hours, minutes);
        }
        
        if (info2.startTime) {
          const [hours, minutes] = info2.startTime.split(':').map(Number);
          start2.setHours(hours, minutes);
        }
        
        if (info2.endTime) {
          const [hours, minutes] = info2.endTime.split(':').map(Number);
          end2.setHours(hours, minutes);
        }
        
        // 겹치는지 확인
        if ((start1 <= end2 && end1 >= start2)) {
          overlaps.push({
            index1: i + 1,
            index2: j + 1,
            info1: {
              startDate: dateFormat(start1, 'yyyy-MM-dd HH:mm'),
              endDate: dateFormat(end1, 'yyyy-MM-dd HH:mm'),
            },
            info2: {
              startDate: dateFormat(start2, 'yyyy-MM-dd HH:mm'),
              endDate: dateFormat(end2, 'yyyy-MM-dd HH:mm'),
            }
          });
        }
      }
    }
    
    return { overlapping: overlaps.length > 0, details: overlaps };
  };
  
  // 일별 정보 정리 함수
  const getDailySchedules = () => {
    const validInfos = mealAllowanceInfo.filter(
      info => info.startDate instanceof Date && !isNaN(info.startDate.getTime()) &&
              info.endDate instanceof Date && !isNaN(info.endDate.getTime())
    );
    
    if (validInfos.length === 0) return [];
    
    // 모든 날짜 범위 찾기
    let minDate = new Date(Math.min(...validInfos.map(info => info.startDate!.getTime())));
    let maxDate = new Date(Math.max(...validInfos.map(info => info.endDate!.getTime())));
    
    // 날짜만 비교하기 위해 시간 정보 초기화
    minDate.setHours(0, 0, 0, 0);
    maxDate.setHours(0, 0, 0, 0);
    
    const dailySchedules = [];
    let currentDate = new Date(minDate);
    
    while (currentDate <= maxDate) {
      const daySchedules = validInfos.filter(info => {
        const start = new Date(info.startDate!);
        const end = new Date(info.endDate!);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return currentDate >= start && currentDate <= end;
      });
      
      if (daySchedules.length > 0) {
        const formattedDate = dateFormat(currentDate, 'yyyy-MM-dd');
        const dayInfo = {
          date: formattedDate,
          schedules: daySchedules.map((info, idx) => {
            // 체류 시간 계산
            let stayHours = 24; // 기본값
            
            if (isSameDay(info.startDate!, currentDate) && isSameDay(info.endDate!, currentDate)) {
              // 같은 날에 시작하고 끝나는 경우
              const start = new Date(info.startDate!);
              const end = new Date(info.endDate!);
              
              if (info.startTime && info.endTime) {
                const [startHours, startMinutes] = info.startTime.split(':').map(Number);
                const [endHours, endMinutes] = info.endTime.split(':').map(Number);
                
                start.setHours(startHours, startMinutes);
                end.setHours(endHours, endMinutes);
                
                stayHours = differenceInHours(end, start);
              }
            } else if (isSameDay(info.startDate!, currentDate)) {
              // 현재 날짜가 시작일인 경우
              if (info.startTime) {
                const [hours, minutes] = info.startTime.split(':').map(Number);
                const start = new Date(currentDate);
                start.setHours(hours, minutes);
                const end = new Date(currentDate);
                end.setHours(23, 59, 59);
                
                stayHours = differenceInHours(end, start);
              }
            } else if (isSameDay(info.endDate!, currentDate)) {
              // 현재 날짜가 종료일인 경우
              if (info.endTime) {
                const [hours, minutes] = info.endTime.split(':').map(Number);
                const start = new Date(currentDate);
                start.setHours(0, 0, 0);
                const end = new Date(currentDate);
                end.setHours(hours, minutes);
                
                stayHours = differenceInHours(end, start);
              }
            }
            
            // 체류 시간 카테고리
            let stayCategory = '';
            if (stayHours <= 8) {
              stayCategory = '8시간 이하';
            } else if (stayHours < 24) {
              stayCategory = '8시간 이상';
            } else {
              stayCategory = '24시간';
            }
            
            // 이동 유형
            const moveType = info.tripType === 'international' ? '국가간 이동' : '국내 이동';
            
            // 국가/도시 정보
            const locationInfo = info.tripType === 'international' 
              ? `${info.departureCountry || ''} → ${info.arrivalCountry || ''}`
              : `${info.departureCity || ''} → ${info.arrivalCity || ''}`;
            
            // 이동한 날 또는 숙박한 날
            const dayType = isSameDay(info.startDate!, currentDate) || isSameDay(info.endDate!, currentDate)
              ? '이동한 날'
              : '숙박한 날';
            
            return {
              index: idx + 1,
              moveType,
              locationInfo,
              dayType,
              stayHours,
              stayCategory,
              tripType: info.tripType,
              departureCountry: info.departureCountry,
              arrivalCountry: info.arrivalCountry,
              departureCity: info.departureCity,
              arrivalCity: info.arrivalCity
            };
          })
        };
        
        dailySchedules.push(dayInfo);
      }
      
      // 다음 날로 이동
      currentDate = addDays(currentDate, 1);
    }
    
    return dailySchedules;
  };
  
  const overlappingResult = checkOverlappingSchedules();
  const dailySchedules = getDailySchedules();
  
  // 기준국가 계산을 위한 함수
  const getBaseCountryScheduleIndex = (schedules: any[]) => {
    if (schedules.length === 1) {
      return schedules[0].index;
    } else if (schedules.length > 1) {
      const otherSchedulesStayHoursSum = schedules
        .filter((_, idx) => idx > 0)
        .reduce((sum, schedule) => sum + schedule.stayHours, 0);
      
      if (otherSchedulesStayHoursSum >= 8) {
        return schedules[schedules.length - 1].index;
      } else {
        return schedules[0].index;
      }
    }
    return -1;
  };

  // 해당 날짜의 접대비 정보를 가져오는 함수
  const getEntertainmentExpenseForDate = (date: string) => {
    // 부모 컴포넌트에서 전달된 접대비 정보가 없거나, 일자별 접대비가 없는 경우
    if (!entertainmentExpenses || entertainmentExpenses.length === 0) {
      return {
        breakfast: false,
        lunch: false,
        dinner: false
      };
    }

    // 해당 날짜의 접대비 정보 찾기
    const entertainmentExpense = entertainmentExpenses.find(expense => expense.date === date);
    
    // 없으면 기본값 반환
    if (!entertainmentExpense) {
      return {
        breakfast: false,
        lunch: false,
        dinner: false
      };
    }
    
    return entertainmentExpense;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {mealAllowanceInfo.map((info, index) => (
          <div key={index} className="border p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">{t("expense.mealAllowanceDetails.item", { number: index + 1 })}</h3>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newInfo = [...mealAllowanceInfo];
                    newInfo[index] = {
                      ...newInfo[index],
                      isExpanded: !newInfo[index].isExpanded
                    };
                    onChange(newInfo);
                  }}
                  className="hover:bg-accent cursor-pointer"
                  title={info.isExpanded ? t("expense.common.collapse") : t("expense.common.expand")}
                >
                  {info.isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveInfo(index)}
                  className="text-red-500 hover:bg-accent cursor-pointer"
                  title={t("expense.mealAllowanceDetails.deleteButton")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {info.isExpanded && (
              <>
                {/* 출장 종류 선택 */}
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">
                    {t("expense.mealAllowanceDetails.tripType.label")}
                  </label>
                  <Select
                    value={info.tripType}
                    onValueChange={(value) => handleInfoChange(index, 'tripType', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("expense.mealAllowanceDetails.tripType.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="international">{t("expense.mealAllowanceDetails.tripType.international")}</SelectItem>
                      <SelectItem value="domestic">{t("expense.mealAllowanceDetails.tripType.domestic")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* 출발/도착 국가/도시 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {info.tripType === 'international' ? (
                    <>
                      {/* 국가간 이동 - 출발 국가 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          {t("expense.mealAllowanceDetails.departureLocation.country")}
                        </label>
                        <CountrySelector 
                          value={info.departureCountry || ''}
                          onChange={(value) => handleInfoChange(index, 'departureCountry', value)}
                          placeholder={t("expense.mealAllowanceDetails.departureLocation.countryPlaceholder")}
                          disabled={isLoadingCountries}
                        />
                      </div>
                      
                      {/* 국가간 이동 - 도착 국가 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          {t("expense.mealAllowanceDetails.arrivalLocation.country")}
                        </label>
                        <CountrySelector 
                          value={info.arrivalCountry || ''}
                          onChange={(value) => handleInfoChange(index, 'arrivalCountry', value)}
                          placeholder={t("expense.mealAllowanceDetails.arrivalLocation.countryPlaceholder")}
                          disabled={isLoadingCountries}
                        />
                      </div>
                    </>
                  ) : info.tripType === 'domestic' ? (
                    <>
                      {/* 국내 이동 - 출발 도시 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          {t("expense.mealAllowanceDetails.departureLocation.city")}
                        </label>
                        <Input
                          value={info.departureCity || ''}
                          onChange={(e) => handleInfoChange(index, 'departureCity', e.target.value)}
                          placeholder={t("expense.mealAllowanceDetails.departureLocation.cityPlaceholder")}
                        />
                      </div>
                      
                      {/* 국내 이동 - 도착 도시 */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          {t("expense.mealAllowanceDetails.arrivalLocation.city")}
                        </label>
                        <Input
                          value={info.arrivalCity || ''}
                          onChange={(e) => handleInfoChange(index, 'arrivalCity', e.target.value)}
                          placeholder={t("expense.mealAllowanceDetails.arrivalLocation.cityPlaceholder")}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 출발일 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("expense.mealAllowanceDetails.startDate")}
                    </label>
                    <DatePicker
                      date={info.startDate instanceof Date && !isNaN(info.startDate.getTime()) ? info.startDate : undefined}
                      setDate={(date) => {
                        console.log('출발일 선택:', date);
                        handleInfoChange(index, 'startDate', date);
                      }}
                      placeholder={t("expense.mealAllowanceDetails.selectDate")}
                      fromDate={tripStartDate instanceof Date && !isNaN(tripStartDate.getTime()) ? tripStartDate : undefined}
                      toDate={tripEndDate instanceof Date && !isNaN(tripEndDate.getTime()) ? tripEndDate : undefined}
                      disabledDays={(date) => !isDateInTripRange(date)}
                    />
                  </div>
                  
                  {/* 출발 시간 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("expense.mealAllowanceDetails.startTime")}
                    </label>
                    <Input
                      type="time"
                      value={info.startTime}
                      onChange={(e) => handleInfoChange(index, 'startTime', e.target.value)}
                      className="[&::-webkit-calendar-picker-indicator]:appearance-none"
                      pattern="[0-9]{2}:[0-9]{2}"
                    />
                  </div>
                  
                  {/* 종료일 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("expense.mealAllowanceDetails.endDate")}
                    </label>
                    <DatePicker
                      date={info.endDate instanceof Date && !isNaN(info.endDate.getTime()) ? info.endDate : undefined}
                      setDate={(date) => {
                        console.log('종료일 선택:', date);
                        handleInfoChange(index, 'endDate', date);
                      }}
                      placeholder={t("expense.mealAllowanceDetails.selectDate")}
                      fromDate={(info.startDate instanceof Date && !isNaN(info.startDate.getTime()) ? info.startDate : undefined) || 
                               (tripStartDate instanceof Date && !isNaN(tripStartDate.getTime()) ? tripStartDate : undefined)}
                      toDate={tripEndDate instanceof Date && !isNaN(tripEndDate.getTime()) ? tripEndDate : undefined}
                      disabledDays={(date) => !isDateInTripRange(date) || (info.startDate instanceof Date && !isNaN(info.startDate.getTime()) ? date < info.startDate : false)}
                    />
                  </div>
                  
                  {/* 종료 시간 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("expense.mealAllowanceDetails.endTime")}
                    </label>
                    <Input
                      type="time"
                      value={info.endTime}
                      onChange={(e) => handleInfoChange(index, 'endTime', e.target.value)}
                      className="[&::-webkit-calendar-picker-indicator]:appearance-none"
                      pattern="[0-9]{2}:[0-9]{2}"
                    />
                  </div>
                </div>
              </>
            )}
            
            {!info.isExpanded && (
              <div className="flex flex-col text-sm text-muted-foreground">
                <div className="flex gap-3 items-center mb-1">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {info.startDate && info.endDate ? (
                      <span>
                        {dateFormat(info.startDate, "yyyy-MM-dd")} {info.startTime} ~ {dateFormat(info.endDate, "yyyy-MM-dd")} {info.endTime}
                      </span>
                    ) : (
                      <span>{t("expense.mealAllowanceDetails.date")}</span>
                    )}
                  </div>
                </div>
                
                {info.tripType && (
                  <div className="flex gap-3 items-center">
                    {info.tripType === 'international' ? (
                      <div className="flex flex-wrap gap-1">
                        <span>{info.departureCountry || '?'}</span>
                        <span>→</span>
                        <span>{info.arrivalCountry || '?'}</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        <span>{info.departureCity || '?'}</span>
                        <span>→</span>
                        <span>{info.arrivalCity || '?'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* 요약 정보 */}
      {mealAllowanceInfo.length > 0 && (
        <div className="mt-8 border p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">여행 정보 요약</h3>
          
          {/* 일정 겹침 체크 */}
          <div className="mb-4">
            <h4 className="text-md font-medium mb-2">일정 겹침 체크</h4>
            {overlappingResult.overlapping ? (
              <div>
                <div className="flex items-center text-red-500 mb-2">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span className="font-medium">일정 겹침!</span>
                </div>
                <div className="space-y-2">
                  {overlappingResult.details.map((overlap, idx) => (
                    <div key={idx} className="text-sm bg-red-50 p-2 rounded">
                      <p>일정 {overlap.index1}: {overlap.info1.startDate} ~ {overlap.info1.endDate}</p>
                      <p>일정 {overlap.index2}: {overlap.info2.startDate} ~ {overlap.info2.endDate}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-green-600">일정이 모두 겹치지 않습니다.</p>
            )}
          </div>

          {/* 총 식대 비용 계산 */}
          <div className="mb-6">
            <h4 className="text-md font-medium mb-2">총 식대 비용</h4>
            <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
              {(() => {
                // 일별 식대 계산 결과 모으기
                let totalAllowance = 0;
                
                // 일별 식대 정보 저장 배열
                const dailyAllowances = dailySchedules.map(day => {
                  // 이 날짜의 접대비 정보 확인
                  const entertainmentExpense = getEntertainmentExpenseForDate(day.date);
                  
                  // 이 날짜의 일별 일정 정보에서 기준 국가 구하기
                  const baseScheduleIndex = getBaseCountryScheduleIndex(day.schedules);
                  const baseSchedule = day.schedules.find(s => s.index === baseScheduleIndex);
                  
                  let countryName = '독일';
                  if (baseSchedule) {
                    if (baseSchedule.tripType === 'international') {
                      countryName = baseSchedule.arrivalCountry || '독일';
                    } else {
                      countryName = '독일';
                    }
                  }
                  
                  // 최대 체류 시간 계산
                  const maxStayHours = Math.max(...day.schedules.map(s => s.stayHours));
                  
                  // 숙박 여부 및 국가간 이동 여부 확인
                  const hasStayOver = day.schedules.some(s => s.dayType === '숙박한 날');
                  const hasInternational = day.schedules.some(s => s.moveType === '국가간 이동');
                  
                  // 스케줄 정보와 할당 유형
                  return {
                    date: day.date,
                    country: countryName,
                    maxStayHours,
                    hasStayOver,
                    hasInternational,
                    allowanceType: hasStayOver ? '전일 식대' : maxStayHours >= 8 ? '부분 식대' : '식대 없음',
                    entertainmentExpense,
                    schedules: day.schedules
                  };
                });
                
                // DOM 참조 배열을 저장할 ref
                const [dailyAllowanceAmounts, setDailyAllowanceAmounts] = useState<{[key: string]: number}>({});
                
                // 일별 식대 금액을 컴포넌트에서 가져오는 함수
                const handleDailyAllowanceUpdate = (date: string, amount: number) => {
                  setDailyAllowanceAmounts(prev => ({
                    ...prev,
                    [date]: amount
                  }));
                };
                
                // 총 식대 계산
                useEffect(() => {
                  const sum = Object.values(dailyAllowanceAmounts).reduce((total, amount) => total + amount, 0);
                  totalAllowance = sum;
                }, [dailyAllowanceAmounts]);
                
                return (
                  <div className="space-y-3">
                    <div className="mb-2">
                      <h5 className="font-medium text-blue-700 mb-2">일별 식대 내역</h5>
                      <div className="space-y-1.5">
                        {dailyAllowances.map((day, idx) => (
                          <div key={idx} className="flex justify-between items-center border-b pb-1">
                            <div>
                              <span className="font-medium">{day.date}</span>
                              <span className="ml-2 text-sm text-gray-600">
                                ({day.country}, {day.allowanceType})
                              </span>
                            </div>
                            <div className="font-medium">
                              <DailyAllowanceAmount 
                                date={day.date}
                                schedules={day.schedules}
                                entertainmentExpense={day.entertainmentExpense}
                                onUpdate={handleDailyAllowanceUpdate}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center bg-green-50 p-2 rounded-md">
                      <span className="font-semibold">총 식대:</span>
                      <span className="font-bold text-green-700 text-lg">
                        {Object.values(dailyAllowanceAmounts).reduce((total, amount) => total + amount, 0).toFixed(2)}€
                      </span>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-1">
                      * 식대는 해당 국가의 요율, 체류 시간, 숙박 여부, 접대비 차감에 따라 계산됩니다.
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          
          {/* 일별 정보 정리 */}
          <div>
            <h4 className="text-md font-medium mb-2">일별 정보 정리</h4>
            {dailySchedules.length > 0 ? (
              <div className="space-y-4">
                {dailySchedules.map((day, idx) => (
                  <div key={idx} className="border-t pt-2">
                    <h5 className="font-medium">{day.date} ({['일', '월', '화', '수', '목', '금', '토'][new Date(day.date).getDay()]})</h5>
                    <div className="space-y-2 mt-2">
                      {day.schedules.map((schedule, scheduleIdx) => {
                        // 기준국가 계산
                        const baseScheduleIndex = getBaseCountryScheduleIndex(day.schedules);
                        const isBaseCountrySchedule = schedule.index === baseScheduleIndex;
                        
                        return (
                          <div 
                            key={scheduleIdx} 
                            className={`p-2 rounded text-sm ${isBaseCountrySchedule ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}
                          >
                            <div className="flex items-center mb-1">
                              <span className={`font-medium mr-2 ${isBaseCountrySchedule ? 'text-green-700' : ''}`}>
                                일정 {schedule.index}:{isBaseCountrySchedule && ' 🌟'}
                              </span>
                              <span>{schedule.locationInfo}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center">
                                <span className="text-gray-600 mr-1">이동 유형:</span>
                                <span>{schedule.moveType}</span>
                              </div>
                              <div className="flex items-center">
                                <span className="text-gray-600 mr-1">일정 유형:</span>
                                <span>{schedule.dayType}</span>
                              </div>
                              <div className="flex items-center">
                                <Clock className="h-3 w-3 mr-1 text-gray-600" />
                                <span className="text-gray-600 mr-1">체류 시간:</span>
                                <span>{schedule.stayCategory} ({schedule.stayHours}시간)</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <MealAllowanceDaySummary 
                        schedules={day.schedules} 
                        entertainmentExpense={getEntertainmentExpenseForDate(day.date)}
                        onAllowanceCalculated={(amount) => {
                          // 여기서 계산된 금액을 상위 컴포넌트로 전달
                          const event = new CustomEvent('daily-allowance-update', { 
                            detail: { date: day.date, amount: amount }
                          });
                          window.dispatchEvent(event);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">여행 정보가 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 