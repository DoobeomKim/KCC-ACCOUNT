import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log('🌐 [1. 루트 레이아웃] 렌더링 시작');
  console.log('🌐 [1. 루트 레이아웃] 렌더링 완료');
  return children;
}
