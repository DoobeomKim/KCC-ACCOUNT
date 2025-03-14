import { Calendar } from '@/components/ui/calendar'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface AccommodationCalendarProps {
  type: 'checkin' | 'checkout'
  selected?: Date
  startDate?: Date
  endDate?: Date
  index: number
  accommodations: Array<{
    startDate?: Date
    endDate?: Date
  }>
  onSelect: (date: Date) => void
}

export function AccommodationCalendar({
  type,
  selected,
  startDate,
  endDate,
  index,
  accommodations,
  onSelect
}: AccommodationCalendarProps) {
  // 날짜가 이미 선택된 숙박 기간과 겹치는지 확인
  const isDateOverlapping = (date: Date, checkInDate?: Date) => {
    const dateWithoutTime = new Date(date);
    dateWithoutTime.setHours(0, 0, 0, 0);
    
    // 이전에 선택된 모든 숙박 기간 수집 및 정렬
    const allBookings = accommodations
      .filter((acc, i) => i !== index && acc.startDate && acc.endDate)
      .map(acc => ({
        startDate: new Date(acc.startDate!),
        endDate: new Date(acc.endDate!)
      }))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    // 체크아웃 날짜 선택 시
    if (checkInDate) {
      const checkInWithoutTime = new Date(checkInDate);
      checkInWithoutTime.setHours(0, 0, 0, 0);

      for (const booking of allBookings) {
        const bookingStart = new Date(booking.startDate);
        bookingStart.setHours(0, 0, 0, 0);
        const bookingEnd = new Date(booking.endDate);
        bookingEnd.setHours(0, 0, 0, 0);

        // 체크아웃 날짜가 다른 숙박의 체크아웃 날짜와 같으면 안됨
        if (dateWithoutTime.getTime() === bookingEnd.getTime()) {
          return true;
        }

        // 체크인-체크아웃 기간이 다른 숙박과 겹치면 안됨
        // 단, 체크아웃 날짜는 다른 숙박의 체크인 날짜와 같을 수 있음
        if (
          (checkInWithoutTime >= bookingStart && checkInWithoutTime < bookingEnd) ||
          (dateWithoutTime > bookingStart && dateWithoutTime < bookingEnd) ||
          // 체크인-체크아웃 사이에 다른 숙박이 있으면 안됨
          (checkInWithoutTime < bookingStart && dateWithoutTime > bookingEnd)
        ) {
          return true;
        }
      }
      return false;
    } else {
      // 체크인 날짜 선택 시
      for (const booking of allBookings) {
        const bookingStart = new Date(booking.startDate);
        bookingStart.setHours(0, 0, 0, 0);
        const bookingEnd = new Date(booking.endDate);
        bookingEnd.setHours(0, 0, 0, 0);

        // 다른 숙박의 체크아웃 날짜는 선택 가능
        if (dateWithoutTime.getTime() === bookingEnd.getTime()) {
          return false;
        }

        // 숙박 기간 내의 날짜는 선택 불가
        if (dateWithoutTime >= bookingStart && dateWithoutTime < bookingEnd) {
          return true;
        }
      }
      return false;
    }
  };

  // 체크인 날짜 유효성 검사
  const isCheckInValid = (date: Date) => {
    if (!startDate || !endDate) return false;
    
    const dateWithoutTime = new Date(date);
    dateWithoutTime.setHours(0, 0, 0, 0);
    
    const tripStartDate = new Date(startDate);
    tripStartDate.setHours(0, 0, 0, 0);
    
    const tripEndDateMinusOne = new Date(endDate);
    tripEndDateMinusOne.setDate(tripEndDateMinusOne.getDate() - 1);
    tripEndDateMinusOne.setHours(0, 0, 0, 0);
    
    // 출장 시작일부터 종료일 전날까지만 선택 가능
    if (dateWithoutTime < tripStartDate || dateWithoutTime > tripEndDateMinusOne) {
      return false;
    }
    
    // 이미 선택된 숙박 기간과 겹치는지 확인
    if (isDateOverlapping(date)) {
      return false;
    }
    
    return true;
  };

  // 체크아웃 날짜 유효성 검사
  const isCheckOutValid = (date: Date, selectedCheckInDate: Date) => {
    if (!selectedCheckInDate || !endDate) return false;
    
    const dateWithoutTime = new Date(date);
    dateWithoutTime.setHours(0, 0, 0, 0);
    
    const checkInWithoutTime = new Date(selectedCheckInDate);
    checkInWithoutTime.setHours(0, 0, 0, 0);
    
    const checkInPlusOne = new Date(selectedCheckInDate);
    checkInPlusOne.setDate(checkInPlusOne.getDate() + 1);
    checkInPlusOne.setHours(0, 0, 0, 0);
    
    const tripEndDate = new Date(endDate);
    tripEndDate.setHours(0, 0, 0, 0);
    
    // 체크인 다음날부터 출장 종료일까지만 선택 가능
    if (dateWithoutTime < checkInPlusOne || dateWithoutTime > tripEndDate) {
      return false;
    }
    
    // 이미 선택된 숙박 기간과 겹치는지 확인
    if (isDateOverlapping(date, selectedCheckInDate)) {
      return false;
    }
    
    return true;
  };

  // 날짜 선택 가능 여부 확인
  const isDateSelectable = (date: Date) => {
    if (type === 'checkin') {
      return isCheckInValid(date);
    } else {
      if (!selected) return false;
      return isCheckOutValid(date, selected);
    }
  };

  return (
    <Calendar
      mode="single"
      selected={selected}
      onDayClick={(day) => {
        if (type === 'checkout' && !selected) {
          toast.error('먼저 체크인 날짜를 선택해주세요.');
          return;
        }
        
        if (!isDateSelectable(day)) {
          if (type === 'checkin') {
            toast.error('선택할 수 없는 날짜입니다. 빈 날짜나 다른 숙박의 체크아웃 날짜만 선택 가능합니다.');
          } else {
            toast.error('체크아웃 날짜는 체크인 다음날부터 선택 가능하며, 다른 숙박의 체크아웃 날짜와 같을 수 없습니다.');
          }
          return;
        }
        
        onSelect(day);
      }}
      disabled={(date) => !isDateSelectable(date)}
      fromDate={startDate}
      toDate={endDate}
    />
  );
} 