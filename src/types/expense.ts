export interface ExpenseForm {
  name: string
  startDate: Date | undefined
  endDate: Date | undefined
  startTime: Date | undefined
  endTime: Date | undefined
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
  entertainment: Array<EntertainmentExpense>
  mileage: Array<MileageExpense>
  meals: MealEntry[]
  miscellaneous: MiscellaneousExpense[]
  mealAllowanceInfo: { [date: string]: MealAllowanceInfo[] }
  totalMealAllowance: number
  headerText?: string
  footerText?: string
  routes?: Route[]
  dailyAllowances: Array<DailyAllowance>
  receipts?: Receipt[]
  transportationExpenses?: Expense[]
  accommodationExpenses?: Expense[]
  otherExpenses: Array<OtherExpense>
  calculatedTotals?: {
    transportation: {
      company: number;
      personal: number;
      total: number;
    };
    accommodation: {
      company: number;
      personal: number;
      total: number;
    };
    entertainment: {
      company: number;
      personal: number;
      total: number;
    };
    miscellaneous: {
      company: number;
      personal: number;
      total: number;
    };
    mealAllowance: number;
    grandTotal: number;
  };
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
  breakfastIncluded?: boolean
  cityTax: string
  vat: string
  totalAmount: string
  isExpanded?: boolean
  datePickerOpen?: boolean
  allowanceRate?: number
}

export interface ExpenseFormEntertainment {
  date?: Date;
  type?: 'breakfast' | 'lunch' | 'dinner' | 'other';
  otherType?: string;
  country?: string;
  companyName?: string;
  totalAmount?: string;
  paidBy?: 'company' | 'personal';
  vat?: string;
  isExpanded?: boolean;
  datePickerOpen?: boolean;
  breakfast?: boolean;
  lunch?: boolean;
  dinner?: boolean;
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

export interface MiscellaneousExpense {
  date?: Date
  description: string
  totalAmount: string
  type?: string
  country?: string
  companyName?: string
  paidBy: 'company' | 'personal'
  vat?: string
  isExpanded?: boolean
  datePickerOpen?: boolean
}

export interface AllowanceRates {
  countryCode: string
  countryName?: string
  fullDayAmount: number
  partialDayAmount: number
}

export interface CountryOption {
  value: string
  label: string
  type: 'business' | 'simple'
}

export interface CompanySettings {
  email: string
  company_name: string
  city: string
}

export interface MealAllowanceInfo {
  date: string
  breakfast: boolean
  lunch: boolean
  dinner: boolean
}

export interface ExpenseSummary {
  transportation: { company: number; personal: number }
  entertainment: { company: number; personal: number }
  accommodation: { company: number; personal: number }
  miscellaneous: { company: number; personal: number }
  mileage: { distance: number; amount: number }
  mealAllowance: { amount: number; personal: number }
  total: { company: number; personal: number }
}

export interface MealAllowanceSchedule {
  tripType: 'domestic' | 'international'
  departureCity: string
  departureCountry?: string
  arrivalCity: string
  arrivalCountry?: string
}

export interface Route {
  date: Date | string
  departureCity: string
  arrivalCity: string
  country: string
  amount: number
}

export interface DailyAllowance {
  date: Date
  amount: number
  location: string
}

export interface Receipt {
  url: string
}

export interface Expense {
  date: string
  type?: string
  description?: string
  amount: number
}

export interface MileageExpense {
  date: Date
  distance: number
  startLocation: string
  endLocation: string
  purpose: string
}

export interface OtherExpense {
  date: Date
  description: string
  amount: number
  vat: number
}

export interface EntertainmentExpense {
  date: Date;
  description: string;
  amount: number;
  vat: number;
  participants: string[];
  location: string;
} 