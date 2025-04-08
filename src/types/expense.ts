export interface ExpenseForm {
  name: string
  startDate?: Date
  endDate?: Date
  startTime?: string
  endTime?: string
  city: string
  description: string
  purpose: string
  projectName: string
  projectNumber: string
  mealOption: boolean
  startDatePickerOpen?: boolean
  endDatePickerOpen?: boolean
  visits: ExpenseFormVisit[]
  transportation: ExpenseFormTransportation[]
  accommodation: ExpenseFormAccommodation[]
  entertainment: ExpenseFormEntertainment[]
  meals: MealEntry[]
  miscellaneous: ExpenseFormMiscellaneous[]
  mealAllowanceInfo: { [date: string]: MealAllowanceInfo[] }
  totalMealAllowance: number
}

export interface ExpenseFormVisit {
  date: Date | undefined
  companyName: string
  city: string
  description: string
  isExpanded: boolean
  datePickerOpen: boolean
}

export interface ExpenseFormTransportation {
  date: Date | undefined
  type: 'flight' | 'train' | 'taxi' | 'fuel' | 'rental' | 'mileage' | 'km_pauschale' | undefined
  otherType?: string
  licensePlate?: string
  country: string
  companyName: string
  paidBy: 'company' | 'personal' | undefined
  vat: string
  totalAmount: string
  mileage?: string
  isExpanded: boolean
  datePickerOpen: boolean
}

export interface ExpenseFormAccommodation {
  startDate: Date | undefined
  endDate: Date | undefined
  type: 'hotel' | 'private' | undefined
  country: string
  hotelName: string
  paidBy: 'company' | 'personal' | undefined
  breakfastDates: Date[]
  cityTax: string
  vat: string
  totalAmount: string
  isExpanded?: boolean
  datePickerOpen?: boolean
  allowanceRate?: number
}

export interface ExpenseFormEntertainment {
  date: Date | undefined
  type: 'breakfast' | 'lunch' | 'dinner' | 'coffee' | undefined
  otherType?: string
  country: string
  companyName: string
  totalAmount: string
  paidBy: 'company' | 'personal' | undefined
  vat: string
  isExpanded?: boolean
  datePickerOpen?: boolean
}

export interface MealEntry {
  date: Date | undefined
  country: string
  companyName: string
  totalAmount: string
  paidBy: 'company' | 'personal' | undefined
  vat: string
  isExpanded?: boolean
  datePickerOpen?: boolean
}

export interface ExpenseFormMiscellaneous {
  date?: Date
  description: string
  totalAmount: string
  vat: string
  paidBy?: 'company' | 'personal'
  isExpanded?: boolean
  datePickerOpen?: boolean
}

export interface AllowanceRates {
  countryCode: string
  fullDayAmount: number
  partialDayAmount: number
}

export interface MealAllowanceInfo {
  date: string
  tripType?: 'international' | 'domestic'
  departureCountry?: string
  departureCity?: string
  arrivalCountry?: string
  arrivalCity?: string
  isExpanded?: boolean
  dayType?: '도착일' | '출발일' | '숙박일'
  breakfast?: boolean
  lunch?: boolean
  dinner?: boolean
  isFirstDay?: boolean
  isLastDay?: boolean
  startTime?: string
  endTime?: string
} 