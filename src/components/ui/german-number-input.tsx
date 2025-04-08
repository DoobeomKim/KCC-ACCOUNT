'use client'

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { parseGermanNumber } from "@/lib/utils"

interface GermanNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number
  onChange: (value: number) => void
  className?: string
}

const GermanNumberInput = React.forwardRef<HTMLInputElement, GermanNumberInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    // 내부 상태를 사용하여 입력 값을 트래킹
    const [displayValue, setDisplayValue] = React.useState<string>('')
    
    // 값이 외부에서 변경될 때 디스플레이 값 업데이트
    React.useEffect(() => {
      if (value === null || value === undefined || value === '') {
        setDisplayValue('')
      } else {
        // 숫자를 문자열로 변환할 때는 소수점을 콤마로 변환
        setDisplayValue(String(value).replace('.', ','))
      }
    }, [value])
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value
      
      // 점(.) 입력 방지
      if (input.includes('.')) return
      
      // 숫자와 콤마만 허용
      const sanitized = input.replace(/[^\d,]/g, '')
      
      // 콤마는 하나만 허용하고, 소수점 2자리까지만 허용
      const parts = sanitized.split(',')
      if (parts.length > 2) return
      if (parts[1] && parts[1].length > 2) return
      
      // 입력값 업데이트
      setDisplayValue(sanitized)
      
      // 숫자로 변환하여 부모에게 전달
      const numericValue = parseGermanNumber(sanitized)
      onChange(numericValue)
    }

    return (
      <Input
        {...props}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        className={cn("text-right", className)}
      />
    )
  }
)

GermanNumberInput.displayName = "GermanNumberInput"

export { GermanNumberInput } 