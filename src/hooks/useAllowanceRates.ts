import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AllowanceRates } from '@/types/expense'

export const useAllowanceRates = () => {
  const [ratesCache, setRatesCache] = useState<Record<string, AllowanceRates>>({
    // 독일 기본 요율
    'DE': {
      countryCode: 'DE',
      countryName: 'Deutschland',
      fullDayAmount: 28,
      partialDayAmount: 14
    }
  });
  
  const fetchRateForCountry = useCallback(async (countryCode: string) => {
    // 국가 코드가 없거나 유효하지 않은 경우
    if (!countryCode || countryCode === '-') {
      return ratesCache['DE'];
    }

    const normalizedCode = countryCode.toUpperCase();
    
    // 캐시에 있으면 바로 반환
    if (ratesCache[normalizedCode]) {
      return ratesCache[normalizedCode];
    }
    
    try {
      const { data, error } = await supabase
        .from('country_allowances')
        .select('country_code, country_name_de, full_day_amount, partial_day_amount')
        .eq('country_code', normalizedCode)
        .single();
        
      if (error) {
        throw error;
      }
        
      if (data) {
        const newRates: AllowanceRates = {
          countryCode: normalizedCode,
          countryName: data.country_name_de,
          fullDayAmount: parseFloat(data.full_day_amount),
          partialDayAmount: parseFloat(data.partial_day_amount)
        };
        
        // 캐시 업데이트
        setRatesCache(prev => ({
          ...prev,
          [normalizedCode]: newRates
        }));
        
        return newRates;
      }
    } catch (error) {
      console.error(`Error fetching rates for ${normalizedCode}:`, error);
    }
    
    // 데이터가 없을 경우 독일 요율 반환
    return ratesCache['DE'];
  }, [ratesCache]);

  // 컴포넌트 마운트 시 모든 국가 요율 정보를 한 번에 가져오기
  useEffect(() => {
    const fetchAllRates = async () => {
      try {
        const { data, error } = await supabase
          .from('country_allowances')
          .select('country_code, country_name_de, full_day_amount, partial_day_amount');
        
        if (error) {
          throw error;
        }
        
        if (data) {
          const newRates: Record<string, AllowanceRates> = {};
          data.forEach(country => {
            newRates[country.country_code] = {
              countryCode: country.country_code,
              countryName: country.country_name_de,
              fullDayAmount: parseFloat(country.full_day_amount),
              partialDayAmount: parseFloat(country.partial_day_amount)
            };
          });
          
          // 캐시 업데이트 (기존 DE 정보 유지)
          setRatesCache(prev => ({
            ...prev,
            ...newRates
          }));
        }
      } catch (error) {
        console.error('Error fetching all country rates:', error);
      }
    };
    
    fetchAllRates();
  }, []);

  return { ratesCache, fetchRateForCountry };
}; 