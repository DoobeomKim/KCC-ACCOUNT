import { ImageResponse } from 'next/og'

// Next.js의 메타데이터 API를 위한 아이콘 구성
export const metadata = {
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
}

// Next.js에서 필요로 하는 default export 함수 추가
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'black', color: 'white', fontSize: '24px' }}>
        KCC
      </div>
    ),
    {
      width: 32,
      height: 32,
    }
  )
} 