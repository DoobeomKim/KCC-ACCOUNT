'use client'

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useEffect } from "react"

interface TimeSelectProps {
  value?: string
  onChange: (value: string) => void
  className?: string
}

export function TimeSelect({ value, onChange, className }: TimeSelectProps) {
  // 시간과 분을 분리 (기본값 처리 개선)
  const defaultValue = "08:00";
  const [hours, minutes] = (value || defaultValue).split(':')
  const hourNum = parseInt(hours)
  const isPM = hourNum >= 12

  // 컴포넌트 마운트 시 기본값이 없으면 설정
  useEffect(() => {
    if (!value) {
      onChange?.(defaultValue);
    }
  }, []);

  // 시간 변경 핸들러
  const handleTimeChange = (newHour: number, newMinutes: string) => {
    const formattedHour = newHour.toString().padStart(2, '0')
    onChange(`${formattedHour}:${newMinutes}`)
  }

  // AM/PM 변경 핸들러
  const handleAMPMChange = (period: 'AM' | 'PM') => {
    if (!hours || !minutes) return
    let newHour = parseInt(hours)
    if (period === 'AM' && newHour >= 12) {
      newHour -= 12
    } else if (period === 'PM' && newHour < 12) {
      newHour += 12
    }
    handleTimeChange(newHour, minutes)
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      <Select
        value={isPM ? 'PM' : 'AM'}
        onValueChange={(val) => handleAMPMChange(val as 'AM' | 'PM')}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="AM/PM" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">오전</SelectItem>
          <SelectItem value="PM">오후</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={hours}
        onValueChange={(val) => {
          if (!minutes) handleTimeChange(parseInt(val), '00')
          else handleTimeChange(parseInt(val), minutes)
        }}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="시" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => {
            const hour = i + 1 // 1부터 12까지
            return (
              <SelectItem 
                key={hour} 
                value={(isPM ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour)).toString().padStart(2, '0')}
              >
                {hour}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <Select
        value={minutes}
        onValueChange={(val) => {
          if (!hours) handleTimeChange(0, val)
          else handleTimeChange(parseInt(hours), val)
        }}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="분" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 6 }, (_, i) => {
            const minute = i * 10
            return (
              <SelectItem key={i} value={minute.toString().padStart(2, '0')}>
                {minute.toString().padStart(2, '0')}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
} 