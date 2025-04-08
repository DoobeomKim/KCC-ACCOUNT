'use client'

import { useState, useEffect, useMemo, memo } from 'react'
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

// 메모이제이션된 SelectItem 컴포넌트
const CountrySelectItem = memo(({ 
  country, 
  currentLocale 
}: { 
  country: Country, 
  currentLocale: string 
}) => {
  const displayText = currentLocale === 'ko' 
    ? `${country.code} - ${country.name_ko} (${country.name_de})` 
    : `${country.code} - ${country.name_de}`

  return (
    <SelectItem value={country.code}>
      {displayText}
    </SelectItem>
  )
})

CountrySelectItem.displayName = 'CountrySelectItem'

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
  const [currentLocale, setCurrentLocale] = useState<string>('ko')
  
  const favoriteCountryCodes = useMemo(() => ['DE', 'KR', 'US', 'JP', 'CN', 'FR', 'GB'], [])
  
  useEffect(() => {
    const locale = t('locale')
    setCurrentLocale(locale)
  }, [t])
  
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

  // 필터링된 국가 목록 메모이제이션
  const filteredCountries = useMemo(() => {
    const search = searchTerm.toLowerCase()
    return countries.filter(country => {
      const isNotFavorite = !favoriteCountryCodes.includes(country.code)
      if (!isNotFavorite) return false

      if (currentLocale === 'ko') {
        return (country.name_ko.toLowerCase().includes(search) || 
                country.name_de.toLowerCase().includes(search) ||
                country.code.toLowerCase().includes(search))
      } else {
        return (country.name_de.toLowerCase().includes(search) ||
                country.code.toLowerCase().includes(search))
      }
    })
  }, [countries, searchTerm, currentLocale, favoriteCountryCodes])

  // 즐겨찾기 국가 목록 메모이제이션
  const favoriteCountries = useMemo(() => {
    return countries.filter(country => favoriteCountryCodes.includes(country.code))
  }, [countries, favoriteCountryCodes])

  // 선택된 국가 정보 메모이제이션
  const selectedCountry = useMemo(() => {
    return countries.find(c => c.code === value)
  }, [countries, value])

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
  
  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className="w-full">
        {selectedCountry ? (
          <div>
            {currentLocale === 'ko' 
              ? `${value} - ${selectedCountry.name_ko} (${selectedCountry.name_de})` 
              : `${value} - ${selectedCountry.name_de}`}
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
        {searchTerm === '' && (
          <>
            <div className="px-2 py-1.5 text-sm font-medium text-gray-500 bg-gray-50">
              자주 사용하는 국가
            </div>
            {favoriteCountries.map((country) => (
              <CountrySelectItem 
                key={`fav-${country.code}`}
                country={country}
                currentLocale={currentLocale}
              />
            ))}
            <div className="px-2 py-1.5 text-sm font-medium text-gray-500 bg-gray-50">
              모든 국가
            </div>
          </>
        )}
        {filteredCountries.map((country) => (
          <CountrySelectItem 
            key={country.code}
            country={country}
            currentLocale={currentLocale}
          />
        ))}
      </SelectContent>
    </Select>
  )
} 