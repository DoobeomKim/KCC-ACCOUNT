'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { format as dateFormat, format } from 'date-fns'
import { toast } from 'sonner'
import { ArrowLeft, Save, Loader2, Pencil, FileDown, ChevronLeft, FileText, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Sidebar from '@/components/layout/Sidebar'
import { ExpenseForm, DailyAllowance } from '@/types/expense'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatEuro, formatNumber } from '@/lib/utils'
import { pdf, Document, Page, Text as PDFText, View as PDFView, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { SummaryAllowanceRow } from '@/components/SummaryAllowanceRow'
import { MILEAGE_RATE } from '@/lib/constants'

// Noto Sans 폰트 등록
Font.register({
  family: 'Noto Sans',
  src: 'https://fonts.gstatic.com/s/notosans/v30/o-0IIpQlx3QUlC5A4PNb4g.ttf',
  fontStyle: 'normal',
  fontWeight: 400,
});

Font.register({
  family: 'Noto Sans',
  src: 'https://fonts.gstatic.com/s/notosans/v30/o-0NIpQlx3QUlC5A4PNjXhFlYw.ttf',
  fontStyle: 'normal',
  fontWeight: 700,
});

Font.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAw.ttf',
      fontWeight: 700,
    }
  ]
});

// 날짜를 시간대 문제 없이 저장하기 위한 함수
// YYYY-MM-DD 형식으로 날짜만 추출하여 저장
const formatDateForStorage = (date: Date | string): string => {
  if (typeof date === 'string') {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 날짜 문자열을 시간대 문제 없이 Date 객체로 변환하는 함수
const parseDateFromStorage = (dateStr: string | undefined): Date | undefined => {
  if (!dateStr) return undefined;

  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  try {
    const date = new Date(dateStr);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  } catch (e) {
    return undefined;
  }
};

interface TimeObject {
  hours: number;
  minutes: number;
}

// 시간 데이터를 데이터베이스 형식으로 변환하는 함수
const formatTimeForStorage = (time: string | TimeObject | undefined | null): string | null => {
  if (!time) return null;
  // 시간이 이미 HH:mm 형식인지 확인
  if (typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)) {
    return `${time}:00`;
  }
  // 시간이 객체인 경우 처리
  if (typeof time === 'object' && time !== null && 'hours' in time && 'minutes' in time) {
    const hours = String(time.hours || 0).padStart(2, '0');
    const minutes = String(time.minutes || 0).padStart(2, '0');
    return `${hours}:${minutes}:00`;
  }
  return null;
};

// 날짜 포맷팅 함수 개선
const formatSafeDate = (dateStr: string | Date | undefined | null): string => {
  if (!dateStr) return '-';
  try {
    if (dateStr instanceof Date) {
      return format(dateStr, 'dd.MM.yyyy');
    }
    return format(new Date(dateStr), 'dd.MM.yyyy');
  } catch (e) {
    return '-';
  }
};

// 시간 포맷팅 함수 추가
const formatTime = (time: string | undefined): string => {
  if (!time) return '-';
  // HH:mm:ss 형식에서 HH:mm 형식으로 변환
  const timeMatch = time.match(/^(\d{2}:\d{2})/);
  return timeMatch ? `${timeMatch[1]} Uhr` : '-';
};

// Supabase에서 가져온 출장 경비 데이터 타입
interface ExpenseData {
  id: string;
  registration_number: string;
  user_email: string;
  name: string;
  start_date: string;
  end_date: string;
  purpose: string;
  project_name: string;
  project_number: string;
  status: string;
  transportation_total: number;
  accommodation_total: number;
  entertainment_total: number;
  miscellaneous_total: number;
  meal_allowance: number;
  grand_total: number;
  created_at: string;
}

// 타입 정의 업데이트
interface ExpenseFormTransportation {
  date: Date | undefined;
  type: 'flight' | 'train' | 'taxi' | 'fuel' | 'rental' | 'mileage' | 'km_pauschale' | undefined;
  country: string;
  companyName: string;
  paidBy: 'company' | 'personal' | undefined;
  vat: string;
  totalAmount: string;  // amount 대신 totalAmount 사용
  mileage?: string;
  isExpanded: boolean;
  datePickerOpen: boolean;
  otherType?: string;
}

// 마일리지 타입 체크 함수 추가
const isMileageType = (type: string | undefined) => type === 'mileage' || type === 'km_pauschale';

// PDF 스타일 정의
const styles = StyleSheet.create({
  page: {
    padding: 40,  // 전체 페이지 패딩 축소
    fontSize: 10.8,  // 기본 폰트 크기 10% 축소 (12 * 0.9)
  },
  content: {
    marginTop: 30,
    marginBottom: 50,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  mainContent: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 10, // 상단 여백 축소 (기존 20에서 10으로)
    left: 40,
    right: 40,
    textAlign: 'center',
  },
  headerText: {
    fontSize: 10,
    color: '#666666',
  },
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10.8,
    color: '#666666',
    textAlign: 'center',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 10,
    right: 40,
    fontSize: 10.8,
    color: '#666666',
  },
  title: {
    fontSize: 16.2,  // 18 * 0.9
    marginBottom: 20,  // 여백 축소
    textAlign: 'center',
    fontWeight: 'bold',
  },
  divider: {
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,  // 섹션 간 여백 축소
  },
  subtitle: {
    fontSize: 13.5,  // 15 * 0.9
    marginBottom: 12,  // 여백 축소
    fontWeight: 'bold',
  },
  contentGroup: {
    marginBottom: 12,  // 컨텐츠 그룹 여백 축소
  },
  rowGroup: {
    flexDirection: 'row',
    gap: 20,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,  // 행 간격 축소
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 3,  // 행 간 여백 축소
  },
  label: {
    flex: 1,
    fontSize: 10.8,  // 12 * 0.9
  },
  value: {
    fontSize: 10.8,  // 12 * 0.9
    textAlign: 'right',
  },
  signatureLine: {
    flex: 1,
    maxWidth: '45%',
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: 8,
    fontSize: 10.8,  // 기본 폰트 크기와 동일하게 조정
    textAlign: 'center',
  },
  signatureText: {
    fontSize: 11,
    textAlign: 'center',
  },
  signatureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: 20,
  },
  visitedPlacesContainer: {
    marginTop: 8,
  },
  visitedPlace: {
    fontSize: 10.8,  // 12 * 0.9
    marginBottom: 4,  // 방문 장소 간 여백 조정
  },
  signatureSection: {
    marginTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 4,
  },
  tableHeader: {
    fontSize: 10.8,
    fontWeight: 'bold',
    paddingRight: 10,
  },
  tableCell: {
    fontSize: 10.8,
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: '#000000',
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 10.8,
    fontWeight: 'bold',
    paddingRight: 10,
  },
  totalAmount: {
    fontSize: 10.8,
    fontWeight: 'bold',
  },
  receipt: {
    width: '100%',
    height: 'auto',
    marginBottom: 20,
    objectFit: 'contain'
  },
  receiptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    padding: 20
  },
  receiptCard: {
    width: '45%',
    border: '1pt solid #e5e7eb',
    borderRadius: 4,
    padding: 10,
    marginBottom: 20
  },
  receiptTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5
  },
  receiptType: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 10
  },
  receiptImage: {
    width: '100%',
    height: 'auto',
    objectFit: 'contain',
    marginBottom: 10
  },
  receiptInfo: {
    fontSize: 10,
    color: '#333333'
  }
});

// PDF 컴포넌트 타입 정의
type PDFProps = {
  data: ExpenseForm | null;
  accountInfo: {
    company_name?: string;
    city?: string;
  } | null;
};

// 날짜와 시간을 독일어 형식으로 포맷팅하는 함수
const formatGermanDateTime = (date: Date | string | undefined, time: string | undefined): string => {
  try {
    if (!date) return '';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const formattedDate = format(dateObj, 'dd.MM.yyyy');

    // 시간이 있는 경우 날짜와 시간을 함께 표시
    if (time) {
      return `${formattedDate}, ${time} Uhr`;
    }

    return formattedDate;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

// Header와 Footer 컴포넌트 추가
const Header = ({ text }: { text: string }) => (
  <PDFView style={styles.header} fixed>
    <PDFText style={styles.headerText}>{text}</PDFText>
  </PDFView>
);

const Footer = ({ text }: { text: string }) => (
  <PDFView style={styles.footer}>
    <PDFText style={styles.footerText}>KCC Account</PDFText>
    <PDFText style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
      `${pageNumber} / ${totalPages}`
    )} fixed />
  </PDFView>
);

