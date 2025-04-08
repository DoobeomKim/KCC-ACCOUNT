'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { format as dateFormat, addDays, differenceInHours, isSameDay, isAfter, isBefore, parseISO, isValid } from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarIcon, Plus, Trash2, ChevronUp, ChevronDown, AlertCircle, Clock, Info } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import React from 'react'
import ReactDOM from 'react-dom/client'
import { dateUtils } from '@/lib/dateUtils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DailyAllowanceTable } from './DailyAllowanceTable'
import { useAllowanceRates } from '@/hooks/useAllowanceRates'
import { getCountryCode } from '@/lib/api/country'
import { formatEuro } from '@/lib/utils'

interface EntertainmentExpense {
  date: string
  breakfast?: boolean
  lunch?: boolean
  dinner?: boolean
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
  isFirstDay?: boolean
  isLastDay?: boolean
  startTime?: string
  endTime?: string
}

interface MealAllowanceInfoProps {
  mealAllowanceInfo: { [date: string]: MealAllowanceInfo[] }
  onChange: (newInfo: { [date: string]: MealAllowanceInfo[] }) => void
  onTotalAllowanceChange: (amount: number) => void
  tripStartDate?: Date
  tripEndDate?: Date
  entertainmentExpenses?: EntertainmentExpense[]
  startTime?: string
  endTime?: string
  isAllowanceEnabled?: boolean
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
  const calculateAllowance = useCallback(() => {
    let baseAllowance = 0;
    
    // 기준 일정 찾기
    const [firstSchedule, ...otherSchedules] = schedules;
    const otherSchedulesHoursSum = otherSchedules.reduce(
      (sum, schedule) => sum + schedule.stayHours, 0
    );
    
    const baseSchedule = otherSchedulesHoursSum >= 8 
      ? schedules[schedules.length - 1] 
      : firstSchedule;
    
    // 체류 시간에 따른 기본 식대 계산
    const hasInternational = schedules.some(s => s.tripType === 'international');
    const hasStayOver = schedules.some(s => s.dayType === '숙박일');
    
    if (hasStayOver) {
      baseAllowance = 24; // 전일 식대
    } else if (baseSchedule.stayHours >= 8) {
      baseAllowance = hasInternational ? 19.2 : 14.4; // 80% 또는 60%
    }
    
    // 접대비 차감
    if (entertainmentExpense) {
      if (entertainmentExpense.breakfast) baseAllowance *= 0.8;
      if (entertainmentExpense.lunch) baseAllowance *= 0.8;
      if (entertainmentExpense.dinner) baseAllowance *= 0.8;
    }
    
    return baseAllowance;
  }, [schedules, entertainmentExpense]);

  // 메모이제이션된 금액 계산
  const amount = useMemo(() => calculateAllowance(), [calculateAllowance]);

  // 금액이 변경될 때만 콜백 호출
  useEffect(() => {
    onUpdate(date, amount);
  }, [date, amount, onUpdate]);
  
