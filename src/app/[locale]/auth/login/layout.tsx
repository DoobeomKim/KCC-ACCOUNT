import { NextIntlClientProvider } from 'next-intl';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <main className="min-h-screen w-full">
        <div className="w-full py-8 px-[5px]">
          {children}
        </div>
      </main>
    </div>
  );
} 