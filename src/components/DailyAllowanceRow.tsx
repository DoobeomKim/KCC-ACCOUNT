import { memo, useMemo, useEffect } from 'react'
import { TableCell, TableRow } from '@/components/ui/table'
import { formatEuro } from '@/lib/utils'
import { dateUtils } from '@/lib/dateUtils'
import { MealAllowanceInfo } from '@/types/expense'
import { useAllowanceRates } from '@/hooks/useAllowanceRates'

// 주요 국가 매핑 (기본값으로 사용)
const COUNTRY_NAMES: { [key: string]: string } = {
  'DE': 'Germany',
  'JP': 'Japan',
  'KR': 'South Korea',
  'CN': 'China',
  'US': 'United States',
  'GB': 'United Kingdom',
  'FR': 'France',
  'IT': 'Italy',
  'ES': 'Spain',
  'CA': 'Canada',
  'AU': 'Australia',
  'RU': 'Russia',
  'IN': 'India',
  'BR': 'Brazil',
  'ZA': 'South Africa'
};

interface DailyAllowanceRowProps {
  date: string
  schedules: MealAllowanceInfo[]
  stayHours: number
  baseCountry: string
  allowance: number
  entertainment: {
    breakfast: boolean
    lunch: boolean
    dinner: boolean
  }
}

export const DailyAllowanceRow = memo(({ 
  date, 
  schedules,
  stayHours,
  baseCountry,
  allowance,
  entertainment
}: DailyAllowanceRowProps) => {
  const firstSchedule = schedules.find(s => s.isFirstDay);
  const lastSchedule = schedules.find(s => s.isLastDay);
  const { ratesCache, fetchRateForCountry } = useAllowanceRates();

  // 국가명 변환 로직
  const countryName = useMemo(() => {
    let result;
    // 국내 여행인 경우
    if (baseCountry.startsWith('국내')) {
      result = baseCountry;
    }
    // 유효하지 않은 국가 코드인 경우
    else if (!baseCountry || baseCountry.length !== 2) {
      result = baseCountry;
    }
    // ratesCache에서 국가명 가져오기
    else {
      result = ratesCache[baseCountry]?.countryName || baseCountry;
    }

    return result
  }, [baseCountry, ratesCache])

  // 컴포넌트 마운트 시 해당 국가의 요율 정보 미리 가져오기
  useEffect(() => {
    if (baseCountry && baseCountry.length === 2 && !baseCountry.startsWith('국내')) {
      fetchRateForCountry(baseCountry)
    }
  }, [baseCountry, fetchRateForCountry])

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">
          {dateUtils.formatSafeDate(new Date(date), 'yyyy-MM-dd')}
          <div className="text-xs text-muted-foreground">
            {['일', '월', '화', '수', '목', '금', '토'][new Date(date).getDay()]}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div>
          {stayHours}시간
          {(firstSchedule || lastSchedule) && (
            <div className="text-xs text-muted-foreground">
              {firstSchedule ? `출발: ${firstSchedule.startTime}` : ''}
              {firstSchedule && lastSchedule ? ' / ' : ''}
              {lastSchedule ? `도착: ${lastSchedule.endTime}` : ''}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        {stayHours < 8 ? (
          <div className="text-xs text-red-500">
            8시간 미만 체류로 식대 미적용
          </div>
        ) : (
          <div className="flex gap-2">
            <span className="text-xs px-2 py-1 rounded bg-muted">
              아침: {entertainment.breakfast ? 'Y' : 'N'}
            </span>
            <span className="text-xs px-2 py-1 rounded bg-muted">
              점심: {entertainment.lunch ? 'Y' : 'N'}
            </span>
            <span className="text-xs px-2 py-1 rounded bg-muted">
              저녁: {entertainment.dinner ? 'Y' : 'N'}
            </span>
          </div>
        )}
      </TableCell>
      <TableCell>
        {countryName}
      </TableCell>
      <TableCell className="text-right font-medium text-green-700">
        {formatEuro(allowance, false)}
      </TableCell>
    </TableRow>
  );
}); 