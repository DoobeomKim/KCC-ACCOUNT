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
import React from 'react'
import ReactDOM from 'react-dom/client'
import { dateUtils, calculateDailyStayHours } from '@/lib/dateUtils'

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

const DailyAllowanceAmount = React.memo(({ date, schedules, entertainmentExpense, onUpdate }: DailyAllowanceAmountProps) => {
  const [amount, setAmount] = useState<number>(0);

  useEffect(() => {
    // MealAllowanceDaySummary를 숨겨서 렌더링하고 금액만 받아옴
    const hiddenDiv = document.createElement('div');
    hiddenDiv.style.display = 'none';
    document.body.appendChild(hiddenDiv);

    const root = ReactDOM.createRoot(hiddenDiv);
    root.render(
      <MealAllowanceDaySummary 
        schedules={schedules}
        entertainmentExpense={entertainmentExpense}
        onAllowanceCalculated={(calculatedAmount) => {
          setAmount(calculatedAmount);
          onUpdate(date, calculatedAmount);
        }}
      />
    );

    return () => {
      root.unmount();
      document.body.removeChild(hiddenDiv);
    };
  }, [date, schedules, entertainmentExpense, onUpdate]);

  return (
    <span className="font-medium">
      {new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount)} €
    </span>
  );
});

DailyAllowanceAmount.displayName = 'DailyAllowanceAmount';

