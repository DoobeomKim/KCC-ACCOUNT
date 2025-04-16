import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { locales, defaultLocale } from '@/i18n/settings';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import MobileHeader from '@/components/layout/MobileHeader';
import Sidebar from '@/components/layout/Sidebar';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });

// 정적 경로 생성
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// 메타데이터 생성
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  console.log('🌐 [2. 메타데이터] 메타데이터 생성 시작');
  // params를 await로 처리
  const { locale } = await params;
  console.log('🌐 [2. 메타데이터] 사용 로케일:', locale);

  if (!validateLocale(locale)) {
    console.log('🌐 [2. 메타데이터] 유효하지 않은 로케일');
    return {
      title: 'Not Found',
    };
  }

  console.log('🌐 [2. 메타데이터] 메타데이터 생성 완료');
  return {
    title: 'KCC Account',
    description: 'KCC Account Management System',
  };
}

// 메시지 로드 함수
async function loadMessages(locale: string) {
  console.log('🌐 [3. 로케일 레이아웃] 메시지 로드 시작:', locale);
  try {
    const messages = (await import(`@/messages/${locale}.json`)).default;
    console.log('🌐 [3. 로케일 레이아웃] 메시지 로드 성공');
    return messages;
  } catch (error) {
    console.error('🌐 [3. 로케일 레이아웃] 메시지 로드 실패:', error);
    return null;
  }
}

// 로케일 유효성 검사
function validateLocale(locale: string | undefined): locale is string {
  const isValid = !!(locale && locales.includes(locale as any));
  console.log('🌐 [3. 로케일 레이아웃] 로케일 유효성 검사:', locale, isValid ? '유효함' : '유효하지 않음');
  return isValid;
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  console.log('🌐 [3. 로케일 레이아웃] 레이아웃 렌더링 시작');
  // params를 await로 처리
  const { locale = defaultLocale } = await params;
  console.log('🌐 [3. 로케일 레이아웃] 사용 로케일:', locale);

  // 로케일 유효성 검사
  if (!validateLocale(locale)) {
    console.log('🌐 [3. 로케일 레이아웃] 유효하지 않은 로케일 -> 404');
    notFound();
  }

  // 메시지 로드
  const messages = await loadMessages(locale);
  if (!messages) {
    console.log('🌐 [3. 로케일 레이아웃] 메시지 없음 -> 404');
    notFound();
  }

  console.log('🌐 [3. 로케일 레이아웃] 레이아웃 렌더링 완료');
  return (
    <html lang={locale}>
      <body className={inter.className}>
        <div suppressHydrationWarning>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <div className="min-h-screen">
              {/* 모바일 헤더 */}
              <MobileHeader />
              
              {/* 데스크톱 사이드바 */}
              <div className="hidden lg:block fixed left-0 top-0 h-screen w-72 bg-gray-900">
                <Sidebar />
              </div>

              <div className="lg:pl-72">
                <main className="min-h-screen w-full">
                  <div className="w-full py-8 px-[5px] mt-16 lg:mt-0">
                    {children}
                  </div>
                </main>
              </div>
            </div>
          </NextIntlClientProvider>
        </div>
      </body>
    </html>
  );
} 