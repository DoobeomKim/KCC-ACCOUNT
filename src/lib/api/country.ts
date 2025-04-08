import { createClient } from '@/lib/supabase/client';

export interface CountryInfo {
  country_code: string;
  country_name_de: string;
  country_name_ko: string;
}

// 기본 국가 매핑 (자주 사용되는 국가들)
const defaultCountryMap: { [key: string]: string } = {
  '독일': 'DE',
  '국내': 'DE',
  '대한민국': 'KR',
  '한국': 'KR',
  '중국': 'CN',
  '일본': 'JP',
  '미국': 'US'
};

export async function getAllCountries(): Promise<CountryInfo[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('country_allowances')
    .select('country_code, country_name_de, country_name_ko');
    
  if (error) {
    console.error('Error fetching countries:', error);
    return [];
  }
  
  return data || [];
}

// 국가 코드 캐시
let countryCodeCache: Map<string, string> | null = null;

export async function getCountryCode(countryName: string): Promise<string> {
  // 기본 매핑 확인
  const normalizedCountryName = countryName.trim();
  
  // 기본 매핑 확인
  if (defaultCountryMap[normalizedCountryName]) {
    console.log(`Found country code in default map: ${normalizedCountryName} -> ${defaultCountryMap[normalizedCountryName]}`);
    return defaultCountryMap[normalizedCountryName];
  }

  // 국내 이동인 경우
  if (normalizedCountryName.startsWith('국내')) {
    console.log(`Domestic travel detected: ${normalizedCountryName} -> DE`);
    return 'DE';
  }
  
  // 이미 국가 코드인 경우
  if (normalizedCountryName.length === 2) {
    const upperCode = normalizedCountryName.toUpperCase();
    console.log(`Country code format detected: ${normalizedCountryName} -> ${upperCode}`);
    return upperCode;
  }

  // 도시 코드인 경우 (예: US-NYC)
  if (normalizedCountryName.length === 5 && normalizedCountryName.includes('-')) {
    const upperCode = normalizedCountryName.toUpperCase();
    console.log(`City code format detected: ${normalizedCountryName} -> ${upperCode}`);
    return upperCode;
  }
  
  // 캐시가 없으면 초기화
  if (!countryCodeCache) {
    countryCodeCache = new Map();
    const countries = await getAllCountries();
    
    // 모든 국가의 한국어, 독일어 이름을 국가 코드와 매핑
    countries.forEach(country => {
      countryCodeCache!.set(country.country_name_ko.trim(), country.country_code);
      countryCodeCache!.set(country.country_name_de.trim(), country.country_code);
      
      // 추가적인 매핑 처리
      if (country.country_name_ko.includes('대한민국') || country.country_name_ko.includes('한국')) {
        countryCodeCache!.set('대한민국', 'KR');
        countryCodeCache!.set('한국', 'KR');
      }
    });

    console.log('Country code cache initialized with entries:', 
      Array.from(countryCodeCache.entries())
        .map(([key, value]) => `${key} -> ${value}`)
    );
  }
  
  // 캐시에서 국가 코드 찾기
  const code = countryCodeCache.get(normalizedCountryName);
  if (code) {
    console.log(`Found country code in cache: ${normalizedCountryName} -> ${code}`);
    return code;
  }
  
  // 매핑을 찾지 못한 경우 경고 로그 출력 후 독일 코드 반환
  console.warn(`매핑되지 않은 국가명: ${normalizedCountryName}, 독일 요율을 기본값으로 적용합니다.`);
  return 'DE';
} 