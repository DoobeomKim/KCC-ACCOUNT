import { memo, useMemo, useCallback, useEffect } from 'react'
import { TableCell, TableRow } from '@/components/ui/table'
import { formatEuro } from '@/lib/utils'
import { dateUtils } from '@/lib/dateUtils'
import { MealAllowanceInfo } from '@/types/expense'
import { useAllowanceRates } from '@/hooks/useAllowanceRates'
import { format } from 'date-fns'

// 주요 국가 매핑
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

interface SummaryAllowanceRowProps {
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
  departureCountry?: string
  departureCity?: string
  arrivalCountry?: string
  arrivalCity?: string
  departureName?: string
  arrivalName?: string
}

export const SummaryAllowanceRow = memo(({ 
  date, 
  schedules,
  stayHours,
  baseCountry,
  allowance,
  entertainment,
  departureName,
  arrivalName
}: SummaryAllowanceRowProps) => {
  const firstSchedule = schedules.find(s => s.isFirstDay);
  const lastSchedule = schedules.find(s => s.isLastDay);
  const { ratesCache } = useAllowanceRates();

  const countryName = useMemo(() => {
    if (!baseCountry) return ''
    return ratesCache?.[baseCountry]?.countryName || baseCountry
  }, [baseCountry, ratesCache])

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
        {departureName || '-'}
      </TableCell>
      <TableCell>
        {arrivalName || '-'}
      </TableCell>
      <TableCell className="text-right font-medium text-green-700">
        {formatEuro(allowance, false)}
      </TableCell>
    </TableRow>
  );
}); 