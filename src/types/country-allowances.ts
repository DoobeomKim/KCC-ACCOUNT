export interface CountryAllowance {
    id: number;
    country_code: string;
    country_name_de: string;
    country_name_ko: string;
    full_day_amount: number;
    partial_day_amount: number;
    accommodation_amount: number;
    created_at?: string;
    updated_at?: string;
  }
  
  export interface CountryAllowanceFormData {
    country_code: string;
    country_name_de: string;
    country_name_ko: string;
    full_day_amount: string;
    partial_day_amount: string;
    accommodation_amount: string;
  } 