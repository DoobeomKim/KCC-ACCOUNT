'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from '@/components/ui/input'

interface Country {
  code: string
  name_de: string
  name_ko: string
}

export type CountrySelectorMode = 'database' | 'simple'

interface CountrySelectorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  mode?: CountrySelectorMode
  disabled?: boolean
  label?: string
}

export default function CountrySelector({
  value,
  onChange,
  placeholder,
  mode = 'database',
  disabled = false,
  label
}: CountrySelectorProps) {
  const t = useTranslations()
  const [searchTerm, setSearchTerm] = useState('')
  const [countries, setCountries] = useState<Country[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentLocale, setCurrentLocale] = useState<string>('ko') // 기본값 설정
  
  // 즐겨찾기 국가 코드 (자주 사용되는 국가들)
  const favoriteCountryCodes = ['DE', 'KR', 'US', 'JP', 'CN', 'FR', 'GB'];
  
  // 컴포넌트 마운트 시 현재 언어 확인
  useEffect(() => {
    const locale = t('locale')
    setCurrentLocale(locale)
  }, [t])
  
  // 국가 목록 가져오기 (database 모드일 때만)
  useEffect(() => {
    if (mode !== 'database') {
      setIsLoading(false)
      return
    }
    
    const fetchCountries = async () => {
      try {
        setIsLoading(true)
        
        const { data, error } = await supabase
          .from('country_allowances')
          .select('country_code, country_name_de, country_name_ko')
          .order(currentLocale === 'ko' ? 'country_name_ko' : 'country_name_de', { ascending: true })
        
        if (error) {
          console.error('국가 목록 가져오기 오류:', error)
          return
        }
        
        if (data) {
          const formattedCountries = data.map(country => ({
            code: country.country_code,
            name_de: country.country_name_de,
            name_ko: country.country_name_ko
          }))
          setCountries(formattedCountries)
        }
      } catch (error) {
        console.error('국가 목록 가져오기 오류:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchCountries()
  }, [currentLocale, mode])

  // 선택 컴포넌트 렌더링
  if (mode === 'simple') {
    return (
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          {value ? (
            <div>
              {value === "DE" ? t("expense.country.germany") : t("expense.country.other")}
            </div>
          ) : (
            <SelectValue placeholder={placeholder || t("expense.country.placeholder")} />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="DE">{t("expense.country.germany")}</SelectItem>
          <SelectItem value="other">{t("expense.country.other")}</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  
  // 데이터베이스 모드(기본)
  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className="w-full">
        {value && countries.find(c => c.code === value) ? (
          <div>
            {currentLocale === 'ko' 
              ? `${value} - ${countries.find(c => c.code === value)?.name_ko} (${countries.find(c => c.code === value)?.name_de})` 
              : `${value} - ${countries.find(c => c.code === value)?.name_de}`}
          </div>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent className="max-h-[300px]" onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="p-2 sticky top-0 bg-white z-10">
          <Input
            placeholder="국가 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        {/* 즐겨찾기 국가 섹션 */}
        {searchTerm === '' && (
          <>
            <div className="px-2 py-1.5 text-sm font-medium text-gray-500 bg-gray-50">
              자주 사용하는 국가
            </div>
            {countries
              .filter(country => favoriteCountryCodes.includes(country.code))
              .map((country) => (
                <SelectItem key={`fav-${country.code}`} value={country.code}>
                  {currentLocale === 'ko' 
                    ? `${country.code} - ${country.name_ko} (${country.name_de})` 
                    : `${country.code} - ${country.name_de}`}
                </SelectItem>
              ))}
            <div className="px-2 py-1.5 text-sm font-medium text-gray-500 bg-gray-50">
              모든 국가
            </div>
          </>
        )}
        {countries
          .filter(country => {
            const search = searchTerm.toLowerCase();
            if (currentLocale === 'ko') {
              return country.name_ko.toLowerCase().includes(search) || 
                     country.name_de.toLowerCase().includes(search) ||
                     country.code.toLowerCase().includes(search);
            } else {
              return country.name_de.toLowerCase().includes(search) ||
                     country.code.toLowerCase().includes(search);
            }
          })
          .map((country) => (
            <SelectItem key={country.code} value={country.code}>
              {currentLocale === 'ko' 
                ? `${country.code} - ${country.name_ko} (${country.name_de})` 
                : `${country.code} - ${country.name_de}`}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
} 