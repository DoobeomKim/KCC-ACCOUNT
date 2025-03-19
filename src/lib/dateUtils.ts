import { format as dateFormat, differenceInHours, isSameDay } from 'date-fns';

export const dateUtils = {
  // 1. 날짜 유효성 검증
  isValidDate(date: Date | undefined): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  },

  // 2. 시간 문자열 유효성 검증
  isValidTimeString(time: string | undefined): boolean {
    if (!time) return false;
    const [hours, minutes] = time.split(':').map(Number);
    return !isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
  },

  // 3. 날짜와 시간 결합
  combineDateAndTime(date: Date, timeStr: string | undefined): Date {
    const result = new Date(date);
    if (timeStr && this.isValidTimeString(timeStr)) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      result.setHours(hours || 0, minutes || 0, 0, 0);
    } else {
      result.setHours(0, 0, 0, 0);
    }
    return result;
  },

  // 4. 안전한 날짜 포맷팅
  formatSafeDate(date: Date | undefined, format: string, defaultValue: string = ''): string {
    try {
      if (!this.isValidDate(date) || !date) return defaultValue;
      return dateFormat(date, format);
    } catch (error) {
      console.error('Date formatting error:', error);
      return defaultValue;
    }
  },

  // 5. 하루 내 체류 시간 계산
  calculateStayHoursInDay(startDate: Date, startTime: string | undefined, 
                         endDate: Date, endTime: string | undefined): number {
    const start = this.combineDateAndTime(startDate, startTime);
    const end = this.combineDateAndTime(endDate, endTime);
    
    // 같은 날짜인 경우
    if (isSameDay(start, end)) {
      return Math.max(0, differenceInHours(end, start));
    }
    
    // 다른 날짜인 경우, 해당 날짜의 시작 또는 끝 시간만 계산
    const dayStart = new Date(startDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(startDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    return Math.min(24, Math.max(0, differenceInHours(dayEnd, start)));
  }
};

export interface ScheduleTime {
  date: Date;
  time?: string;
  isStart: boolean;
}

export const calculateDailyStayHours = (schedules: any[], targetDate: Date) => {
  // 1. 해당 날짜의 모든 일정 필터링
  const daySchedules = schedules.filter(schedule => 
    dateUtils.isValidDate(schedule.startDate) && 
    dateUtils.isValidDate(schedule.endDate) &&
    (isSameDay(targetDate, schedule.startDate) || isSameDay(targetDate, schedule.endDate))
  );

  if (daySchedules.length === 0) return { firstScheduleHours: 0, otherSchedulesHours: 0, totalHours: 0 };

  // 2. 첫 일정과 나머지 일정 분리
  const [firstSchedule, ...otherSchedules] = daySchedules;
  
  // 3. 첫 일정의 체류 시간 계산
  const firstScheduleHours = dateUtils.calculateStayHoursInDay(
    firstSchedule.startDate,
    firstSchedule.startTime,
    firstSchedule.endDate,
    firstSchedule.endTime
  );

  // 4. 나머지 일정들의 체류 시간 합 계산
  const otherSchedulesHours = otherSchedules.reduce((sum, schedule) => {
    return sum + dateUtils.calculateStayHoursInDay(
      schedule.startDate,
      schedule.startTime,
      schedule.endDate,
      schedule.endTime
    );
  }, 0);

  return {
    firstScheduleHours,
    otherSchedulesHours,
    totalHours: Math.min(24, firstScheduleHours + otherSchedulesHours)
  };
}; 