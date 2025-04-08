import { parseISO, isSameDay, isValid } from 'date-fns'
import { MealAllowanceInfo, AllowanceRates } from '@/types/expense'
import { getCountryCode } from '@/lib/api/country'

export const calculateDailyStayHours = (date: string, schedules: MealAllowanceInfo[]): number => {
  if (!schedules || schedules.length === 0) return 0;
  
  const currentDate = new Date(date);
  
  // 첫째날인 경우
  if (schedules[0].isFirstDay) {
    const [startHour, startMinute] = schedules[0].startTime?.split(':').map(Number) || [0, 0];
    const hoursFromStart = 24 - startHour - (startMinute / 60);
    return Math.round(hoursFromStart * 10) / 10;
  }
  
  // 마지막날인 경우
  if (schedules[schedules.length - 1].isLastDay) {
    const [endHour, endMinute] = schedules[schedules.length - 1].endTime?.split(':').map(Number) || [0, 0];
    const hoursUntilEnd = endHour + (endMinute / 60);
    return Math.round(hoursUntilEnd * 10) / 10;
  }
  
  // 중간날인 경우
  return 24;
};

export const getBaseCountry = (schedule: MealAllowanceInfo): string => {
  if (!schedule.tripType) return "-";
  
  // 국내 이동인 경우
  if (schedule.tripType === 'domestic') {
    return schedule.arrivalCity ? `국내(${schedule.arrivalCity})` : "독일";
  }
  
  // 국제 이동인 경우
  if (schedule.tripType === 'international') {
    return schedule.arrivalCountry || "-";
  }
  
  return "-";
};

export const getEntertainmentExpenseForDate = (date: string, entertainmentExpenses: any[]) => {
  if (!entertainmentExpenses) return {
    breakfast: false,
    lunch: false,
    dinner: false
  };

  // 해당 날짜의 모든 접대비 정보를 찾습니다
  const dayExpenses = entertainmentExpenses.filter(expense => {
    try {
      const expenseDate = parseISO(expense.date);
      const targetDate = parseISO(date);
      return isValid(expenseDate) && isValid(targetDate) && isSameDay(expenseDate, targetDate);
    } catch (error) {
      console.error("날짜 파싱 오류:", error);
      return false;
    }
  });

  // 모든 접대비 정보를 합산합니다
  return {
    breakfast: dayExpenses.some(expense => expense.breakfast),
    lunch: dayExpenses.some(expense => expense.lunch),
    dinner: dayExpenses.some(expense => expense.dinner)
  };
};

export const calculateDailyAllowance = async (
  schedules: MealAllowanceInfo[], 
  entertainmentExpense: any,
  allowanceRates: Record<string, AllowanceRates>
): Promise<number> => {
  if (!Array.isArray(schedules) || schedules.length === 0) return 0;

  // 체류시간 계산
  const stayHours = calculateDailyStayHours(schedules[0].date, schedules);
  
  // 8시간 미만 체류 시 0유로 반환
  if (stayHours < 8) return 0;
  
  // 1. 기준 국가 및 요율 확인
  const baseCountry = getBaseCountry(schedules[schedules.length - 1]);
  
  // 기준국가가 선택되지 않은 경우 0유로 반환
  if (!baseCountry || baseCountry === '-') return 0;
  
  // 국가 코드 가져오기
  const countryCode = await getCountryCode(baseCountry);

  // allowanceRates가 없는 경우 0 반환
  if (!allowanceRates) {
    console.warn('No allowance rates provided');
    return 0;
  }

  // 해당 국가의 요율 가져오기
  let rates = allowanceRates[countryCode];
  
  // 요율이 없는 경우 독일 요율 사용
  if (!rates && countryCode !== 'DE') {
    console.warn(`No rates found for ${countryCode}, using DE rates`);
    rates = allowanceRates['DE'];
  }
  
  if (!rates) {
    console.error('No rates available');
    return 0;
  }

  // 2. 기본 식대 금액 설정
  const isFullDay = stayHours >= 24;
  const isInternational = schedules.some(s => s.tripType === 'international');
  const isNotGermany = countryCode !== 'DE';
  
  // 기본 금액 설정
  let baseAmount = isFullDay ? 
    Number(rates.fullDayAmount) : 
    Number(rates.partialDayAmount);

  console.log('Debug - Initial Amount:', {
    countryCode,
    isFullDay,
    baseAmount,
    stayHours
  });

  // 3. 국제출장 & 부분식대 적용 (전일 식대는 제외)
  if (!isFullDay && isInternational && isNotGermany) {
    baseAmount = baseAmount * 0.8;
    console.log('Debug - After International Reduction:', {
      baseAmount,
      reduction: '20%'
    });
  }
  
  // 4. 식사 제공에 따른 차감
  let deduction = 0;
  
  if (entertainmentExpense) {
    if (entertainmentExpense.breakfast) {
      deduction += baseAmount * 0.2;
    }
    if (entertainmentExpense.lunch) {
      deduction += baseAmount * 0.4;
    }
    if (entertainmentExpense.dinner) {
      deduction += baseAmount * 0.4;
    }
  }

  console.log('Debug - Meal Deductions:', {
    baseAmount,
    deduction,
    entertainmentExpense
  });
  
  const finalAmount = Math.max(0, baseAmount - deduction);
  
  console.log('Debug - Final Calculation:', {
    originalBase: isFullDay ? rates.fullDayAmount : rates.partialDayAmount,
    afterInternational: baseAmount,
    mealDeduction: deduction,
    finalAmount: finalAmount
  });

  return finalAmount;
}; 