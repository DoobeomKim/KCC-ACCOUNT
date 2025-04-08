import { memo, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatEuro } from '@/lib/utils'
import { DailyAllowanceRow } from './DailyAllowanceRow'
import { MealAllowanceInfo } from '@/types/expense'

interface DailyAllowanceTableProps {
  mealAllowanceInfo: { [date: string]: MealAllowanceInfo[] }
  dailyAllowances: { [date: string]: number }
  stayHours: { [date: string]: number }
  baseCountries: { [date: string]: string }
  entertainmentExpenses: { [date: string]: { breakfast: boolean, lunch: boolean, dinner: boolean } }
}

export const DailyAllowanceTable = memo(({ 
  mealAllowanceInfo,
  dailyAllowances,
  stayHours,
  baseCountries,
  entertainmentExpenses
}: DailyAllowanceTableProps) => {
  // 날짜별 정렬된 데이터 메모이제이션
  const sortedDates = useMemo(() => 
    Object.entries(mealAllowanceInfo || {})
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB)),
    [mealAllowanceInfo]
  );

  const totalAllowance = useMemo(() => 
    Object.values(dailyAllowances).reduce((sum, amount) => sum + amount, 0),
    [dailyAllowances]
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">날짜</TableHead>
          <TableHead className="w-[100px]">체류 시간</TableHead>
          <TableHead>식사 제공</TableHead>
          <TableHead className="w-[100px]">기준 국가</TableHead>
          <TableHead className="w-[120px] text-right">계산된 식대</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedDates.map(([date, schedules]) => (
          <DailyAllowanceRow
            key={date}
            date={date}
            schedules={schedules}
            stayHours={stayHours[date] || 0}
            baseCountry={baseCountries[date] || '-'}
            allowance={dailyAllowances[date] || 0}
            entertainment={entertainmentExpenses[date] || { breakfast: false, lunch: false, dinner: false }}
          />
        ))}
        <TableRow>
          <TableCell colSpan={4} className="text-right font-medium">
            총 식대:
          </TableCell>
          <TableCell className="text-right font-medium text-green-700">
            {formatEuro(totalAllowance, false)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}); 