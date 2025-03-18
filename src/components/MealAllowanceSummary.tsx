'use client'

import { Clock, EuroIcon } from "lucide-react"
import { useTranslations } from 'next-intl'
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

interface AllowanceRates {
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
  schedules: DaySchedule[]
  entertainmentExpense?: EntertainmentExpense
  onAllowanceCalculated?: (amount: number) => void
}

export default function MealAllowanceDaySummary({ schedules, entertainmentExpense, onAllowanceCalculated }: DaySummaryProps) {
  const t = useTranslations()
  const [allowanceRates, setAllowanceRates] = useState<AllowanceRates>({
    fullDayAmount: 0,
    partialDayAmount: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const fetchedCountryRef = useRef<string | null>(null);
  
  // 최장 체류 시간 계산
  const maxStayHours = Math.max(...schedules.map(s => s.stayHours))
  const maxStaySchedule = schedules.find(s => s.stayHours === maxStayHours)
  
  // 국가간 이동 여부 확인
  const hasInternational = schedules.some(s => s.moveType === '국가간 이동')
  
  // 숙박한 날 여부 확인
  const hasStayOver = schedules.some(s => s.dayType === '숙박한 날')
  
  // 기준국가 계산 - useMemo로 메모이제이션
  const baseCountryInfo = useMemo(() => {
    let result = {
      country: '',
      scheduleIndex: -1
    };
    
    if (schedules.length === 1) {
      // 일정이 하나면 도착한 나라가 기준
      const schedule = schedules[0]
      if (schedule.tripType === 'international') {
        result = {
          country: schedule.arrivalCountry || '',
          scheduleIndex: schedule.index
        }
      } else {
        result = {
          country: `국내(${schedule.arrivalCity || ''})`,
          scheduleIndex: schedule.index
        }
      }
    } else if (schedules.length > 1) {
      // 첫번째 일정을 제외한 모든 일정의 체류시간 합계 계산
      const otherSchedulesStayHoursSum = schedules
        .filter((_, idx) => idx > 0)
        .reduce((sum, schedule) => sum + schedule.stayHours, 0)
      
      if (otherSchedulesStayHoursSum >= 8) {
        // 8시간 이상이면 마지막 일정의 도착국가
        const lastSchedule = schedules[schedules.length - 1]
        if (lastSchedule.tripType === 'international') {
          result = {
            country: lastSchedule.arrivalCountry || '',
            scheduleIndex: lastSchedule.index
          }
        } else {
          result = {
            country: `국내(${lastSchedule.arrivalCity || ''})`,
            scheduleIndex: lastSchedule.index
          }
        }
      } else {
        // 8시간 미만이면 첫번째 일정의 출발국가
        const firstSchedule = schedules[0]
        if (firstSchedule.tripType === 'international') {
          result = {
            country: firstSchedule.departureCountry || '',
            scheduleIndex: firstSchedule.index
          }
        } else {
          result = {
            country: `국내(${firstSchedule.departureCity || ''})`,
            scheduleIndex: firstSchedule.index
          }
        }
      }
    }
    
    return result;
  }, [schedules]);
  
  // 독일 세법에 맞는 식대 계산
  function calculateMealAllowance() {
    // 기본 식대 금액
    let baseMealAllowance = 0;
    
    // 각 식사별 차감 금액을 저장할 변수
    let breakfastDeduction = 0;
    let lunchDeduction = 0;
    let dinnerDeduction = 0;
    
    // 1. 숙박 & 체류 시간에 따른 기본 식대 결정
    if (hasStayOver || maxStayHours >= 24) {
      // 숙박한 날이면 전일 식대 적용
      baseMealAllowance = allowanceRates.fullDayAmount;
    } else if (maxStayHours >= 8) {
      // 숙박하지 않았지만 8시간 이상이면 부분 식대 적용
      baseMealAllowance = allowanceRates.partialDayAmount;
      
      // 2. 국가간 이동의 경우 부분 식대의 80%를 적용
      if (hasInternational && !hasStayOver) {
        baseMealAllowance = baseMealAllowance * 0.8;
      }
    } else {
      // 8시간 미만이면 식대 미적용
      return {
        baseMealAllowance: 0,
        finalMealAllowance: 0,
        breakfastDeduction: 0,
        lunchDeduction: 0,
        dinnerDeduction: 0
      };
    }
    
    // 3. 접대비에 따른 차감 계산
    const deductionBase = hasStayOver ? allowanceRates.fullDayAmount : allowanceRates.partialDayAmount;
    
    if (entertainmentExpense?.breakfast) {
      breakfastDeduction = deductionBase * 0.2;
    }
    
    if (entertainmentExpense?.lunch) {
      lunchDeduction = deductionBase * 0.4;
    }
    
    if (entertainmentExpense?.dinner) {
      dinnerDeduction = deductionBase * 0.4;
    }
    
    // 최종 식대 = 기본 식대 - 식사별 차감 금액
    let finalMealAllowance = baseMealAllowance - (breakfastDeduction + lunchDeduction + dinnerDeduction);
    
    // 음수가 되지 않도록 처리
    finalMealAllowance = Math.max(0, finalMealAllowance);
    
    return {
      baseMealAllowance,
      finalMealAllowance,
      breakfastDeduction,
      lunchDeduction,
      dinnerDeduction
    };
  }
  
  // 국가 이름으로 식대 정보 가져오기
  useEffect(() => {
    const fetchAllowanceRates = async () => {
      if (!baseCountryInfo.country) {
        setIsLoading(false);
        return;
      }
      
      // 이미 이 국가에 대해 데이터를 가져왔으면 중복 요청 방지
      if (fetchedCountryRef.current === baseCountryInfo.country) {
        return;
      }
      
      try {
        setIsLoading(true);
        
        let countryName = baseCountryInfo.country;
        console.log('Fetching rates for country:', countryName);
        
        // 현재 요청 중인 국가 저장
        fetchedCountryRef.current = countryName;
        
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
            setAllowanceRates({
              fullDayAmount: 28,
              partialDayAmount: 14
            });
          } else if (data) {
            console.log('Received German allowance data:', data);
            setAllowanceRates({
              fullDayAmount: parseFloat(data.full_day_amount),
              partialDayAmount: parseFloat(data.partial_day_amount)
            });
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
              setAllowanceRates({
                fullDayAmount: parseFloat(data.full_day_amount),
                partialDayAmount: parseFloat(data.partial_day_amount)
              });
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
              setAllowanceRates({
                fullDayAmount: parseFloat(data.full_day_amount),
                partialDayAmount: parseFloat(data.partial_day_amount)
              });
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
            setAllowanceRates({
              fullDayAmount: parseFloat(exactData[0].full_day_amount),
              partialDayAmount: parseFloat(exactData[0].partial_day_amount)
            });
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
              setAllowanceRates({
                fullDayAmount: 28,
                partialDayAmount: 14
              });
            } else {
              console.log('Using German rates from DB:', germanData);
              setAllowanceRates({
                fullDayAmount: parseFloat(germanData.full_day_amount),
                partialDayAmount: parseFloat(germanData.partial_day_amount)
              });
            }
          } else {
            console.log('Found country data by partial match:', data[0]);
            setAllowanceRates({
              fullDayAmount: parseFloat(data[0].full_day_amount),
              partialDayAmount: parseFloat(data[0].partial_day_amount)
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch allowance rates:', error);
        // 오류 발생 시 독일 기본 데이터 사용
        setAllowanceRates({
          fullDayAmount: 28,
          partialDayAmount: 14
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAllowanceRates();
  }, [baseCountryInfo.country]);
  
  // 식대 계산 결과
  const mealAllowanceResult = calculateMealAllowance();
  
  // 계산된 식대 금액을 부모 컴포넌트에 전달
  useEffect(() => {
    if (onAllowanceCalculated && !isLoading) {
      onAllowanceCalculated(mealAllowanceResult.finalMealAllowance);
    }
  }, [mealAllowanceResult.finalMealAllowance, isLoading, onAllowanceCalculated]);
  
  return (
    <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mt-3">
      <h6 className="font-semibold text-blue-800 mb-2">📋 일별 정리</h6>
      <div className="space-y-2 text-sm">
        <div className="flex flex-col">
          <div className="flex items-center">
            <span className="font-medium text-blue-700 w-28">최대 체류 시간:</span>
            <span>{maxStayHours}시간 ({maxStaySchedule?.stayCategory})</span>
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
            <span className="ml-1 text-xs text-gray-500">(일정 {baseCountryInfo.scheduleIndex} 기준)</span>
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
          <div className="flex items-center mt-1">
            <span className="font-medium text-blue-700 w-28">식대 계산:</span>
            <span className="font-medium">
              {hasStayOver ? '전일 식대 적용' : 
                maxStayHours >= 8 ? '부분 식대 적용' : '식대 미적용'}
              {hasInternational && !hasStayOver && maxStayHours >= 8 ? ' (80%)' : ''}
            </span>
          </div>
          
          {/* 금액 정보 표시 */}
          <div className="mt-3 border-t border-blue-200 pt-2">
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
                    <div className="mt-2 pt-2 border-t border-blue-100">
                      <div className="flex items-center">
                        <span className="w-28 text-gray-600">기본 적용 식대:</span>
                        <span className="font-medium">{mealAllowanceResult.baseMealAllowance.toFixed(2)}€</span>
                      </div>
                      
                      {/* 식사별 차감 금액 표시 */}
                      {(mealAllowanceResult.breakfastDeduction > 0 || 
                       mealAllowanceResult.lunchDeduction > 0 || 
                       mealAllowanceResult.dinnerDeduction > 0) && (
                        <div className="mt-1 pt-1 pl-2 border-l-2 border-red-200">
                          <div className="text-sm font-medium text-red-600 mb-1">차감 내역:</div>
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
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center mt-2 bg-green-50 p-1 rounded">
                      <span className="font-medium text-green-700 w-28">최종 식대:</span>
                      <div className="flex items-center text-green-700 font-semibold">
                        <EuroIcon className="h-3 w-3 mr-1" />
                        <span>{mealAllowanceResult.finalMealAllowance.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}
                
                {mealAllowanceResult.baseMealAllowance === 0 && (
                  <div className="flex items-center mt-2 bg-red-50 p-1 rounded">
                    <span className="font-medium text-red-700 w-28">적용 식대:</span>
                    <div className="flex items-center text-red-700 font-semibold">
                      <EuroIcon className="h-3 w-3 mr-1" />
                      <span>0.00</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 