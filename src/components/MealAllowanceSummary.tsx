'use client'

import { Clock, EuroIcon } from "lucide-react"
import { useTranslations } from 'next-intl'
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// 숫자 포맷팅 함수
const formatNumber = (num: number) => {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

interface AllowanceRates {
  countryCode: string
  fullDayAmount: number
  partialDayAmount: number
}

interface DaySchedule {
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
}

interface EntertainmentExpense {
  breakfast?: boolean
  lunch?: boolean
  dinner?: boolean
}

interface DaySummaryProps {
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
  onAllowanceCalculated?: (amount: number) => void
  hideAllowanceResult?: boolean
  enhanceBaseAllowance?: boolean
}

export default function MealAllowanceDaySummary({ 
  schedules, 
  entertainmentExpense,
  onAllowanceCalculated,
  hideAllowanceResult = false,
  enhanceBaseAllowance = false
}: DaySummaryProps) {
  const t = useTranslations()
  const [allowanceRates, setAllowanceRates] = useState<AllowanceRates>({
    countryCode: '',
    fullDayAmount: 0,
    partialDayAmount: 0
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const prevAmountRef = useRef<number>(0);
  
  // 국가간 이동 여부 확인
  const hasInternational = useMemo(() => 
    schedules.some(s => s.tripType === 'international'), 
  [schedules])
  
  // 숙박 여부 확인
  const hasStayOver = schedules.some(s => s.dayType === '숙박한 날')
  
  // 일별 체류 시간 및 기준국가 계산 로직
  const { maxStayHours, maxStaySchedule, baseCountryInfo } = useMemo(() => {
    if (!schedules || schedules.length === 0) {
      return { 
        maxStayHours: 0, 
        maxStaySchedule: null,
        baseCountryInfo: { country: '', scheduleIndex: -1 }
      };
    }

    // 첫 일정과 나머지 일정으로 분리
    const [firstSchedule, ...otherSchedules] = schedules;
    
    // 나머지 일정들의 체류시간 합 계산
    const otherSchedulesStayHoursSum = otherSchedules.reduce(
      (sum, schedule) => sum + schedule.stayHours, 0
    );
    
    // 최대 체류 시간 및 기준 일정 결정
    let maxStayHours, maxStaySchedule, baseCountryInfo;
    
    // 국가간 이동 여부 확인
    const isInternationalTrip = schedules.some(s => s.tripType === 'international');
    
    if (otherSchedulesStayHoursSum >= 8) {
      // 나머지 일정들의 체류시간 합이 8시간 이상이면 마지막 일정 기준
      maxStayHours = otherSchedulesStayHoursSum;
      maxStaySchedule = schedules[schedules.length - 1];
      
      // 기준국가는 마지막 일정의 도착국가
      if (maxStaySchedule.tripType === 'international') {
        baseCountryInfo = {
          country: maxStaySchedule.arrivalCountry || '',
          scheduleIndex: maxStaySchedule.index
        };
      } else {
        baseCountryInfo = {
          country: `국내(${maxStaySchedule.arrivalCity || ''})`,
          scheduleIndex: maxStaySchedule.index
        };
      }
    } else {
      // 나머지 일정들의 체류시간 합이 8시간 미만이면 첫 일정 기준
      maxStayHours = firstSchedule.stayHours;
      maxStaySchedule = firstSchedule;
      
      // 국가간 이동이면서 체류 시간이 8시간 이상인 경우 도착국가가 기준
      if (isInternationalTrip && maxStayHours >= 8 && firstSchedule.tripType === 'international') {
        baseCountryInfo = {
          country: firstSchedule.arrivalCountry || '',
          scheduleIndex: firstSchedule.index
        };
      } 
      // 그 외의 경우 출발국가가 기준
      else if (firstSchedule.tripType === 'international') {
        baseCountryInfo = {
          country: firstSchedule.departureCountry || '',
          scheduleIndex: firstSchedule.index
        };
      } else {
        baseCountryInfo = {
          country: `국내(${firstSchedule.departureCity || ''})`,
          scheduleIndex: firstSchedule.index
        };
      }
    }
    
    return { maxStayHours, maxStaySchedule, baseCountryInfo };
  }, [schedules]);
  
  // 식대 계산 결과
  const mealAllowanceResult = useMemo(() => {
    // 디버깅을 위한 로그 추가
    console.log("Entertainment Expense:", entertainmentExpense);
    
    // 기본 식대 금액
    let baseMealAllowance = 0;
    let baseForDeduction = 0;  // 차감 계산을 위한 기준 금액
    
    // 1. 숙박 & 체류 시간에 따른 기본 식대 결정
    if (hasStayOver) {
      // 숙박한 날이면 전일 식대 적용
      baseMealAllowance = allowanceRates.fullDayAmount;
      baseForDeduction = allowanceRates.fullDayAmount;
    } else if (maxStayHours >= 8) {
      // 숙박하지 않았지만 8시간 이상이면 부분 식대 적용
      baseMealAllowance = allowanceRates.partialDayAmount;
      baseForDeduction = allowanceRates.partialDayAmount;
      
      // 국가간 이동의 경우 부분 식대의 80%를 적용
      // 단, 차감은 원래 금액 기준(100%)으로 함
      if (hasInternational) {
        baseMealAllowance = baseMealAllowance * 0.8;
      }
    } else {
      // 8시간 미만이면 식대 미적용
      return {
        baseMealAllowance: 0,
        finalMealAllowance: 0,
        breakfastDeduction: 0,
        lunchDeduction: 0,
        dinnerDeduction: 0,
        baseForDeduction: 0,
        totalDeduction: 0
      };
    }
    
    // 2. 접대비에 따른 차감 계산 (항상 원래 금액 기준으로 계산)
    let breakfastDeduction = 0;
    let lunchDeduction = 0;
    let dinnerDeduction = 0;
    
    // 각 식사별로 차감 금액 계산
    if (entertainmentExpense?.breakfast) {
      breakfastDeduction = baseForDeduction * 0.2;
    }
    
    if (entertainmentExpense?.lunch) {
      lunchDeduction = baseForDeduction * 0.4;
    }
    
    if (entertainmentExpense?.dinner) {
      dinnerDeduction = baseForDeduction * 0.4;
    }
    
    // 총 차감 금액 계산
    const totalDeduction = breakfastDeduction + lunchDeduction + dinnerDeduction;
    
    // 최종 식대 = 기본 식대 - 식사별 차감 금액
    let finalMealAllowance = baseMealAllowance - totalDeduction;
    
    // 음수가 되지 않도록 처리
    finalMealAllowance = Math.max(0, finalMealAllowance);
    
    return {
      baseMealAllowance,
      finalMealAllowance,
      breakfastDeduction,
      lunchDeduction,
      dinnerDeduction,
      baseForDeduction,
      totalDeduction
    };
  }, [allowanceRates, hasStayOver, maxStayHours, hasInternational, entertainmentExpense]);

  // 독일 세법에 맞는 식대 계산
  const calculateMealAllowance = () => {
    return mealAllowanceResult.finalMealAllowance;
  };

  // DB에서 국가별 식대 요율 가져오기
  const fetchAllowanceRates = async () => {
    // 필수 데이터 검증
    if (!baseCountryInfo.country || baseCountryInfo.country === '') {
      setAllowanceRates({
        countryCode: '',
        fullDayAmount: 0,
        partialDayAmount: 0
      });
      setIsLoading(false);
      return;
    }
    
    // 이미 이 국가에 대해 데이터를 가져왔고 로딩 중이 아니면 중복 요청 방지
    if (allowanceRates.countryCode === baseCountryInfo.country && !isLoading) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      let countryName = baseCountryInfo.country;
      console.log('Fetching rates for country:', countryName);
      
      // 현재 요청 중인 국가 저장
      setAllowanceRates(prev => ({
        ...prev,
        countryCode: countryName
      }));
      
      // 국내 이동인 경우 독일로 처리
      if (countryName.startsWith('국내')) {
        console.log('Domestic travel, using German rates');
        const { data, error } = await supabase
          .from('country_allowances')
          .select('*')
          .eq('country_code', 'DE')
          .single();
          
        if (error) {
          console.error('Error fetching German allowance:', error);
          setAllowanceRates(prev => ({
            ...prev,
            fullDayAmount: 28,
            partialDayAmount: 14
          }));
        } else if (data) {
          console.log('Received German allowance data:', data);
          setAllowanceRates(prev => ({
            ...prev,
            fullDayAmount: parseFloat(data.full_day_amount),
            partialDayAmount: parseFloat(data.partial_day_amount)
          }));
        }
      } else {
        // 간단한 국가명 정제 (괄호 제거 등)
        const simplifiedCountryName = countryName.replace(/\(.*?\)/g, '').trim();
        console.log('Simplified country name:', simplifiedCountryName);
        
        // 1. 먼저 직접 국가 코드인지 확인 (JP, KR 등 2자리 코드일 경우)
        if (simplifiedCountryName.length === 2 && simplifiedCountryName.toUpperCase() === simplifiedCountryName) {
          console.log('Country name appears to be a country code, using directly:', simplifiedCountryName);
          
          const { data, error } = await supabase
            .from('country_allowances')
            .select('*')
            .eq('country_code', simplifiedCountryName)
            .single();
            
          if (!error && data) {
            console.log('Found country data by direct code:', data);
            setAllowanceRates(prev => ({
              ...prev,
              fullDayAmount: parseFloat(data.full_day_amount),
              partialDayAmount: parseFloat(data.partial_day_amount)
            }));
            setIsLoading(false);
            return;
          }
        }
        
        // 2. 매핑된 국가 코드 확인
        const countryMap: { [key: string]: string } = {
          // 주요 국가 매핑
          '한국': 'KR',
          '대한민국': 'KR',
          '일본': 'JP',
          '중국': 'CN',
          '미국': 'US',
          '영국': 'GB',
          '프랑스': 'FR',
          '독일': 'DE',
          '이탈리아': 'IT',
          '스페인': 'ES',
          '캐나다': 'CA',
          '호주': 'AU',
          '러시아': 'RU',
          '인도': 'IN',
          '브라질': 'BR',
          '남아프리카': 'ZA',
          // 필요한 국가 매핑 추가...
        };
        
        let countryCode = countryMap[simplifiedCountryName];
        
        if (countryCode) {
          console.log('Found country code from map:', countryCode);
          const { data, error } = await supabase
            .from('country_allowances')
            .select('*')
            .eq('country_code', countryCode)
            .single();
            
          if (!error && data) {
            console.log('Found country data by code:', data);
            setAllowanceRates(prev => ({
              ...prev,
              fullDayAmount: parseFloat(data.full_day_amount),
              partialDayAmount: parseFloat(data.partial_day_amount)
            }));
            setIsLoading(false);
            return;
          }
        }
        
        // 3. 정확한 국가명으로 검색
        const { data: exactData, error: exactError } = await supabase
          .from('country_allowances')
          .select('*')
          .eq('country_name_ko', simplifiedCountryName);
          
        if (!exactError && exactData && exactData.length > 0) {
          console.log('Found country by exact name:', exactData[0]);
          setAllowanceRates(prev => ({
            ...prev,
            fullDayAmount: parseFloat(exactData[0].full_day_amount),
            partialDayAmount: parseFloat(exactData[0].partial_day_amount)
          }));
          setIsLoading(false);
          return;
        }
        
        // 3. 부분 일치로 검색 (마지막 대안)
        console.log('Trying partial match for:', simplifiedCountryName);
        const { data, error } = await supabase
          .from('country_allowances')
          .select('*')
          .ilike('country_name_ko', `%${simplifiedCountryName}%`)
          .limit(1);
        
        console.log('Partial match search result:', data);
          
        if (error || !data || data.length === 0) {
          console.log('No matches found, using German rates');
          // 국가를 찾지 못했을 때 독일 데이터 사용
          const { data: germanData, error: germanError } = await supabase
            .from('country_allowances')
            .select('*')
            .eq('country_code', 'DE')
            .single();
            
          if (germanError || !germanData) {
            console.log('Using default German rates');
            setAllowanceRates(prev => ({
              ...prev,
              fullDayAmount: 28,
              partialDayAmount: 14
            }));
          } else {
            console.log('Using German rates from DB:', germanData);
            setAllowanceRates(prev => ({
              ...prev,
              fullDayAmount: parseFloat(germanData.full_day_amount),
              partialDayAmount: parseFloat(germanData.partial_day_amount)
            }));
          }
        } else {
          console.log('Found country data by partial match:', data[0]);
          setAllowanceRates(prev => ({
            ...prev,
            fullDayAmount: parseFloat(data[0].full_day_amount),
            partialDayAmount: parseFloat(data[0].partial_day_amount)
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch allowance rates:', error);
      // 오류 발생 시 독일 기본 데이터 사용
      setAllowanceRates(prev => ({
        ...prev,
        fullDayAmount: 28,
        partialDayAmount: 14
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 식대 요율 가져오기
  useEffect(() => {
    fetchAllowanceRates();
  }, [baseCountryInfo]);

  // 식대 금액이 변경될 때 부모 컴포넌트에 전달
  useEffect(() => {
    const currentAmount = mealAllowanceResult.finalMealAllowance;
    
    if (currentAmount !== prevAmountRef.current && onAllowanceCalculated) {
      prevAmountRef.current = currentAmount;
      onAllowanceCalculated(currentAmount);
    }
  }, [mealAllowanceResult.finalMealAllowance, onAllowanceCalculated]);
  
  return (
    <div className="space-y-2 mt-2">
      {/* 기본 적용 식대 정보 */}
      <div className="p-3 rounded-md bg-gray-50">
        <div className="space-y-2">
          <div className="flex items-center">
            <span className="font-medium text-blue-700 w-28">최대 체류 시간:</span>
            <span>{maxStayHours}시간</span>
          </div>
          <div className="flex items-center">
            <span className="font-medium text-blue-700 w-28">국가간 이동:</span>
            <span>{hasInternational ? '있음' : '없음'}</span>
          </div>
          <div className="flex items-center">
            <span className="font-medium text-blue-700 w-28">숙박 여부:</span>
            <span>{hasStayOver ? '숙박함' : '숙박 안함'}</span>
          </div>
          <div className="flex items-center">
            <span className="font-medium text-blue-700 w-28">기준국가:</span>
            <span className="font-medium text-green-700">{baseCountryInfo.country || '없음'}</span>
            <span className="ml-1 text-xs text-gray-500">
              (일정 {baseCountryInfo.scheduleIndex} 기준
              {hasInternational && maxStayHours >= 8 && !hasStayOver ? ' - 도착국가' : ''}
              {hasInternational && (maxStayHours < 8 || hasStayOver) ? ' - 출발국가' : ''})
            </span>
          </div>
          <div className="flex items-center">
            <span className="font-medium text-blue-700 w-28">식대 계산:</span>
            <div className="flex-1">
              <div className="font-medium">
                {hasStayOver 
                  ? '전일 식대 적용' 
                  : maxStayHours >= 8 
                    ? '부분 식대 적용' 
                    : '식대 미적용'}
              </div>
              <div className="text-xs text-gray-600">
                {!hasStayOver && maxStayHours >= 8 && hasInternational 
                  ? '※ 국가간 이동 & 숙박 안함: 부분 식대의 80%만 적용 (차감은 원래 금액 기준)' 
                  : ''}
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <span className="font-medium text-blue-700 w-28">접대비 포함여부:</span>
            <div className="flex space-x-2">
              {entertainmentExpense?.breakfast ? 
                <span className="text-red-600 font-medium">조식 포함</span> : null}
              {entertainmentExpense?.lunch ? 
                <span className="text-red-600 font-medium">중식 포함</span> : null}
              {entertainmentExpense?.dinner ? 
                <span className="text-red-600 font-medium">석식 포함</span> : null}
              {!entertainmentExpense?.breakfast && !entertainmentExpense?.lunch && !entertainmentExpense?.dinner && 
                <span className="text-gray-500">접대비 없음</span>}
            </div>
          </div>
          
          {/* 금액 정보 표시 */}
          <div className="mt-3 border-t border-gray-200 pt-2">
            <h6 className="font-semibold text-blue-700 mb-1">💰 식대 금액 정보</h6>
            {isLoading ? (
              <div className="text-gray-500">로딩 중...</div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center">
                  <span className="w-28 text-gray-600">전일 식대(24H):</span>
                  <span className="font-medium">{allowanceRates.fullDayAmount.toFixed(2)}€</span>
                </div>
                <div className="flex items-center">
                  <span className="w-28 text-gray-600">부분 식대(8H+):</span>
                  <span className="font-medium">{allowanceRates.partialDayAmount.toFixed(2)}€</span>
                </div>
                
                {mealAllowanceResult.baseMealAllowance > 0 && (
                  <>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex items-center">
                        <span className="w-28 text-gray-600">기본 적용 식대:</span>
                        <div className="flex-1">
                          <div className="font-medium">
                            {mealAllowanceResult.baseMealAllowance.toFixed(2)}€
                          </div>
                          <div className="text-xs text-gray-600">
                            {hasStayOver 
                              ? '전일 식대' 
                              : maxStayHours >= 8 
                                ? hasInternational 
                                  ? '부분 식대 (국가간 이동 80% 적용)' 
                                  : '부분 식대'
                                : '식대 미적용'}
                          </div>
                        </div>
                      </div>
                      
                      {/* 식사별 차감 금액 표시 */}
                      {(mealAllowanceResult.breakfastDeduction > 0 || 
                       mealAllowanceResult.lunchDeduction > 0 || 
                       mealAllowanceResult.dinnerDeduction > 0) && (
                        <div className="mt-1 pt-1 pl-2 border-l-2 border-red-200">
                          <div className="text-sm font-medium text-red-600 mb-1">
                            차감 내역 (차감은 {hasInternational && !hasStayOver && maxStayHours >= 8 
                              ? '부분 식대 100% 기준으로 적용'
                              : '적용 식대 기준으로 적용'}):
                          </div>
                          {mealAllowanceResult.breakfastDeduction > 0 && (
                            <div className="flex items-center text-xs">
                              <span className="w-28 text-red-500">- 조식:</span>
                              <span className="text-red-500">-{mealAllowanceResult.breakfastDeduction.toFixed(2)}€ (20%)</span>
                            </div>
                          )}
                          {mealAllowanceResult.lunchDeduction > 0 && (
                            <div className="flex items-center text-xs">
                              <span className="w-28 text-red-500">- 중식:</span>
                              <span className="text-red-500">-{mealAllowanceResult.lunchDeduction.toFixed(2)}€ (40%)</span>
                            </div>
                          )}
                          {mealAllowanceResult.dinnerDeduction > 0 && (
                            <div className="flex items-center text-xs">
                              <span className="w-28 text-red-500">- 석식:</span>
                              <span className="text-red-500">-{mealAllowanceResult.dinnerDeduction.toFixed(2)}€ (40%)</span>
                            </div>
                          )}
                          <div className="flex items-center text-xs border-t border-red-100 mt-1 pt-1">
                            <span className="w-28 text-red-600 font-medium">- 총 차감:</span>
                            <span className="text-red-600 font-medium">-{mealAllowanceResult.totalDeduction.toFixed(2)}€ ({Math.round(mealAllowanceResult.totalDeduction / mealAllowanceResult.baseForDeduction * 100)}%)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 최종 식대 정보 - hideAllowanceResult가 true일 때는 숨김 */}
      {!hideAllowanceResult && (
        <div className={cn(
          "p-3 rounded-md border",
          enhanceBaseAllowance ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200"
        )}>
          <div className="flex justify-between items-center">
            <span className="font-medium">최종 적용 식대:</span>
            <span className={cn(
              "font-bold",
              enhanceBaseAllowance ? "text-blue-700 text-lg" : "text-green-700"
            )}>
              {mealAllowanceResult.finalMealAllowance.toFixed(2)}€
            </span>
          </div>
        </div>
      )}
    </div>
  )
} 