  return (
    <span className="font-medium">
      {formatEuro(amount, false)} 
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

const calculateDailyAllowance = (schedules: any[], entertainmentExpense: any) => {
  // 배열이 아니거나 빈 배열이면 0 반환
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return 0;
  }

  // 기준 일정 찾기
  const [firstSchedule, ...otherSchedules] = schedules;
  
  // 첫 번째 일정이 없거나 tripType이 없으면 0 반환
  if (!firstSchedule || !firstSchedule.tripType) {
    return 0;
  }

  const otherSchedulesHoursSum = otherSchedules.reduce(
    (sum, schedule) => sum + (schedule.stayHours || 0), 0
  );
  
  const baseSchedule = otherSchedulesHoursSum >= 8 
    ? schedules[schedules.length - 1] 
    : firstSchedule;
  
  // 체류 시간에 따른 기본 식대 계산
  const hasInternational = schedules.some(s => s.tripType === 'international');
  const hasStayOver = schedules.some(s => s.dayType === '숙박일');
  
  let baseAmount = 0;
  if (hasStayOver) {
    baseAmount = 24; // 전일 식대
  } else if (baseSchedule.stayHours >= 8) {
    baseAmount = hasInternational ? 24 : 14; // 국외는 24유로, 국내는 14유로
  }
  
  // 접대비 차감
  if (entertainmentExpense) {
    if (entertainmentExpense.breakfast) baseAmount *= 0.8;
    if (entertainmentExpense.lunch) baseAmount *= 0.8;
    if (entertainmentExpense.dinner) baseAmount *= 0.8;
  }
  
  return baseAmount;
};

// 유틸리티 함수들을 컴포넌트 외부로 이동
const calculateStayHoursForDate = (
  date: string, 
  schedules: MealAllowanceInfo[], 
  tripStartDate: Date | undefined, 
  tripEndDate: Date | undefined,
  startTime: string = "00:00",
  endTime: string = "24:00"
): number => {
  if (!schedules || schedules.length === 0 || !tripStartDate || !tripEndDate) return 0;
  
  const currentDate = new Date(date);
  const startDate = new Date(tripStartDate);
  const endDate = new Date(tripEndDate);
  
  // 해당 날짜의 스케줄 찾기
  const daySchedule = schedules.find(schedule => 
    schedule.dayType === '숙박일' || 
    (schedule.date && new Date(schedule.date).toDateString() === currentDate.toDateString())
  );

  // 숙박일인 경우 24시간 반환
  if (daySchedule?.dayType === '숙박일') {
    return 24;
  }
  
  // 첫째날인 경우
  if (isSameDay(currentDate, startDate)) {
    const schedule = schedules[0];
    const timeStr = schedule.startTime || startTime;
    const [hours, minutes] = timeStr.split(':').map(Number);
    // 시작 시간부터 자정(24:00)까지의 시간 계산
    const hoursFromStart = 24 - hours - (minutes / 60);
    return Math.max(0, Math.min(24, hoursFromStart));
  }
  
  // 마지막날인 경우
  if (isSameDay(currentDate, endDate)) {
    const schedule = schedules[schedules.length - 1];
    const timeStr = schedule.endTime || endTime;
    const [hours, minutes] = timeStr.split(':').map(Number);
    // 자정(00:00)부터 종료 시간까지의 시간 계산
    const hoursUntilEnd = hours + (minutes / 60);
    return Math.max(0, Math.min(24, hoursUntilEnd));
  }
  
  // 중간날인 경우
  return 24;
};

const getBaseCountry = (info: MealAllowanceInfo): string => {
  if (!info.tripType) return "-";
  return info.tripType === 'domestic' 
    ? (info.arrivalCity ? `국내(${info.arrivalCity})` : "독일")
    : (info.arrivalCountry || "-");
};

const calculateMealAllowance = (info: MealAllowanceInfo): number => {
  if (!info.tripType) return 0;
  
  let baseAmount = info.tripType === 'international' ? 20 : 8;
  
  // 식사 공제
  if (info.breakfast) baseAmount *= 0.8;
  if (info.lunch) baseAmount *= 0.8;
  if (info.dinner) baseAmount *= 0.8;
  
  return baseAmount;
};

export default function MealAllowanceInfo({ 
  mealAllowanceInfo = {},
  onChange, 
  onTotalAllowanceChange, 
  tripStartDate, 
  tripEndDate,
  entertainmentExpenses = [],
  startTime = "08:00",
  endTime = "08:00",
  isAllowanceEnabled = true
}: MealAllowanceInfoProps) {
  const t = useTranslations()
  const { ratesCache, fetchRateForCountry } = useAllowanceRates();
  const [loadingCountries, setLoadingCountries] = useState<Set<string>>(new Set());
  const prevTotalRef = useRef<number>(0);

  // 국가 코드 캐시
  const countryCodesCache = useMemo(() => {
    const cache: { [key: string]: string } = {};
    Object.values(mealAllowanceInfo).forEach(schedules => {
      if (!Array.isArray(schedules)) return;
      schedules.forEach(schedule => {
        if (schedule.tripType === 'international' && schedule.arrivalCountry) {
          cache[schedule.arrivalCountry] = '';
        }
      });
    });
    return cache;
  }, [mealAllowanceInfo]);

  // 필요한 국가 요율 미리 로드
  useEffect(() => {
    const loadRates = async () => {
      const countries = Object.keys(countryCodesCache).filter(country => 
        !ratesCache[country] && !loadingCountries.has(country)
      );

      if (countries.length === 0) return;

      setLoadingCountries(prev => {
        const newSet = new Set(prev);
        countries.forEach(c => newSet.add(c));
        return newSet;
      });

      try {
        await Promise.all(
          countries.map(async country => {
            await fetchRateForCountry(country);
          })
        );
      } finally {
        setLoadingCountries(prev => {
          const newSet = new Set(prev);
          countries.forEach(c => newSet.delete(c));
          return newSet;
        });
      }
    };

    loadRates();
  }, [countryCodesCache, ratesCache, loadingCountries, fetchRateForCountry]);

  // 날짜 범위에 따른 초기 일정 생성
  useEffect(() => {
    if (!tripStartDate || !tripEndDate) return;

    const newInfo: { [date: string]: MealAllowanceInfo[] } = {};
    let currentDate = new Date(tripStartDate);
    const endDate = new Date(tripEndDate);
    endDate.setHours(23, 59, 59, 999);

    while (currentDate <= endDate) {
      const dateStr = dateFormat(currentDate, "yyyy-MM-dd");
      const isFirstDay = isSameDay(currentDate, tripStartDate);
      const isLastDay = isSameDay(currentDate, tripEndDate);

      // 해당 날짜에 일정이 없는 경우에만 생성
      if (!mealAllowanceInfo[dateStr] || !Array.isArray(mealAllowanceInfo[dateStr]) || mealAllowanceInfo[dateStr].length === 0) {
        newInfo[dateStr] = [{
          date: dateStr,
          tripType: undefined,
          departureCountry: '',
          departureCity: '',
          arrivalCountry: '',
          arrivalCity: '',
          isExpanded: true,
          isFirstDay,
          isLastDay,
          startTime: isFirstDay ? startTime : undefined,
          endTime: isLastDay ? endTime : undefined
        }];
      } else {
        // 기존 일정이 있는 경우 시작/종료 시간만 업데이트
        newInfo[dateStr] = mealAllowanceInfo[dateStr].map(schedule => ({
          ...schedule,
          isFirstDay,
          isLastDay,
          startTime: isFirstDay ? startTime : schedule.startTime,
          endTime: isLastDay ? endTime : schedule.endTime
        }));
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 변경사항이 있는 경우에만 업데이트
    const hasChanges = Object.keys(newInfo).length > 0;
    if (hasChanges) {
      onChange(newInfo);
    }
  }, [tripStartDate, tripEndDate, startTime, endTime]);

  // 계산된 값들을 메모이제이션
  const calculatedValues = useMemo(() => {
    const values = {
      dailyAllowances: {} as { [date: string]: number },
      stayHours: {} as { [date: string]: number },
      baseCountries: {} as { [date: string]: string },
      entertainmentInfo: {} as { [date: string]: { breakfast: boolean; lunch: boolean; dinner: boolean } }
    };

    for (const [date, schedules] of Object.entries(mealAllowanceInfo)) {
      if (!Array.isArray(schedules) || schedules.length === 0) continue;

      const lastSchedule = schedules[schedules.length - 1];
      const isDomestic = lastSchedule.tripType === 'domestic';
      
      // 체류 시간 계산 - 국내/국외 구분 없이 동일한 로직 적용
      values.stayHours[date] = calculateStayHoursForDate(
        date, 
        schedules, 
        tripStartDate, 
        tripEndDate,
        startTime,
        endTime
      );

      // 기준 국가 설정
      const baseCountry = isDomestic ? '국내' : lastSchedule.arrivalCountry || '-';
      values.baseCountries[date] = baseCountry;

      // 접대비 정보 설정
      const entertainment = entertainmentExpenses.find(exp => exp.date === date);
      values.entertainmentInfo[date] = {
        breakfast: entertainment?.breakfast || false,
        lunch: entertainment?.lunch || false,
        dinner: entertainment?.dinner || false
      };

      // 체류시간이 8시간 미만이면 0유로
      if (values.stayHours[date] < 8) {
        values.dailyAllowances[date] = 0;
        continue;
      }

      // 국가별 요율에 따른 식대 계산
      let countryRates;
      if (isDomestic) {
        countryRates = ratesCache['DE'];
      } else {
        // 국외인 경우, 해당 국가의 요율이 없으면 0원 처리
        countryRates = baseCountry && ratesCache[baseCountry];
        if (!countryRates) {
          values.dailyAllowances[date] = 0;
          continue;
        }
      }

      const isFullDay = values.stayHours[date] >= 24;
      let baseAmount;
      
      if (isFullDay) {
        // 24시간 이상 체류 시 전일 요율 적용
        baseAmount = countryRates.fullDayAmount;
      } else {
        // 8시간 이상 24시간 미만 체류
        if (isDomestic || baseCountry === 'DE') {
          // 국내이거나 독일이 기준 국가인 경우 부분 요율 그대로 적용
          baseAmount = countryRates.partialDayAmount;
        } else {
          // 그 외 국외는 부분 요율의 80% 적용
          baseAmount = countryRates.partialDayAmount * 0.8;
        }
      }

      // 식사 제공에 따른 차감 (항상 원래 요율 기준으로 계산)
      let mealDeduction = 0;
      const mealDeductionBase = isFullDay ? countryRates.fullDayAmount : countryRates.partialDayAmount;

      if (values.entertainmentInfo[date].breakfast) {
        mealDeduction += mealDeductionBase * 0.2;  // 20% 차감
      }
      if (values.entertainmentInfo[date].lunch) {
        mealDeduction += mealDeductionBase * 0.4;  // 40% 차감
      }
      if (values.entertainmentInfo[date].dinner) {
        mealDeduction += mealDeductionBase * 0.4;  // 40% 차감
      }

      values.dailyAllowances[date] = Math.max(0, baseAmount - mealDeduction);
    }

    return values;
  }, [mealAllowanceInfo, entertainmentExpenses, tripStartDate, tripEndDate, startTime, endTime, ratesCache]);

  // 총액 계산 메모이제이션 - 식비 지급 여부 반영
  const totalAmount = useMemo(() => {
    if (!isAllowanceEnabled) return 0;
    return Object.values(calculatedValues.dailyAllowances).reduce((sum, amount) => sum + amount, 0);
  }, [calculatedValues.dailyAllowances, isAllowanceEnabled]);

  // 총액이 변경될 때만 부모에게 알림
  useEffect(() => {
    if (prevTotalRef.current !== totalAmount) {
      prevTotalRef.current = totalAmount;
      onTotalAllowanceChange(totalAmount);
    }
  }, [totalAmount, onTotalAllowanceChange]);

  // 식비 지급이 비활성화되어 있으면 UI를 숨김
  if (!isAllowanceEnabled) {
    return null;
  }

  // 특정 날짜에 일정 추가
  const handleAddSchedule = (date: string) => {
    const newInfo = { ...mealAllowanceInfo }
    
    // 해당 날짜의 일정이 없거나 배열이 아닌 경우 초기화
    if (!newInfo[date] || !Array.isArray(newInfo[date])) {
      newInfo[date] = []
    }
    
    // 새 일정 추가
    const newSchedule: MealAllowanceInfo = {
      date,
        tripType: undefined,
        departureCountry: '',
        departureCity: '',
        arrivalCountry: '',
        arrivalCity: '',
        isExpanded: true
  }

    newInfo[date] = [...newInfo[date], newSchedule]
    onChange(newInfo)
  }

  // 특정 날짜의 특정 일정 삭제
  const handleRemoveSchedule = (date: string, scheduleIndex: number) => {
    const newInfo = { ...mealAllowanceInfo }
    
    // 해당 날짜의 일정이 없거나 배열이 아닌 경우 처리하지 않음
    if (!newInfo[date] || !Array.isArray(newInfo[date])) {
      return;
    }
    
    // 해당 날짜의 일정이 1개 이하면 삭제하지 않음
    if (newInfo[date].length <= 1) {
      return;
    }
    
    newInfo[date] = newInfo[date].filter((_, index) => index !== scheduleIndex)
    onChange(newInfo)
  }

  // 일정 정보 변경
  const handleScheduleChange = (date: string, scheduleIndex: number, field: keyof MealAllowanceInfo, value: any) => {
    const newInfo = { ...mealAllowanceInfo };
    
    if (!newInfo[date]) {
      newInfo[date] = [];
    }
    
    // tripType이 변경되는 경우 관련 필드 초기화
    if (field === 'tripType') {
      newInfo[date][scheduleIndex] = {
        ...newInfo[date][scheduleIndex],
        date,
        tripType: value,
        departureCountry: '',
        departureCity: '',
        arrivalCountry: '',
        arrivalCity: '',
      };
            } else {
      if (!newInfo[date][scheduleIndex]) {
        newInfo[date][scheduleIndex] = {
          date,
          tripType: 'domestic',
          departureCountry: '',
          departureCity: '',
          arrivalCountry: '',
          arrivalCity: '',
        };
      }
      newInfo[date][scheduleIndex] = {
        ...newInfo[date][scheduleIndex],
        [field]: value
      };
    }
    
    onChange(newInfo);
  };

  // 해당 날짜의 접대비 정보를 가져오는 함수
  const getEntertainmentExpenseForDate = (date: string) => {
    // entertainmentExpenses가 없거나 빈 배열이면 기본값 반환
    if (!entertainmentExpenses || entertainmentExpenses.length === 0) {
      return {
        breakfast: false,
        lunch: false,
        dinner: false
      };
    }

    // 해당 날짜의 모든 접대비 정보를 찾습니다
    const dayExpenses = entertainmentExpenses.filter(expense => {
      try {
        const expenseDate = parseISO(expense.date);
        const targetDate = parseISO(date);
        return isValid(expenseDate) && isValid(targetDate) && isSameDay(expenseDate, targetDate);
      } catch (error) {
        console.error("날짜 파싱 오류:", error);
        return false;
      }
    });

    // 모든 접대비 정보를 합산합니다
    return {
      breakfast: dayExpenses.some(expense => expense.breakfast),
      lunch: dayExpenses.some(expense => expense.lunch),
      dinner: dayExpenses.some(expense => expense.dinner)
    };
  };

  // 유틸리티 함수들
  const calculateDuration = (startDate: Date | undefined, endDate: Date | undefined, startTime: string, endTime: string): string => {
    if (!startDate || !endDate || !startTime || !endTime) return "-";
    
    const start = dateUtils.combineDateAndTime(startDate, startTime);
    const end = dateUtils.combineDateAndTime(endDate, endTime);
    const hours = differenceInHours(end, start);
    
    return `${hours}`;
  };

  const isArrivalDay = (info: MealAllowanceInfo): boolean => {
    return info.dayType === '도착일';
  };

  const handleArrivalDayChange = (index: number, isArrival: boolean) => {
    // 도착일 상태 변경 로직
  };

  const handleMealChange = (date: string, index: number, meal: 'breakfast' | 'lunch' | 'dinner', value: boolean) => {
    const newInfo = { ...mealAllowanceInfo };
    if (!newInfo[date]) {
      newInfo[date] = [];
    }
    if (!newInfo[date][index]) {
      newInfo[date][index] = {
        date,
        tripType: undefined,
        departureCountry: '',
        departureCity: '',
        arrivalCountry: '',
        arrivalCity: '',
      };
    }
    newInfo[date][index] = {
      ...newInfo[date][index],
      [meal]: value
    };
    onChange(newInfo);
  };

  const calculateStayHours = (info: MealAllowanceInfo): number => {
    if (!info.tripType) return 0;
    
    let hours = 0;
    if (info.tripType === 'international') {
      hours = 24; // 전일
    } else if (info.tripType === 'domestic') {
      hours = 8; // 8시간
    }
    
    return hours;
  };

  return (
    <div className="space-y-4">
      {/* 상단 설명 */}
      <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-2">
        <Info className="w-5 h-5 text-blue-500 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          각 날짜별로 이동 일정을 입력하세요. 필요한 경우 일정을 추가하거나 삭제할 수 있습니다.
        </p>
            </div>
            
      {/* 날짜별 일정 입력 */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">날짜</TableHead>
              <TableHead className="w-[90px]">국내/국외</TableHead>
              <TableHead className="w-[200px]">출발지</TableHead>
              <TableHead className="w-[200px]">도착지</TableHead>
              <TableHead className="w-[100px]">추가/삭제</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(mealAllowanceInfo || {})
              .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
              .map(([date, schedules]) => (
                Array.isArray(schedules) && schedules.map((schedule, scheduleIndex) => (
                  <TableRow key={`${date}-${scheduleIndex}`}>
                    <TableCell>
                      {scheduleIndex === 0 ? (
                        <div className="font-medium text-sm flex items-center gap-1">
                          {date}
                          <span className="text-xs text-muted-foreground">
                            ({['일', '월', '화', '수', '목', '금', '토'][new Date(date).getDay()]})
                          </span>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                  <Select
                        value={schedule.tripType}
                        onValueChange={(value) => handleScheduleChange(date, scheduleIndex, 'tripType', value)}
                  >
                        <SelectTrigger className="w-[80px]">
                          <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                          <SelectItem value="domestic">국내</SelectItem>
                          <SelectItem value="international">국외</SelectItem>
                    </SelectContent>
                  </Select>
                    </TableCell>
                    <TableCell>
                      {schedule.tripType === 'international' ? (
                        <CountrySelector 
                          value={schedule.departureCountry || ''}
                          onChange={(value) => handleScheduleChange(
                            date,
                            scheduleIndex,
                            'departureCountry',
                            value
                          )}
                          placeholder="출발 국가"
                          disabled={!schedule.tripType}
                        />
                      ) : (
                        <Input
                          value={schedule.departureCity || ''} 
                          onChange={(e) => handleScheduleChange(
                            date,
                            scheduleIndex,
                            'departureCity',
                            e.target.value
                          )}
                          placeholder="출발지"
                          className="w-full"
                          disabled={!schedule.tripType}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {schedule.tripType === 'international' ? (
                        <CountrySelector
                          value={schedule.arrivalCountry || ''}
                          onChange={(value) => handleScheduleChange(
                            date,
                            scheduleIndex,
                            'arrivalCountry',
                            value
                          )}
                          placeholder="도착 국가"
                          disabled={!schedule.tripType}
                        />
                      ) : (
                        <Input
                          value={schedule.arrivalCity || ''} 
                          onChange={(e) => handleScheduleChange(
                            date,
                            scheduleIndex,
                            'arrivalCity',
                            e.target.value
                          )}
                          placeholder="도착지"
                          className="w-full"
                          disabled={!schedule.tripType}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {scheduleIndex === schedules.length - 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleAddSchedule(date)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                        {schedules.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                            onClick={() => handleRemoveSchedule(date, scheduleIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ))}
          </TableBody>
        </Table>
      </div>
      
      {/* 일별 상세 정보 */}
      <Card className="mt-8">
        <CardHeader className="py-4">
          <CardTitle>일별 상세 정보</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DailyAllowanceTable
            mealAllowanceInfo={mealAllowanceInfo}
            dailyAllowances={calculatedValues.dailyAllowances}
            stayHours={calculatedValues.stayHours}
            baseCountries={calculatedValues.baseCountries}
            entertainmentExpenses={calculatedValues.entertainmentInfo}
          />
        </CardContent>
      </Card>
    </div>
  )
} 