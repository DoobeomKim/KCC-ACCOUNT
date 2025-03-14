import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 숫자를 한국 원화 형식으로 포맷팅합니다.
 * @param amount 포맷팅할 금액
 * @returns 포맷팅된 금액 문자열 (예: ₩123,456)
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '₩0';
  
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * 숫자를 유로 형식으로 포맷팅합니다.
 * @param amount 포맷팅할 금액
 * @param divideBy1000 금액을 1000으로 나눌지 여부 (Supabase에서 가져온 데이터 처리용)
 * @returns 포맷팅된 금액 문자열 (예: €123.45)
 */
export function formatEuro(amount: number | null | undefined, divideBy1000: boolean = true): string {
  if (amount === null || amount === undefined) return '€0.00';
  
  // Supabase에서 가져온 데이터는 1000배로 저장되어 있으므로 필요한 경우 나눠줌
  const adjustedAmount = divideBy1000 ? amount / 1000 : amount;
  
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(adjustedAmount);
}