// PDF 문서 컴포넌트
const ExpensePDF = ({ data, accountInfo }: PDFProps) => (
  <Document>
    {/* 1페이지: 결제용 정보 (Reisekostenformular) */}
    <Page size="A4" style={styles.page}>
      <Header text={data?.headerText || ''} />
      <PDFView style={styles.content}>
        <PDFText style={styles.title}>Reisekostenabrechnung</PDFText>
        <PDFView style={styles.divider} />

        <PDFView style={styles.mainContent}>
          <PDFView style={styles.section}>
            <PDFText style={styles.subtitle}>1. Persönliche Daten</PDFText>
            <PDFView style={styles.contentGroup}>
              <PDFView style={styles.row}>
                <PDFText style={styles.label}>Name</PDFText>
                <PDFText style={styles.value}>{data?.name || ''}</PDFText>
              </PDFView>
              <PDFView style={styles.row}>
                <PDFText style={styles.label}>Firma</PDFText>
                <PDFText style={styles.value}>{accountInfo?.company_name || ''}</PDFText>
              </PDFView>
              <PDFView style={styles.row}>
                <PDFText style={styles.label}>Stadt</PDFText>
                <PDFText style={styles.value}>{accountInfo?.city || ''}</PDFText>
              </PDFView>
            </PDFView>
          </PDFView>

          <PDFView style={styles.section}>
            <PDFText style={styles.subtitle}>2. Reisedaten</PDFText>
            <PDFView style={styles.contentGroup}>
              {/* 시작일/시작시간 */}
              <PDFView style={styles.rowGroup}>
                <PDFView style={[styles.row, { flex: 1, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }]}>
                  <PDFText style={styles.label}>Beginn der Reise</PDFText>
                  <PDFText style={styles.value}>
                    {data?.startDate ? format(new Date(data.startDate), 'dd.MM.yyyy') : '-'}
                  </PDFText>
                </PDFView>
                <PDFView style={[styles.row, { flex: 1, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }]}>
                  <PDFText style={styles.label}>Startuhrzeit</PDFText>
                  <PDFText style={styles.value}>{formatTime(data?.startTime)}</PDFText>
                </PDFView>
              </PDFView>

              {/* 종료일/종료시간 */}
              <PDFView style={styles.rowGroup}>
                <PDFView style={[styles.row, { flex: 1, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }]}>
                  <PDFText style={styles.label}>Ende der Reise</PDFText>
                  <PDFText style={styles.value}>
                    {data?.endDate ? format(new Date(data.endDate), 'dd.MM.yyyy') : '-'}
                  </PDFText>
                </PDFView>
                <PDFView style={[styles.row, { flex: 1, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }]}>
                  <PDFText style={styles.label}>Enduhrzeit</PDFText>
                  <PDFText style={styles.value}>{formatTime(data?.endTime)}</PDFText>
                </PDFView>
              </PDFView>

              {/* 방문한 장소 목록 */}
              <PDFView style={styles.visitedPlacesContainer}>
                <PDFText style={styles.label}>Besuchte Orte</PDFText>
                {data?.visits?.map((visit, index) => (
                  <PDFView key={index} style={styles.visitedPlace}>
                    <PDFText style={styles.value}>
                      {visit.date ? format(new Date(visit.date), 'dd.MM.yyyy') : '-'} - {visit.companyName} {visit.city} {visit.description}
                    </PDFText>
                  </PDFView>
                ))}
              </PDFView>
            </PDFView>
          </PDFView>

          <PDFView style={styles.section}>
            <PDFText style={styles.subtitle}>3. Kostenübersicht</PDFText>
            <PDFView style={styles.contentGroup}>
              <PDFView style={[styles.row, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]}>
                <PDFText style={styles.label}>Fahrtkosten</PDFText>
                <PDFText style={styles.value}>
                  {formatEuro(
                    data?.transportation?.reduce((sum, item) => {
                      const amount = parseFloat(item.totalAmount || '0') || 0;
                      return sum + amount;
                    }, 0) || 0,
                    false
                  )}
                </PDFText>
              </PDFView>
              <PDFView style={[styles.row, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]}>
                <PDFText style={styles.label}>Bewirtungskosten</PDFText>
                <PDFText style={styles.value}>
                  {formatEuro(
                    data?.entertainment?.reduce((sum, item) => {
                      const amount = parseFloat(item.totalAmount || '0') || 0;
                      return sum + amount;
                    }, 0) || 0,
                    false
                  )}
                </PDFText>
              </PDFView>
              <PDFView style={[styles.row, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]}>
                <PDFText style={styles.label}>Übernachtungskosten</PDFText>
                <PDFText style={styles.value}>
                  {formatEuro(
                    data?.accommodation?.reduce((sum, item) => {
                      const amount = parseFloat(item.totalAmount || '0') || 0;
                      return sum + amount;
                    }, 0) || 0,
                    false
                  )}
                </PDFText>
              </PDFView>
              <PDFView style={[styles.row, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]}>
                <PDFText style={styles.label}>Verpflegungsmehraufwand</PDFText>
                <PDFText style={styles.value}>
                  {formatEuro(
                    data?.calculatedTotals?.mealAllowance?.amount || 0,
                    false
                  )}
                </PDFText>
              </PDFView>
              <PDFView style={[styles.row, { borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }]}>
                <PDFText style={styles.label}>Sonstige Kosten</PDFText>
                <PDFText style={styles.value}>
                  {formatEuro(
                    data?.miscellaneous?.reduce((sum, item) => {
                      const amount = parseFloat(item.totalAmount || '0') || 0;
                      return sum + amount;
                    }, 0) || 0,
                    false
                  )}
                </PDFText>
              </PDFView>
              <PDFView style={[styles.row, { borderTopWidth: 2, borderTopColor: '#000000', marginTop: 8, paddingTop: 8, borderBottomWidth: 0 }]}>
                <PDFText style={[styles.label, { fontWeight: 'bold' }]}>Gesamtbetrag</PDFText>
                <PDFText style={[styles.value, { fontWeight: 'bold' }]}>
                  {formatEuro(
                    (data?.transportation?.reduce((sum, item) => {
                      const amount = parseFloat(item.totalAmount || '0') || 0;
                      return sum + amount;
                    }, 0) || 0) +
                    (data?.entertainment?.reduce((sum, item) => {
                      const amount = parseFloat(item.totalAmount || '0') || 0;
                      return sum + amount;
                    }, 0) || 0) +
                    (data?.accommodation?.reduce((sum, item) => {
                      const amount = parseFloat(item.totalAmount || '0') || 0;
                      return sum + amount;
                    }, 0) || 0) +
                    (typeof formData?.calculatedTotals === 'string'
                      ? JSON.parse(formData.calculatedTotals).mealAllowance?.amount || 0
                      : formData?.calculatedTotals?.mealAllowance?.amount || 0) +
                    (data?.miscellaneous?.reduce((sum, item) => {
                      const amount = parseFloat(item.totalAmount || '0') || 0;
                      return sum + amount;
                    }, 0) || 0),
                    false
                  )}
                </PDFText>
              </PDFView>
            </PDFView>
          </PDFView>
        </PDFView>
      </PDFView>
      <Footer text={data?.footerText || 'Bridgemakers GmbH'} />
    </Page>

    {/* 2페이지: 회계용 지출내역 */}
    <Page size="A4" style={styles.page}>
      <Header text={data?.headerText || ''} />
      <PDFView style={styles.content}>
        <PDFText style={styles.title}>Ausgabenübersicht für die Buchhaltung</PDFText>
        <PDFView style={styles.divider} />

        <PDFView style={styles.section}>
          <PDFText style={styles.subtitle}>1. Transportkosten</PDFText>
          {data?.transportationExpenses?.map((expense, index) => (
            <PDFView key={index} style={styles.row}>
              <PDFText style={styles.label}>{expense.date}</PDFText>
              <PDFText style={styles.value}>
                {expense.type}: {formatEuro(expense.amount)}
              </PDFText>
            </PDFView>
          ))}
        </PDFView>

        <PDFView style={styles.section}>
          <PDFText style={styles.subtitle}>2. Übernachtungskosten</PDFText>
          {data?.accommodationExpenses?.map((expense, index) => (
            <PDFView key={index} style={styles.row}>
              <PDFText style={styles.label}>{expense.date}</PDFText>
              <PDFText style={styles.value}>{formatEuro(expense.amount)}</PDFText>
            </PDFView>
          ))}
        </PDFView>

        <PDFView style={styles.section}>
          <PDFText style={styles.subtitle}>3. Sonstige Kosten</PDFText>
          {data?.otherExpenses?.map((expense, index) => (
            <PDFView key={index} style={styles.row}>
              <PDFText style={styles.label}>{expense.date}</PDFText>
              <PDFText style={styles.value}>
                {expense.description}: {formatEuro(expense.amount)}
              </PDFText>
            </PDFView>
          ))}
        </PDFView>
      </PDFView>
      <Footer text={data?.footerText || 'Bridgemakers GmbH'} />
    </Page>

    {/* 3페이지: 식대 관련 세부내용 */}
    <Page size="A4" style={styles.page}>
      <Header text={data?.headerText || ''} />
      <PDFView style={styles.content}>
        <PDFText style={styles.title}>Verpflegungsmehraufwendungen</PDFText>
        <PDFView style={styles.divider} />

        <PDFView style={styles.section}>
          <PDFText style={styles.subtitle}>Reiserouten</PDFText>
          <PDFView style={styles.table}>
            <PDFView style={styles.tableRow}>
              <PDFText style={styles.tableHeader}>Datum</PDFText>
              <PDFText style={styles.tableHeader}>Abfahrtsort</PDFText>
              <PDFText style={styles.tableHeader}>Ankunftsort</PDFText>
              <PDFText style={styles.tableHeader}>Land</PDFText>
              <PDFText style={styles.tableHeader}>Tagegeld</PDFText>
            </PDFView>
            {data?.routes?.map((route, index) => (
              <PDFView key={index} style={styles.tableRow}>
                <PDFText style={styles.tableCell}>{formatSafeDate(route.date)}</PDFText>
                <PDFText style={styles.tableCell}>{route.departureCity || '-'}</PDFText>
                <PDFText style={styles.tableCell}>{route.arrivalCity || '-'}</PDFText>
                <PDFText style={styles.tableCell}>{route.country || '-'}</PDFText>
                <PDFText style={styles.tableCell}>{formatEuro(route.amount || 0, false)}</PDFText>
              </PDFView>
            ))}
          </PDFView>

          <PDFText style={[styles.subtitle, { marginTop: 20 }]}>Tägliche Details</PDFText>
          <PDFView style={styles.table}>
            <PDFView style={styles.tableRow}>
              <PDFText style={styles.tableHeader}>Datum</PDFText>
              <PDFText style={styles.tableHeader}>Land</PDFText>
              <PDFText style={styles.tableHeader}>Aufenthalt</PDFText>
              <PDFText style={styles.tableHeader}>Frühstück</PDFText>
              <PDFText style={styles.tableHeader}>Mittagessen</PDFText>
              <PDFText style={styles.tableHeader}>Abendessen</PDFText>
              <PDFText style={styles.tableHeader}>Tagegeld</PDFText>
            </PDFView>
            {data?.dailyAllowances?.map((allowance, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="text-[11px] py-2">
                  {allowance.date ? format(new Date(allowance.date), 'dd.MM.yyyy') : '-'}
                </td>
                <td className="text-[11px] py-2">{allowance.baseCountry}</td>
                <td className="text-center text-[11px] py-2">
                  {allowance.stayHours ? `${allowance.stayHours}h` : '-'}
                </td>
                <td className="text-center text-[11px] py-2">
                  {allowance.entertainment.breakfast ? 'Ja' : 'Nein'}
                </td>
                <td className="text-center text-[11px] py-2">
                  {allowance.entertainment.lunch ? 'Ja' : 'Nein'}
                </td>
                <td className="text-center text-[11px] py-2">
                  {allowance.entertainment.dinner ? 'Ja' : 'Nein'}
                </td>
                <td className="text-right text-[11px] py-2">
                  {formatEuro(allowance.allowance || 0, false)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-gray-200">
              <td colSpan={6} className="text-right text-[11px] py-2 font-bold">
                Gesamt:
              </td>
              <td className="text-right text-[11px] py-2 font-bold">
                {formatEuro(data?.dailyAllowances?.reduce((sum, allowance) =>
                  sum + (allowance.allowance || 0), 0) || 0, false)}
              </td>
            </tr>
          </PDFView>
        </PDFView>
      </PDFView>
      <Footer text={data?.footerText || 'Bridgemakers GmbH'} />
    </Page>

    {/* 4페이지 이후: 업로드된 영수증 */}
    {data?.receipts?.map((receipt, index) => (
      <Page key={index} size="A4" style={styles.page}>
        <Header text={data?.headerText || ''} />
        <PDFView style={styles.content}>
          <PDFText style={styles.title}>Beleg {index + 1}</PDFText>
          <PDFView style={styles.divider} />
          <Image src={receipt.url} style={styles.receipt} />
        </PDFView>
        <Footer text={data?.footerText || 'Bridgemakers GmbH'} />
      </Page>
    ))}
  </Document>
);

// 문자열로 저장된 calculatedTotals를 객체로 변환하는 헬퍼 함수
const getCalculatedTotal = (formData, section) => {
  if (!formData?.calculatedTotals) return 0;
  
  try {
    if (typeof formData.calculatedTotals === 'string') {
      const parsed = JSON.parse(formData.calculatedTotals);
      return parsed[section]?.total || 0;
    }
    return formData.calculatedTotals[section]?.total || 0;
  } catch (e) {
    console.error(`calculatedTotals.${section} 파싱 오류:`, e);
    return 0;
  }
};

export default function BusinessExpenseSummaryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BusinessExpenseSummaryContent />
    </Suspense>
  )
}

function BusinessExpenseSummaryContent() {
  const [formData, setFormData] = useState<ExtendedExpenseForm | null>(null);
  const [dailyAllowances, setDailyAllowances] = useState<DailyAllowance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useParams();
  const searchParams = useSearchParams();
  const expenseId = searchParams.get('id');
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // 세션 스토리지 디버깅 로깅 추가
        console.log('=== 세션 스토리지 조회 ===');
        const allStorageKeys = Object.keys(sessionStorage);
        console.log('모든 세션 스토리지 키:', allStorageKeys);
        
        // expenseFormData 상세 로깅
        const formDataFromStorage = sessionStorage.getItem('expenseFormData');
        if (formDataFromStorage) {
          console.log('expenseFormData 원본 데이터:', formDataFromStorage);
          try {
            const parsedFormData = JSON.parse(formDataFromStorage);
            console.log('expenseFormData 구조:', {
              기본정보: {
                이름: parsedFormData.name,
                시작일: parsedFormData.startDate,
                종료일: parsedFormData.endDate,
                시작시간: parsedFormData.startTime,
                종료시간: parsedFormData.endTime,
                목적: parsedFormData.purpose,
                프로젝트명: parsedFormData.projectName,
                프로젝트번호: parsedFormData.projectNumber
              },
              방문정보: {
                개수: parsedFormData.visits?.length || 0,
                샘플: parsedFormData.visits?.[0] || '없음'
              },
              교통정보: {
                개수: parsedFormData.transportation?.length || 0,
                샘플: parsedFormData.transportation?.[0] || '없음'
              },
              숙박정보: {
                개수: parsedFormData.accommodation?.length || 0,
                샘플: parsedFormData.accommodation?.[0] || '없음'
              },
              접대정보: {
                개수: parsedFormData.entertainment?.length || 0,
                샘플: parsedFormData.entertainment?.[0] || '없음'
              },
              기타정보: {
                개수: parsedFormData.miscellaneous?.length || 0,
                샘플: parsedFormData.miscellaneous?.[0] || '없음'
              },
              일비정보: {
                개수: parsedFormData.dailyAllowances?.length || 0,
                샘플: parsedFormData.dailyAllowances?.[0] || '없음'
              }
            });
          } catch (e) {
            console.error('세션 스토리지 데이터 파싱 오류:', e);
          }
        } else {
          console.log('expenseFormData가 세션 스토리지에 없습니다.');
        }
        
        // 편집 ID 로깅
        const editId = sessionStorage.getItem('expenseEditId');
        console.log('편집 ID:', editId || '없음');

        // 1. 현재 로그인된 사용자 세션 가져오기
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) {
          console.error('No session or email found');
          return;
        }

        // 2. URL에서 ID를 통해 데이터 불러오기
        if (expenseId) {
          // 기본 경비 정보 조회
          const { data: expenseData, error: expenseError } = await supabase
            .from('business_expenses')
            .select('*')
            .eq('id', expenseId)
          .single();

          if (expenseError) {
            console.error('Error fetching expense data:', expenseError);
            return;
          }

          // 방문 정보 조회
          const { data: visitsData } = await supabase
            .from('expense_visits')
            .select('*')
            .eq('expense_id', expenseId);

          // 교통비 정보 조회
          const { data: transportationData } = await supabase
            .from('expense_transportation')
            .select('*')
            .eq('expense_id', expenseId);

          // 숙박비 정보 조회
          const { data: accommodationData } = await supabase
            .from('expense_accommodations')
            .select('*')
            .eq('expense_id', expenseId);

          // 접대비 정보 조회
          const { data: entertainmentData } = await supabase
            .from('expense_entertainment')
            .select('*')
            .eq('expense_id', expenseId);

          // 기타 비용 정보 조회
          const { data: miscellaneousData } = await supabase
            .from('expense_miscellaneous')
            .select('*')
            .eq('expense_id', expenseId);

          // 일비 정보는 세션 스토리지에서 가져오기 위해 추가
        const savedData = sessionStorage.getItem('expenseFormData');
          if (savedData) {
            const parsedData = JSON.parse(savedData);
            if (parsedData.dailyAllowances) {
              setDailyAllowances(parsedData.dailyAllowances);
            }
          }

          // calculated_totals에서 dailyAllowances를 직접 가져와 상태 설정
          if (expenseData.calculated_totals?.dailyAllowances) {
            setDailyAllowances(expenseData.calculated_totals.dailyAllowances);
          }

          // 데이터 형식 변환 및 통합
          const formattedData = {
            name: expenseData.name,
            startDate: expenseData.start_date ? new Date(expenseData.start_date) : undefined,
            endDate: expenseData.end_date ? new Date(expenseData.end_date) : undefined,
            startTime: expenseData.start_time,
            endTime: expenseData.end_time,
            purpose: expenseData.purpose,
            projectName: expenseData.project_name,
            projectNumber: expenseData.project_number,
            mealOption: expenseData.meal_option || false,
            calculatedTotals: expenseData.calculated_totals || {},
            // calculated_totals 내부에서 mealAllowanceInfo와 dailyAllowances 추출
            mealAllowanceInfo: expenseData.calculated_totals?.mealAllowanceInfo || {},
            dailyAllowances: expenseData.calculated_totals?.dailyAllowances || [],
            visits: visitsData?.map(visit => ({
              date: visit.date ? new Date(visit.date) : undefined,
              companyName: visit.company_name,
              city: visit.city,
              description: visit.description
            })) || [],
            transportation: transportationData?.map(item => ({
              date: item.date ? new Date(item.date) : undefined,
              // km_pauschale 타입을 mileage 타입으로 변환
              type: item.type === 'km_pauschale' ? 'mileage' : item.type,
              country: item.country,
              companyName: item.company_name,
              paidBy: item.paid_by,
              vat: item.vat?.toString(),
              totalAmount: item.amount?.toString(),
              mileage: item.mileage?.toString(),
              isExpanded: false,
              datePickerOpen: false
            })) || [],
            accommodation: accommodationData?.map(item => ({
              startDate: item.start_date ? new Date(item.start_date) : undefined,
              endDate: item.end_date ? new Date(item.end_date) : undefined,
              type: item.type,
              country: item.country,
              hotelName: item.hotel_name,
              paidBy: item.paid_by,
              vat: item.vat?.toString(),
              totalAmount: item.total_amount?.toString(),
              isExpanded: false,
              datePickerOpen: false
            })) || [],
            entertainment: entertainmentData?.map(item => ({
              date: item.date ? new Date(item.date) : undefined,
              type: item.type,
              country: item.country,
              companyName: item.company_name,
              paidBy: item.paid_by,
              vat: item.vat?.toString(),
              totalAmount: item.amount?.toString(),
              isExpanded: false,
              datePickerOpen: false
            })) || [],
            miscellaneous: miscellaneousData?.map(item => ({
              date: item.date ? new Date(item.date) : undefined,
              type: item.type,
              country: item.country,
              companyName: item.company_name,
              paidBy: item.paid_by,
              vat: item.vat?.toString(),
              totalAmount: item.amount?.toString(),
              description: item.description,
              isExpanded: false,
              datePickerOpen: false
            })) || []
          };

          setFormData(formattedData);
        } else {
          // 세션 스토리지에서 데이터 로드
          const savedData = sessionStorage.getItem('expenseFormData');
          if (savedData) {
        console.log('=== 세션 스토리지 데이터 확인 ===');
        console.log('원본 데이터:', savedData);

            const parsedData = JSON.parse(savedData);
        console.log('파싱된 데이터:', parsedData);
        console.log('dailyAllowances 존재 여부:', !!parsedData.dailyAllowances);
        
        // 식비 관련 데이터 로깅
        console.log('=== Verpflegungsmehraufwand 데이터 ===');
        console.log('출장 기간:', {
          시작일: parsedData.startDate,
          종료일: parsedData.endDate,
          시작시간: parsedData.startTime,
          종료시간: parsedData.endTime
        });
            
        console.log('일일 식비 정보:', parsedData.mealAllowanceInfo);

        // dailyAllowances 로그 추가
        console.log('\n=== Daily Allowances 데이터 ===');
        console.log('dailyAllowances:', parsedData.dailyAllowances);
            
            // formData 설정
            setFormData(parsedData);
            setDailyAllowances(parsedData.dailyAllowances || []);
          } else {
            console.error('세션 스토리지에 데이터가 없습니다');
          }
        }

        // 3. 회사 프로필 데이터 가져오기
        const { data: companyProfile, error: companyError } = await supabase
          .from('company_profiles')
          .select('company_name, city')
          .eq('email', session.user.email)
          .single();

        if (companyError && companyError.code !== 'PGRST116') {
          console.error('Error fetching company profile:', companyError);
        }

        setAccountInfo({
          company_name: companyProfile?.company_name || '',
          city: companyProfile?.city || ''
        });
        
      } catch (error) {
        console.error('데이터 로딩 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [expenseId]);

  // 최종 저장 함수
  const handleSave = async () => {
    if (!formData) return

    setIsSaving(true)

    try {
      // 세션 스토리지에서 편집 ID 확인
      const editId = sessionStorage.getItem('expenseEditId');
      console.log('세션 스토리지에서 편집 ID 확인:', editId);

      // 이미 저장된 데이터인 경우 (URL에 ID가 있는 경우 또는 세션 스토리지에 편집 ID가 있는 경우)
      if (expenseId || editId) {
        // 사용할 ID 결정 (URL의 ID가 우선)
        const targetId = expenseId || editId;
        console.log('업데이트할 ID:', targetId);

        // 1. 세션에서 사용자 정보 가져오기
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
          return;
        }

        // 2. 기본 정보 업데이트
        const { error: updateError } = await supabase
          .from('business_expenses')
          .update({
            name: formData.name || '',
            start_date: formData.startDate ? formatDateForStorage(formData.startDate) : null,
            end_date: formData.endDate ? formatDateForStorage(formData.endDate) : null,
            start_time: formatTimeForStorage(formData.startTime),
            end_time: formatTimeForStorage(formData.endTime),
            purpose: formData.purpose || '',
            project_name: formData.projectName || '',
            project_number: formData.projectNumber || '',
            status: 'submitted',
            meal_option: formData.mealOption,
            calculated_totals: {
              ...formData.calculatedTotals || {},
              dailyAllowances: formData.dailyAllowances || [],
              mealAllowanceInfo: formData.mealAllowanceInfo || {}
            }
          })
          .eq('id', targetId);

        if (updateError) {
          console.error('출장 경비 기본 정보 업데이트 오류:', updateError);
          toast.error(t('expense.summary.saveError'));
          return;
        }

        // 3. 기존 방문 정보 삭제 후 새로 추가
        if (formData.visits.length > 0) {
          // 기존 방문 정보 삭제
          const { error: deleteVisitsError } = await supabase
            .from('expense_visits')
            .delete()
            .eq('expense_id', targetId);

          if (deleteVisitsError) {
            console.error('방문 정보 삭제 오류:', deleteVisitsError);
            toast.error('방문 정보 업데이트 중 오류가 발생했습니다.');
            return;
          }

          // 새 방문 정보 추가
          const visitsToInsert = formData.visits
            .filter(visit => visit.date)
            .map(visit => ({
              expense_id: targetId,
              date: visit.date ? formatDateForStorage(visit.date) : null,
              company_name: visit.companyName,
              city: visit.city,
              description: visit.description
            }));

          if (visitsToInsert.length > 0) {
            const { error: insertVisitsError } = await supabase
              .from('expense_visits')
              .insert(visitsToInsert);

            if (insertVisitsError) {
              console.error('방문 정보 저장 오류:', insertVisitsError);
              toast.error('방문 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }

        // 4. 기존 교통비 정보 삭제 후 새로 추가
        if (formData.transportation.length > 0) {
          // 기존 교통비 정보 삭제
          const { error: deleteTransportationError } = await supabase
            .from('expense_transportation')
            .delete()
            .eq('expense_id', targetId);

          if (deleteTransportationError) {
            console.error('교통비 정보 삭제 오류:', deleteTransportationError);
            toast.error('교통비 정보 업데이트 중 오류가 발생했습니다.');
            return;
          }

          // 새 교통비 정보 추가
          const transportationToInsert = formData.transportation
            .filter(item => item.date)
            .map(item => ({
              expense_id: targetId,
              date: item.date ? formatDateForStorage(item.date) : null,
              // 'mileage' 타입을 'km_pauschale'로 변환
              type: item.type === 'mileage' ? 'km_pauschale' : item.type,
              country: item.country,
              company_name: item.companyName,
              paid_by: item.paidBy,
              vat: item.vat ? parseFloat(item.vat) : null,
              amount: item.totalAmount ? parseFloat(item.totalAmount) : null,
              mileage: item.mileage ? parseFloat(item.mileage) : null,
              license_plate: item.licensePlate
            }));

          if (transportationToInsert.length > 0) {
            const { error: insertTransportationError } = await supabase
              .from('expense_transportation')
              .insert(transportationToInsert);

            if (insertTransportationError) {
              console.error('교통비 정보 저장 오류:', insertTransportationError);
              toast.error('교통비 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }

        // 5. 기존 숙박비 정보 삭제 후 새로 추가
        if (formData.accommodation.length > 0) {
          // 기존 숙박비 정보 삭제
          const { error: deleteAccommodationError } = await supabase
            .from('expense_accommodations')
            .delete()
            .eq('expense_id', targetId);

          if (deleteAccommodationError) {
            console.error('숙박비 정보 삭제 오류:', deleteAccommodationError);
            toast.error('숙박비 정보 업데이트 중 오류가 발생했습니다.');
            return;
          }

          // 새 숙박비 정보 추가
          for (const accommodation of formData.accommodation) {
            if (!accommodation.startDate || !accommodation.endDate) continue;

            const { error: insertAccommodationError } = await supabase
              .from('expense_accommodations')
              .insert({
                expense_id: targetId,
                start_date: formatDateForStorage(accommodation.startDate),
                end_date: formatDateForStorage(accommodation.endDate),
                type: accommodation.type,
                country: accommodation.country,
                hotel_name: accommodation.hotelName,
                paid_by: accommodation.paidBy,
                vat: accommodation.vat ? parseFloat(accommodation.vat) : null,
                total_amount: accommodation.totalAmount ? parseFloat(accommodation.totalAmount) : null
              });

            if (insertAccommodationError) {
              console.error('숙박비 정보 저장 오류:', insertAccommodationError);
              toast.error('숙박비 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }

        // 6. 기존 접대비 정보 삭제 후 새로 추가
        if (formData.entertainment.length > 0) {
          // 기존 접대비 정보 삭제
          const { error: deleteEntertainmentError } = await supabase
            .from('expense_entertainment')
            .delete()
            .eq('expense_id', targetId);

          if (deleteEntertainmentError) {
            console.error('접대비 정보 삭제 오류:', deleteEntertainmentError);
            toast.error('접대비 정보 업데이트 중 오류가 발생했습니다.');
            return;
          }

          // 새 접대비 정보 추가
          const entertainmentToInsert = formData.entertainment
            .filter(item => item.date)
            .map(item => ({
              expense_id: targetId,
              date: item.date ? formatDateForStorage(item.date) : null,
              type: item.type,
              country: item.country,
              company_name: item.companyName,
              paid_by: item.paidBy,
              vat: item.vat ? parseFloat(item.vat) : null,
              amount: item.totalAmount ? parseFloat(item.totalAmount) : null
            }));

          if (entertainmentToInsert.length > 0) {
            const { error: insertEntertainmentError } = await supabase
              .from('expense_entertainment')
              .insert(entertainmentToInsert);

            if (insertEntertainmentError) {
              console.error('접대비 정보 저장 오류:', insertEntertainmentError);
              toast.error('접대비 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }

        // 7. 기존 기타 금액 정보 삭제 후 새로 추가
        if (formData.miscellaneous.length > 0) {
          // 기존 기타 금액 정보 삭제
          const { error: deleteMiscellaneousError } = await supabase
            .from('expense_miscellaneous')
            .delete()
            .eq('expense_id', targetId);

          if (deleteMiscellaneousError) {
            console.error('기타 금액 정보 삭제 오류:', deleteMiscellaneousError);
            toast.error('기타 금액 정보 업데이트 중 오류가 발생했습니다.');
            return;
          }

          // 새 기타 금액 정보 추가
          const miscellaneousToInsert = formData.miscellaneous
            .filter(item => item.date) // 날짜가 있는 항목만 필터링
            .map(item => ({
              expense_id: targetId,
              date: item.date ? formatDateForStorage(item.date) : null,
              type: item.type,
              country: item.country,
              company_name: item.companyName,
              paid_by: item.paidBy,
              vat: item.vat ? parseFloat(item.vat) : null,
              amount: item.totalAmount ? parseFloat(item.totalAmount) : null,
              description: item.description
            }));

          if (miscellaneousToInsert.length > 0) {
            const { error: insertMiscellaneousError } = await supabase
              .from('expense_miscellaneous')
              .insert(miscellaneousToInsert);

            if (insertMiscellaneousError) {
              console.error('기타 금액 정보 저장 오류:', insertMiscellaneousError);
              toast.error('기타 금액 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }

        toast.success(t('expense.summary.submitSuccess'));
      } else {
        // 새로운 데이터인 경우 (세션 스토리지에서 로드한 경우)
        // 1. 기본 정보 저장
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          toast.error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
          return;
        }

        // 2. 기본 정보 저장
        const { data: newExpense, error: insertError } = await supabase
          .from('business_expenses')
          .insert({
            user_email: session.user.email,
            name: formData.name || '',
            start_date: formData.startDate ? formatDateForStorage(formData.startDate) : null,
            end_date: formData.endDate ? formatDateForStorage(formData.endDate) : null,
            start_time: formatTimeForStorage(formData.startTime),
            end_time: formatTimeForStorage(formData.endTime),
            purpose: formData.purpose || '',
            project_name: formData.projectName || '',
            project_number: formData.projectNumber || '',
            status: 'submitted',
            meal_option: formData.mealOption,
            calculated_totals: {
              ...formData.calculatedTotals || {},
              dailyAllowances: formData.dailyAllowances || [],
              mealAllowanceInfo: formData.mealAllowanceInfo || {}
            }
          })
          .select('id')
          .single();

        if (insertError || !newExpense) {
          console.error('출장 경비 기본 정보 저장 오류:', insertError);
          toast.error(t('expense.summary.saveError'));
          return;
        }

        const newExpenseId = newExpense.id;

        // 2. 방문 정보 저장
        if (formData.visits.length > 0) {
          const visitsToInsert = formData.visits
            .filter(visit => visit.date) // 날짜가 있는 항목만 필터링
            .map(visit => ({
              expense_id: newExpenseId,
              date: visit.date ? formatDateForStorage(visit.date) : null,
              company_name: visit.companyName,
              city: visit.city,
              description: visit.description
            }));

          if (visitsToInsert.length > 0) {
            const { error: insertVisitsError } = await supabase
              .from('expense_visits')
              .insert(visitsToInsert);

            if (insertVisitsError) {
              console.error('방문 정보 저장 오류:', insertVisitsError);
              toast.error('방문 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }

        // 3. 교통비 정보 저장
        if (formData.transportation.length > 0) {
          const transportationToInsert = formData.transportation
            .filter(item => item.date) // 날짜가 있는 항목만 필터링
            .map(item => ({
              expense_id: newExpenseId,
              date: item.date ? formatDateForStorage(item.date) : null,
              // 'mileage' 타입을 'km_pauschale'로 변환
              type: item.type === 'mileage' ? 'km_pauschale' : item.type,
              country: item.country,
              company_name: item.companyName,
              paid_by: item.paidBy,
              vat: item.vat ? parseFloat(item.vat) : null,
              amount: item.totalAmount ? parseFloat(item.totalAmount) : null,
              mileage: item.mileage ? parseFloat(item.mileage) : null,
              license_plate: item.licensePlate
            }));

          if (transportationToInsert.length > 0) {
            const { error: insertTransportationError } = await supabase
              .from('expense_transportation')
              .insert(transportationToInsert);

            if (insertTransportationError) {
              console.error('교통비 정보 저장 오류:', insertTransportationError);
              toast.error('교통비 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }

        // 4. 숙박비 정보 저장
        if (formData.accommodation.length > 0) {
          for (const accommodation of formData.accommodation) {
            // 시작일과 종료일이 있는 경우에만 저장
            if (!accommodation.startDate || !accommodation.endDate) continue;

            // 숙박 정보 추가
            const { data: newAccommodation, error: insertAccommodationError } = await supabase
              .from('expense_accommodations')
              .insert({
                expense_id: newExpenseId,
                start_date: formatDateForStorage(accommodation.startDate),
                end_date: formatDateForStorage(accommodation.endDate),
                type: accommodation.type,
                country: accommodation.country,
                hotel_name: accommodation.hotelName,
                paid_by: accommodation.paidBy,
                vat: accommodation.vat ? parseFloat(accommodation.vat) : null,
                total_amount: accommodation.totalAmount ? parseFloat(accommodation.totalAmount) : null
              });

            if (insertAccommodationError) {
              console.error('숙박비 정보 저장 오류:', insertAccommodationError);
              toast.error('숙박비 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }

        // 5. 접대비 정보 저장
        if (formData.entertainment.length > 0) {
          const entertainmentToInsert = formData.entertainment
            .filter(item => item.date) // 날짜가 있는 항목만 필터링
            .map(item => ({
              expense_id: newExpenseId,
              date: item.date ? formatDateForStorage(item.date) : null,
              type: item.type,
              country: item.country,
              company_name: item.companyName,
              paid_by: item.paidBy,
              vat: item.vat ? parseFloat(item.vat) : null,
              amount: item.totalAmount ? parseFloat(item.totalAmount) : null
            }));

          if (entertainmentToInsert.length > 0) {
            const { error: insertEntertainmentError } = await supabase
              .from('expense_entertainment')
              .insert(entertainmentToInsert);

            if (insertEntertainmentError) {
              console.error('접대비 정보 저장 오류:', insertEntertainmentError);
              toast.error('접대비 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }

        // 6. 기타 금액 정보 저장
        if (formData.miscellaneous.length > 0) {
          const miscellaneousToInsert = formData.miscellaneous
            .filter(item => item.date) // 날짜가 있는 항목만 필터링
            .map(item => ({
              expense_id: newExpenseId,
              date: item.date ? formatDateForStorage(item.date) : null,
              type: item.type,
              country: item.country,
              company_name: item.companyName,
              paid_by: item.paidBy,
              vat: item.vat ? parseFloat(item.vat) : null,
              amount: item.totalAmount ? parseFloat(item.totalAmount) : null,
              description: item.description
            }));

          if (miscellaneousToInsert.length > 0) {
            const { error: insertMiscellaneousError } = await supabase
              .from('expense_miscellaneous')
              .insert(miscellaneousToInsert);

            if (insertMiscellaneousError) {
              console.error('기타 금액 정보 저장 오류:', insertMiscellaneousError);
              toast.error('기타 금액 정보 저장 중 오류가 발생했습니다.');
              return;
            }
          }
        }

        toast.success(t('expense.summary.saveSuccess'));
      }

      // 세션 스토리지 데이터 정리
      sessionStorage.removeItem('expenseFormData');
      sessionStorage.removeItem('expenseEditMode');
      sessionStorage.removeItem('expenseEditId');
      sessionStorage.removeItem('expenseEditComplete');

      // 저장 성공 시 경비 조회 페이지로 이동
      router.push(`/${locale}/expense-list`);
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error(t('expense.summary.saveError'));
    } finally {
      setIsSaving(false);
    }
  }

  // 뒤로 가기 함수
  const handleBack = () => {
    router.back();
  };

  // 편집하기 버튼 클릭 핸들러 함수 수정
  const handleEdit = () => {
    if (!formData) return;
    
    // 세션 스토리지에 현재 폼 데이터 저장
    const dataToSave = { ...formData };
    
    // calculatedTotals 객체에서 mealAllowanceInfo와 dailyAllowances 추출
    if (formData.calculatedTotals) {
      // calculatedTotals가 문자열인 경우 파싱
      if (typeof formData.calculatedTotals === 'string') {
        try {
          const parsed = JSON.parse(formData.calculatedTotals);
          if (parsed.mealAllowanceInfo) {
            dataToSave.mealAllowanceInfo = parsed.mealAllowanceInfo;
          }
          if (parsed.dailyAllowances) {
            dataToSave.dailyAllowances = parsed.dailyAllowances;
          }
        } catch (e) {
          console.error('calculatedTotals 파싱 오류:', e);
        }
        } else {
        // 객체인 경우 직접 접근
        if (formData.calculatedTotals.mealAllowanceInfo) {
          dataToSave.mealAllowanceInfo = formData.calculatedTotals.mealAllowanceInfo;
        }
        if (formData.calculatedTotals.dailyAllowances) {
          dataToSave.dailyAllowances = formData.calculatedTotals.dailyAllowances;
        }
      }
    }
    
    sessionStorage.setItem('expenseFormData', JSON.stringify(dataToSave));
    
    // 편집 모드로 설정 (ID 저장)
        if (expenseId) {
          sessionStorage.setItem('expenseEditId', expenseId);
    }
    
    // 입력 페이지로 이동
    router.push(`/${locale}/business-expense`);
  };

  // PDF 저장 기능 구현
  const handleSavePdf = async () => {
    try {
      setIsSaving(true);

      const doc = (
        <Document>
          {/* 1페이지: Reisekostenabrechnung */}
          <Page size="A4" style={styles.page}>
            <Header text={formData?.headerText || ''} />
            <PDFView style={styles.content}>
              <PDFText style={styles.title}>Reisekostenabrechnung</PDFText>
              <PDFView style={styles.divider} />

              {/* 1. Persönliche Daten */}
              <PDFView style={styles.section}>
                <PDFText style={styles.subtitle}>1. Persönliche Daten</PDFText>
                <PDFView style={styles.contentGroup}>
                  <PDFView style={styles.row}>
                    <PDFText style={styles.label}>Name</PDFText>
                    <PDFText style={styles.value}>{formData?.name || '-'}</PDFText>
                  </PDFView>
                  <PDFView style={styles.row}>
                    <PDFText style={styles.label}>Firma</PDFText>
                    <PDFText style={styles.value}>{accountInfo?.company_name || '-'}</PDFText>
                  </PDFView>
                  <PDFView style={styles.row}>
                    <PDFText style={styles.label}>Stadt</PDFText>
                    <PDFText style={styles.value}>{accountInfo?.city || '-'}</PDFText>
                  </PDFView>
                </PDFView>
              </PDFView>

              {/* 2. Reisedaten */}
              <PDFView style={styles.section}>
                <PDFText style={styles.subtitle}>2. Reisedaten</PDFText>
                <PDFView style={styles.contentGroup}>
                  <PDFView style={styles.rowGroup}>
                    <PDFView style={{ flex: 1 }}>
                      <PDFView style={styles.row}>
                        <PDFText style={styles.label}>Beginn der Reise</PDFText>
                        <PDFText style={styles.value}>{formatSafeDate(formData?.startDate)}</PDFText>
                      </PDFView>
                    </PDFView>
                    <PDFView style={{ flex: 1 }}>
                      <PDFView style={styles.row}>
                        <PDFText style={styles.label}>Startuhrzeit</PDFText>
                        <PDFText style={styles.value}>{formatTime(formData?.startTime)}</PDFText>
                      </PDFView>
                    </PDFView>
                  </PDFView>
                  
                  <PDFView style={styles.rowGroup}>
                    <PDFView style={{ flex: 1 }}>
                      <PDFView style={styles.row}>
                        <PDFText style={styles.label}>Ende der Reise</PDFText>
                        <PDFText style={styles.value}>{formatSafeDate(formData?.endDate)}</PDFText>
                      </PDFView>
                    </PDFView>
                    <PDFView style={{ flex: 1 }}>
                      <PDFView style={styles.row}>
                        <PDFText style={styles.label}>Enduhrzeit</PDFText>
                        <PDFText style={styles.value}>{formatTime(formData?.endTime)}</PDFText>
                      </PDFView>
                    </PDFView>
                  </PDFView>
                </PDFView>

                {/* 방문한 장소 목록 */}
                <PDFView style={styles.visitedPlacesContainer}>
                  <PDFText style={{ fontSize: 10.8, marginBottom: 8 }}>Besuchte Orte</PDFText>
                  {formData?.visits?.map((visit, index) => (
                    <PDFView key={index} style={{ marginBottom: 5, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 3 }}>
                      <PDFText style={styles.visitedPlace}>
                        {formatSafeDate(visit.date)} - {visit.companyName} {visit.city} {visit.description}
                      </PDFText>
                    </PDFView>
                  ))}
                </PDFView>
              </PDFView>

              {/* 3. Kostenübersicht */}
              <PDFView style={styles.section}>
                <PDFText style={styles.subtitle}>3. Kostenübersicht</PDFText>
                <PDFView style={styles.contentGroup}>
                  <PDFView style={styles.row}>
                    <PDFText style={styles.label}>Fahrtkosten</PDFText>
                    <PDFText style={styles.value}>
                      {formatEuro(getCalculatedTotal(formData, 'transportation'), false)}
                    </PDFText>
                  </PDFView>
                  <PDFView style={styles.row}>
                    <PDFText style={styles.label}>Bewirtungskosten</PDFText>
                    <PDFText style={styles.value}>
                      {formatEuro(getCalculatedTotal(formData, 'entertainment'), false)}
                    </PDFText>
                  </PDFView>
                  <PDFView style={styles.row}>
                    <PDFText style={styles.label}>Übernachtungskosten</PDFText>
                    <PDFText style={styles.value}>
                      {formatEuro(getCalculatedTotal(formData, 'accommodation'), false)}
                    </PDFText>
                  </PDFView>
                  <PDFView style={styles.row}>
                    <PDFText style={styles.label}>Verpflegungsmehraufwand</PDFText>
                    <PDFText style={styles.value}>
                      {formatEuro(formData?.calculatedTotals?.mealAllowance?.amount || 0, false)}
                    </PDFText>
                  </PDFView>
                  <PDFView style={styles.row}>
                    <PDFText style={styles.label}>Sonstige Kosten</PDFText>
                    <PDFText style={styles.value}>
                      {formatEuro(getCalculatedTotal(formData, 'miscellaneous'), false)}
                    </PDFText>
                  </PDFView>
                </PDFView>
                
                {/* 총 비용 */}
                <PDFView style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 5,
                  marginTop: 5,
                  borderTopWidth: 2,
                  borderTopColor: '#000000',
                }}>
                  <PDFText style={{ 
                    flex: 1, 
                    fontSize: 11.7, 
                    fontWeight: 'bold' 
                  }}>Gesamtbetrag</PDFText>
                  <PDFText style={{ 
                    fontSize: 11.7, 
                    fontWeight: 'bold',
                    textAlign: 'right'
                  }}>
                    {formatEuro(
                      getCalculatedTotal(formData, 'transportation') +
                      getCalculatedTotal(formData, 'entertainment') +
                      getCalculatedTotal(formData, 'accommodation') +
                      getCalculatedTotal(formData, 'miscellaneous') +
                      (typeof formData?.calculatedTotals === 'string'
                        ? JSON.parse(formData.calculatedTotals).mealAllowance?.amount || 0
                        : formData?.calculatedTotals?.mealAllowance?.amount || 0),
                      false
                    )}
                  </PDFText>
                </PDFView>
              </PDFView>

              {/* 서명란 */}
              <PDFView style={styles.signatureSection}>
                <PDFView style={styles.signatureLine}>
                  <PDFText style={styles.signatureText}>Datum, Unterschrift Reisender</PDFText>
                </PDFView>
                <PDFView style={styles.signatureLine}>
                  <PDFText style={styles.signatureText}>Datum, Unterschrift Vorgesetzter</PDFText>
                </PDFView>
              </PDFView>
            </PDFView>
            <Footer text={formData?.footerText || 'Bridgemakers GmbH'} />
          </Page>

          {/* 2페이지: Buchungsrelevante Ausgaben */}
          <Page size="A4" style={styles.page}>
            <Header text={formData?.headerText || ''} />
            <PDFView style={styles.content}>
              <PDFText style={styles.title}>Buchungsrelevante Ausgaben</PDFText>
              <PDFView style={styles.divider} />

              {/* 1. Transportkosten */}
              <PDFView style={styles.section}>
                <PDFText style={styles.subtitle}>1. Transportkosten</PDFText>
                <PDFView style={styles.table}>
                  {formData?.transportation?.filter(item => 
                    !isMileageType(item.type)
                  ).map((item, index) => (
                    <PDFView key={index} style={styles.tableRow}>
                      <PDFText style={styles.tableCell}>{formatSafeDate(item.date)}</PDFText>
                      <PDFText style={styles.tableCell}>{item.type}</PDFText>
                      <PDFText style={styles.tableCell}>{item.country}</PDFText>
                      <PDFText style={styles.tableCell}>{formatEuro(Number(item.totalAmount), false)}</PDFText>
                    </PDFView>
                  ))}
                </PDFView>
              </PDFView>

              {/* 2. Übernachtungskosten */}
              <PDFView style={styles.section}>
                <PDFText style={styles.subtitle}>2. Übernachtungskosten</PDFText>
                <PDFView style={styles.table}>
                  {formData?.accommodation?.map((item, index) => (
                    <PDFView key={index} style={styles.tableRow}>
                      <PDFText style={styles.tableCell}>{formatSafeDate(item.startDate)} - {formatSafeDate(item.endDate)}</PDFText>
                      <PDFText style={styles.tableCell}>{item.country}</PDFText>
                      <PDFText style={styles.tableCell}>{formatEuro(Number(item.totalAmount), false)}</PDFText>
                    </PDFView>
                  ))}
                </PDFView>
              </PDFView>

              {/* 3. Sonstige Kosten */}
              <PDFView style={styles.section}>
                <PDFText style={styles.subtitle}>3. Sonstige Kosten</PDFText>
                <PDFView style={styles.table}>
                  {formData?.miscellaneous?.map((item, index) => (
                    <PDFView key={index} style={styles.tableRow}>
                      <PDFText style={styles.tableCell}>{formatSafeDate(item.date)}</PDFText>
                      <PDFText style={styles.tableCell}>{item.description}</PDFText>
                      <PDFText style={styles.tableCell}>{formatEuro(Number(item.totalAmount), false)}</PDFText>
                    </PDFView>
                  ))}
                </PDFView>
              </PDFView>
            </PDFView>
            <Footer text={formData?.footerText || 'Bridgemakers GmbH'} />
          </Page>

          {/* ... 나머지 페이지들 ... */}
        </Document>
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${formData?.name}_expense_report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('PDF 파일이 저장되었습니다.');
    } catch (error) {
      console.error('PDF 생성 중 오류 발생:', error);
      toast.error('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 상태에 따른 스타일 및 텍스트 반환
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'draft':
        return { class: 'bg-gray-100 text-gray-800', text: '임시저장' }
      case 'submitted':
        return { class: 'bg-blue-100 text-blue-800', text: '저장됨' }
      case 'approved':
        return { class: 'bg-green-100 text-green-800', text: '승인됨' }
      case 'rejected':
        return { class: 'bg-red-100 text-red-800', text: '반려됨' }
      default:
        return { class: 'bg-gray-100 text-gray-800', text: status }
    }
  }

  // 비용 계산 함수 수정
  const calculateExpensesByPaymentType = (expenses: any[], isPersonal: boolean = false) => {
    if (!expenses) return 0;

    return expenses.reduce((sum, item) => {
      const amount = parseFloat(item.totalAmount || '0') || 0;
      const shouldCount = item.paidBy === (isPersonal ? 'personal' : 'company');

      if (shouldCount) {
        return sum + amount;
      }
      return sum;
    }, 0);
  };

  // 교통비 계산 로직 수정
  const transportationTotal = {
    company: calculateExpensesByPaymentType(formData?.transportation || [], false),
    personal: calculateExpensesByPaymentType(formData?.transportation || [], true)
  };

  // 숙박비 계산
  const accommodationTotal = {
    company: calculateExpensesByPaymentType(formData?.accommodation || [], false),
    personal: calculateExpensesByPaymentType(formData?.accommodation || [], true)
  };

  // 접대비 계산
  const entertainmentTotal = {
    company: calculateExpensesByPaymentType(formData?.entertainment || [], false),
    personal: calculateExpensesByPaymentType(formData?.entertainment || [], true)
  };

  // 기타 금액 계산
  const miscellaneousTotal = {
    company: calculateExpensesByPaymentType(formData?.miscellaneous || [], false),
    personal: calculateExpensesByPaymentType(formData?.miscellaneous || [], true)
  };

  // 총 금액 계산
  const totalAmount = {
    company: transportationTotal.company + accommodationTotal.company + entertainmentTotal.company + miscellaneousTotal.company,
    personal: transportationTotal.personal + accommodationTotal.personal + entertainmentTotal.personal + miscellaneousTotal.personal,
    mealAllowance: formData?.totalMealAllowance || 0
  };

  if (isLoading || !formData) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 lg:ml-64">
          <div className="p-8">
            <div className="container mx-auto py-6 max-w-4xl">
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500 mr-2" />
                <p>{t('expense.summary.loading')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className="flex-1 lg:ml-64">
        <div className="p-8 bg-white">
          <div className="container mx-auto py-6">
            {/* 상단 버튼 영역 */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isLoading}
                >
                  이전 단계로
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSavePdf}
                  disabled={isLoading || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      PDF 저장 중...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      PDF 저장
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleEdit}
                  disabled={isLoading || isSaving}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  내용 수정하기
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Check className="w-4 h-4 mr-2" />
                  최종 저장
                </Button>
              </div>
            </div>

            {/* 4개의 독일식 문서 */}
            <div ref={contentRef} className="space-y-12">
              {/* Chapter 1: 결제용 정보 (Reisekostenformular) */}
              <div id="payment-section" className="bg-white p-8 rounded-lg shadow">
                <h1 className="text-[14px] font-bold text-center mb-6">Reisekostenabrechnung</h1>
                <div className="border-b-2 border-black mb-8"></div>

                {/* 1. Persönliche Daten */}
                <div className="mb-8">
                  <h2 className="text-[12px] font-bold mb-4">1. Persönliche Daten</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="text-[11px]">Name</span>
                      <span className="text-[11px]">{formData?.name || ''}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="text-[11px]">Firma</span>
                      <span className="text-[11px]">{accountInfo?.company_name || ''}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="text-[11px]">Stadt</span>
                      <span className="text-[11px]">{accountInfo?.city || ''}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Reisedaten */}
                <div className="mb-8">
                  <h2 className="text-[12px] font-bold mb-4">2. Reisedaten</h2>
                  <div className="space-y-4">
                    {/* 시작일/시작시간 */}
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="text-[11px]">Beginn der Reise</span>
                          <span className="text-[11px]">{formData?.startDate ? format(new Date(formData.startDate), 'dd.MM.yyyy') : '-'}</span>
                        </div>
                      </div>
                      <div className="flex-1 ml-8">
                        <div className="flex justify-between">
                          <span className="text-[11px]">Startuhrzeit</span>
                          <span className="text-[11px]">{formatTime(formData?.startTime)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 종료일/종료시간 */}
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="text-[11px]">Ende der Reise</span>
                          <span className="text-[11px]">{formData?.endDate ? format(new Date(formData.endDate), 'dd.MM.yyyy') : '-'}</span>
                        </div>
                      </div>
                      <div className="flex-1 ml-8">
                        <div className="flex justify-between">
                          <span className="text-[11px]">Enduhrzeit</span>
                          <span className="text-[11px]">{formatTime(formData?.endTime)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 방문한 장소 목록 */}
                    <div className="mt-4">
                      <p className="text-[11px] mb-2">Besuchte Orte</p>
                      <div className="space-y-2">
                        {formData.visits?.map((visit, index) => (
                          <div key={index} className="border-b border-gray-200 pb-2">
                            <p className="text-[11px]">
                              {formatSafeDate(visit.date)} - {visit.companyName} {visit.city} {visit.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Kostenübersicht */}
                <div className="mb-8">
                  <h2 className="text-[12px] font-bold mb-4">3. Kostenübersicht</h2>
                  {/* 비용 요약 섹션 수정 */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="text-[11px]">Fahrtkosten</span>
                      <span className="text-[11px]">
                        {formatEuro(
                          getCalculatedTotal(formData, 'transportation'),
                          false
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="text-[11px]">Bewirtungskosten</span>
                      <span className="text-[11px]">
                        {formatEuro(
                          getCalculatedTotal(formData, 'entertainment'),
                          false
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="text-[11px]">Übernachtungskosten</span>
                      <span className="text-[11px]">
                        {formatEuro(
                          getCalculatedTotal(formData, 'accommodation'),
                          false
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="text-[11px]">Verpflegungsmehraufwand</span>
                      <span className="text-[11px]">
                        {formatEuro(
                          formData?.calculatedTotals?.mealAllowance?.amount || 0,
                          false
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                      <span className="text-[11px]">Sonstige Kosten</span>
                      <span className="text-[11px]">
                        {formatEuro(
                          getCalculatedTotal(formData, 'miscellaneous'),
                          false
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t-2 border-black pt-2 font-bold">
                      <span className="text-[11px]">Gesamtbetrag</span>
                      <span className="text-[11px]">
                        {formatEuro(
                          getCalculatedTotal(formData, 'transportation') +
                          getCalculatedTotal(formData, 'entertainment') +
                          getCalculatedTotal(formData, 'accommodation') +
                          getCalculatedTotal(formData, 'miscellaneous') +
                          (typeof formData?.calculatedTotals === 'string'
                            ? JSON.parse(formData.calculatedTotals).mealAllowance?.amount || 0
                            : formData?.calculatedTotals?.mealAllowance?.amount || 0),
                          false
                        )}
                      </span>
                    </div>
                  </div>
                </div>


              </div>

              {/* Chapter 2: 회계용 지출내역 (Buchungsrelevante Ausgaben) */}
              <div id="accounting-section" className="bg-white p-8 rounded-lg shadow">
                <h1 className="text-[14px] font-bold text-center mb-6">Buchungsrelevante Ausgaben</h1>
                <div className="border-b-2 border-black mb-8"></div>

                {/* 1. 교통비 */}
                <div className="mb-8">
                  <h2 className="text-[12px] font-bold mb-4">1. Fahrtkosten</h2>
                  <div className="space-y-4">
                    {/* 일반 교통비 */}
                    <div>
                      <h3 className="text-[11px] font-semibold mb-2">Transportkosten</h3>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left text-[11px] py-2">Datum</th>
                            <th className="text-left text-[11px] py-2">Land</th>
                            <th className="text-left text-[11px] py-2">Art</th>
                            <th className="text-left text-[11px] py-2">Unternehmen</th>
                            <th className="text-left text-[11px] py-2">Zahlung</th>
                            <th className="text-right text-[11px] py-2">USt.</th>
                            <th className="text-right text-[11px] py-2">Betrag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData?.transportation?.filter(item => 
                            item?.type && item.type !== 'mileage' && item.type !== 'km_pauschale'
                          ).map((item, index) => (
                            <tr key={index} className="border-b border-gray-200">
                              <td className="text-[11px] py-2">
                                {item.date ? format(new Date(item.date), 'dd.MM.yyyy') : '-'}
                              </td>
                              <td className="text-[11px] py-2">{item.country || '-'}</td>
                              <td className="text-[11px] py-2">
                                {item.type === 'flight' ? 'Flug' :
                                 item.type === 'train' ? 'Bahn' :
                                 item.type === 'taxi' ? 'Taxi' :
                                 item.type === 'fuel' ? 'Kraftstoff' :
                                 item.type === 'rental' ? 'Mietwagen' : '-'}
                              </td>
                              <td className="text-[11px] py-2">{item.companyName || '-'}</td>
                              <td className="text-[11px] py-2">
                                {item.paidBy === 'company' ? 'Firma' : 
                                 item.paidBy === 'personal' ? 'Privat' : '-'}
                              </td>
                              <td className="text-right text-[11px] py-2">
                                {item.vat ? formatEuro(parseFloat(item.vat), false) : '-'}
                              </td>
                              <td className="text-right text-[11px] py-2">
                                {formatEuro(parseFloat(item.totalAmount || '0'), false)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Kilometerpauschale */}
                    <div>
                      <h3 className="text-[11px] font-semibold mb-2">Kilometerpauschale</h3>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left text-[11px] py-2">Datum</th>
                            <th className="text-left text-[11px] py-2">Kilometer</th>
                            <th className="text-left text-[11px] py-2">Zahlung</th>
                            <th className="text-right text-[11px] py-2">Betrag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData?.transportation?.filter(item => 
                            item.type === 'mileage' || item.type === 'km_pauschale'
                          ).map((item, index) => (
                            <tr key={index} className="border-b border-gray-200">
                              <td className="text-[11px] py-2">
                                {item.date ? format(new Date(item.date), 'dd.MM.yyyy') : '-'}
                              </td>
                              <td className="text-[11px] py-2">{formatNumber(Number(item.mileage || '0'), 2)} km</td>
                              <td className="text-[11px] py-2">Privat</td>
                              <td className="text-right text-[11px] py-2">
                                {formatEuro(Number(item.mileage || '0') * MILEAGE_RATE, false)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 2. 접대비 */}
                <div className="mb-8">
                  <h2 className="text-[12px] font-bold mb-4">2. Bewirtungskosten</h2>
                  <div className="space-y-2">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left text-[11px] py-2">Datum</th>
                          <th className="text-left text-[11px] py-2">Land</th>
                          <th className="text-left text-[11px] py-2">Art</th>
                          <th className="text-left text-[11px] py-2">Unternehmen</th>
                          <th className="text-left text-[11px] py-2">Zahlung</th>
                          <th className="text-right text-[11px] py-2">USt.</th>
                          <th className="text-right text-[11px] py-2">Betrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData?.entertainment?.filter(item => 
                          item.type && ['breakfast', 'lunch', 'dinner'].includes(item.type)
                        ).map((item, index) => (
                          <tr key={index} className="border-b border-gray-200">
                            <td className="text-[11px] py-2">
                              {item.date ? format(new Date(item.date), 'dd.MM.yyyy') : '-'}
                            </td>
                            <td className="text-[11px] py-2">{item.country || '-'}</td>
                            <td className="text-[11px] py-2">
                              {item.type === 'breakfast' ? 'Frühstück' :
                               item.type === 'lunch' ? 'Mittagessen' :
                               item.type === 'dinner' ? 'Abendessen' :
                               item.type === 'other' ? 'Sonstiges' : '-'}
                            </td>
                            <td className="text-[11px] py-2">{item.companyName || '-'}</td>
                            <td className="text-[11px] py-2">
                              {item.paidBy === 'company' ? 'Firma' : 
                               item.paidBy === 'personal' ? 'Privat' : '-'}
                            </td>
                            <td className="text-right text-[11px] py-2">
                              {item.vat ? formatEuro(parseFloat(item.vat), false) : '-'}
                            </td>
                            <td className="text-right text-[11px] py-2">
                              {formatEuro(parseFloat(item.totalAmount || '0'), false)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. 숙박비 */}
                <div className="mb-8">
                  <h2 className="text-[12px] font-bold mb-4">3. Übernachtungskosten</h2>
                  <div className="space-y-4">
                    {/* 호텔 숙박 */}
                    <div>
                      <h3 className="text-[11px] font-semibold mb-2">Hotel</h3>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left text-[11px] py-2">Zeitraum</th>
                            <th className="text-left text-[11px] py-2">Land</th>
                            <th className="text-left text-[11px] py-2">Hotel</th>
                            <th className="text-left text-[11px] py-2">Zahlung</th>
                            <th className="text-right text-[11px] py-2">USt.</th>
                            <th className="text-right text-[11px] py-2">Betrag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData?.accommodation?.filter(item => item.type === 'hotel').map((item, index) => (
                            <tr key={index} className="border-b border-gray-200">
                              <td className="text-[11px] py-2">
                                {item.startDate && dateFormat(new Date(item.startDate), "dd.MM.yy")} - {item.endDate && dateFormat(new Date(item.endDate), "dd.MM.yy")}
                              </td>
                              <td className="text-[11px] py-2">{item.country || '-'}</td>
                              <td className="text-[11px] py-2">{item.hotelName || '-'}</td>
                              <td className="text-[11px] py-2">
                                {item.paidBy === 'company' ? 'Firma' : 
                                 item.paidBy === 'personal' ? 'Privat' : '-'}
                              </td>
                              <td className="text-right text-[11px] py-2">
                                {item.vat ? formatEuro(parseFloat(item.vat), false) : '-'}
                              </td>
                              <td className="text-right text-[11px] py-2">
                                {formatEuro(parseFloat(item.totalAmount || '0'), false)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 개인숙소 */}
                    <div>
                      <h3 className="text-[11px] font-semibold mb-2">Private Unterkunft</h3>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left text-[11px] py-2">Zeitraum</th>
                            <th className="text-left text-[11px] py-2">Land</th>
                            <th className="text-left text-[11px] py-2">Zahlung</th>
                            <th className="text-right text-[11px] py-2">Betrag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData?.accommodation?.filter(item => item.type === 'private').map((item, index) => (
                            <tr key={index} className="border-b border-gray-200">
                              <td className="text-[11px] py-2">
                                {item.startDate && dateFormat(new Date(item.startDate), "dd.MM.yy")} - {item.endDate && dateFormat(new Date(item.endDate), "dd.MM.yy")}
                              </td>
                              <td className="text-[11px] py-2">{item.country || '-'}</td>
                              <td className="text-[11px] py-2">Privat</td>
                              <td className="text-right text-[11px] py-2">
                                {(() => {
                                  if (item.startDate && item.endDate && item.allowanceRate) {
                                    const nights = Math.floor((new Date(item.endDate).getTime() - new Date(item.startDate).getTime()) / (1000 * 60 * 60 * 24));
                                    const amount = nights * item.allowanceRate;
                                    return formatEuro(amount, false);
                                  }
                                  return formatEuro(0, false);
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 4. 기타 비용 */}
                <div className="mb-8">
                  <h2 className="text-[12px] font-bold mb-4">4. Sonstige Kosten</h2>
                  <div className="space-y-2">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left text-[11px] py-2">Datum</th>
                          <th className="text-left text-[11px] py-2">Land</th>
                          <th className="text-left text-[11px] py-2">Art</th>
                          <th className="text-left text-[11px] py-2">Beschreibung</th>
                          <th className="text-left text-[11px] py-2">Zahlung</th>
                          <th className="text-right text-[11px] py-2">USt.</th>
                          <th className="text-right text-[11px] py-2">Betrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData?.miscellaneous?.map((item, index) => (
                          <tr key={index} className="border-b border-gray-200">
                            <td className="text-[11px] py-2">
                              {item.date ? format(new Date(item.date), 'dd.MM.yyyy') : '-'}
                            </td>
                            <td className="text-[11px] py-2">{item.country || '-'}</td>
                            <td className="text-[11px] py-2">{item.type || '-'}</td>
                            <td className="text-[11px] py-2">{item.description || '-'}</td>
                            <td className="text-[11px] py-2">
                              {item.paidBy === 'company' ? 'Firma' : 
                               item.paidBy === 'personal' ? 'Privat' : '-'}
                            </td>
                            <td className="text-right text-[11px] py-2">
                              {item.vat ? formatEuro(parseFloat(item.vat), false) : '-'}
                            </td>
                            <td className="text-right text-[11px] py-2">
                              {formatEuro(parseFloat(item.totalAmount || '0'), false)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Chapter 3: VERPFLEGUNGSMEHRAUFWAND */}
              <div id="meal-allowance-section" className="bg-white p-8 rounded-lg shadow">
                <h1 className="text-[14px] font-bold text-center mb-6">Verpflegungsmehraufwand</h1>
                <div className="border-b-2 border-black mb-8"></div>

                {/* 이동 일정 표시 */}
                <div className="mb-6">
                  <h3 className="text-[13px] font-bold mb-2">Reiserouten</h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-[11px] py-2">Datum</th>
                        <th className="text-left text-[11px] py-2">Art</th>
                        <th className="text-left text-[11px] py-2">Von</th>
                        <th className="text-left text-[11px] py-2">Nach</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(formData?.mealAllowanceInfo || {}).map(([date, schedules]) => (
                        // 각 날짜의 모든 일정을 표시
                        schedules.map((schedule, idx) => (
                          <tr key={`${date}-${idx}`} className="border-b border-gray-200">
                            <td className="text-[11px] py-2">
                              {format(new Date(date), 'dd.MM.yyyy')}
                            </td>
                            <td className="text-[11px] py-2">
                              {schedule.tripType === 'domestic' ? 'Inland' : 'Ausland'}
                            </td>
                            <td className="text-[11px] py-2">
                              {schedule.departureCity} {schedule.departureCountry ? `(${schedule.departureCountry})` : ''}
                            </td>
                            <td className="text-[11px] py-2">
                              {schedule.arrivalCity} {schedule.arrivalCountry ? `(${schedule.arrivalCountry})` : ''}
                            </td>
                          </tr>
                        ))
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 일일 상세 정보 테이블 */}
                <div className="mb-6">
                  <h3 className="text-[13px] font-bold mb-2">Tägliche Details</h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-[11px] py-2">Datum</th>
                        <th className="text-left text-[11px] py-2">Land</th>
                        <th className="text-center text-[11px] py-2">Aufenthalt</th>
                        <th className="text-center text-[11px] py-2">Frühstück</th>
                        <th className="text-center text-[11px] py-2">Mittagessen</th>
                        <th className="text-center text-[11px] py-2">Abendessen</th>
                        <th className="text-right text-[11px] py-2">Tagegeld</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData?.dailyAllowances?.map((allowance, index) => (
                        <tr key={index} className="border-b border-gray-200">
                          <td className="text-[11px] py-2">
                            {allowance.date ? format(new Date(allowance.date), 'dd.MM.yyyy') : '-'}
                          </td>
                          <td className="text-[11px] py-2">{allowance.baseCountry}</td>
                          <td className="text-center text-[11px] py-2">
                            {allowance.stayHours ? `${allowance.stayHours}h` : '-'}
                          </td>
                          <td className="text-center text-[11px] py-2">
                            {allowance.entertainment.breakfast ? 'Ja' : 'Nein'}
                          </td>
                          <td className="text-center text-[11px] py-2">
                            {allowance.entertainment.lunch ? 'Ja' : 'Nein'}
                          </td>
                          <td className="text-center text-[11px] py-2">
                            {allowance.entertainment.dinner ? 'Ja' : 'Nein'}
                          </td>
                          <td className="text-right text-[11px] py-2">
                            {formatEuro(allowance.allowance || 0, false)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-200">
                        <td colSpan={6} className="text-right text-[11px] py-2 font-bold">
                          Gesamt:
                        </td>
                        <td className="text-right text-[11px] py-2 font-bold">
                          {formatEuro(formData?.dailyAllowances?.reduce((sum, allowance) =>
                            sum + (allowance.allowance || 0), 0) || 0, false)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Chapter 4: Belege (영수증) */}
              <div id="receipts-section" className="bg-white p-8 rounded-lg shadow">
                <h1 className="text-[14px] font-bold text-center mb-6">Belege</h1>
                <div className="border-b-2 border-black mb-8"></div>

                <div className="grid grid-cols-2 gap-6">
                  {formData?.receipts?.map((receipt, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-[12px] font-bold">Beleg {index + 1}</h3>
                        <span className="text-[11px] text-gray-500">
                          {receipt.type === 'image' ? 'Bild' : 'PDF'}
                        </span>
            </div>
                      {receipt.type === 'image' ? (
                        <div className="relative aspect-[3/4] w-full">
                          <img
                            src={receipt.url}
                            alt={`Beleg ${index + 1}`}
                            className="object-contain w-full h-full border rounded"
                          />
          </div>
                      ) : (
                        <div className="relative aspect-[3/4] w-full">
                          <iframe
                            src={receipt.url}
                            className="w-full h-full border rounded"
                            title={`Beleg ${index + 1}`}
                          />
                        </div>
                      )}
                      <div className="text-[11px] mt-2">
                        <p>Datum: {receipt.date ? format(new Date(receipt.date), 'dd.MM.yyyy') : '-'}</p>
                        <p>Kategorie: {receipt.category || '-'}</p>
                        <p>Betrag: {formatEuro(receipt.amount || 0, false)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

      // DailyAllowances 계산 함수
      const calculateDailyAllowances = (
      mealAllowanceInfo: {[key: string]: any[] },
      startDate: Date | undefined,
      endDate: Date | undefined,
      startTime: string | undefined,
      endTime: string | undefined,
      entertainment: any[]
): DailyAllowance[] => {
  if (!mealAllowanceInfo || !startDate || !endDate) return [];

      const allowances: DailyAllowance[] = [];
  Object.entries(mealAllowanceInfo).forEach(([date, schedules]) => {
    if (!Array.isArray(schedules) || schedules.length === 0) return;

      const baseCountry = schedules[0]?.departureCountry || schedules[0]?.arrivalCountry || 'DE';
      const stayHours = calculateStayHoursForDate(
      date,
      schedules,
      startDate,
      endDate,
      startTime,
      endTime
      );

    const entertainmentForDate = entertainment.find(e => e.date === date) || {
        breakfast: false,
      lunch: false,
      dinner: false
    };

      const allowance = calculateDailyAllowance(schedules, entertainmentForDate);

      allowances.push({
        date,
        stayHours,
        baseCountry,
        allowance,
        entertainment: {
        breakfast: entertainmentForDate.breakfast || false,
      lunch: entertainmentForDate.lunch || false,
      dinner: entertainmentForDate.dinner || false
      }
    });
  });

      return allowances;
};

      function calculateStayHoursForDate(
      date: string,
      schedules: any[],
      startDate: Date | undefined,
      endDate: Date | undefined,
      startTime: string | undefined,
      endTime: string | undefined
      ): number {
  const currentDate = new Date(date);
  
  // 시작일과 종료일이 없으면 0 반환
  if (!startDate || !endDate) return 0;

  // 현재 날짜가 시작일과 종료일 범위 밖이면 0 반환
  if (currentDate < startDate || currentDate > endDate) return 0;

  // 시작일인 경우
  if (currentDate.getTime() === startDate.getTime()) {
    if (!startTime) return 24;
    const [hours] = startTime.split(':').map(Number);
    return 24 - hours;
  }

  // 종료일인 경우
  if (currentDate.getTime() === endDate.getTime()) {
    if (!endTime) return 24;
    const [hours] = endTime.split(':').map(Number);
    return hours;
  }

  // 중간 날짜인 경우 24시간
  return 24;
}

      function calculateDailyAllowance(
      schedules: any[],
      entertainment: any
      ): number {
  // 기본 일당 금액 (예: 국내 24시간 기준)
  const DEFAULT_DOMESTIC_RATE = 28;
  const DEFAULT_FOREIGN_RATE = 0; // 국가별로 다르게 설정해야 함

  // 식사 공제 비율
  const BREAKFAST_REDUCTION = 0.2; // 20%
  const LUNCH_REDUCTION = 0.4;     // 40%
  const DINNER_REDUCTION = 0.4;    // 40%

  let baseRate = DEFAULT_DOMESTIC_RATE;
  
  // 해외 일정이 있는 경우 해당 국가의 일당 적용
  const foreignSchedule = schedules.find(s => s.tripType === 'foreign');
  if (foreignSchedule) {
    baseRate = DEFAULT_FOREIGN_RATE; // 실제로는 국가별 요율 적용 필요
  }

  // 식사 제공에 따른 공제
  let reduction = 0;
  if (entertainment.breakfast) reduction += baseRate * BREAKFAST_REDUCTION;
  if (entertainment.lunch) reduction += baseRate * LUNCH_REDUCTION;
  if (entertainment.dinner) reduction += baseRate * DINNER_REDUCTION;

  return Math.max(0, baseRate - reduction);
} 