interface DailySchedule {
  date: string;
  country: string;
  allowanceType: string;
  schedules: {
    index: number;
    moveType: string;
    locationInfo: string;
    dayType: string;
    stayHours: number;
    stayCategory: string;
    tripType?: 'international' | 'domestic';
    departureCountry?: string;
    arrivalCountry?: string;
    departureCity?: string;
    arrivalCity?: string;
  }[];
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
  const [dailyAllowanceAmounts, setDailyAllowanceAmounts] = useState<{[key: string]: number}>({});
  const [totalAllowance, setTotalAllowance] = useState(0);
  
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
      info => dateUtils.isValidDate(info.startDate) && dateUtils.isValidDate(info.endDate)
    );
    
    if (validInfos.length < 2) return { overlapping: false, details: [] };
    
    const overlaps = [];
    
    for (let i = 0; i < validInfos.length; i++) {
      for (let j = i + 1; j < validInfos.length; j++) {
        const info1 = validInfos[i];
        const info2 = validInfos[j];
        
        const start1 = dateUtils.combineDateAndTime(info1.startDate!, info1.startTime);
        const end1 = dateUtils.combineDateAndTime(info1.endDate!, info1.endTime);
        const start2 = dateUtils.combineDateAndTime(info2.startDate!, info2.startTime);
        const end2 = dateUtils.combineDateAndTime(info2.endDate!, info2.endTime);
        
        // 겹치는지 확인
        if (start1 <= end2 && end1 >= start2) {
          overlaps.push({
            index1: i + 1,
            index2: j + 1,
            info1: {
              startDate: dateUtils.formatSafeDate(start1, 'yyyy-MM-dd HH:mm'),
              endDate: dateUtils.formatSafeDate(end1, 'yyyy-MM-dd HH:mm'),
            },
            info2: {
              startDate: dateUtils.formatSafeDate(start2, 'yyyy-MM-dd HH:mm'),
              endDate: dateUtils.formatSafeDate(end2, 'yyyy-MM-dd HH:mm'),
            }
          });
        }
      }
    }
    
    return { overlapping: overlaps.length > 0, details: overlaps };
  };
  
  // 일별 정보 정리 함수
  const getDailySchedules = (): DailySchedule[] => {
    // 유효한 일정만 필터링
    const validInfos = mealAllowanceInfo.filter(info => 
      dateUtils.isValidDate(info.startDate) && 
      dateUtils.isValidDate(info.endDate)
    );
    
    if (validInfos.length === 0) return [];
    
    // 날짜 범위 계산
    const minDate = new Date(Math.min(...validInfos.map(info => info.startDate!.getTime())));
    const maxDate = new Date(Math.max(...validInfos.map(info => info.endDate!.getTime())));
    
    const dailySchedules: DailySchedule[] = [];
    
    // 각 날짜별로 처리
    let currentDate = new Date(minDate);
    while (currentDate <= maxDate) {
      const currentDateStr = dateUtils.formatSafeDate(currentDate, 'yyyy-MM-dd', '');
      if (!currentDateStr) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // 이 날짜에 해당하는 모든 일정 찾기
      const daySchedules = validInfos.map((info, index) => {
        const startDate = info.startDate!;
        const endDate = info.endDate!;
        
        // 현재 날짜가 이 일정의 날짜 범위에 포함되는지 확인
        if (isSameDay(currentDate, startDate) || isSameDay(currentDate, endDate) || 
            (currentDate > startDate && currentDate < endDate)) {
          
          // 일별 체류 시간 계산
          let stayHours = 0;
          
          if (isSameDay(currentDate, startDate) && isSameDay(currentDate, endDate)) {
            // 시작일과 종료일이 같은 경우
            const start = dateUtils.combineDateAndTime(startDate, info.startTime);
            const end = dateUtils.combineDateAndTime(endDate, info.endTime);
            stayHours = Math.max(0, differenceInHours(end, start));
          } else if (isSameDay(currentDate, startDate)) {
            // 시작일인 경우 - 그날의 시작 시간부터 하루 끝까지
            const start = dateUtils.combineDateAndTime(startDate, info.startTime);
            const end = new Date(startDate);
            end.setHours(23, 59, 59);
            stayHours = Math.max(0, differenceInHours(end, start));
          } else if (isSameDay(currentDate, endDate)) {
            // 종료일인 경우 - 하루 시작부터 종료 시간까지
            const start = new Date(endDate);
            start.setHours(0, 0, 0);
            const end = dateUtils.combineDateAndTime(endDate, info.endTime);
            stayHours = Math.max(0, differenceInHours(end, start));
          } else {
            // 중간 날짜인 경우 - 하루 전체
            stayHours = 24;
          }
          
          // 최대 24시간으로 제한
          stayHours = Math.min(24, stayHours);
          
          // 일정 정보 반환
          const dayType = isSameDay(currentDate, startDate) || isSameDay(currentDate, endDate)
            ? '이동한 날'
            : '숙박한 날';
            
          return {
            index: index + 1,
            moveType: info.tripType === 'international' ? '국가간 이동' : '국내 이동',
            locationInfo: info.tripType === 'international' 
              ? `${info.departureCountry || ''} → ${info.arrivalCountry || ''}`
              : `${info.departureCity || ''} → ${info.arrivalCity || ''}`,
            dayType: dayType,
            stayHours: stayHours,
            stayCategory: info.tripType === 'international' ? '국가간 이동' : '국내 이동',
            tripType: info.tripType,
            departureCountry: info.departureCountry,
            arrivalCountry: info.arrivalCountry,
            departureCity: info.departureCity,
            arrivalCity: info.arrivalCity
          };
        }
        return null;
      }).filter((schedule): schedule is NonNullable<typeof schedule> => schedule !== null);
      
      if (daySchedules.length > 0) {
        // 첫 일정과 나머지 일정들로 분리 (food-fee-rules.md 규칙에 따라)
        const [firstSchedule, ...otherSchedules] = daySchedules;
        
        // 나머지 일정들의 체류 시간 총합 계산
        const otherSchedulesHoursSum = otherSchedules.reduce(
          (sum, schedule) => sum + schedule.stayHours, 0
        );
        
        // 기준 국가 결정
        let baseSchedule;
        let baseCountry = '';
        
        // 국가간 이동 여부
        const hasInternational = daySchedules.some(s => s.tripType === 'international');
        
        // 숙박 여부 확인
        const hasStayOver = daySchedules.some(s => s.dayType === '숙박한 날');
        
        // 최대 체류 시간 계산 및 기준 국가 결정
        let maxStayHours;
        
        if (otherSchedulesHoursSum >= 8) {
          // 나머지 일정들의 체류 시간 합이 8시간 이상이면 마지막 일정
          baseSchedule = daySchedules[daySchedules.length - 1];
          maxStayHours = otherSchedulesHoursSum;
          
          // 국가간 이동이면 도착 국가, 국내 이동이면 독일
          if (baseSchedule.tripType === 'international') {
            baseCountry = baseSchedule.arrivalCountry || '독일';
          } else {
            baseCountry = '독일';
          }
        } else {
          // 나머지 일정들의 체류 시간 합이 8시간 미만이면 첫 일정
          baseSchedule = firstSchedule;
          maxStayHours = firstSchedule.stayHours;
          
          // 국가간 이동이면서 체류 시간이 8시간 이상인 경우 도착국가가 기준
          if (hasInternational && maxStayHours >= 8 && baseSchedule.tripType === 'international') {
            baseCountry = baseSchedule.arrivalCountry || '독일';
          }
          // 그 외의 경우(8시간 미만이거나 국내 이동) 출발국가가 기준
          else if (baseSchedule.tripType === 'international') {
            baseCountry = baseSchedule.departureCountry || '독일';
          } else {
            baseCountry = '독일';
          }
        }
        
        // 식대 유형 결정
        let allowanceType;
        if (hasStayOver) {
          allowanceType = '전일 식대';
        } else if (maxStayHours >= 8) {
          allowanceType = hasInternational ? '부분 식대 (80%)' : '부분 식대';
        } else {
          allowanceType = '식대 없음';
        }
        
        const dayInfo: DailySchedule = {
          date: currentDateStr,
          country: baseCountry,
          allowanceType: allowanceType,
          schedules: daySchedules
        };
        
        dailySchedules.push(dayInfo);
      }
      
      // 다음 날짜로 이동
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dailySchedules;
  };
  
  const overlappingResult = checkOverlappingSchedules();
  const dailySchedules = getDailySchedules();
  
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
    
    // 디버깅을 위한 로그 추가
    console.log(`Entertainment data for ${date}:`, entertainmentExpense, entertainmentExpenses);
    
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

  // 일별 식대 금액을 업데이트하는 함수
  const handleDailyAllowanceUpdate = (date: string, amount: number) => {
    setDailyAllowanceAmounts(prev => ({
      ...prev,
      [date]: amount
    }));
  };

  // 총 식대 계산 effect
  useEffect(() => {
    const sum = Object.values(dailyAllowanceAmounts).reduce((total, amount) => total + amount, 0);
    setTotalAllowance(sum);
  }, [dailyAllowanceAmounts]);

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
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">총 식대:</span>
                  <span className="font-bold text-green-700 text-lg">
                    {totalAllowance.toFixed(2)}€
                  </span>
                </div>
                
                <div className="text-xs text-gray-500 mt-1">
                  * 식대는 해당 국가의 요율, 체류 시간, 숙박 여부, 접대비 차감에 따라 계산됩니다.
                </div>
              </div>
            </div>
          </div>
          
          {/* 일별 정보 정리 */}
          <div>
            <h4 className="text-md font-medium mb-2">일별 정보 정리</h4>
            {dailySchedules.length > 0 ? (
              <div className="space-y-4">
                {dailySchedules.map((day, idx) => (
                  <div key={idx} className="border-t pt-2">
                    <h5 className="font-medium mb-2">
                      {day.date} ({['일', '월', '화', '수', '목', '금', '토'][new Date(day.date).getDay()]}) - 
                      <span className="text-green-700 ml-2">{day.country}</span>
                      <span className="text-blue-600 ml-2">({day.allowanceType})</span>
                    </h5>
                    <div className="space-y-2 mt-2">
                      {day.schedules.map((schedule, scheduleIdx) => {
                        // 기준 일정 계산
                        let isBaseSchedule = false;
                        
                        // 첫 일정과 나머지 일정들의 체류시간으로 계산
                        if (day.schedules.length > 1) {
                          const [firstSchedule, ...otherSchedules] = day.schedules;
                          const otherSchedulesHoursSum = otherSchedules.reduce(
                            (sum, s) => sum + s.stayHours, 0
                          );
                          
                          if (otherSchedulesHoursSum >= 8) {
                            // 마지막 일정이 기준
                            isBaseSchedule = scheduleIdx === day.schedules.length - 1;
                          } else {
                            // 첫 일정이 기준
                            isBaseSchedule = scheduleIdx === 0;
                          }
                        } else {
                          // 일정이 하나면 그게 기준
                          isBaseSchedule = true;
                        }
                        
                        return (
                          <div 
                            key={scheduleIdx} 
                            className={`p-2 rounded text-sm ${isBaseSchedule ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}
                          >
                            <div className="flex items-center mb-1">
                              <span className={`font-medium mr-2 ${isBaseSchedule ? 'text-green-700' : ''}`}>
                                일정 {schedule.index}:{isBaseSchedule && ' 🌟 기준 일정'}
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
                                <span>{Math.round(schedule.stayHours * 10) / 10}시간</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      <MealAllowanceDaySummary 
                        schedules={day.schedules} 
                        entertainmentExpense={getEntertainmentExpenseForDate(day.date)}
                        onAllowanceCalculated={(amount) => handleDailyAllowanceUpdate(day.date, amount)}
                        hideAllowanceResult={false}
                        enhanceBaseAllowance={false}
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