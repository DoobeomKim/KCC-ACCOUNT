import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AllowanceRates } from '@/types/expense'

export const useAllowanceRates = () => {
  const [ratesCache, setRatesCache] = useState<Record<string, AllowanceRates>>({
    // 독일 기본 요율
    'DE': {
      countryCode: 'DE',
      fullDayAmount: 28,
      partialDayAmount: 14
    }
  });
  
  const fetchRateForCountry = useCallback(async (countryCode: string) => {
    // 국가 코드가 없거나 유효하지 않은 경우
    if (!countryCode || countryCode === '-') {
      console.warn('Invalid country code provided');
      return ratesCache['DE'];
    }

    const normalizedCode = countryCode.toUpperCase();
    
    // 캐시에 있으면 바로 반환
    if (ratesCache[normalizedCode]) {
      console.log(`Using cached rates for ${normalizedCode}:`, ratesCache[normalizedCode]);
      return ratesCache[normalizedCode];
    }
    
    try {
      console.log(`Fetching rates for country code: ${normalizedCode}`);
      const { data, error } = await supabase
        .from('country_allowances')
        .select('*')
        .eq('country_code', normalizedCode)
        .single();
        
      if (error) {
        console.error(`Error fetching rates for ${normalizedCode}:`, error);
        throw error;
      }
        
      if (data) {
        console.log(`Received data for ${normalizedCode}:`, data);
        const newRates: AllowanceRates = {
          countryCode: normalizedCode,
          fullDayAmount: parseFloat(data.full_day_amount),
          partialDayAmount: parseFloat(data.partial_day_amount)
        };
        
        // 캐시 업데이트
        setRatesCache(prev => {
          const updated = {
            ...prev,
            [normalizedCode]: newRates
          };
          console.log('Updated rates cache:', updated);
          return updated;
        });
        
        return newRates;
      }
    } catch (error) {
      console.error(`Error fetching rates for ${normalizedCode}:`, error);
    }
    
    // 데이터가 없을 경우 독일 요율 반환
    console.warn(`No data found for ${normalizedCode}, using German rates`);
    return ratesCache['DE'];
  }, [ratesCache]);

  // 컴포넌트 마운트 시 주요 국가 요율 미리 가져오기
  useEffect(() => {
    const preloadCountries = async () => {
      // 자주 사용되는 국가 코드 목록
      const commonCountries = ['KR', 'JP', 'CN', 'US', 'GB', 'FR', 'GN', 'CG'];
      
      try {
        // 모든 국가 요율을 병렬로 가져오기
        await Promise.all(
          commonCountries.map(async (code) => {
            if (!ratesCache[code]) {
              await fetchRateForCountry(code);
            }
          })
        );
      } catch (error) {
        console.error('Error preloading country rates:', error);
      }
    };
    
    preloadCountries();
  }, [fetchRateForCountry]);

  return { ratesCache, fetchRateForCountry };
}; 